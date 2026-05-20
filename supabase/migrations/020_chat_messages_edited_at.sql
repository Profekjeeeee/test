-- Метка «изменено» в UI: время последней правки текста.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.doctor_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
