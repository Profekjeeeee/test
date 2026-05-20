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
