-- Минимальная вставка: client_id, doctor_id, appointment_date, appointment_time, status.
-- Поле id и прочие колонки заполняются на стороне БД / остаются необязательными.
ALTER TABLE public.appointments
  ALTER COLUMN doctor_display_name DROP NOT NULL;
