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
