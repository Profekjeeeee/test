-- Стоматология: схема под Supabase (выполните в SQL Editor или через CLI).
-- После применения: Database → Replication → убедитесь, что dental_messages в publication (ниже ALTER PUBLICATION).

-- ─── dental_clients ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dental_clients (
  id text PRIMARY KEY,
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
  id text PRIMARY KEY,
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
  id text PRIMARY KEY,
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
