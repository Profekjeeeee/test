-- Стоматология: схема под Supabase (выполните в SQL Editor или через CLI).
-- После применения: Database → Replication → убедитесь, что dental_messages в publication (ниже ALTER PUBLICATION).

-- ─── dental_clients ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dental_clients (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  phone text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'client',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  formula_teeth jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── dental_employees ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dental_employees (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  phone text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'doctor')),
  specialization text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  doctor_id text REFERENCES public.dental_employees (id) ON DELETE SET NULL,
  appointment_date date NOT NULL,
  appointment_time text NOT NULL,
  status text NOT NULL,
  doctor_display_name text NOT NULL,
  specialty text,
  service text,
  price numeric,
  cabinet text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments (doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments (appointment_date);

-- ─── dental_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dental_messages (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  sender_id text NOT NULL,
  recipient_id text NOT NULL,
  body text NOT NULL,
  chat_type text NOT NULL CHECK (chat_type IN ('support', 'clinic', 'doctor')),
  sender_role text NOT NULL CHECK (sender_role IN ('client', 'doctor', 'admin')),
  sender_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dental_messages_created ON public.dental_messages (created_at);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Если таблица уже в publication, команда ниже выдаст ошибку — это нормально, пропустите её.
ALTER PUBLICATION supabase_realtime ADD TABLE public.dental_messages;

-- ─── RLS (anon-ключ из Mini App / браузера; для продакшена замените на Supabase Auth + политики) ───
ALTER TABLE public.dental_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dental_clients_anon_rw" ON public.dental_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dental_employees_anon_read" ON public.dental_employees FOR SELECT USING (true);
CREATE POLICY "appointments_anon_rw" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dental_messages_anon_rw" ON public.dental_messages FOR ALL USING (true) WITH CHECK (true);

-- ─── Seed: админ, врачи из экрана записи (d1–d10), телефоны для демо-входа ───
INSERT INTO public.dental_employees (id, phone, name, role, specialization) VALUES
  ('emp_admin', '77777777777', 'Системный Администратор', 'admin', NULL),
  ('d1', '79991112233', 'Михайлова А.В.', 'doctor', 'Терапевт'),
  ('d2', '79001001002', 'Соколов Д.И.', 'doctor', 'Терапевт'),
  ('d3', '79001001003', 'Петрова Н.К.', 'doctor', 'Хирург'),
  ('d4', '79994445566', 'Зайцев В.А.', 'doctor', 'Хирург'),
  ('d5', '79001001005', 'Иванов С.П.', 'doctor', 'Гигиенист'),
  ('d6', '79001001006', 'Орлова Е.М.', 'doctor', 'Гигиенист'),
  ('d7', '79001001007', 'Борисов К.Л.', 'doctor', 'Ортодонт'),
  ('d8', '79001001008', 'Сидорова Ю.В.', 'doctor', 'Ортодонт'),
  ('d9', '79001001009', 'Громов А.Н.', 'doctor', 'Имплантолог'),
  ('d10', '79001001010', 'Власова Т.С.', 'doctor', 'Имплантолог')
ON CONFLICT (id) DO NOTHING;

-- Телефон врача для записи (дублирует employees.phone для отчётов и интеграций).
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_phone text;

-- Таблица чата под колонку `text` и Realtime-подписку `chat_messages`.
-- chat_type + sender_name остаются нужны приложению (раздел clinic / support / doctor и подпись в UI).

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  sender_id text NOT NULL,
  recipient_id text NOT NULL,
  "text" text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('client', 'doctor', 'admin')),
  chat_type text NOT NULL CHECK (chat_type IN ('support', 'clinic', 'doctor')),
  sender_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages (created_at);

-- Перенос из legacy `dental_messages`, если таблица существует.
DO $$
BEGIN
  IF to_regclass('public.dental_messages') IS NOT NULL THEN
    INSERT INTO public.chat_messages (
      id, sender_id, recipient_id, "text", sender_role, chat_type, sender_name, created_at
    )
    SELECT
      id, sender_id, recipient_id, body, sender_role, chat_type, sender_name, created_at
    FROM public.dental_messages
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_anon_rw" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Минимальная вставка: client_id, doctor_id, appointment_date, appointment_time, status.
-- Поле id и прочие колонки заполняются на стороне БД / остаются необязательными.
ALTER TABLE public.appointments
  ALTER COLUMN doctor_display_name DROP NOT NULL;

-- Колонка под вставку с фронта (имя врача текстом). Идентификатор записи не передаётся — генерируется в БД.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_name text;

-- Staff-only notes about patient (dental_clients.internal_notes).
ALTER TABLE public.dental_clients
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Зубная формула пациента (jsonb): синхрон ЛК пациента ↔ кабинет врача.
-- Идемпотентно для БД, созданных до добавления поля в коде.
ALTER TABLE public.dental_clients
  ADD COLUMN IF NOT EXISTS formula_teeth jsonb;

-- Telegram user id (строка: числовой id из Mini App)
ALTER TABLE public.dental_clients
  ADD COLUMN IF NOT EXISTS telegram_id text;

ALTER TABLE public.dental_employees
  ADD COLUMN IF NOT EXISTS telegram_id text;

-- Внутренний чат врачей: общая комната «Ординаторская» + сообщения с Realtime.

CREATE TABLE IF NOT EXISTS public.doctor_rooms (
  id text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  is_general boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.doctor_rooms (id, title, is_general) VALUES
  ('ordinatorskaya', 'Ординаторская', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.doctor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.doctor_rooms (id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_messages_room_created ON public.doctor_messages (room_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_messages;

ALTER TABLE public.doctor_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_rooms_anon_rw" ON public.doctor_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "doctor_messages_anon_rw" ON public.doctor_messages FOR ALL USING (true) WITH CHECK (true);

-- Личные чаты врачей: пара участников + уникальность пары.

ALTER TABLE public.doctor_rooms
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);

ALTER TABLE public.doctor_rooms
  ADD COLUMN IF NOT EXISTS peer_low text,
  ADD COLUMN IF NOT EXISTS peer_high text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_rooms_dm_peers
  ON public.doctor_rooms (peer_low, peer_high)
  WHERE is_general = false
    AND peer_low IS NOT NULL
    AND peer_high IS NOT NULL;

-- Метаданные для сообщений врачей (консилиум, вложения и т.д.)

ALTER TABLE public.doctor_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.doctor_messages.metadata IS 'JSON: consilium (patient_id, formula_teeth, …) и др.';

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

-- Строгие политики RLS: доступ только через роль authenticated (JWT Supabase Auth).
-- Требование: связать строки dental_clients / dental_employees с auth.uid() через auth_user_id,
-- или (legacy) использовать id пациента = uuid текстом, совпадающим с auth.uid().
-- До миграции данных мини-приложение без Supabase-сессии к этим таблицам через anon не пройдёт RLS —
-- нужен signIn/signUp или service_role на сервере.

-- ─── Связь профилей с Auth ────────────────────────────────────────────────────
ALTER TABLE public.dental_clients
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dental_clients.auth_user_id IS
  'Supabase Auth UID; задаёт привязку субъекта к строке профиля (RLS).';

CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_clients_auth_user_id
  ON public.dental_clients (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.dental_employees
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dental_employees.auth_user_id IS
  'Supabase Auth UID сотрудника (врач/админ) для проверки RLS.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_employees_auth_user_id
  ON public.dental_employees (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- ─── Утилиты (IMMUTABLE/STABLE определённые для строковых ключей приложения) ───
CREATE OR REPLACE FUNCTION public.phone_digits_normalized(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
BEGIN
  IF d IS NULL OR d = '' THEN
    RETURN '';
  END IF;
  IF substring(d FROM 1 FOR 1) = '8' THEN
    d := '7' || substring(d FROM 2);
  END IF;
  IF d <> '' AND substring(d FROM 1 FOR 1) <> '7' THEN
    d := '7' || d;
  END IF;
  RETURN d;
END;
$$;

-- UUID v4-совместимость в lower-case (совпадает с isDentalClientUuidKey во фронте).
CREATE OR REPLACE FUNCTION public.subject_client_pk()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.dental_clients c
  WHERE auth.uid() IS NOT NULL
    AND (
      c.auth_user_id = auth.uid()
      OR (
        c.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND lower(c.id) = auth.uid()::text
      )
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
    WHERE auth.uid() IS NOT NULL AND e.auth_user_id = auth.uid()
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

-- Видимость строк чата для врача/администратора (body/text не нужны).
CREATE OR REPLACE FUNCTION public.chat_staff_can_read_row(
  p_sender_id text,
  p_recipient_id text,
  p_chat_type text,
  p_sender_role text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp public.dental_employees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO emp
  FROM public.dental_employees e
  WHERE e.auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF emp.role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF emp.role <> 'doctor' THEN
    RETURN FALSE;
  END IF;

  IF p_chat_type = 'support' THEN
    RETURN FALSE;
  END IF;

  IF p_chat_type = 'doctor' THEN
    RETURN public.phone_digits_normalized(p_sender_id) = public.phone_digits_normalized(emp.phone)
      OR public.phone_digits_normalized(p_recipient_id) = public.phone_digits_normalized(emp.phone);
  END IF;

  IF p_chat_type <> 'clinic' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.doctor_id = emp.id
      AND (
        a.client_id IS NOT DISTINCT FROM p_sender_id
        OR a.client_id IS NOT DISTINCT FROM p_recipient_id
      )
  )
    OR (
      p_sender_role = 'doctor'
      AND public.phone_digits_normalized(p_sender_id)
        IS NOT DISTINCT FROM public.phone_digits_normalized(emp.phone)
    );
END;
$$;

COMMENT ON FUNCTION public.chat_staff_can_read_row IS
  'Администратор: все сообщения chat_messages / dental_messages. Врачи: свой doctor-поток по телефону; clinic-поток — только где участвует пациент с приёмом у этого врача, либо исходящие от них как doctor.';

CREATE OR REPLACE FUNCTION public.dental_clients_protect_internal_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.internal_notes IS DISTINCT FROM OLD.internal_notes THEN
    IF NOT public.is_staff_user() THEN
      NEW.internal_notes := OLD.internal_notes;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dental_clients_protect_internal_notes_trg ON public.dental_clients;

CREATE TRIGGER dental_clients_protect_internal_notes_trg
BEFORE UPDATE ON public.dental_clients
FOR EACH ROW
EXECUTE FUNCTION public.dental_clients_protect_internal_notes();

REVOKE ALL ON FUNCTION public.subject_client_pk() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subject_client_pk() TO authenticated;

REVOKE ALL ON FUNCTION public.phone_digits_normalized(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phone_digits_normalized(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- ─── Drop legacy permissive policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "dental_clients_anon_rw" ON public.dental_clients;
DROP POLICY IF EXISTS "dental_employees_anon_read" ON public.dental_employees;
DROP POLICY IF EXISTS "appointments_anon_rw" ON public.appointments;
DROP POLICY IF EXISTS "dental_messages_anon_rw" ON public.dental_messages;
DROP POLICY IF EXISTS "chat_messages_anon_rw" ON public.chat_messages;
DROP POLICY IF EXISTS "doctor_rooms_anon_rw" ON public.doctor_rooms;
DROP POLICY IF EXISTS "doctor_messages_anon_rw" ON public.doctor_messages;

-- ─── dental_clients ────────────────────────────────────────────────────────────
CREATE POLICY dental_clients_select_authenticated
  ON public.dental_clients FOR SELECT TO authenticated
  USING (
    (public.subject_client_pk() IS NOT NULL AND id IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.is_staff_user()
  );

CREATE POLICY dental_clients_insert_authenticated
  ON public.dental_clients FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_user()
    OR (
      auth_user_id IS NOT NULL AND auth_user_id = auth.uid()
    )
    OR (
      id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND lower(id) IS NOT DISTINCT FROM auth.uid()::text
    )
  );

CREATE POLICY dental_clients_update_authenticated
  ON public.dental_clients FOR UPDATE TO authenticated
  USING (
    (public.subject_client_pk() IS NOT NULL AND id IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.is_staff_user()
  )
  WITH CHECK (
    (public.subject_client_pk() IS NOT NULL AND id IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.is_staff_user()
  );

CREATE POLICY dental_clients_delete_authenticated_admin
  ON public.dental_clients FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- ─── dental_employees ─────────────────────────────────────────────────────────
CREATE POLICY dental_employees_select_authenticated
  ON public.dental_employees FOR SELECT TO authenticated
  USING (true);

CREATE POLICY dental_employees_insert_admin
  ON public.dental_employees FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY dental_employees_update_admin
  ON public.dental_employees FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY dental_employees_delete_admin
  ON public.dental_employees FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- ─── appointments ─────────────────────────────────────────────────────────────
CREATE POLICY appointments_select_authenticated
  ON public.appointments FOR SELECT TO authenticated
  USING (
    public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND client_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY appointments_insert_authenticated
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND client_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY appointments_update_authenticated
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND client_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
  )
  WITH CHECK (
    public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND client_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY appointments_delete_authenticated
  ON public.appointments FOR DELETE TO authenticated
  USING (
    public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND client_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

-- ─── Legacy dental_messages ───────────────────────────────────────────────────
CREATE POLICY dental_messages_select_authenticated
  ON public.dental_messages FOR SELECT TO authenticated
  USING (
    (
      public.subject_client_pk() IS NOT NULL
      AND (
        sender_id IS NOT DISTINCT FROM public.subject_client_pk()
        OR recipient_id IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
    OR public.chat_staff_can_read_row(sender_id, recipient_id, chat_type, sender_role)
  );

CREATE POLICY dental_messages_insert_authenticated
  ON public.dental_messages FOR INSERT TO authenticated
  WITH CHECK (
    (
      sender_role = 'client'
      AND public.subject_client_pk() IS NOT NULL
      AND sender_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR (
      sender_role IN ('doctor', 'admin')
      AND EXISTS (
        SELECT 1
        FROM public.dental_employees e
        WHERE e.auth_user_id = auth.uid()
          AND (
            (sender_role = 'admin' AND e.role = 'admin' AND sender_id IS NOT DISTINCT FROM e.id::text)
            OR (
              sender_role = 'doctor'
              AND e.role = 'doctor'
              AND public.phone_digits_normalized(sender_id)
                IS NOT DISTINCT FROM public.phone_digits_normalized(e.phone)
            )
          )
      )
    )
  );

CREATE POLICY dental_messages_update_authenticated
  ON public.dental_messages FOR UPDATE TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY dental_messages_delete_authenticated_admin
  ON public.dental_messages FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- ─── chat_messages ─────────────────────────────────────────────────────────────
CREATE POLICY chat_messages_select_authenticated
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    (
      public.subject_client_pk() IS NOT NULL
      AND (
        sender_id IS NOT DISTINCT FROM public.subject_client_pk()
        OR recipient_id IS NOT DISTINCT FROM public.subject_client_pk()
      )
    )
    OR public.chat_staff_can_read_row(sender_id, recipient_id, chat_type, sender_role)
  );

CREATE POLICY chat_messages_insert_authenticated
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    (
      sender_role = 'client'
      AND public.subject_client_pk() IS NOT NULL
      AND sender_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR (
      sender_role IN ('doctor', 'admin')
      AND EXISTS (
        SELECT 1
        FROM public.dental_employees e
        WHERE e.auth_user_id = auth.uid()
          AND (
            (sender_role = 'admin' AND e.role = 'admin' AND sender_id IS NOT DISTINCT FROM e.id::text)
            OR (
              sender_role = 'doctor'
              AND e.role = 'doctor'
              AND public.phone_digits_normalized(sender_id)
                IS NOT DISTINCT FROM public.phone_digits_normalized(e.phone)
            )
          )
      )
    )
  );

CREATE POLICY chat_messages_update_authenticated_staff
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY chat_messages_delete_authenticated_admin
  ON public.chat_messages FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- ─── doctor_rooms / doctor_messages ───────────────────────────────────────────
CREATE POLICY doctor_rooms_staff_all
  ON public.doctor_rooms FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY doctor_messages_staff_select
  ON public.doctor_messages FOR SELECT TO authenticated
  USING (public.is_staff_user());

CREATE POLICY doctor_messages_staff_insert
  ON public.doctor_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_user()
    AND EXISTS (
      SELECT 1 FROM public.doctor_rooms r
      WHERE r.id IS NOT DISTINCT FROM room_id
    )
    AND EXISTS (
      SELECT 1 FROM public.dental_employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.id IS NOT DISTINCT FROM sender_id
    )
  );

CREATE POLICY doctor_messages_staff_update
  ON public.doctor_messages FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.dental_employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.id IS NOT DISTINCT FROM sender_id
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.dental_employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.id IS NOT DISTINCT FROM sender_id
    )
  );

CREATE POLICY doctor_messages_staff_delete_own
  ON public.doctor_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dental_employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.id IS NOT DISTINCT FROM sender_id
    )
    OR public.is_admin_user()
  );

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

-- client_id должен указывать на профиль (dental_clients.id), а не на сырой номер телефона.
-- 1) Подтягиваем id клиента по совпадению нормализованного телефона, если в client_id лежали только цифры.
-- 2) Запрещаем «телефоноподобные» значения в client_id (10–15 подряд идущих цифр).

UPDATE public.appointments a
SET client_id = c.id
FROM public.dental_clients c
WHERE a.client_id IS NOT NULL
  AND a.client_id ~ '^[0-9]{10,15}$'
  AND public.phone_digits_normalized(a.client_id) = public.phone_digits_normalized(c.phone);

-- Оставшийся «телефон» без соответствующего `dental_clients.id` — обнуляем (иначе CHECK).
UPDATE public.appointments a
SET client_id = NULL
WHERE a.client_id IS NOT NULL
  AND a.client_id ~ '^[0-9]{10,15}$'
  AND NOT EXISTS (SELECT 1 FROM public.dental_clients c WHERE c.id = a.client_id);

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_client_id_not_phone_like;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_id_not_phone_like CHECK (
    client_id IS NULL
    OR client_id !~ '^[0-9]{10,15}$'
  );

COMMENT ON CONSTRAINT appointments_client_id_not_phone_like ON public.appointments IS
  'client_id — только внешний ключ на dental_clients.id; «голый» телефон в этом поле запрещён.';

-- В doctor-ветке sender_id/recipient_id для врача допускают dental_employees.id (не только телефон).
-- Обновляем RLS: врач может вставлять сообщение, если sender_id = e.id ИЛИ совпадает нормализованный телефон (legacy).

CREATE OR REPLACE FUNCTION public.chat_staff_can_read_row(
  p_sender_id text,
  p_recipient_id text,
  p_chat_type text,
  p_sender_role text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp public.dental_employees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO emp
  FROM public.dental_employees e
  WHERE e.auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF emp.role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF emp.role <> 'doctor' THEN
    RETURN FALSE;
  END IF;

  IF p_chat_type = 'support' THEN
    RETURN FALSE;
  END IF;

  IF p_chat_type = 'doctor' THEN
    RETURN public.phone_digits_normalized(p_sender_id) = public.phone_digits_normalized(emp.phone)
      OR public.phone_digits_normalized(p_recipient_id) = public.phone_digits_normalized(emp.phone)
      OR p_sender_id IS NOT DISTINCT FROM emp.id::text
      OR p_recipient_id IS NOT DISTINCT FROM emp.id::text;
  END IF;

  IF p_chat_type <> 'clinic' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.doctor_id = emp.id
      AND (
        a.client_id IS NOT DISTINCT FROM p_sender_id
        OR a.client_id IS NOT DISTINCT FROM p_recipient_id
      )
  )
    OR (
      p_sender_role = 'doctor'
      AND (
        public.phone_digits_normalized(p_sender_id) IS NOT DISTINCT FROM public.phone_digits_normalized(emp.phone)
        OR p_sender_id IS NOT DISTINCT FROM emp.id::text
      )
    );
END;
$$;

DROP POLICY IF EXISTS dental_messages_insert_authenticated ON public.dental_messages;

CREATE POLICY dental_messages_insert_authenticated
  ON public.dental_messages FOR INSERT TO authenticated
  WITH CHECK (
    (
      sender_role = 'client'
      AND public.subject_client_pk() IS NOT NULL
      AND sender_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR (
      sender_role IN ('doctor', 'admin')
      AND EXISTS (
        SELECT 1
        FROM public.dental_employees e
        WHERE e.auth_user_id = auth.uid()
          AND (
            (
              sender_role = 'admin'
              AND e.role = 'admin'
              AND sender_id IS NOT DISTINCT FROM e.id::text
            )
            OR (
              sender_role = 'doctor'
              AND e.role = 'doctor'
              AND (
                sender_id IS NOT DISTINCT FROM e.id::text
                OR public.phone_digits_normalized(sender_id)
                  IS NOT DISTINCT FROM public.phone_digits_normalized(e.phone)
              )
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS chat_messages_insert_authenticated ON public.chat_messages;

CREATE POLICY chat_messages_insert_authenticated
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    (
      sender_role = 'client'
      AND public.subject_client_pk() IS NOT NULL
      AND sender_id IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR (
      sender_role IN ('doctor', 'admin')
      AND EXISTS (
        SELECT 1
        FROM public.dental_employees e
        WHERE e.auth_user_id = auth.uid()
          AND (
            (
              sender_role = 'admin'
              AND e.role = 'admin'
              AND sender_id IS NOT DISTINCT FROM e.id::text
            )
            OR (
              sender_role = 'doctor'
              AND e.role = 'doctor'
              AND (
                sender_id IS NOT DISTINCT FROM e.id::text
                OR public.phone_digits_normalized(sender_id)
                  IS NOT DISTINCT FROM public.phone_digits_normalized(e.phone)
              )
            )
          )
      )
    )
  );

-- Админ-каталог: врачи, услуги, расширение appointments
-- Без конфликтов с существующей Mini App схемой

-- ─────────────────────────────────────────────────────────────────────────────
-- doctors
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  specialization text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_doctors_sort
  ON public.doctors (sort_order, name);

CREATE INDEX IF NOT EXISTS idx_doctors_active
  ON public.doctors (is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- services
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  category text NOT NULL DEFAULT 'Прочее',
  is_visible boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_services_category
  ON public.services (category);

CREATE INDEX IF NOT EXISTS idx_services_visible
  ON public.services (is_visible);

-- ─────────────────────────────────────────────────────────────────────────────
-- appointments extensions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_id uuid
  REFERENCES public.services(id)
  ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_name text;

COMMENT ON COLUMN public.appointments.service_id
  IS 'FK на public.services для аналитики и прайса';

COMMENT ON COLUMN public.appointments.patient_name
  IS 'Имя пациента для админ-дашборда';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.doctors
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.services
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors_anon_rw"
  ON public.doctors;

CREATE POLICY "doctors_anon_rw"
  ON public.doctors
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "services_anon_rw"
  ON public.services;

CREATE POLICY "services_anon_rw"
  ON public.services
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed doctors
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.doctors (
  name,
  specialization,
  photo_url,
  is_active,
  sort_order
)
SELECT
  v.name,
  v.specialization,
  '',
  v.is_active,
  v.sort_order
FROM (
  VALUES
    ('Михайлова Анна Владимировна', 'Терапия', true, 10),
    ('Иванов Сергей Петрович', 'Хирургия', true, 20),
    ('Петрова Наталья Константиновна', 'Ортодонтия', true, 30),
    ('Соколов Дмитрий Игоревич', 'Имплантология', true, 40),
    ('Козлова Елена Викторовна', 'Терапия', true, 50),
    ('Смирнов Константин Алексеевич', 'Хирургия', false, 60)
) AS v(name, specialization, is_active, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.doctors
  LIMIT 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed services
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.services (
  name,
  price,
  category,
  is_visible
)
SELECT
  v.name,
  v.price,
  v.category,
  true
FROM (
  VALUES
    ('Профессиональная чистка зубов', 3500::numeric, 'Гигиена'),
    ('Комплексная чистка AirFlow', 5500::numeric, 'Гигиена'),
    ('Чистка AirFlow + ультразвук', 7000::numeric, 'Гигиена'),
    ('Фторирование зубов', 1500::numeric, 'Гигиена'),
    ('Лечение кариеса (1 поверхность)', 4500::numeric, 'Терапия'),
    ('Лечение кариеса (2+ поверхности)', 7500::numeric, 'Терапия'),
    ('Лечение пульпита (1-канальный)', 12000::numeric, 'Терапия'),
    ('Удаление зуба (простое)', 3500::numeric, 'Хирургия'),
    ('Удаление зуба (сложное)', 6500::numeric, 'Хирургия'),
    ('Имплантация (установка)', 45000::numeric, 'Имплантология'),
    ('Брекеты — установка', 85000::numeric, 'Ортодонтия'),
    ('Консультация ортодонта', 2500::numeric, 'Ортодонтия')
) AS v(name, price, category)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.services
  LIMIT 1
);
-- Системные логи приложения (замена localStorage dental_logs)

CREATE TABLE IF NOT EXISTS public.app_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at
  ON public.app_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_logs_level
  ON public.app_logs (level);

COMMENT ON TABLE public.app_logs IS
  'Клиентские и серверные события Mini App для админ-панели';

ALTER TABLE public.app_logs
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_logs_anon_rw"
  ON public.app_logs;

CREATE POLICY "app_logs_anon_rw"
  ON public.app_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Колонка user_id для app_logs (связь с сессией без разбора metadata)

ALTER TABLE public.app_logs
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_app_logs_user_id
  ON public.app_logs (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.app_logs.user_id IS
  'ID пользователя из клиентской сессии (dental_clients / employees)';

-- 1. Создаем функции для проверки ролей
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin';
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') IN ('admin', 'doctor');
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Удаляем старые дырявые политики
DROP POLICY IF EXISTS "doctors_anon_rw" ON public.doctors;
DROP POLICY IF EXISTS "services_anon_rw" ON public.services;
DROP POLICY IF EXISTS "app_logs_anon_rw" ON public.app_logs;

-- 3. Настраиваем безопасный доступ к услугам
CREATE POLICY services_select_authenticated
  ON public.services FOR SELECT TO authenticated
  USING (is_visible = true OR public.is_staff_user());

CREATE POLICY services_write_admin
  ON public.services FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- 4. Настраиваем безопасный доступ к логам
CREATE POLICY app_logs_insert_authenticated
  ON public.app_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY app_logs_select_admin
  ON public.app_logs FOR SELECT TO authenticated
  USING (public.is_admin_user());
-- Правка и удаление своих сообщений в patient/staff чатах (authenticated).

CREATE POLICY chat_messages_update_own_client
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    sender_role = 'client'
    AND public.subject_client_pk() IS NOT NULL
    AND sender_id IS NOT DISTINCT FROM public.subject_client_pk()
  )
  WITH CHECK (
    sender_role = 'client'
    AND public.subject_client_pk() IS NOT NULL
    AND sender_id IS NOT DISTINCT FROM public.subject_client_pk()
  );

CREATE POLICY chat_messages_delete_own_client
  ON public.chat_messages FOR DELETE TO authenticated
  USING (
    sender_role = 'client'
    AND public.subject_client_pk() IS NOT NULL
    AND sender_id IS NOT DISTINCT FROM public.subject_client_pk()
  );

CREATE POLICY chat_messages_delete_own_staff
  ON public.chat_messages FOR DELETE TO authenticated
  USING (
    sender_role IN ('doctor', 'admin')
    AND EXISTS (
      SELECT 1
      FROM public.dental_employees e
      WHERE e.auth_user_id = auth.uid()
        AND (
          (sender_role = 'admin' AND e.role = 'admin' AND sender_id IS NOT DISTINCT FROM e.id::text)
          OR (
            sender_role = 'doctor'
            AND e.role = 'doctor'
            AND public.phone_digits_normalized(sender_id)
              IS NOT DISTINCT FROM public.phone_digits_normalized(e.phone)
          )
        )
    )
  );

-- Метка «изменено» в UI: время последней правки текста.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.doctor_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- PIN для Supabase Auth: profiles.pin_hash, RPC set_user_pin / verify_user_pin.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  pin_hash text,
  pin_failed_attempts integer NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Профиль Auth-пользователя: PIN-хэш и блокировка.';
COMMENT ON COLUMN public.profiles.pin_hash IS 'bcrypt-хэш PIN (pgcrypto crypt).';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_insert_own
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user_profile();

CREATE OR REPLACE FUNCTION public.ensure_profile_row(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.profiles (id) VALUES (p_user_id) ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_pin(p_user_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  digits := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  IF length(digits) < 4 OR length(digits) > 6 THEN
    RAISE EXCEPTION 'PIN must be 4–6 digits' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ensure_profile_row(p_user_id);

  UPDATE public.profiles
  SET
    pin_hash = crypt(digits, gen_salt('bf', 8)),
    pin_failed_attempts = 0,
    pin_locked_until = NULL,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits text;
  row public.profiles%ROWTYPE;
  remaining integer;
  max_attempts constant integer := 5;
  lock_minutes constant integer := 15;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  digits := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  IF length(digits) < 4 OR length(digits) > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_format', 'remaining', max_attempts);
  END IF;

  SELECT * INTO row FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR row.pin_hash IS NULL OR row.pin_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_pin');
  END IF;

  IF row.pin_locked_until IS NOT NULL AND row.pin_locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'locked',
      'locked_until', row.pin_locked_until,
      'remaining', 0
    );
  END IF;

  IF row.pin_hash = crypt(digits, row.pin_hash) THEN
    UPDATE public.profiles
    SET pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = now()
    WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  remaining := GREATEST(0, max_attempts - (row.pin_failed_attempts + 1));

  IF row.pin_failed_attempts + 1 >= max_attempts THEN
    UPDATE public.profiles
    SET
      pin_failed_attempts = max_attempts,
      pin_locked_until = now() + (lock_minutes || ' minutes')::interval,
      updated_at = now()
    WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'locked',
      'locked_until', now() + (lock_minutes || ' minutes')::interval,
      'remaining', 0
    );
  END IF;

  UPDATE public.profiles
  SET pin_failed_attempts = pin_failed_attempts + 1, updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', false, 'error', 'wrong_pin', 'remaining', remaining);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile_row(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_user_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_pin(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.verify_user_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(uuid, text) TO authenticated;

-- Seed: тестовые врачи и услуги
-- Запуск: Supabase Dashboard → SQL Editor → вставить и выполнить
-- Безопасно перезапускать — дубликаты по name не создаются

-- ─── Врачи (4 активных + 1 неактивный для теста) ───

INSERT INTO public.doctors (name, specialization, photo_url, is_active, sort_order)
SELECT v.name, v.specialization, '', v.is_active, v.sort_order
FROM (VALUES
  ('Михайлова Анна Владимировна', 'Терапия',        true,  10),
  ('Иванов Сергей Петрович',      'Хирургия',       true,  20),
  ('Петрова Наталья Константиновна', 'Ортодонтия',  true,  30),
  ('Соколов Дмитрий Игоревич',    'Имплантология',  true,  40),
  ('Смирнов Константин Алексеевич', 'Хирургия',     false, 50)
) AS v(name, specialization, is_active, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.doctors d WHERE d.name = v.name
);

-- ─── Услуги (~12 позиций) ───

INSERT INTO public.services (name, price, category, is_visible)
SELECT v.name, v.price, v.category, true
FROM (VALUES
  ('Профессиональная чистка зубов',       3500::numeric,  'Гигиена'),
  ('Комплексная чистка AirFlow',          5500::numeric,  'Гигиена'),
  ('Чистка AirFlow + ультразвук',         7000::numeric,  'Гигиена'),
  ('Фторирование зубов',                  1500::numeric,  'Гигиена'),
  ('Лечение кариеса (1 поверхность)',     4500::numeric,  'Терапия'),
  ('Лечение кариеса (2+ поверхности)',    7500::numeric,  'Терапия'),
  ('Лечение пульпита (1-канальный)',     12000::numeric,  'Терапия'),
  ('Удаление зуба (простое)',             3500::numeric,  'Хирургия'),
  ('Удаление зуба (сложное)',             6500::numeric,  'Хирургия'),
  ('Имплантация (установка)',            45000::numeric,  'Имплантология'),
  ('Брекеты — установка',                85000::numeric,  'Ортодонтия'),
  ('Консультация ортодонта',              2500::numeric,  'Ортодонтия')
) AS v(name, price, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s WHERE s.name = v.name
);

-- Проверка
SELECT 'doctors' AS table_name, count(*) AS rows FROM public.doctors
UNION ALL
SELECT 'services', count(*) FROM public.services;

-- Шаг 1 ROADMAP: bills + treatment_plan_items (см. supabase/migrations/002_bills_treatment_plan.sql)

CREATE OR REPLACE FUNCTION public.subject_client_pk()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id::text
  FROM public.dental_clients c
  WHERE auth.uid() IS NOT NULL
    AND (c.auth_user_id = auth.uid() OR c.id = auth.uid())
  ORDER BY CASE WHEN c.auth_user_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dental_employees e
    WHERE auth.uid() IS NOT NULL AND e.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dental_employees e
    WHERE auth.uid() IS NOT NULL AND e.auth_user_id = auth.uid() AND e.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.subject_client_pk() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subject_client_pk() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.doctor_can_access_patient(p_patient_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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

REVOKE ALL ON FUNCTION public.doctor_can_access_patient(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_can_access_patient(text) TO authenticated;

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
CREATE UNIQUE INDEX IF NOT EXISTS ux_bills_appointment_pending
  ON public.bills (appointment_id)
  WHERE appointment_id IS NOT NULL AND status IN ('pending', 'overdue');

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

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS bills_set_updated_at ON public.bills;
CREATE TRIGGER bills_set_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS treatment_plan_items_set_updated_at ON public.treatment_plan_items;
CREATE TRIGGER treatment_plan_items_set_updated_at BEFORE UPDATE ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bills_select_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_insert_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_update_authenticated ON public.bills;
DROP POLICY IF EXISTS bills_delete_authenticated ON public.bills;
DROP POLICY IF EXISTS treatment_plan_items_select_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_insert_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_update_authenticated ON public.treatment_plan_items;
DROP POLICY IF EXISTS treatment_plan_items_delete_authenticated ON public.treatment_plan_items;

CREATE POLICY bills_select_authenticated ON public.bills FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY bills_insert_authenticated ON public.bills FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user() OR public.is_staff_user()
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
  );

CREATE POLICY bills_update_authenticated ON public.bills FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.doctor_can_access_patient(patient_id::text)
  )
  WITH CHECK (
    public.is_admin_user()
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY bills_delete_authenticated ON public.bills FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY treatment_plan_items_select_authenticated ON public.treatment_plan_items FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY treatment_plan_items_insert_authenticated ON public.treatment_plan_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text)
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
  );

CREATE POLICY treatment_plan_items_update_authenticated ON public.treatment_plan_items FOR UPDATE TO authenticated
  USING (
    public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text)
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
  )
  WITH CHECK (
    public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text)
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
  );

CREATE POLICY treatment_plan_items_delete_authenticated ON public.treatment_plan_items FOR DELETE TO authenticated
  USING (
    public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text)
    OR (public.subject_client_pk() IS NOT NULL AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk())
  );

-- ═══ 003_medical_records_patient_visits.sql ═════════════════════════════════

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

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medical_records_select_authenticated ON public.medical_records;
DROP POLICY IF EXISTS medical_records_insert_authenticated ON public.medical_records;
DROP POLICY IF EXISTS medical_records_update_authenticated ON public.medical_records;
DROP POLICY IF EXISTS medical_records_delete_authenticated ON public.medical_records;

CREATE POLICY medical_records_select_authenticated ON public.medical_records FOR SELECT TO authenticated
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

CREATE POLICY medical_records_insert_authenticated ON public.medical_records FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user() OR public.is_staff_user());

CREATE POLICY medical_records_update_authenticated ON public.medical_records FOR UPDATE TO authenticated
  USING (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  WITH CHECK (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text));

CREATE POLICY medical_records_delete_authenticated ON public.medical_records FOR DELETE TO authenticated
  USING (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text));

ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_visits_select_authenticated ON public.patient_visits;
DROP POLICY IF EXISTS patient_visits_insert_authenticated ON public.patient_visits;
DROP POLICY IF EXISTS patient_visits_update_authenticated ON public.patient_visits;
DROP POLICY IF EXISTS patient_visits_delete_authenticated ON public.patient_visits;

CREATE POLICY patient_visits_select_authenticated ON public.patient_visits FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      AND visible_to_patient = true
    )
  );

CREATE POLICY patient_visits_insert_authenticated ON public.patient_visits FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text));

CREATE POLICY patient_visits_update_authenticated ON public.patient_visits FOR UPDATE TO authenticated
  USING (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  WITH CHECK (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text));

CREATE POLICY patient_visits_delete_authenticated ON public.patient_visits FOR DELETE TO authenticated
  USING (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text));

-- ═══ 004_patient_files_storage.sql ═══════════════════════════════════════════
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

DROP TRIGGER IF EXISTS patient_files_set_updated_at ON public.patient_files;
CREATE TRIGGER patient_files_set_updated_at
  BEFORE UPDATE ON public.patient_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_files_select_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_insert_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_update_authenticated ON public.patient_files;
DROP POLICY IF EXISTS patient_files_delete_authenticated ON public.patient_files;

CREATE POLICY patient_files_select_authenticated ON public.patient_files FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
      AND visible_to_patient = true
    )
  );

CREATE POLICY patient_files_insert_authenticated ON public.patient_files FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY patient_files_update_authenticated ON public.patient_files FOR UPDATE TO authenticated
  USING (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text))
  WITH CHECK (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text));

CREATE POLICY patient_files_delete_authenticated ON public.patient_files FOR DELETE TO authenticated
  USING (public.is_admin_user() OR public.doctor_can_access_patient(patient_id::text));

DROP POLICY IF EXISTS patient_files_storage_select ON storage.objects;
DROP POLICY IF EXISTS patient_files_storage_insert ON storage.objects;
DROP POLICY IF EXISTS patient_files_storage_update ON storage.objects;
DROP POLICY IF EXISTS patient_files_storage_delete ON storage.objects;

CREATE POLICY patient_files_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-files'
    AND (
      public.is_admin_user()
      OR public.doctor_can_access_patient((storage.foldername(name))[1])
      OR (
        public.subject_client_pk() IS NOT DISTINCT FROM (storage.foldername(name))[1]
        AND EXISTS (
          SELECT 1 FROM public.patient_files pf
          WHERE pf.storage_path = name AND pf.visible_to_patient = true
        )
      )
    )
  );

CREATE POLICY patient_files_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-files'
    AND (public.is_admin_user() OR public.doctor_can_access_patient((storage.foldername(name))[1]))
  );

CREATE POLICY patient_files_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'patient-files'
    AND (public.is_admin_user() OR public.doctor_can_access_patient((storage.foldername(name))[1]))
  )
  WITH CHECK (
    bucket_id = 'patient-files'
    AND (public.is_admin_user() OR public.doctor_can_access_patient((storage.foldername(name))[1]))
  );

CREATE POLICY patient_files_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-files'
    AND (public.is_admin_user() OR public.doctor_can_access_patient((storage.foldername(name))[1]))
  );

-- ─── Шаг 4 ROADMAP: автоматизация уведомлений ───────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_tg_message_id bigint;

COMMENT ON COLUMN public.appointments.reminder_24h_sent_at IS
  'Когда отправлено Telegram-напоминание за ~24 ч до приёма.';
COMMENT ON COLUMN public.appointments.reminder_2h_sent_at IS
  'Когда отправлено Telegram-напоминание за ~2 ч до приёма.';
COMMENT ON COLUMN public.appointments.confirmed_at IS
  'Пациент подтвердил запись через inline-кнопку в Telegram.';
COMMENT ON COLUMN public.appointments.confirmation_tg_message_id IS
  'message_id сообщения с кнопками подтверждения (для editMessageText).';

CREATE INDEX IF NOT EXISTS idx_appointments_reminders_pending
  ON public.appointments (appointment_date, appointment_time)
  WHERE status IN ('pending', 'scheduled', 'rescheduled')
    AND (reminder_24h_sent_at IS NULL OR reminder_2h_sent_at IS NULL);

