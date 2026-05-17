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
