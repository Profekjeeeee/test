-- Шаг 1 ROADMAP: счета и план лечения в Supabase (вместо localStorage)
-- Совместимость прод-БД: dental_clients.id — uuid; appointments.id — bigint; dental_employees.id — uuid.

-- ─── RLS-хелперы (нужны политикам; CREATE OR REPLACE — безопасно перезапускать) ───
CREATE OR REPLACE FUNCTION public.subject_client_pk()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id::text
  FROM public.dental_clients c
  WHERE auth.uid() IS NOT NULL
    AND (
      c.auth_user_id = auth.uid()
      OR c.id = auth.uid()
    )
  ORDER BY CASE WHEN c.auth_user_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dental_employees e
    WHERE auth.uid() IS NOT NULL
      AND e.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dental_employees e
    WHERE auth.uid() IS NOT NULL
      AND e.auth_user_id = auth.uid()
      AND e.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.subject_client_pk() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subject_client_pk() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- ─── Утилита: врач видит пациента, с которым работал ───────────────────────
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
    WHERE e.auth_user_id = auth.uid()
      AND e.role = 'doctor'
      AND a.client_id::text IS NOT DISTINCT FROM p_patient_id
  );
$$;

COMMENT ON FUNCTION public.doctor_can_access_patient IS
  'Врач видит данные только пациентов, у которых есть приём с этим врачом.';

REVOKE ALL ON FUNCTION public.doctor_can_access_patient(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_can_access_patient(text) TO authenticated;

-- ─── bills ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  appointment_id bigint REFERENCES public.appointments (id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_amount numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
  description text NOT NULL DEFAULT '',
  bill_number text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_patient ON public.bills (patient_id);
CREATE INDEX IF NOT EXISTS idx_bills_appointment ON public.bills (appointment_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills (status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bills_appointment_pending
  ON public.bills (appointment_id)
  WHERE appointment_id IS NOT NULL
    AND status IN ('pending', 'overdue');

COMMENT ON TABLE public.bills IS 'Счета пациентов (ранее dental_bills в localStorage).';

-- ─── treatment_plan_items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.treatment_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.dental_employees (id) ON DELETE SET NULL,
  appointment_id bigint REFERENCES public.appointments (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  planned_date date,
  completed_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatment_plan_patient ON public.treatment_plan_items (patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_doctor ON public.treatment_plan_items (doctor_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_planned ON public.treatment_plan_items (planned_date);

COMMENT ON TABLE public.treatment_plan_items IS
  'Статичные позиции плана лечения (без привязки к записи); записи → appointments.';

-- ─── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bills_set_updated_at ON public.bills;
CREATE TRIGGER bills_set_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS treatment_plan_items_set_updated_at ON public.treatment_plan_items;
CREATE TRIGGER treatment_plan_items_set_updated_at
  BEFORE UPDATE ON public.treatment_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ─── RLS: bills ──────────────────────────────────────────────────────────────
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bills_select_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_insert_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_update_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_delete_authenticated ON public.bills;

CREATE POLICY bills_select_authenticated
  ON public.bills FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY bills_insert_authenticated
  ON public.bills FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY bills_update_authenticated
  ON public.bills FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR public.doctor_can_access_patient(patient_id::text)
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY bills_delete_authenticated
  ON public.bills FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR public.doctor_can_access_patient(patient_id::text)
  );

-- ─── RLS: treatment_plan_items ───────────────────────────────────────────────
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS treatment_plan_items_select_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_insert_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_update_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_delete_authenticated ON public.treatment_plan_items;

CREATE POLICY treatment_plan_items_select_authenticated
  ON public.treatment_plan_items FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY treatment_plan_items_insert_authenticated
  ON public.treatment_plan_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY treatment_plan_items_update_authenticated
  ON public.treatment_plan_items FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY treatment_plan_items_delete_authenticated
  ON public.treatment_plan_items FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

NOTIFY pgrst, 'reload schema';
