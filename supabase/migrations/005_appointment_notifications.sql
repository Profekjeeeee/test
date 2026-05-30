-- Шаг 4 ROADMAP: автоматизация уведомлений (напоминания, подтверждение записи)

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_tg_message_id bigint;

COMMENT ON COLUMN public.appointments.reminder_24h_sent_at IS
  'Когда отправлено Telegram-напоминание за ~24 ч до приёма.';
COMMENT ON COLUMN public.appointments.reminder_2h_sent_at IS
  'Когда отправлено Telegram-напоминание за ~2 ч до приёма.';
COMMENT ON COLUMN public.appointments.confirmed_at IS
  'Пациент подтвердил запись через inline-кнопку в Telegram.';
COMMENT ON COLUMN public.appointments.confirmation_tg_message_id IS
  'message_id сообщения с кнопками подтверждения (для editMessageText).';

CREATE INDEX IF NOT EXISTS idx_appointments_reminders_pending
  ON public.appointments (appointment_date, appointment_time)
  WHERE status IN ('pending', 'scheduled', 'rescheduled')
    AND (reminder_24h_sent_at IS NULL OR reminder_2h_sent_at IS NULL);
