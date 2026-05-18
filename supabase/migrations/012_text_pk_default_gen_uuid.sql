-- INSERT с фронта без поля id: NOT NULL на PK без DEFAULT давал ошибку на чистой БД.
-- Тип PK — text (uuid строкой + legacy-ключи вроде d1); задаём DEFAULT как у doctor_rooms (009).

ALTER TABLE public.dental_clients
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);

ALTER TABLE public.dental_employees
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);

ALTER TABLE public.chat_messages
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);

DO $$
BEGIN
  IF to_regclass('public.dental_messages') IS NOT NULL THEN
    ALTER TABLE public.dental_messages
      ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);
  END IF;
END $$;
