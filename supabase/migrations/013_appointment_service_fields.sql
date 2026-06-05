-- Шаг 13: текстовая услуга и цена прямо в записи на приём
-- Бронирование на клиенте использует справочник SERVICES_MOCK, чьи названия
-- не совпадают с public.services. Чтобы врач/клиент/админка видели реально
-- выбранную услугу и сумму, храним их текстом прямо в строке записи.
-- Колонки добавляются как nullable — миграция безопасна и идемпотентна.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service text,
  ADD COLUMN IF NOT EXISTS price   numeric;

COMMENT ON COLUMN public.appointments.service IS
  'Название услуги, выбранной при онлайн-записи (UI-снимок, может отличаться от services.name).';
COMMENT ON COLUMN public.appointments.price IS
  'Стоимость услуги на момент записи (₽). Источник суммы счёта.';

NOTIFY pgrst, 'reload schema';
