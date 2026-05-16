-- Колонка под вставку с фронта (имя врача текстом). Идентификатор записи не передаётся — генерируется в БД.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_name text;
