-- Шаг 15 ROADMAP EXTENSION: SaaS-подготовка
-- Тарифы, подписки, platform admins, онбординг, мониторинг

-- ─── subscription_plans ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text           NOT NULL,
  name           text           NOT NULL,
  description    text           NOT NULL DEFAULT '',
  price_monthly  numeric(10, 2) NOT NULL DEFAULT 0,
  currency       text           NOT NULL DEFAULT 'RUB',
  limits         jsonb          NOT NULL DEFAULT '{}'::jsonb,
  features       jsonb          NOT NULL DEFAULT '[]'::jsonb,
  sort_order     integer        NOT NULL DEFAULT 0,
  is_active      boolean        NOT NULL DEFAULT true,
  created_at     timestamptz    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_subscription_plans_code
  ON public.subscription_plans (code);

COMMENT ON TABLE public.subscription_plans IS 'Тарифные планы SaaS-платформы.';
COMMENT ON COLUMN public.subscription_plans.limits IS
  'JSON: max_doctors, max_patients, ai_enabled, video_enabled, crm_enabled.';

-- ─── clinic_subscriptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_subscriptions (
  clinic_id            uuid        PRIMARY KEY REFERENCES public.clinics (id) ON DELETE CASCADE,
  plan_id              uuid        NOT NULL REFERENCES public.subscription_plans (id),
  status               text        NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'suspended')),
  trial_ends_at        timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end   timestamptz,
  metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_plan
  ON public.clinic_subscriptions (plan_id);

CREATE INDEX IF NOT EXISTS idx_clinic_subscriptions_status
  ON public.clinic_subscriptions (status);

COMMENT ON TABLE public.clinic_subscriptions IS 'Подписка клиники на тарифный план.';

-- ─── platform_admins ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid        UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  email        text        NOT NULL DEFAULT '',
  full_name    text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_email
  ON public.platform_admins (lower(email))
  WHERE email <> '';

COMMENT ON TABLE public.platform_admins IS
  'Super Admin платформы — доступ к /screens/platform и platform API.';

-- ─── clinics: онбординг ──────────────────────────────────────────────────────
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'completed';

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_onboarding_status_check;

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_onboarding_status_check
  CHECK (onboarding_status IN ('draft', 'pending', 'completed'));

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

UPDATE public.clinics
SET
  onboarding_status = 'completed',
  onboarded_at = COALESCE(onboarded_at, created_at)
WHERE slug = 'default';

-- ─── app_logs: clinic_id для мониторинга ─────────────────────────────────────
ALTER TABLE public.app_logs
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_logs_clinic_id
  ON public.app_logs (clinic_id)
  WHERE clinic_id IS NOT NULL;

-- ─── Seed тарифов ────────────────────────────────────────────────────────────
INSERT INTO public.subscription_plans (id, code, name, description, price_monthly, limits, features, sort_order)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'starter',
    'Старт',
    'Для небольшой клиники до 2 врачей',
    9900,
    '{"max_doctors":2,"max_patients":500,"ai_enabled":false,"video_enabled":false,"crm_enabled":true}'::jsonb,
    '["Запись и медкарта","CRM базовый","Telegram Mini App"]'::jsonb,
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'pro',
    'Профи',
    'Полный функционал для растущей клиники',
    24900,
    '{"max_doctors":10,"max_patients":5000,"ai_enabled":true,"video_enabled":true,"crm_enabled":true}'::jsonb,
    '["AI-помощник","Видеоконсультации","KPI и аналитика","Audit trail"]'::jsonb,
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000003'::uuid,
    'enterprise',
    'Enterprise',
    'Без ограничений + приоритетная поддержка',
    49900,
    '{"max_doctors":999,"max_patients":999999,"ai_enabled":true,"video_enabled":true,"crm_enabled":true}'::jsonb,
    '["White-label","SLA","Кастомные интеграции","Dedicated support"]'::jsonb,
    3
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- Подписка default-клиники
INSERT INTO public.clinic_subscriptions (clinic_id, plan_id, status, current_period_end)
VALUES (
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'a0000000-0000-4000-8000-000000000002'::uuid,
  'active',
  now() + interval '1 year'
)
ON CONFLICT (clinic_id) DO NOTHING;

-- ─── is_platform_admin() ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.auth_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ─── clinic_plan_limits() — лимиты текущего плана клиники ────────────────────
CREATE OR REPLACE FUNCTION public.clinic_plan_limits(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sp.limits, '{}'::jsonb)
  FROM public.clinic_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.clinic_id = p_clinic_id
    AND cs.status IN ('trial', 'active')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.clinic_plan_limits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clinic_plan_limits(uuid) TO authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_select ON public.subscription_plans;
CREATE POLICY subscription_plans_select ON public.subscription_plans
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS clinic_subscriptions_select_staff ON public.clinic_subscriptions;
CREATE POLICY clinic_subscriptions_select_staff ON public.clinic_subscriptions
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.same_user_clinic(clinic_id)
  );

DROP POLICY IF EXISTS platform_admins_select_self ON public.platform_admins;
CREATE POLICY platform_admins_select_self ON public.platform_admins
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_platform_admin());

-- clinic_settings UPDATE для админа клиники
DROP POLICY IF EXISTS clinic_settings_update_admin ON public.clinic_settings;
CREATE POLICY clinic_settings_update_admin ON public.clinic_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_admin_user() AND public.same_user_clinic(clinic_id));

-- clinics SELECT для platform admin (все клиники)
DROP POLICY IF EXISTS clinics_select_platform_admin ON public.clinics;
CREATE POLICY clinics_select_platform_admin ON public.clinics
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

NOTIFY pgrst, 'reload schema';
