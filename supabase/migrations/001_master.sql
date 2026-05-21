-- ============================================================
-- DentalCare — MASTER SCHEMA
-- Версия: актуальная (синхронизирована с Supabase)
-- Заменяет все 24 локальных миграции + 50 сниппетов в Supabase
-- Безопасно выполнять на чистой БД или поверх существующей
-- ============================================================

-- ─── Расширения ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ТАБЛИЦЫ
-- ============================================================

-- ─── dental_clients ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dental_clients (
  id            text        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  phone         text        NOT NULL UNIQUE,
  name          text,
  role          text        NOT NULL DEFAULT 'client',
  first_name    text,
  last_name     text,
  email         text,
  formula_teeth jsonb,
  internal_notes text,
  pin_hash      text,
  pin_attempts  integer     NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  telegram_id   bigint      UNIQUE,
  telegram_username text,
  auth_user_id  uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Индексы
CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_clients_auth_user_id
  ON public.dental_clients (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.dental_clients.auth_user_id IS
  'Supabase Auth UID; привязка субъекта к строке профиля (RLS).';
COMMENT ON COLUMN public.dental_clients.internal_notes IS
  'Внутренние заметки персонала — защищены триггером от изменения клиентом.';

-- ─── dental_employees ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dental_employees (
  id            text        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  phone         text        NOT NULL UNIQUE,
  name          text        NOT NULL DEFAULT '',
  role          text        NOT NULL CHECK (role IN ('admin', 'doctor')),
  specialization text,
  first_name    text,
  last_name     text,
  email         text,
  pin_hash      text,
  pin_attempts  integer     NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  telegram_id   bigint      UNIQUE,
  telegram_username text,
  auth_user_id  uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dental_employees_auth_user_id
  ON public.dental_employees (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.dental_employees.auth_user_id IS
  'Supabase Auth UID сотрудника (врач/админ) для проверки RLS.';

-- ─── doctors (каталог для админки) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctors (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  name           text        NOT NULL,
  specialization text        NOT NULL DEFAULT '',
  photo_url      text        NOT NULL DEFAULT '',
  is_active      boolean     NOT NULL DEFAULT true,
  sort_order     integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_doctors_sort   ON public.doctors (sort_order, name);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors (is_active);

-- ─── services ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name       text    NOT NULL,
  price      numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  category   text    NOT NULL DEFAULT 'Прочее',
  is_visible boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_services_category ON public.services (category);
CREATE INDEX IF NOT EXISTS idx_services_visible  ON public.services (is_visible);

-- ─── appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id               bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at       timestamptz NOT NULL DEFAULT now(),
  client_id        text        REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  doctor_id        text        REFERENCES public.dental_employees (id) ON DELETE SET NULL,
  doctor_name      text,
  appointment_date text        NOT NULL,
  appointment_time text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending',
  comment          text,
  service_id       uuid        REFERENCES public.services (id) ON DELETE SET NULL,
  patient_name     text,
  CONSTRAINT appointments_client_id_not_phone_like CHECK (
    client_id IS NULL OR client_id !~ '^[0-9]{10,15}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments (doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date   ON public.appointments (appointment_date);

COMMENT ON CONSTRAINT appointments_client_id_not_phone_like ON public.appointments IS
  'client_id — только FK на dental_clients.id; голый телефон запрещён.';
COMMENT ON COLUMN public.appointments.service_id   IS 'FK на services для аналитики и прайса.';
COMMENT ON COLUMN public.appointments.patient_name IS 'Имя пациента для админ-дашборда.';

-- ─── dental_messages (legacy, оставляем для совместимости) ───────────────────
CREATE TABLE IF NOT EXISTS public.dental_messages (
  id          text        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  sender_id   text        NOT NULL,
  sender_role text        NOT NULL,
  sender_name text        NOT NULL DEFAULT '',
  recipient_id text       NOT NULL,
  text        text        NOT NULL,
  chat_type   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── chat_messages (основной чат) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           text        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  created_at   timestamptz NOT NULL DEFAULT now(),
  sender_id    text        NOT NULL,
  recipient_id text        NOT NULL,
  text         text        NOT NULL,
  sender_role  text        NOT NULL CHECK (sender_role IN ('client', 'doctor', 'admin')),
  chat_type    text        NOT NULL CHECK (chat_type IN ('support', 'clinic', 'doctor')),
  sender_name  text        NOT NULL DEFAULT '',
  updated_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages (created_at);

-- ─── doctor_rooms (внутренний чат врачей) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_rooms (
  id         text        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  name       text        NOT NULL DEFAULT '',
  is_general boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  peer_low   uuid,
  peer_high  uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_rooms_dm_peers
  ON public.doctor_rooms (peer_low, peer_high)
  WHERE is_general = false AND peer_low IS NOT NULL AND peer_high IS NOT NULL;

-- ─── doctor_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  room_id     text        NOT NULL REFERENCES public.doctor_rooms (id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL,
  sender_name text        NOT NULL DEFAULT '',
  text        text,
  body        text,
  metadata    jsonb,
  updated_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_doctor_messages_room_created
  ON public.doctor_messages (room_id, created_at DESC);

COMMENT ON COLUMN public.doctor_messages.metadata IS
  'JSON: consilium (patient_id, formula_teeth, …) и др.';

-- ─── app_logs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level      text        NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  message    text        NOT NULL,
  user_id    text,
  metadata   jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON public.app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level      ON public.app_logs (level);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id    ON public.app_logs (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE  public.app_logs         IS 'Клиентские и серверные события Mini App.';
COMMENT ON COLUMN public.app_logs.user_id IS 'ID пользователя из клиентской сессии.';

-- ─── profiles (PIN для Supabase Auth) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  pin_hash            text,
  pin_failed_attempts integer     NOT NULL DEFAULT 0,
  pin_locked_until    timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles          IS 'Профиль Auth-пользователя: PIN-хэш и блокировка.';
COMMENT ON COLUMN public.profiles.pin_hash IS 'bcrypt-хэш PIN (pgcrypto crypt).';

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.dental_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_messages;

-- ============================================================
-- RLS — включаем для всех таблиц
-- ============================================================
ALTER TABLE public.dental_clients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ФУНКЦИИ (актуальные версии — заменяют все старые)
-- ============================================================

-- Нормализация телефона
CREATE OR REPLACE FUNCTION public.phone_digits_normalized(p_raw text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
BEGIN
  IF d IS NULL OR d = '' THEN RETURN ''; END IF;
  IF substring(d FROM 1 FOR 1) = '8' THEN d := '7' || substring(d FROM 2); END IF;
  IF substring(d FROM 1 FOR 1) <> '7' THEN d := '7' || d; END IF;
  RETURN d;
END;
$$;

-- PK клиента по auth.uid()
CREATE OR REPLACE FUNCTION public.subject_client_pk()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
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

-- Проверка: сотрудник (врач или админ)
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dental_employees e
    WHERE auth.uid() IS NOT NULL AND e.auth_user_id = auth.uid()
  );
$$;

-- Проверка: только админ
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dental_employees e
    WHERE auth.uid() IS NOT NULL
      AND e.auth_user_id = auth.uid()
      AND e.role = 'admin'
  );
$$;

-- Доступ сотрудника к строке чата
CREATE OR REPLACE FUNCTION public.chat_staff_can_read_row(
  p_sender_id text, p_recipient_id text, p_chat_type text, p_sender_role text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp public.dental_employees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO emp FROM public.dental_employees e WHERE e.auth_user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF emp.role = 'admin' THEN RETURN TRUE; END IF;
  IF emp.role <> 'doctor' THEN RETURN FALSE; END IF;
  IF p_chat_type = 'support' THEN RETURN FALSE; END IF;
  IF p_chat_type = 'doctor' THEN
    RETURN phone_digits_normalized(p_sender_id) = phone_digits_normalized(emp.phone)
      OR phone_digits_normalized(p_recipient_id) = phone_digits_normalized(emp.phone)
      OR p_sender_id IS NOT DISTINCT FROM emp.id::text
      OR p_recipient_id IS NOT DISTINCT FROM emp.id::text;
  END IF;
  IF p_chat_type <> 'clinic' THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = emp.id
      AND (a.client_id IS NOT DISTINCT FROM p_sender_id OR a.client_id IS NOT DISTINCT FROM p_recipient_id)
  ) OR (
    p_sender_role = 'doctor'
    AND (
      phone_digits_normalized(p_sender_id) IS NOT DISTINCT FROM phone_digits_normalized(emp.phone)
      OR p_sender_id IS NOT DISTINCT FROM emp.id::text
    )
  );
END;
$$;

COMMENT ON FUNCTION public.chat_staff_can_read_row IS
  'Администратор: все сообщения. Врачи: свой doctor-поток; clinic — только пациенты с приёмом.';

-- Триггер защиты internal_notes от клиента
CREATE OR REPLACE FUNCTION public.dental_clients_protect_internal_notes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
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
  FOR EACH ROW EXECUTE FUNCTION public.dental_clients_protect_internal_notes();

-- Автосоздание профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user_profile();

-- Гарантия существования строки профиля
CREATE OR REPLACE FUNCTION public.ensure_profile_row(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.profiles (id) VALUES (p_user_id) ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Установка PIN (актуальная: p_user_id первый, p_pin второй)
CREATE OR REPLACE FUNCTION public.set_user_pin(p_user_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
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
  SET pin_hash = crypt(digits, gen_salt('bf', 8)),
      pin_failed_attempts = 0,
      pin_locked_until = NULL,
      updated_at = now()
  WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;

-- Проверка PIN
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits        text;
  row           public.profiles%ROWTYPE;
  remaining     integer;
  max_attempts  constant integer := 5;
  lock_minutes  constant integer := 15;
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
    RETURN jsonb_build_object('ok', false, 'error', 'locked',
      'locked_until', row.pin_locked_until, 'remaining', 0);
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
    SET pin_failed_attempts = max_attempts,
        pin_locked_until = now() + (lock_minutes || ' minutes')::interval,
        updated_at = now()
    WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'locked',
      'locked_until', now() + (lock_minutes || ' minutes')::interval, 'remaining', 0);
  END IF;
  UPDATE public.profiles
  SET pin_failed_attempts = pin_failed_attempts + 1, updated_at = now()
  WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', false, 'error', 'wrong_pin', 'remaining', remaining);
END;
$$;

-- PIN для клиента напрямую в dental_clients
CREATE OR REPLACE FUNCTION public.set_client_pin(p_user_id uuid, pin_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pin_code !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4-6 digits';
  END IF;
  UPDATE dental_clients
  SET pin_hash = crypt(pin_code, gen_salt('bf', 10)),
      pin_attempts = 0,
      pin_locked_until = NULL
  WHERE auth_user_id = p_user_id;
END;
$$;

-- PIN для сотрудника напрямую в dental_employees
CREATE OR REPLACE FUNCTION public.set_employee_pin(p_user_id uuid, pin_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pin_code !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4-6 digits';
  END IF;
  UPDATE dental_employees
  SET pin_hash = crypt(pin_code, gen_salt('bf', 10)),
      pin_attempts = 0,
      pin_locked_until = NULL
  WHERE auth_user_id = p_user_id;
END;
$$;

-- Очистка старых логов (вызывается по расписанию)
CREATE OR REPLACE FUNCTION public.delete_old_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM app_logs WHERE created_at < now() - interval '30 days';
END;
$$;

-- ============================================================
-- ПРАВА НА ФУНКЦИИ
-- ============================================================
REVOKE ALL ON FUNCTION public.subject_client_pk()              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.phone_digits_normalized(text)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_user()                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_user()                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_profile_row(uuid)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_pin(uuid, text)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_user_pin(uuid, text)      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.subject_client_pk()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.phone_digits_normalized(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_row(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_pin(uuid, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(uuid, text)   TO authenticated;

-- ============================================================
-- RLS ПОЛИТИКИ — сначала удаляем все старые
-- ============================================================

-- dental_clients
DROP POLICY IF EXISTS dental_clients_anon_rw                    ON public.dental_clients;
DROP POLICY IF EXISTS dental_clients_select_authenticated        ON public.dental_clients;
DROP POLICY IF EXISTS dental_clients_insert_authenticated        ON public.dental_clients;
DROP POLICY IF EXISTS dental_clients_update_authenticated        ON public.dental_clients;
DROP POLICY IF EXISTS dental_clients_delete_authenticated_admin  ON public.dental_clients;

CREATE POLICY dental_clients_select_authenticated ON public.dental_clients FOR SELECT TO authenticated
  USING (
    (public.subject_client_pk() IS NOT NULL AND id IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.is_staff_user()
  );

CREATE POLICY dental_clients_insert_authenticated ON public.dental_clients FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_user()
    OR (auth_user_id IS NOT NULL AND auth_user_id = auth.uid())
    OR (id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND lower(id) IS NOT DISTINCT FROM auth.uid()::text)
  );

CREATE POLICY dental_clients_update_authenticated ON public.dental_clients FOR UPDATE TO authenticated
  USING (
    (public.subject_client_pk() IS NOT NULL AND id IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.is_staff_user()
  )
  WITH CHECK (
    (public.subject_client_pk() IS NOT NULL AND id IS NOT DISTINCT FROM public.subject_client_pk())
    OR public.is_staff_user()
  );

CREATE POLICY dental_clients_delete_authenticated_admin ON public.dental_clients FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- dental_employees
DROP POLICY IF EXISTS dental_employees_anon_read         ON public.dental_employees;
DROP POLICY IF EXISTS dental_employees_select_authenticated ON public.dental_employees;
DROP POLICY IF EXISTS dental_employees_insert_admin      ON public.dental_employees;
DROP POLICY IF EXISTS dental_employees_update_admin      ON public.dental_employees;
DROP POLICY IF EXISTS dental_employees_delete_admin      ON public.dental_employees;

CREATE POLICY dental_employees_select_authenticated ON public.dental_employees FOR SELECT TO authenticated USING (true);
CREATE POLICY dental_employees_insert_admin         ON public.dental_employees FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY dental_employees_update_admin         ON public.dental_employees FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY dental_employees_delete_admin         ON public.dental_employees FOR DELETE TO authenticated USING (public.is_admin_user());

-- appointments
DROP POLICY IF EXISTS appointments_anon_rw                ON public.appointments;
DROP POLICY IF EXISTS appointments_select_authenticated    ON public.appointments;
DROP POLICY IF EXISTS appointments_insert_authenticated    ON public.appointments;
DROP POLICY IF EXISTS appointments_update_authenticated    ON public.appointments;
DROP POLICY IF EXISTS appointments_delete_authenticated    ON public.appointments;

CREATE POLICY appointments_select_authenticated ON public.appointments FOR SELECT TO authenticated
  USING (public.is_staff_user() OR (public.subject_client_pk() IS NOT NULL AND client_id IS NOT DISTINCT FROM public.subject_client_pk()));
CREATE POLICY appointments_insert_authenticated ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user() OR (public.subject_client_pk() IS NOT NULL AND client_id IS NOT DISTINCT FROM public.subject_client_pk()));
CREATE POLICY appointments_update_authenticated ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_staff_user() OR (public.subject_client_pk() IS NOT NULL AND client_id IS NOT DISTINCT FROM public.subject_client_pk()))
  WITH CHECK (public.is_staff_user() OR (public.subject_client_pk() IS NOT NULL AND client_id IS NOT DISTINCT FROM public.subject_client_pk()));
CREATE POLICY appointments_delete_authenticated ON public.appointments FOR DELETE TO authenticated
  USING (public.is_staff_user() OR (public.subject_client_pk() IS NOT NULL AND client_id IS NOT DISTINCT FROM public.subject_client_pk()));

-- dental_messages
DROP POLICY IF EXISTS dental_messages_anon_rw                      ON public.dental_messages;
DROP POLICY IF EXISTS dental_messages_select_authenticated          ON public.dental_messages;
DROP POLICY IF EXISTS dental_messages_insert_authenticated          ON public.dental_messages;
DROP POLICY IF EXISTS dental_messages_update_authenticated          ON public.dental_messages;
DROP POLICY IF EXISTS dental_messages_delete_authenticated_admin    ON public.dental_messages;

CREATE POLICY dental_messages_select_authenticated ON public.dental_messages FOR SELECT TO authenticated
  USING (
    (public.subject_client_pk() IS NOT NULL AND (sender_id IS NOT DISTINCT FROM public.subject_client_pk() OR recipient_id IS NOT DISTINCT FROM public.subject_client_pk()))
    OR public.chat_staff_can_read_row(sender_id, recipient_id, chat_type, sender_role)
  );
CREATE POLICY dental_messages_insert_authenticated ON public.dental_messages FOR INSERT TO authenticated
  WITH CHECK (
    (sender_role = 'client' AND public.subject_client_pk() IS NOT NULL AND sender_id IS NOT DISTINCT FROM public.subject_client_pk())
    OR (sender_role IN ('doctor', 'admin') AND EXISTS (
      SELECT 1 FROM public.dental_employees e WHERE e.auth_user_id = auth.uid()
        AND ((sender_role = 'admin' AND e.role = 'admin' AND sender_id IS NOT DISTINCT FROM e.id::text)
          OR (sender_role = 'doctor' AND e.role = 'doctor'
              AND (sender_id IS NOT DISTINCT FROM e.id::text OR phone_digits_normalized(sender_id) IS NOT DISTINCT FROM phone_digits_normalized(e.phone))))
    ))
  );
CREATE POLICY dental_messages_update_authenticated          ON public.dental_messages FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY dental_messages_delete_authenticated_admin    ON public.dental_messages FOR DELETE TO authenticated USING (public.is_admin_user());

-- chat_messages
DROP POLICY IF EXISTS chat_messages_anon_rw                     ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_select_authenticated         ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_authenticated         ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_update_authenticated_staff   ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_delete_authenticated_admin   ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_update_own_client            ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_delete_own_client            ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_delete_own_staff             ON public.chat_messages;

CREATE POLICY chat_messages_select_authenticated ON public.chat_messages FOR SELECT TO authenticated
  USING (
    (public.subject_client_pk() IS NOT NULL AND (sender_id IS NOT DISTINCT FROM public.subject_client_pk() OR recipient_id IS NOT DISTINCT FROM public.subject_client_pk()))
    OR public.chat_staff_can_read_row(sender_id, recipient_id, chat_type, sender_role)
  );
CREATE POLICY chat_messages_insert_authenticated ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    (sender_role = 'client' AND public.subject_client_pk() IS NOT NULL AND sender_id IS NOT DISTINCT FROM public.subject_client_pk())
    OR (sender_role IN ('doctor', 'admin') AND EXISTS (
      SELECT 1 FROM public.dental_employees e WHERE e.auth_user_id = auth.uid()
        AND ((sender_role = 'admin' AND e.role = 'admin' AND sender_id IS NOT DISTINCT FROM e.id::text)
          OR (sender_role = 'doctor' AND e.role = 'doctor'
              AND (sender_id IS NOT DISTINCT FROM e.id::text OR phone_digits_normalized(sender_id) IS NOT DISTINCT FROM phone_digits_normalized(e.phone))))
    ))
  );
CREATE POLICY chat_messages_update_own_client ON public.chat_messages FOR UPDATE TO authenticated
  USING (sender_role = 'client' AND public.subject_client_pk() IS NOT NULL AND sender_id IS NOT DISTINCT FROM public.subject_client_pk())
  WITH CHECK (sender_role = 'client' AND public.subject_client_pk() IS NOT NULL AND sender_id IS NOT DISTINCT FROM public.subject_client_pk());
CREATE POLICY chat_messages_update_authenticated_staff ON public.chat_messages FOR UPDATE TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY chat_messages_delete_own_client ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_role = 'client' AND public.subject_client_pk() IS NOT NULL AND sender_id IS NOT DISTINCT FROM public.subject_client_pk());
CREATE POLICY chat_messages_delete_own_staff ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_role IN ('doctor', 'admin') AND EXISTS (
    SELECT 1 FROM public.dental_employees e WHERE e.auth_user_id = auth.uid()
      AND ((sender_role = 'admin' AND e.role = 'admin' AND sender_id IS NOT DISTINCT FROM e.id::text)
        OR (sender_role = 'doctor' AND e.role = 'doctor'
            AND phone_digits_normalized(sender_id) IS NOT DISTINCT FROM phone_digits_normalized(e.phone)))
  ));

-- doctor_rooms
DROP POLICY IF EXISTS doctor_rooms_anon_rw   ON public.doctor_rooms;
DROP POLICY IF EXISTS doctor_rooms_staff_all ON public.doctor_rooms;

CREATE POLICY doctor_rooms_staff_all ON public.doctor_rooms FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- doctor_messages
DROP POLICY IF EXISTS doctor_messages_anon_rw      ON public.doctor_messages;
DROP POLICY IF EXISTS doctor_messages_staff_select  ON public.doctor_messages;
DROP POLICY IF EXISTS doctor_messages_staff_insert  ON public.doctor_messages;
DROP POLICY IF EXISTS doctor_messages_staff_update  ON public.doctor_messages;
DROP POLICY IF EXISTS doctor_messages_staff_delete_own ON public.doctor_messages;

CREATE POLICY doctor_messages_staff_select ON public.doctor_messages FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY doctor_messages_staff_insert ON public.doctor_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user()
    AND EXISTS (SELECT 1 FROM public.doctor_rooms r WHERE r.id IS NOT DISTINCT FROM room_id)
    AND EXISTS (SELECT 1 FROM public.dental_employees e WHERE e.auth_user_id = auth.uid() AND e.id IS NOT DISTINCT FROM sender_id));
CREATE POLICY doctor_messages_staff_update ON public.doctor_messages FOR UPDATE TO authenticated
  USING (public.is_admin_user() OR EXISTS (SELECT 1 FROM public.dental_employees e WHERE e.auth_user_id = auth.uid() AND e.id IS NOT DISTINCT FROM sender_id))
  WITH CHECK (public.is_admin_user() OR EXISTS (SELECT 1 FROM public.dental_employees e WHERE e.auth_user_id = auth.uid() AND e.id IS NOT DISTINCT FROM sender_id));
CREATE POLICY doctor_messages_staff_delete_own ON public.doctor_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dental_employees e WHERE e.auth_user_id = auth.uid() AND e.id IS NOT DISTINCT FROM sender_id) OR public.is_admin_user());

-- doctors
DROP POLICY IF EXISTS doctors_anon_rw              ON public.doctors;
DROP POLICY IF EXISTS doctors_select_authenticated  ON public.doctors;
DROP POLICY IF EXISTS doctors_write_admin           ON public.doctors;

CREATE POLICY doctors_select_authenticated ON public.doctors FOR SELECT TO authenticated USING (is_active = true OR public.is_staff_user());
CREATE POLICY doctors_write_admin          ON public.doctors FOR ALL    TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- services
DROP POLICY IF EXISTS services_anon_rw              ON public.services;
DROP POLICY IF EXISTS services_select_authenticated  ON public.services;
DROP POLICY IF EXISTS services_write_admin           ON public.services;

CREATE POLICY services_select_authenticated ON public.services FOR SELECT TO authenticated USING (is_visible = true OR public.is_staff_user());
CREATE POLICY services_write_admin          ON public.services FOR ALL    TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- app_logs
DROP POLICY IF EXISTS app_logs_anon_rw            ON public.app_logs;
DROP POLICY IF EXISTS app_logs_insert_authenticated ON public.app_logs;
DROP POLICY IF EXISTS app_logs_select_admin        ON public.app_logs;

CREATE POLICY app_logs_insert_authenticated ON public.app_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY app_logs_select_admin         ON public.app_logs FOR SELECT TO authenticated USING (public.is_admin_user());

-- profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ============================================================
-- SEED DATA
-- ============================================================

-- Сотрудники
INSERT INTO public.dental_employees (id, phone, name, role, specialization) VALUES
  ('emp_admin', '77777777777', 'Системный Администратор', 'admin', NULL),
  ('d1',  '79991112233', 'Михайлова А.В.',  'doctor', 'Терапевт'),
  ('d2',  '79001001002', 'Соколов Д.И.',    'doctor', 'Терапевт'),
  ('d3',  '79001001003', 'Петрова Н.К.',    'doctor', 'Хирург'),
  ('d4',  '79994445566', 'Зайцев В.А.',     'doctor', 'Хирург'),
  ('d5',  '79001001005', 'Иванов С.П.',     'doctor', 'Гигиенист'),
  ('d6',  '79001001006', 'Орлова Е.М.',     'doctor', 'Гигиенист'),
  ('d7',  '79001001007', 'Борисов К.Л.',    'doctor', 'Ортодонт'),
  ('d8',  '79001001008', 'Сидорова Ю.В.',   'doctor', 'Ортодонт'),
  ('d9',  '79001001009', 'Громов А.Н.',     'doctor', 'Имплантолог'),
  ('d10', '79001001010', 'Власова Т.С.',    'doctor', 'Имплантолог')
ON CONFLICT (id) DO NOTHING;

-- Комната ординаторской
INSERT INTO public.doctor_rooms (id, name, is_general) VALUES
  ('ordinatorskaya', 'Ординаторская', true)
ON CONFLICT (id) DO NOTHING;

-- Каталог врачей (только если пустой)
INSERT INTO public.doctors (name, specialization, photo_url, is_active, sort_order)
SELECT v.name, v.specialization, '', v.is_active, v.sort_order
FROM (VALUES
  ('Михайлова Анна Владимировна',    'Терапия',        true,  10),
  ('Иванов Сергей Петрович',         'Хирургия',       true,  20),
  ('Петрова Наталья Константиновна', 'Ортодонтия',     true,  30),
  ('Соколов Дмитрий Игоревич',       'Имплантология',  true,  40),
  ('Козлова Елена Викторовна',       'Терапия',        true,  50),
  ('Смирнов Константин Алексеевич',  'Хирургия',       false, 60)
) AS v(name, specialization, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.name = v.name);

-- Каталог услуг (только если пустой)
INSERT INTO public.services (name, price, category, is_visible)
SELECT v.name, v.price, v.category, true
FROM (VALUES
  ('Профессиональная чистка зубов',    3500::numeric,  'Гигиена'),
  ('Комплексная чистка AirFlow',       5500::numeric,  'Гигиена'),
  ('Чистка AirFlow + ультразвук',      7000::numeric,  'Гигиена'),
  ('Фторирование зубов',               1500::numeric,  'Гигиена'),
  ('Лечение кариеса (1 поверхность)',  4500::numeric,  'Терапия'),
  ('Лечение кариеса (2+ поверхности)', 7500::numeric,  'Терапия'),
  ('Лечение пульпита (1-канальный)',  12000::numeric,  'Терапия'),
  ('Удаление зуба (простое)',          3500::numeric,  'Хирургия'),
  ('Удаление зуба (сложное)',          6500::numeric,  'Хирургия'),
  ('Имплантация (установка)',         45000::numeric,  'Имплантология'),
  ('Брекеты — установка',             85000::numeric,  'Ортодонтия'),
  ('Консультация ортодонта',           2500::numeric,  'Ортодонтия')
) AS v(name, price, category)
WHERE NOT EXISTS (SELECT 1 FROM public.services s WHERE s.name = v.name);

-- ============================================================
-- ФИНАЛЬНЫЙ СБРОС КЭША
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ПРОВЕРКА (опционально)
-- ============================================================
SELECT 'dental_clients'   AS tbl, count(*) FROM public.dental_clients   UNION ALL
SELECT 'dental_employees',         count(*) FROM public.dental_employees  UNION ALL
SELECT 'doctors',                  count(*) FROM public.doctors           UNION ALL
SELECT 'services',                 count(*) FROM public.services;
