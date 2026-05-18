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
