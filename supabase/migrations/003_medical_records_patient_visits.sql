-- Шаг 2 ROADMAP: медицинская карта — записи и история лечения

-- ─── medical_records (аллергии, хронические, противопоказания) ───────────────
CREATE TABLE IF NOT EXISTS public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  record_type text NOT NULL DEFAULT 'general'
    CHECK (record_type IN ('allergy', 'chronic', 'medication', 'contraindication', 'general')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high')),
  is_active boolean NOT NULL DEFAULT true,
  visible_to_patient boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.dental_employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON public.medical_records (patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON public.medical_records (record_type);

COMMENT ON TABLE public.medical_records IS
  'Стационарные мед. факты пациента: аллергии, хронические заболевания, противопоказания.';

-- ─── patient_visits (проведённое лечение по визитам) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.dental_employees (id) ON DELETE SET NULL,
  appointment_id bigint REFERENCES public.appointments (id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  procedure_title text NOT NULL,
  procedure_description text NOT NULL DEFAULT '',
  tooth_numbers integer[] NOT NULL DEFAULT '{}',
  diagnosis text NOT NULL DEFAULT '',
  clinical_notes text NOT NULL DEFAULT '',
  materials text NOT NULL DEFAULT '',
  price numeric CHECK (price IS NULL OR price >= 0),
  visible_to_patient boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_visits_patient ON public.patient_visits (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_doctor ON public.patient_visits (doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_appointment ON public.patient_visits (appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_date ON public.patient_visits (visit_date DESC);

COMMENT ON TABLE public.patient_visits IS
  'История лечения: процедуры, диагнозы и материалы по каждому визиту.';

-- ─── updated_at triggers ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS medical_records_set_updated_at ON public.medical_records;
CREATE TRIGGER medical_records_set_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS patient_visits_set_updated_at ON public.patient_visits;
CREATE TRIGGER patient_visits_set_updated_at
  BEFORE UPDATE ON public.patient_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ─── RLS: medical_records ────────────────────────────────────────────────────
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_records_select_authenticated ON public.medical_records;
DROP POLICY IF EXISTS medical_records_insert_authenticated ON public.medical_records;
DROP POLICY IF EXISTS medical_records_update_authenticated ON public.medical_records;
DROP POLICY IF EXISTS medical_records_delete_authenticated ON public.medical_records;

CREATE POLICY medical_records_select_authenticated
  ON public.medical_records FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      AND visible_to_patient = true
      AND is_active = true
    )
  );

CREATE POLICY medical_records_insert_authenticated
  ON public.medical_records FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR public.is_staff_user()
  );

CREATE POLICY medical_records_update_authenticated
  ON public.medical_records FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY medical_records_delete_authenticated
  ON public.medical_records FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

-- ─── RLS: patient_visits ─────────────────────────────────────────────────────
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_visits_select_authenticated ON public.patient_visits;
DROP POLICY IF EXISTS patient_visits_insert_authenticated ON public.patient_visits;
DROP POLICY IF EXISTS patient_visits_update_authenticated ON public.patient_visits;
DROP POLICY IF EXISTS patient_visits_delete_authenticated ON public.patient_visits;

CREATE POLICY patient_visits_select_authenticated
  ON public.patient_visits FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      AND visible_to_patient = true
    )
  );

CREATE POLICY patient_visits_insert_authenticated
  ON public.patient_visits FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY patient_visits_update_authenticated
  ON public.patient_visits FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY patient_visits_delete_authenticated
  ON public.patient_visits FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

NOTIFY pgrst, 'reload schema';
