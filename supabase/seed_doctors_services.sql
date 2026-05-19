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
