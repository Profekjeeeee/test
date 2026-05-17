-- Схема в продакшене: колонка `name`. Старые миграции создавали `title` — переименовываем, если нужно.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'doctor_rooms' AND column_name = 'title'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'doctor_rooms' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.doctor_rooms RENAME COLUMN title TO name;
  END IF;
END $$;
