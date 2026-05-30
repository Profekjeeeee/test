-- Шаг 6 ROADMAP: CRM — сегментация, метрики пациентов, маркетинговые кампании

-- ─── patient_metrics (кэш метрик и сегмента) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_metrics (
  patient_id uuid PRIMARY KEY REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  total_visits integer NOT NULL DEFAULT 0,
  last_visit_date date,
  days_since_visit integer,
  total_paid numeric NOT NULL DEFAULT 0,
  overdue_debt numeric NOT NULL DEFAULT 0,
  segment_key text NOT NULL DEFAULT 'new'
    CHECK (segment_key IN ('new', 'active', 'at_risk', 'dormant', 'high_value', 'debtor')),
  has_telegram boolean NOT NULL DEFAULT false,
  last_reactivation_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_metrics_segment ON public.patient_metrics (segment_key);
CREATE INDEX IF NOT EXISTS idx_patient_metrics_reactivation ON public.patient_metrics (last_reactivation_at)
  WHERE has_telegram = true;

COMMENT ON TABLE public.patient_metrics IS
  'Агрегированные CRM-метрики пациента; обновляются cron refresh_patient_metrics.';

-- ─── marketing_campaigns ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment_key text
    CHECK (
      segment_key IS NULL
      OR segment_key IN ('new', 'active', 'at_risk', 'dormant', 'high_value', 'debtor')
    ),
  message_template text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'reactivation_auto')),
  min_days_since_visit integer,
  max_sends_per_run integer NOT NULL DEFAULT 30 CHECK (max_sends_per_run > 0 AND max_sends_per_run <= 200),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns (status, trigger_type);

COMMENT ON TABLE public.marketing_campaigns IS
  'Маркетинговые рассылки в Telegram по сегментам пациентов.';

-- ─── campaign_deliveries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  telegram_message_id bigint,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign ON public.campaign_deliveries (campaign_id, status);

-- ─── Обновление метрик и сегмента ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_patient_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_high_value_threshold numeric := 30000;
BEGIN
  INSERT INTO public.patient_metrics (
    patient_id,
    total_visits,
    last_visit_date,
    days_since_visit,
    total_paid,
    overdue_debt,
    segment_key,
    has_telegram,
    updated_at
  )
  SELECT
    c.id::uuid,
    COALESCE(vs.visit_cnt, 0) + COALESCE(asched.apt_cnt, 0),
    GREATEST(vs.last_pv, asched.last_apt),
    CASE
      WHEN GREATEST(vs.last_pv, asched.last_apt) IS NULL THEN NULL
      ELSE (CURRENT_DATE - GREATEST(vs.last_pv, asched.last_apt))::integer
    END,
    COALESCE(pay.total_paid, 0),
    COALESCE(debt.overdue_sum, 0),
    CASE
      WHEN COALESCE(debt.overdue_sum, 0) > 0 THEN 'debtor'
      WHEN GREATEST(vs.last_pv, asched.last_apt) IS NULL
        AND c.created_at >= (now() - interval '30 days') THEN 'new'
      WHEN GREATEST(vs.last_pv, asched.last_apt) IS NULL THEN 'dormant'
      WHEN (CURRENT_DATE - GREATEST(vs.last_pv, asched.last_apt)) > 180 THEN 'dormant'
      WHEN (CURRENT_DATE - GREATEST(vs.last_pv, asched.last_apt)) > 90 THEN 'at_risk'
      WHEN COALESCE(pay.total_paid, 0) >= v_high_value_threshold THEN 'high_value'
      ELSE 'active'
    END,
    (c.telegram_id IS NOT NULL),
    now()
  FROM public.dental_clients c
  LEFT JOIN LATERAL (
    SELECT
      count(*)::integer AS visit_cnt,
      max(pv.visit_date) AS last_pv
    FROM public.patient_visits pv
    WHERE pv.patient_id::text = c.id::text
  ) vs ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*)::integer AS apt_cnt,
      max(a.appointment_date::date) AS last_apt
    FROM public.appointments a
    WHERE a.client_id::text = c.id::text
      AND a.status = 'completed'
  ) asched ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(p.amount), 0) AS total_paid
    FROM public.payments p
    WHERE p.patient_id::text = c.id::text
      AND p.status = 'succeeded'
  ) pay ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(b.amount - b.paid_amount), 0) AS overdue_sum
    FROM public.bills b
    WHERE b.patient_id::text = c.id::text
      AND b.status = 'overdue'
  ) debt ON true
  ON CONFLICT (patient_id) DO UPDATE SET
    total_visits = EXCLUDED.total_visits,
    last_visit_date = EXCLUDED.last_visit_date,
    days_since_visit = EXCLUDED.days_since_visit,
    total_paid = EXCLUDED.total_paid,
    overdue_debt = EXCLUDED.overdue_debt,
    segment_key = EXCLUDED.segment_key,
    has_telegram = EXCLUDED.has_telegram,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_patient_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_patient_metrics() TO authenticated;

-- Демо-кампании возврата (можно отключить в админке)
INSERT INTO public.marketing_campaigns (name, segment_key, message_template, trigger_type, min_days_since_visit, status)
SELECT
  v.name,
  v.segment_key,
  v.message_template,
  v.trigger_type,
  v.min_days_since_visit,
  v.status
FROM (
  VALUES
    (
      'Возврат: 90+ дней без визита',
      'at_risk',
      'Здравствуйте, <b>{{name}}</b>! 👋

Давно не виделись — прошло уже <b>{{days}} дн.</b> с последнего визита.
Запишитесь на профилактический осмотр — это поможет избежать осложнений.',
      'reactivation_auto',
      90,
      'active'
    ),
    (
      'Возврат: спящие пациенты',
      'dormant',
      '<b>{{name}}</b>, мы скучаем! 🦷

Вы не были у нас более <b>{{days}} дн.</b>
Нажмите кнопку ниже — подберём удобное время для визита.',
      'reactivation_auto',
      180,
      'active'
    )
) AS v(name, segment_key, message_template, trigger_type, min_days_since_visit, status)
WHERE NOT EXISTS (SELECT 1 FROM public.marketing_campaigns LIMIT 1);

-- ─── Триггеры updated_at ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS marketing_campaigns_set_updated_at ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaigns_set_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_metrics_select ON public.patient_metrics;
CREATE POLICY patient_metrics_select ON public.patient_metrics FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

DROP POLICY IF EXISTS marketing_campaigns_admin_rw ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_admin_rw ON public.marketing_campaigns
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS campaign_deliveries_admin_select ON public.campaign_deliveries;
CREATE POLICY campaign_deliveries_admin_select ON public.campaign_deliveries
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

NOTIFY pgrst, 'reload schema';
