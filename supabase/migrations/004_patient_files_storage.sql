-- Шаг 3 ROADMAP: файлы и медицинские снимки (Supabase Storage + patient_files)

-- ─── Storage bucket patient-files ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-files',
  'patient-files',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── patient_files (метаданные файлов в Storage) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  file_category text NOT NULL DEFAULT 'document'
    CHECK (file_category IN ('xray', 'photo', 'document', 'scan', 'other')),
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  visit_id uuid REFERENCES public.patient_visits (id) ON DELETE SET NULL,
  appointment_id bigint REFERENCES public.appointments (id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  visible_to_patient boolean NOT NULL DEFAULT true,
  uploaded_by uuid REFERENCES public.dental_employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_patient_files_storage_path UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_patient_files_patient ON public.patient_files (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_visit ON public.patient_files (visit_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_category ON public.patient_files (file_category);

COMMENT ON TABLE public.patient_files IS
  'Метаданные файлов пациента в bucket patient-files (JPG, PNG, PDF).';

-- ─── updated_at trigger ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS patient_files_set_updated_at ON public.patient_files;
CREATE TRIGGER patient_files_set_updated_at
  BEFORE UPDATE ON public.patient_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ─── RLS: patient_files ──────────────────────────────────────────────────────
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_files_select_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_insert_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_update_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_delete_authenticated ON public.patient_files;

CREATE POLICY patient_files_select_authenticated
  ON public.patient_files FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      AND visible_to_patient = true
    )
  );

CREATE POLICY patient_files_insert_authenticated
  ON public.patient_files FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY patient_files_update_authenticated
  ON public.patient_files FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY patient_files_delete_authenticated
  ON public.patient_files FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

-- ─── Storage policies: patient-files bucket ────────────────────────────────────
-- Путь: {patient_id}/{upload_key}/{filename}

DROP POLICY IF EXISTS patient_files_storage_select ON storage.objects;
DROP POLICY IF EXISTS patient_files_storage_insert ON storage.objects;
DROP POLICY IF EXISTS patient_files_storage_update ON storage.objects;
DROP POLICY IF EXISTS patient_files_storage_delete ON storage.objects;

CREATE POLICY patient_files_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-files'
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient((storage.foldername(name))[1])
      OR (
        public.subject_client_pk() IS NOT DISTINCT FROM (storage.foldername(name))[1]
        AND EXISTS (
          SELECT 1
          FROM public.patient_files pf
          WHERE pf.storage_path = name
            AND pf.visible_to_patient = true
        )
      )
    )
  );

CREATE POLICY patient_files_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-files'
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient((storage.foldername(name))[1])
    )
  );

CREATE POLICY patient_files_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'patient-files'
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient((storage.foldername(name))[1])
    )
  )
  WITH CHECK (
    bucket_id = 'patient-files'
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient((storage.foldername(name))[1])
    )
  );

CREATE POLICY patient_files_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-files'
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient((storage.foldername(name))[1])
    )
  );

NOTIFY pgrst, 'reload schema';
