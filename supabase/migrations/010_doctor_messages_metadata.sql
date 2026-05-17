-- Метаданные для сообщений врачей (консилиум, вложения и т.д.)

ALTER TABLE public.doctor_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.doctor_messages.metadata IS 'JSON: consilium (patient_id, formula_teeth, …) и др.';
