-- Системные логи приложения (замена localStorage dental_logs)

CREATE TABLE IF NOT EXISTS public.app_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at
  ON public.app_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_logs_level
  ON public.app_logs (level);

COMMENT ON TABLE public.app_logs IS
  'Клиентские и серверные события Mini App для админ-панели';

ALTER TABLE public.app_logs
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_logs_anon_rw"
  ON public.app_logs;

CREATE POLICY "app_logs_anon_rw"
  ON public.app_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
