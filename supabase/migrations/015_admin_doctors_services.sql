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