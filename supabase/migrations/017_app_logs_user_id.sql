-- Колонка user_id для app_logs (связь с сессией без разбора metadata)

ALTER TABLE public.app_logs
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_app_logs_user_id
  ON public.app_logs (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.app_logs.user_id IS
  'ID пользователя из клиентской сессии (dental_clients / employees)';
