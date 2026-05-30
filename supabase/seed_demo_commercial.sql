-- ============================================================
-- DentalCare — DEMO DATA (Шаг 10 ROADMAP)
-- Наполнение демо-стенда реалистичными данными
-- Запуск: Supabase Dashboard → SQL Editor
-- Порядок: migrations 001–010 → seed_doctors_services.sql → этот файл
-- Сброс: seed_demo_reset.sql → этот файл
-- ============================================================

-- ─── 12 демо-пациентов (сегменты CRM: new, active, at_risk, dormant, high_value, debtor) ───

INSERT INTO public.dental_clients (id, phone, name, first_name, last_name, email, formula_teeth, internal_notes)
SELECT v.id, v.phone, v.name, v.first_name, v.last_name, v.email, v.formula_teeth::jsonb, v.internal_notes
FROM (VALUES
  (
    'a1000001-0001-4001-8001-000000000001',
    '79001002001',
    'Петров Иван Сергеевич',
    'Иван',
    'Петров',
    'petrov.demo@example.com',
    '[{"number":16,"condition":"caries","jaw":"upper","side":"right","hasNote":true,"notes":"Глубокий кариес"},{"number":26,"condition":"treated","jaw":"upper","side":"left","hasNote":false},{"number":36,"condition":"healthy","jaw":"lower","side":"left","hasNote":false}]',
    '[DEMO] Активный пациент. Аллергия на лидокаин — уточнять перед анестезией.'
  ),
  (
    'a1000001-0001-4001-8001-000000000002',
    '79001002002',
    'Смирнова Мария Александровна',
    'Мария',
    'Смирнова',
    'smirnova.demo@example.com',
    '[{"number":11,"condition":"crown","jaw":"upper","side":"right","hasNote":false},{"number":21,"condition":"crown","jaw":"upper","side":"left","hasNote":false}]',
    '[DEMO] VIP-пациент. Имплантация 46 зуба в процессе.'
  ),
  (
    'a1000001-0001-4001-8001-000000000003',
    '79001002003',
    'Козлова Елена Викторовна',
    'Елена',
    'Козлова',
    'kozlova.demo@example.com',
    '[{"number":37,"condition":"pulpitis","jaw":"lower","side":"left","hasNote":true}]',
    '[DEMO] Риск оттока — давно не была на профилактике.'
  ),
  (
    'a1000001-0001-4001-8001-000000000004',
    '79001002004',
    'Новиков Алексей Дмитриевич',
    'Алексей',
    'Новиков',
    'novikov.demo@example.com',
    '[]',
    '[DEMO] Новый пациент — первая запись на консультацию.'
  ),
  (
    'a1000001-0001-4001-8001-000000000005',
    '79001002005',
    'Волкова Анна Игоревна',
    'Анна',
    'Волкова',
    'volkova.demo@example.com',
    '[{"number":46,"condition":"removed","jaw":"lower","side":"right","hasNote":false}]',
    '[DEMO] Долг 12 500 ₽ — просроченный счёт.'
  ),
  (
    'a1000001-0001-4001-8001-000000000006',
    '79001002006',
    'Морозов Дмитрий Павлович',
    'Дмитрий',
    'Морозов',
    'morozov.demo@example.com',
    '[{"number":14,"condition":"caries","jaw":"upper","side":"right","hasNote":false}]',
    '[DEMO] Спящий сегмент — не был >180 дней.'
  ),
  (
    'a1000001-0001-4001-8001-000000000007',
    '79001002007',
    'Лебедева Ольга Николаевна',
    'Ольга',
    'Лебедева',
    'lebedeva.demo@example.com',
    '[{"number":24,"condition":"treated","jaw":"upper","side":"left","hasNote":false}]',
    '[DEMO] Ортодонтия — брекеты, контроль раз в месяц.'
  ),
  (
    'a1000001-0001-4001-8001-000000000008',
    '79001002008',
    'Соколов Артём Владимирович',
    'Артём',
    'Соколов',
    'sokolov.demo@example.com',
    '[]',
    '[DEMO] Гигиена — регулярные чистки.'
  ),
  (
    'a1000001-0001-4001-8001-000000000009',
    '79001002009',
    'Федорова Ксения Андреевна',
    'Ксения',
    'Федорова',
    'fedorova.demo@example.com',
    '[{"number":36,"condition":"implant","jaw":"lower","side":"left","hasNote":true}]',
    '[DEMO] Имплантолог — этап 2 из 3.'
  ),
  (
    'a1000001-0001-4001-8001-000000000010',
    '79001002010',
    'Кузнецов Павел Олегович',
    'Павел',
    'Кузнецов',
    'kuznetsov.demo@example.com',
    '[{"number":47,"condition":"caries","jaw":"lower","side":"right","hasNote":false}]',
    '[DEMO] Запись на сегодня — демо для админ-дашборда.'
  ),
  (
    'a1000001-0001-4001-8001-000000000011',
    '79001002011',
    'Орлова Татьяна Сергеевна',
    'Татьяна',
    'Орлова',
    'orlova.demo@example.com',
    '[]',
    '[DEMO] План лечения — 3 этапа.'
  ),
  (
    'a1000001-0001-4001-8001-000000000012',
    '79001002012',
    'Громов Никита Евгеньевич',
    'Никита',
    'Громов',
    'gromov.demo@example.com',
    '[{"number":18,"condition":"healthy","jaw":"upper","side":"right","hasNote":false}]',
    '[DEMO] Молодой пациент — профилактика.'
  )
) AS v(id, phone, name, first_name, last_name, email, formula_teeth, internal_notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dental_clients c WHERE c.phone = v.phone
);

-- Обновить существующих демо-пациентов
UPDATE public.dental_clients c
SET
  name = v.name,
  first_name = v.first_name,
  last_name = v.last_name,
  email = v.email,
  formula_teeth = v.formula_teeth::jsonb,
  internal_notes = v.internal_notes
FROM (VALUES
  ('79001002001', 'Петров Иван Сергеевич', 'Иван', 'Петров', 'petrov.demo@example.com',
   '[{"number":16,"condition":"caries","jaw":"upper","side":"right","hasNote":true}]',
   '[DEMO] Активный пациент. Аллергия на лидокаин.'),
  ('79001002002', 'Смирнова Мария Александровна', 'Мария', 'Смирнова', 'smirnova.demo@example.com',
   '[{"number":11,"condition":"crown","jaw":"upper","side":"right","hasNote":false}]',
   '[DEMO] VIP-пациент.'),
  ('79001002005', 'Волкова Анна Игоревна', 'Анна', 'Волкова', 'volkova.demo@example.com',
   '[{"number":46,"condition":"removed","jaw":"lower","side":"right","hasNote":false}]',
   '[DEMO] Долг 12 500 ₽.')
) AS v(phone, name, first_name, last_name, email, formula_teeth, internal_notes)
WHERE c.phone = v.phone;

-- ─── Записи на приём (относительные даты) ────────────────────────────────────

INSERT INTO public.appointments (
  client_id, doctor_id, doctor_name, appointment_date, appointment_time,
  status, comment, patient_name, service_id
)
SELECT
  p.id,
  v.doctor_id,
  v.doctor_name,
  to_char(v.apt_date, 'YYYY-MM-DD'),
  v.apt_time,
  v.status,
  v.comment,
  p.name,
  (SELECT s.id FROM public.services s WHERE s.name = v.service_name LIMIT 1)
FROM (VALUES
  -- Сегодня (дашборд)
  ('79001002001', 'd1',  'Михайлова А.В.', CURRENT_DATE,     '10:00', 'scheduled', '[DEMO] Консультация + лечение 16', 'Лечение кариеса (1 поверхность)'),
  ('79001002010', 'd3',  'Петрова Н.К.',   CURRENT_DATE,     '11:30', 'scheduled', '[DEMO] Удаление 47',               'Удаление зуба (простое)'),
  ('79001002007', 'd7',  'Борисов К.Л.',   CURRENT_DATE,     '14:00', 'scheduled', '[DEMO] Контроль брекетов',         'Консультация ортодонта'),
  -- Завтра
  ('79001002004', 'd1',  'Михайлова А.В.', CURRENT_DATE + 1, '09:00', 'pending',   '[DEMO] Первая консультация',       'Профессиональная чистка зубов'),
  ('79001002011', 'd2',  'Соколов Д.И.',   CURRENT_DATE + 1, '15:00', 'scheduled', '[DEMO] Этап 1 плана',              'Лечение кариеса (2+ поверхности)'),
  -- Прошлые (история + KPI)
  ('79001002001', 'd1',  'Михайлова А.В.', CURRENT_DATE - 14, '10:00', 'completed', '[DEMO] Чистка',                    'Профессиональная чистка зубов'),
  ('79001002002', 'd9',  'Громов А.Н.',    CURRENT_DATE - 30, '11:00', 'completed', '[DEMO] Имплантация этап 1',        'Имплантация (установка)'),
  ('79001002002', 'd1',  'Михайлова А.В.', CURRENT_DATE - 60, '09:30', 'completed', '[DEMO] Терапия',                   'Лечение кариеса (2+ поверхности)'),
  ('79001002003', 'd5',  'Иванов С.П.',    CURRENT_DATE - 90, '12:00', 'completed', '[DEMO] Гигиена',                   'Комплексная чистка AirFlow'),
  ('79001002005', 'd1',  'Михайлова А.В.', CURRENT_DATE - 45, '16:00', 'completed', '[DEMO] Лечение до счёта',          'Лечение пульпита (1-канальный)'),
  ('79001002008', 'd6',  'Орлова Е.М.',    CURRENT_DATE - 7,  '10:30', 'completed', '[DEMO] Профилактика',              'Фторирование зубов'),
  ('79001002009', 'd9',  'Громов А.Н.',    CURRENT_DATE - 21, '14:30', 'completed', '[DEMO] Имплант контроль',          'Имплантация (установка)'),
  -- Отмены (KPI)
  ('79001002006', 'd2',  'Соколов Д.И.',   CURRENT_DATE - 3,  '11:00', 'cancelled', '[DEMO] Отмена пациентом',          'Удаление зуба (простое)'),
  ('79001002003', 'd1',  'Михайлова А.В.', CURRENT_DATE + 3,  '09:00', 'scheduled', '[DEMO] Профилактика — at_risk',    'Профессиональная чистка зубов'),
  -- Спящий (>180 дней назад)
  ('79001002006', 'd5',  'Иванов С.П.',    CURRENT_DATE - 200,'10:00', 'completed', '[DEMO] Последний визит dormant',   'Профессиональная чистка зубов')
) AS v(phone, doctor_id, doctor_name, apt_date, apt_time, status, comment, service_name)
INNER JOIN public.dental_clients p ON p.phone = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.client_id = p.id
    AND a.appointment_date = to_char(v.apt_date, 'YYYY-MM-DD')
    AND a.appointment_time = v.apt_time
    AND a.comment LIKE '[DEMO]%'
);

-- ─── Медицинские записи ──────────────────────────────────────────────────────

INSERT INTO public.medical_records (patient_id, record_type, title, description, severity, visible_to_patient)
SELECT p.id::uuid, v.record_type, v.title, v.description, v.severity, true
FROM (VALUES
  ('79001002001', 'allergy',           'Лидокаин',              'Местная анестезия — лёгкая реакция', 'medium'),
  ('79001002001', 'chronic',           'Гипертония I ст.',      'Контроль АД перед процедурами',      'low'),
  ('79001002002', 'medication',        'Антибиотики',           'Амоксициллин 500 мг — курс 5 дней', 'low'),
  ('79001002005', 'contraindication',  'Беременность',          'Рентген только по показаниям',       'high'),
  ('79001002007', 'general',           'Брекет-система',        'Установлена 2024-03, контроль ежемесячно', NULL)
) AS v(phone, record_type, title, description, severity)
INNER JOIN public.dental_clients p ON p.phone = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM public.medical_records mr
  WHERE mr.patient_id::text = p.id::text AND mr.title = v.title
);

-- ─── История лечения (визиты) ────────────────────────────────────────────────

INSERT INTO public.patient_visits (
  patient_id, visit_date, procedure_title, procedure_description,
  tooth_numbers, diagnosis, clinical_notes, price, visible_to_patient
)
SELECT
  p.id::uuid,
  v.visit_date,
  v.procedure_title,
  v.procedure_description,
  v.tooth_numbers,
  v.diagnosis,
  v.clinical_notes,
  v.price,
  true
FROM (VALUES
  ('79001002001', CURRENT_DATE - 14, 'Профессиональная чистка', 'Удаление зубного камня, полировка', ARRAY[16,17,26,27], 'Налёт, камень', 'Рекомендована гигиена раз в 6 мес.', 3500::numeric),
  ('79001002002', CURRENT_DATE - 30, 'Установка импланта 36',   'Nobel Biocare, этап 1',             ARRAY[36],          'Adentia 36',    'Контроль через 3 мес.',              45000::numeric),
  ('79001002005', CURRENT_DATE - 45, 'Лечение пульпита 46',     '1 канал, пломба',                   ARRAY[46],          'Pulpitis 46',   'Счёт выставлен',                     12000::numeric),
  ('79001002008', CURRENT_DATE - 7,  'Фторирование',            'Профилактика кариеса',              ARRAY[]::integer[], 'Профилактика',  'Следующий визит через 6 мес.',       1500::numeric)
) AS v(phone, visit_date, procedure_title, procedure_description, tooth_numbers, diagnosis, clinical_notes, price)
INNER JOIN public.dental_clients p ON p.phone = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM public.patient_visits pv
  WHERE pv.patient_id::text = p.id::text
    AND pv.visit_date = v.visit_date
    AND pv.procedure_title = v.procedure_title
);

-- ─── План лечения ────────────────────────────────────────────────────────────

INSERT INTO public.treatment_plan_items (
  patient_id, title, description, category, price, priority, status, planned_date, completed_date
)
SELECT
  p.id::uuid,
  v.title,
  v.description,
  v.category,
  v.price,
  v.priority,
  v.status,
  v.planned_date,
  v.completed_date
FROM (VALUES
  ('79001002001', 'Лечение 16 зуба',       'Пломба после кариеса',     'Терапия',        4500::numeric,  1, 'pending',     CURRENT_DATE + 7,  NULL),
  ('79001002002', 'Коронка на имплант 36', 'После приживления',        'Имплантология',  35000::numeric, 2, 'pending',     CURRENT_DATE + 90, NULL),
  ('79001002011', 'Лечение 14 зуба',       'Кариес 2 поверхности',     'Терапия',        7500::numeric,  1, 'in_progress', CURRENT_DATE + 1,  NULL),
  ('79001002011', 'Профилактика',          'Чистка после лечения',     'Гигиена',        3500::numeric,  2, 'pending',     CURRENT_DATE + 30, NULL),
  ('79001002007', 'Коррекция брекетов',    'Ежемесячный контроль',     'Ортодонтия',     2500::numeric,  1, 'completed',   CURRENT_DATE - 30, CURRENT_DATE - 30)
) AS v(phone, title, description, category, price, priority, status, planned_date, completed_date)
INNER JOIN public.dental_clients p ON p.phone = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM public.treatment_plan_items t
  WHERE t.patient_id::text = p.id::text AND t.title = v.title
);

-- ─── Счета и платежи ─────────────────────────────────────────────────────────

INSERT INTO public.bills (
  patient_id, amount, paid_amount, status, description, bill_number, due_date, paid_at
)
SELECT
  p.id::uuid,
  v.amount,
  v.paid_amount,
  v.status,
  v.description,
  v.bill_number,
  v.due_date,
  v.paid_at
FROM (VALUES
  ('79001002001', 4500::numeric,  4500::numeric,  'paid',    'Чистка зубов 14.02',           'DEMO-2025-001', CURRENT_DATE - 14, CURRENT_DATE - 10),
  ('79001002002', 45000::numeric, 45000::numeric, 'paid',    'Имплантация 36 — этап 1',      'DEMO-2025-002', CURRENT_DATE - 30, CURRENT_DATE - 28),
  ('79001002002', 35000::numeric, 10000::numeric, 'partial', 'Коронка на имплант (аванс)',   'DEMO-2025-003', CURRENT_DATE + 60, NULL),
  ('79001002005', 12500::numeric, 0::numeric,     'overdue', 'Лечение пульпита 46',          'DEMO-2025-004', CURRENT_DATE - 30, NULL),
  ('79001002010', 3500::numeric,  0::numeric,     'pending', 'Удаление 47 (предоплата)',   'DEMO-2025-005', CURRENT_DATE + 14, NULL)
) AS v(phone, amount, paid_amount, status, description, bill_number, due_date, paid_at)
INNER JOIN public.dental_clients p ON p.phone = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM public.bills b WHERE b.bill_number = v.bill_number
);

-- Платежи по оплаченным счетам
INSERT INTO public.payments (bill_id, patient_id, amount, method, status, provider, completed_at)
SELECT b.id, b.patient_id, b.paid_amount, 'card_terminal', 'succeeded', 'mock', b.paid_at
FROM public.bills b
WHERE b.bill_number IN ('DEMO-2025-001', 'DEMO-2025-002')
  AND b.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.payments pay WHERE pay.bill_id = b.id AND pay.status = 'succeeded'
  );

INSERT INTO public.payments (bill_id, patient_id, amount, method, status, provider, completed_at)
SELECT b.id, b.patient_id, 10000, 'transfer', 'succeeded', 'mock', CURRENT_DATE - 5
FROM public.bills b
WHERE b.bill_number = 'DEMO-2025-003'
  AND NOT EXISTS (SELECT 1 FROM public.payments pay WHERE pay.bill_id = b.id);

-- ─── Демо-сообщения чата ─────────────────────────────────────────────────────

INSERT INTO public.chat_messages (sender_id, recipient_id, text, sender_role, chat_type, sender_name)
SELECT v.sender_id, v.recipient_id, v.text, v.sender_role, v.chat_type, v.sender_name
FROM (VALUES
  ('79001002001', 'support', '[DEMO] Здравствуйте! Можно перенести запись на завтра?', 'client', 'support', 'Иван Петров'),
  ('support', '79001002001', '[DEMO] Добрый день! Конечно, перенесём. На какое время удобно?', 'admin', 'support', 'Поддержка'),
  ('79001002001', 'd1', '[DEMO] Доктор, после чистки чувствительность — это нормально?', 'client', 'doctor', 'Иван Петров'),
  ('d1', '79001002001', '[DEMO] Да, 2–3 дня — норма. Используйте пасту для чувствительных зубов.', 'doctor', 'doctor', 'Михайлова А.В.')
) AS v(sender_id, recipient_id, text, sender_role, chat_type, sender_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_messages cm WHERE cm.text = v.text
);

-- ─── Обновить CRM-метрики и KPI врачей ────────────────────────────────────────

SELECT public.refresh_patient_metrics();
SELECT public.refresh_doctor_metrics();

-- ─── Проверка ────────────────────────────────────────────────────────────────

SELECT 'demo_patients' AS metric, count(*)::text AS value
FROM public.dental_clients WHERE phone LIKE '790010020%'
UNION ALL
SELECT 'demo_appointments', count(*)::text
FROM public.appointments WHERE comment LIKE '[DEMO]%'
UNION ALL
SELECT 'demo_bills', count(*)::text
FROM public.bills WHERE bill_number LIKE 'DEMO-%'
UNION ALL
SELECT 'patient_metrics', count(*)::text FROM public.patient_metrics
UNION ALL
SELECT 'doctor_metrics', count(*)::text FROM public.doctor_metrics;
