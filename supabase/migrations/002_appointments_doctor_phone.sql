-- Телефон врача для записи (дублирует employees.phone для отчётов и интеграций).
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_phone text;
