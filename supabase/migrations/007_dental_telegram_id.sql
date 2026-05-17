-- Telegram user id (строка: числовой id из Mini App)
ALTER TABLE public.dental_clients
  ADD COLUMN IF NOT EXISTS telegram_id text;

ALTER TABLE public.dental_employees
  ADD COLUMN IF NOT EXISTS telegram_id text;
