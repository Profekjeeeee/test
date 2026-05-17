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
