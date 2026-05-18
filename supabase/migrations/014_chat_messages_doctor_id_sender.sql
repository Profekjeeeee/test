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
