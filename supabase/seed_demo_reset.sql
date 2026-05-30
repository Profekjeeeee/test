-- Сброс демо-данных (шаг 10 ROADMAP)
-- Запуск ПЕРЕД повторным seed_demo_commercial.sql
-- Безопасно: удаляет только записи с маркером [DEMO] или телефоны 790010020xx

-- ─── Пациенты-демо ───────────────────────────────────────────────────────────
DELETE FROM public.campaign_deliveries
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.payments
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.bills
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.treatment_plan_items
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.patient_visits
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.medical_records
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.patient_files
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.appointments
WHERE comment LIKE '[DEMO]%'
   OR client_id IN (SELECT id FROM public.dental_clients WHERE phone LIKE '790010020%');

DELETE FROM public.chat_messages
WHERE text LIKE '[DEMO]%';

DELETE FROM public.patient_metrics
WHERE patient_id IN (
  SELECT id::uuid FROM public.dental_clients WHERE phone LIKE '790010020%'
);

DELETE FROM public.dental_clients WHERE phone LIKE '790010020%';

-- ─── Обновить KPI после очистки ──────────────────────────────────────────────
SELECT public.refresh_patient_metrics();
SELECT public.refresh_doctor_metrics();

SELECT 'demo reset complete' AS status;
