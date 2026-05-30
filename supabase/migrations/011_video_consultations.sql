-- Шаг 14 ROADMAP EXTENSION: видеоконсультации и удалённое взаимодействие

-- ─── Режим визита на записи ──────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS visit_mode text NOT NULL DEFAULT 'in_person';

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_visit_mode_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_visit_mode_check
  CHECK (visit_mode IN ('in_person', 'video'));

COMMENT ON COLUMN public.appointments.visit_mode IS
  'in_person — очный приём; video — онлайн-консультация (WebRTC).';

-- ─── video_consultations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.video_consultations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  appointment_id  bigint      NOT NULL REFERENCES public.appointments (id) ON DELETE CASCADE,
  patient_id        uuid        NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  doctor_id         uuid        REFERENCES public.dental_employees (id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'waiting',
  room_token        text        NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  started_at        timestamptz,
  ended_at          timestamptz,
  shared_file_id    uuid        REFERENCES public.patient_files (id) ON DELETE SET NULL,
  metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_consultations_status_check
    CHECK (status IN ('waiting', 'active', 'ended', 'cancelled')),
  CONSTRAINT video_consultations_appointment_unique UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_video_consultations_clinic
  ON public.video_consultations (clinic_id);
CREATE INDEX IF NOT EXISTS idx_video_consultations_patient
  ON public.video_consultations (patient_id);
CREATE INDEX IF NOT EXISTS idx_video_consultations_status
  ON public.video_consultations (status) WHERE status IN ('waiting', 'active');

COMMENT ON TABLE public.video_consultations IS
  'Сессия видеоконсультации, привязанная к записи на приём.';

-- ─── Аннотации на снимках во время консультации ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultation_annotations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  consultation_id     uuid        NOT NULL REFERENCES public.video_consultations (id) ON DELETE CASCADE,
  file_id             uuid        NOT NULL REFERENCES public.patient_files (id) ON DELETE CASCADE,
  author_id           text        NOT NULL,
  author_role         text        NOT NULL CHECK (author_role IN ('doctor', 'admin', 'client')),
  strokes             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_annotations_consultation
  ON public.consultation_annotations (consultation_id);

COMMENT ON TABLE public.consultation_annotations IS
  'Разметка снимков (линии, стрелки) во время онлайн-консультации.';

-- ─── clinic_id trigger ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_video_consultations_clinic_id'
  ) THEN
    CREATE TRIGGER trg_video_consultations_clinic_id
      BEFORE INSERT ON public.video_consultations
      FOR EACH ROW EXECUTE FUNCTION public.set_row_clinic_id_default();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_consultation_annotations_clinic_id'
  ) THEN
    CREATE TRIGGER trg_consultation_annotations_clinic_id
      BEFORE INSERT ON public.consultation_annotations
      FOR EACH ROW EXECUTE FUNCTION public.set_row_clinic_id_default();
  END IF;
END $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.video_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS video_consultations_select ON public.video_consultations;
DROP POLICY IF EXISTS video_consultations_insert ON public.video_consultations;
DROP POLICY IF EXISTS video_consultations_update ON public.video_consultations;

CREATE POLICY video_consultations_select ON public.video_consultations
  FOR SELECT TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    )
  );

CREATE POLICY video_consultations_insert ON public.video_consultations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    )
  );

CREATE POLICY video_consultations_update ON public.video_consultations
  FOR UPDATE TO authenticated
  USING (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    )
  )
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND (
      public.is_staff_user()
      OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    )
  );

DROP POLICY IF EXISTS consultation_annotations_select ON public.consultation_annotations;
DROP POLICY IF EXISTS consultation_annotations_insert ON public.consultation_annotations;
DROP POLICY IF EXISTS consultation_annotations_update ON public.consultation_annotations;

CREATE POLICY consultation_annotations_select ON public.consultation_annotations
  FOR SELECT TO authenticated
  USING (public.same_user_clinic(clinic_id));

CREATE POLICY consultation_annotations_insert ON public.consultation_annotations
  FOR INSERT TO authenticated
  WITH CHECK (public.same_user_clinic(clinic_id));

CREATE POLICY consultation_annotations_update ON public.consultation_annotations
  FOR UPDATE TO authenticated
  USING (public.same_user_clinic(clinic_id))
  WITH CHECK (public.same_user_clinic(clinic_id));

-- ─── Realtime ────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_consultations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_annotations;

-- Пациент может загружать файлы во время активной video-сессии
DROP POLICY IF EXISTS patient_files_insert_patient_video ON public.patient_files;

CREATE POLICY patient_files_insert_patient_video ON public.patient_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.same_user_clinic(clinic_id)
    AND public.subject_client_pk() IS NOT NULL
    AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    AND appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.video_consultations vc
      WHERE vc.appointment_id = patient_files.appointment_id
        AND vc.patient_id::text = public.subject_client_pk()
        AND vc.status IN ('waiting', 'active')
        AND public.same_user_clinic(vc.clinic_id)
    )
  );
