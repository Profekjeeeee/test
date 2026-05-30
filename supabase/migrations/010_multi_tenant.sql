-- Шаг 11 ROADMAP EXTENSION: подготовка к мультитенантности
-- clinics + clinic_settings, clinic_id на бизнес-таблицах, RLS изоляция

-- ─── Константа дефолтной клиники (single-tenant / legacy backfill) ───────────
-- UUID фиксирован для идемпотентного seed и .env

-- ─── clinics ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL,
  name        text        NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_clinics_slug ON public.clinics (slug);
CREATE INDEX IF NOT EXISTS idx_clinics_active ON public.clinics (is_active) WHERE is_active = true;

COMMENT ON TABLE public.clinics IS 'Тенант: стоматологическая клиника на платформе.';

-- ─── clinic_settings (1:1) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  clinic_id              uuid        PRIMARY KEY REFERENCES public.clinics (id) ON DELETE CASCADE,
  display_name           text        NOT NULL DEFAULT '',
  tagline                text        NOT NULL DEFAULT '',
  logo_url               text        NOT NULL DEFAULT '',
  primary_color          text        NOT NULL DEFAULT '#2563EB',
  accent_color           text        NOT NULL DEFAULT '#1D4ED8',
  address_line1          text        NOT NULL DEFAULT '',
  address_line2          text        NOT NULL DEFAULT '',
  city                   text        NOT NULL DEFAULT '',
  postal_code            text        NOT NULL DEFAULT '',
  metro_hint             text        NOT NULL DEFAULT '',
  phone                  text        NOT NULL DEFAULT '',
  whatsapp               text        NOT NULL DEFAULT '',
  email                  text        NOT NULL DEFAULT '',
  map_embed_url          text        NOT NULL DEFAULT '',
  working_hours          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  booking_slots          jsonb       NOT NULL DEFAULT '{"startHour":9,"endHour":17,"stepMinutes":30}'::jsonb,
  timezone               text        NOT NULL DEFAULT 'Europe/Moscow',
  tz_offset              text        NOT NULL DEFAULT '+03:00',
  telegram_bot_username  text        NOT NULL DEFAULT '',
  telegram_mini_app_url  text        NOT NULL DEFAULT '',
  locale                 text        NOT NULL DEFAULT 'ru',
  metadata               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_settings IS
  'Брендинг, контакты, расписание и Telegram Mini App для клиники.';
COMMENT ON COLUMN public.clinic_settings.booking_slots IS
  'JSON: startHour, endHour, stepMinutes — слоты онлайн-записи.';
COMMENT ON COLUMN public.clinic_settings.working_hours IS
  'JSON-массив: [{ "day": "Пн — Пт", "hours": "09:00 — 20:00" }, ...].';

-- Дефолтная клиника
INSERT INTO public.clinics (id, slug, name, is_active)
VALUES (
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'default',
  'DentalCare Demo',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinic_settings (
  clinic_id,
  display_name,
  tagline,
  address_line1,
  address_line2,
  city,
  postal_code,
  metro_hint,
  phone,
  whatsapp,
  email,
  working_hours,
  booking_slots,
  timezone,
  tz_offset
)
VALUES (
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'Стоматология DentalCare',
  'Личный кабинет пациента',
  'ул. Ленина, 42, офис 301',
  'Новосибирск, 630099',
  'Новосибирск',
  '630099',
  'Метро «Площадь Ленина», 5 мин пешком',
  '+73833000000',
  '73833000000',
  'info@dentalcare.demo',
  '[
    {"day":"Пн — Пт","hours":"09:00 — 20:00"},
    {"day":"Суббота","hours":"10:00 — 17:00"},
    {"day":"Воскресенье","hours":"Выходной"}
  ]'::jsonb,
  '{"startHour":9,"endHour":17,"stepMinutes":30}'::jsonb,
  'Asia/Novosibirsk',
  '+07:00'
)
ON CONFLICT (clinic_id) DO NOTHING;

-- default_clinic_id — до ADD COLUMN (не ссылается на clinic_id в таблицах)
CREATE OR REPLACE FUNCTION public.default_clinic_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT 'c0000000-0000-4000-8000-000000000001'::uuid;
$$;

REVOKE ALL ON FUNCTION public.default_clinic_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.default_clinic_id() TO authenticated, anon;

-- ─── Добавление clinic_id ────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'dental_clients', 'dental_employees', 'doctors', 'services', 'appointments',
    'chat_messages', 'doctor_rooms', 'doctor_messages',
    'bills', 'treatment_plan_items', 'medical_records', 'patient_visits',
    'patient_files', 'payments', 'patient_metrics', 'marketing_campaigns',
    'doctor_metrics', 'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT',
      t
    );
    EXECUTE format(
      'UPDATE public.%I SET clinic_id = public.default_clinic_id() WHERE clinic_id IS NULL',
      t
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN clinic_id SET NOT NULL',
      t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_clinic ON public.%I (clinic_id)',
      t, t
    );
  END LOOP;
END $$;

-- campaign_deliveries — через кампанию; для простоты RLS добавим clinic_id
ALTER TABLE public.campaign_deliveries
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics (id) ON DELETE RESTRICT;

UPDATE public.campaign_deliveries cd
SET clinic_id = mc.clinic_id
FROM public.marketing_campaigns mc
WHERE cd.campaign_id = mc.id
  AND cd.clinic_id IS NULL;

UPDATE public.campaign_deliveries
SET clinic_id = public.default_clinic_id()
WHERE clinic_id IS NULL;

ALTER TABLE public.campaign_deliveries
  ALTER COLUMN clinic_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_clinic
  ON public.campaign_deliveries (clinic_id);

-- Уникальность телефона в рамках клиники
ALTER TABLE public.dental_clients DROP CONSTRAINT IF EXISTS dental_clients_phone_key;
DROP INDEX IF EXISTS public.dental_clients_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_clients_clinic_phone
  ON public.dental_clients (clinic_id, phone);

ALTER TABLE public.dental_employees DROP CONSTRAINT IF EXISTS dental_employees_phone_key;
DROP INDEX IF EXISTS public.dental_employees_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_employees_clinic_phone
  ON public.dental_employees (clinic_id, phone);

-- telegram_id уникален в рамках клиники (в 001 — UNIQUE constraint, не отдельный index)
ALTER TABLE public.dental_clients DROP CONSTRAINT IF EXISTS dental_clients_telegram_id_key;
ALTER TABLE public.dental_employees DROP CONSTRAINT IF EXISTS dental_employees_telegram_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_clients_clinic_telegram
  ON public.dental_clients (clinic_id, telegram_id)
  WHERE telegram_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_employees_clinic_telegram
  ON public.dental_employees (clinic_id, telegram_id)
  WHERE telegram_id IS NOT NULL;

-- ─── Хелперы тенанта (после ADD COLUMN clinic_id) ────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.clinic_id
  FROM public.dental_employees e
  WHERE auth.uid() IS NOT NULL
    AND e.auth_user_id = auth.uid()
  ORDER BY CASE WHEN e.role = 'admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.client_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.clinic_id
  FROM public.dental_clients c
  WHERE auth.uid() IS NOT NULL
    AND (
      c.auth_user_id = auth.uid()
      OR (
        c.id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND lower(c.id::text) = auth.uid()::text
      )
    )
  ORDER BY CASE WHEN c.auth_user_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.staff_clinic_id(), public.client_clinic_id());
$$;

CREATE OR REPLACE FUNCTION public.same_user_clinic(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_clinic_id IS NOT NULL
    AND public.user_clinic_id() IS NOT NULL
    AND p_clinic_id IS NOT DISTINCT FROM public.user_clinic_id();
$$;

COMMENT ON FUNCTION public.user_clinic_id IS
  'Клиника текущего auth-пользователя (сотрудник или пациент).';

REVOKE ALL ON FUNCTION public.staff_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_clinic_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.same_user_clinic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_user_clinic(uuid) TO authenticated;

-- ─── Триггер: подстановка clinic_id при INSERT ───────────────────────────────
CREATE OR REPLACE FUNCTION public.set_row_clinic_id_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := COALESCE(public.user_clinic_id(), public.default_clinic_id());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'dental_clients', 'dental_employees', 'doctors', 'services', 'appointments',
    'chat_messages', 'doctor_rooms', 'bills', 'treatment_plan_items',
    'medical_records', 'patient_visits', 'patient_files', 'payments',
    'marketing_campaigns'
  ];
  trg_name text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    trg_name := 'set_clinic_id_' || t;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trg_name, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_row_clinic_id_default()',
      trg_name, t
    );
  END LOOP;
END $$;

-- ─── doctor_can_access_patient: только та же клиника ───────────────────────
CREATE OR REPLACE FUNCTION public.doctor_can_access_patient(p_patient_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    INNER JOIN public.dental_employees e
      ON e.id::text IS NOT DISTINCT FROM a.doctor_id::text
    INNER JOIN public.dental_clients c
      ON c.id::text IS NOT DISTINCT FROM a.client_id::text
    WHERE e.auth_user_id = auth.uid()
      AND e.role = 'doctor'
      AND c.id::text IS NOT DISTINCT FROM p_patient_id
      AND c.clinic_id IS NOT DISTINCT FROM e.clinic_id
      AND a.clinic_id IS NOT DISTINCT FROM e.clinic_id
  );
$$;

-- ─── phone_digits_normalized (если 001_master не применялся) ─────────────────
CREATE OR REPLACE FUNCTION public.phone_digits_normalized(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
BEGIN
  IF d IS NULL OR d = '' THEN RETURN ''; END IF;
  IF substring(d FROM 1 FOR 1) = '8' THEN d := '7' || substring(d FROM 2); END IF;
  IF substring(d FROM 1 FOR 1) <> '7' THEN d := '7' || d; END IF;
  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.phone_digits_normalized(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phone_digits_normalized(text) TO authenticated;

-- ─── chat_staff_can_read_row: привязка к клинике ─────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_staff_can_read_row(
  p_sender_id text, p_recipient_id text, p_chat_type text, p_sender_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp public.dental_employees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO emp FROM public.dental_employees e WHERE e.auth_user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF emp.role = 'admin' THEN RETURN TRUE; END IF;
  IF emp.role <> 'doctor' THEN RETURN FALSE; END IF;
  IF p_chat_type = 'support' THEN RETURN FALSE; END IF;
  IF p_chat_type = 'doctor' THEN
    RETURN phone_digits_normalized(p_sender_id) = phone_digits_normalized(emp.phone)
      OR phone_digits_normalized(p_recipient_id) = phone_digits_normalized(emp.phone)
      OR p_sender_id IS NOT DISTINCT FROM emp.id::text
      OR p_recipient_id IS NOT DISTINCT FROM emp.id::text;
  END IF;
  IF p_chat_type <> 'clinic' THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id::text IS NOT DISTINCT FROM emp.id::text
      AND a.clinic_id IS NOT DISTINCT FROM emp.clinic_id
      AND (
        a.client_id::text IS NOT DISTINCT FROM p_sender_id
        OR a.client_id::text IS NOT DISTINCT FROM p_recipient_id
      )
  ) OR (
    p_sender_role = 'doctor'
    AND (
      phone_digits_normalized(p_sender_id) IS NOT DISTINCT FROM phone_digits_normalized(emp.phone)
      OR p_sender_id IS NOT DISTINCT FROM emp.id::text
    )
  );
END;
$$;

-- ─── RLS: clinics / clinic_settings ──────────────────────────────────────────
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinics_select_active ON public.clinics;
CREATE POLICY clinics_select_active ON public.clinics
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS clinic_settings_select ON public.clinic_settings;
CREATE POLICY clinic_settings_select ON public.clinic_settings
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.is_active = true
    )
  );

-- ─── Обновление ключевых RLS (изоляция по clinic_id) ─────────────────────────

-- dental_clients
DROP POLICY IF EXISTS dental_clients_select_authenticated ON public.dental_clients;
CREATE POLICY dental_clients_select_authenticated ON public.dental_clients
  FOR SELECT TO authenticated
  USING (
    (
      public.subject_client_pk() IS NOT NULL
      AND id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR (
      public.is_staff_user()
      AND public.same_user_clinic(clinic_id)
    )
  );

DROP POLICY IF EXISTS dental_clients_insert_authenticated ON public.dental_clients;
CREATE POLICY dental_clients_insert_authenticated ON public.dental_clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_user()
    OR (
      auth_user_id IS NOT NULL
      AND auth_user_id = auth.uid()
      AND clinic_id IS NOT DISTINCT FROM COALESCE(public.user_clinic_id(), public.default_clinic_id())
    )
    OR (
      id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND lower(id::text) = auth.uid()::text
      AND clinic_id IS NOT DISTINCT FROM public.default_clinic_id()
    )
  );

DROP POLICY IF EXISTS dental_clients_update_authenticated ON public.dental_clients;
CREATE POLICY dental_clients_update_authenticated ON public.dental_clients
  FOR UPDATE TO authenticated
  USING (
    (
      public.subject_client_pk() IS NOT NULL
      AND id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR (public.is_staff_user() AND public.same_user_clinic(clinic_id))
  )
  WITH CHECK (
    (
      public.subject_client_pk() IS NOT NULL
      AND id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR (public.is_staff_user() AND public.same_user_clinic(clinic_id))
  );

DROP POLICY IF EXISTS dental_clients_delete_authenticated_admin ON public.dental_clients;
CREATE POLICY dental_clients_delete_authenticated_admin ON public.dental_clients
  FOR DELETE TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id));

-- dental_employees
DROP POLICY IF EXISTS dental_employees_select_authenticated ON public.dental_employees;
CREATE POLICY dental_employees_select_authenticated ON public.dental_employees
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS dental_employees_insert_admin ON public.dental_employees;
CREATE POLICY dental_employees_insert_admin ON public.dental_employees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user() AND clinic_id IS NOT DISTINCT FROM public.staff_clinic_id());

DROP POLICY IF EXISTS dental_employees_update_admin ON public.dental_employees;
CREATE POLICY dental_employees_update_admin ON public.dental_employees
  FOR UPDATE TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_admin_user() AND public.same_user_clinic(clinic_id));

DROP POLICY IF EXISTS dental_employees_delete_admin ON public.dental_employees;
CREATE POLICY dental_employees_delete_admin ON public.dental_employees
  FOR DELETE TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id));

-- appointments
DROP POLICY IF EXISTS appointments_select_authenticated ON public.appointments;
CREATE POLICY appointments_select_authenticated ON public.appointments
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND client_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

DROP POLICY IF EXISTS appointments_insert_authenticated ON public.appointments;
CREATE POLICY appointments_insert_authenticated ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND client_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

DROP POLICY IF EXISTS appointments_update_authenticated ON public.appointments;
CREATE POLICY appointments_update_authenticated ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND client_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  )
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND client_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

DROP POLICY IF EXISTS appointments_delete_authenticated ON public.appointments;
CREATE POLICY appointments_delete_authenticated ON public.appointments
  FOR DELETE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND client_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

-- doctors / services
DROP POLICY IF EXISTS doctors_select_authenticated ON public.doctors;
CREATE POLICY doctors_select_authenticated ON public.doctors
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (is_active = true OR public.is_staff_user())
  );

DROP POLICY IF EXISTS doctors_write_admin ON public.doctors;
CREATE POLICY doctors_write_admin ON public.doctors
  FOR ALL TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_admin_user() AND public.same_user_clinic(clinic_id));

DROP POLICY IF EXISTS services_select_authenticated ON public.services;
CREATE POLICY services_select_authenticated ON public.services
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (is_visible = true OR public.is_staff_user())
  );

DROP POLICY IF EXISTS services_write_admin ON public.services;
CREATE POLICY services_write_admin ON public.services
  FOR ALL TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_admin_user() AND public.same_user_clinic(clinic_id));

-- doctor_rooms
DROP POLICY IF EXISTS doctor_rooms_staff_all ON public.doctor_rooms;
CREATE POLICY doctor_rooms_staff_all ON public.doctor_rooms
  FOR ALL TO authenticated
  USING (public.is_staff_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_staff_user() AND public.same_user_clinic(clinic_id));

-- chat_messages — добавляем фильтр клиники в SELECT
DROP POLICY IF EXISTS chat_messages_select_authenticated ON public.chat_messages;
CREATE POLICY chat_messages_select_authenticated ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      (
        public.subject_client_pk() IS NOT NULL
        AND (
          sender_id::text IS NOT DISTINCT FROM public.subject_client_pk()
          OR recipient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
        )
      )
      OR public.chat_staff_can_read_row(sender_id, recipient_id, chat_type, sender_role)
    )
  );

DROP POLICY IF EXISTS chat_messages_insert_authenticated ON public.chat_messages;
CREATE POLICY chat_messages_insert_authenticated ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (
      (
        sender_role = 'client'
        AND public.subject_client_pk() IS NOT NULL
        AND sender_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
      OR (
        sender_role IN ('doctor', 'admin')
        AND EXISTS (
          SELECT 1 FROM public.dental_employees e
          WHERE e.auth_user_id = auth.uid()
            AND e.clinic_id IS NOT DISTINCT FROM clinic_id
            AND (
              (sender_role = 'admin' AND e.role = 'admin' AND sender_id IS NOT DISTINCT FROM e.id::text)
              OR (
                sender_role = 'doctor'
                AND e.role = 'doctor'
                AND (
                  sender_id IS NOT DISTINCT FROM e.id::text
                  OR phone_digits_normalized(sender_id) IS NOT DISTINCT FROM phone_digits_normalized(e.phone)
                )
              )
            )
        )
      )
    )
  );

-- medical_records / patient_visits — фильтр клиники
DROP POLICY IF EXISTS medical_records_select_authenticated ON public.medical_records;
CREATE POLICY medical_records_select_authenticated ON public.medical_records
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient(patient_id::text)
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
        AND visible_to_patient = true
        AND is_active = true
      )
    )
  );

DROP POLICY IF EXISTS medical_records_insert_authenticated ON public.medical_records;
CREATE POLICY medical_records_insert_authenticated ON public.medical_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user() AND public.same_user_clinic(clinic_id));

DROP POLICY IF EXISTS medical_records_update_authenticated ON public.medical_records;
CREATE POLICY medical_records_update_authenticated ON public.medical_records
  FOR UPDATE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  )
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

DROP POLICY IF EXISTS medical_records_delete_authenticated ON public.medical_records;
CREATE POLICY medical_records_delete_authenticated ON public.medical_records
  FOR DELETE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

DROP POLICY IF EXISTS patient_visits_select_authenticated ON public.patient_visits;
CREATE POLICY patient_visits_select_authenticated ON public.patient_visits
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient(patient_id::text)
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
        AND visible_to_patient = true
      )
    )
  );

DROP POLICY IF EXISTS patient_visits_insert_authenticated ON public.patient_visits;
CREATE POLICY patient_visits_insert_authenticated ON public.patient_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

DROP POLICY IF EXISTS patient_visits_update_authenticated ON public.patient_visits;
CREATE POLICY patient_visits_update_authenticated ON public.patient_visits
  FOR UPDATE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  )
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

DROP POLICY IF EXISTS patient_visits_delete_authenticated ON public.patient_visits;
CREATE POLICY patient_visits_delete_authenticated ON public.patient_visits
  FOR DELETE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

-- bills — пересоздаём SELECT/WRITE с клиникой
DROP POLICY IF EXISTS bills_select_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_insert_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_update_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_delete_authenticated ON public.bills;

CREATE POLICY bills_select_authenticated ON public.bills
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient(patient_id::text)
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

CREATE POLICY bills_insert_authenticated ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user() AND public.same_user_clinic(clinic_id));

CREATE POLICY bills_update_authenticated ON public.bills
  FOR UPDATE TO authenticated
  USING (public.is_staff_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_staff_user() AND public.same_user_clinic(clinic_id));

CREATE POLICY bills_delete_authenticated ON public.bills
  FOR DELETE TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id));

-- treatment_plan_items
DROP POLICY IF EXISTS treatment_plan_items_select_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_insert_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_update_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_delete_authenticated ON public.treatment_plan_items;

CREATE POLICY treatment_plan_items_select_authenticated ON public.treatment_plan_items
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient(patient_id::text)
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

CREATE POLICY treatment_plan_items_insert_authenticated ON public.treatment_plan_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user() AND public.same_user_clinic(clinic_id));

CREATE POLICY treatment_plan_items_update_authenticated ON public.treatment_plan_items
  FOR UPDATE TO authenticated
  USING (public.is_staff_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_staff_user() AND public.same_user_clinic(clinic_id));

CREATE POLICY treatment_plan_items_delete_authenticated ON public.treatment_plan_items
  FOR DELETE TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id));

-- CRM / analytics / audit
DROP POLICY IF EXISTS patient_metrics_select ON public.patient_metrics;
CREATE POLICY patient_metrics_select ON public.patient_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dental_clients c
      WHERE c.id::text = patient_id::text
        AND public.same_user_clinic(c.clinic_id)
    )
    AND (
      public.is_admin_user()
      OR public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

DROP POLICY IF EXISTS marketing_campaigns_admin_rw ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_admin_rw ON public.marketing_campaigns
  FOR ALL TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_admin_user() AND public.same_user_clinic(clinic_id));

DROP POLICY IF EXISTS campaign_deliveries_admin_select ON public.campaign_deliveries;
DROP POLICY IF EXISTS campaign_deliveries_admin_insert ON public.campaign_deliveries;
DROP POLICY IF EXISTS campaign_deliveries_admin_update ON public.campaign_deliveries;
DROP POLICY IF EXISTS campaign_deliveries_admin_delete ON public.campaign_deliveries;
CREATE POLICY campaign_deliveries_admin_rw ON public.campaign_deliveries
  FOR ALL TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id))
  WITH CHECK (public.is_admin_user() AND public.same_user_clinic(clinic_id));

DROP POLICY IF EXISTS doctor_metrics_select ON public.doctor_metrics;
CREATE POLICY doctor_metrics_select ON public.doctor_metrics
  FOR SELECT TO authenticated
  USING (
    (public.is_admin_user() OR public.is_staff_user())
    AND public.same_user_clinic(clinic_id)
  );

DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id));

-- patient_files
DROP POLICY IF EXISTS patient_files_select_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_insert_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_update_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_delete_authenticated ON public.patient_files;

CREATE POLICY patient_files_select_authenticated ON public.patient_files
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient(patient_id::text)
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
        AND visible_to_patient = true
      )
    )
  );

CREATE POLICY patient_files_insert_authenticated ON public.patient_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

CREATE POLICY patient_files_update_authenticated ON public.patient_files
  FOR UPDATE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  )
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

CREATE POLICY patient_files_delete_authenticated ON public.patient_files
  FOR DELETE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  );

-- payments
DROP POLICY IF EXISTS payments_select_authenticated ON public.payments;
DROP POLICY IF EXISTS payments_insert_authenticated ON public.payments;
DROP POLICY IF EXISTS payments_update_authenticated ON public.payments;
DROP POLICY IF EXISTS payments_delete_authenticated ON public.payments;

CREATE POLICY payments_select_authenticated ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
      OR public.doctor_can_access_patient(patient_id::text)
    )
  );

CREATE POLICY payments_insert_authenticated ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

CREATE POLICY payments_update_authenticated ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  )
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_admin_user()
      OR public.is_staff_user()
      OR (
        public.subject_client_pk() IS NOT NULL
        AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
  );

CREATE POLICY payments_delete_authenticated ON public.payments
  FOR DELETE TO authenticated
  USING (public.is_admin_user() AND public.same_user_clinic(clinic_id));

NOTIFY pgrst, 'reload schema';
