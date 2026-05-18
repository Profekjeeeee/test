-- client_id должен указывать на профиль (dental_clients.id), а не на сырой номер телефона.
-- 1) Подтягиваем id клиента по совпадению нормализованного телефона, если в client_id лежали только цифры.
-- 2) Запрещаем «телефоноподобные» значения в client_id (10–15 подряд идущих цифр).

UPDATE public.appointments a
SET client_id = c.id
FROM public.dental_clients c
WHERE a.client_id IS NOT NULL
  AND a.client_id ~ '^[0-9]{10,15}$'
  AND public.phone_digits_normalized(a.client_id) = public.phone_digits_normalized(c.phone);

-- Оставшийся «телефон» без соответствующего `dental_clients.id` — обнуляем (иначе CHECK).
UPDATE public.appointments a
SET client_id = NULL
WHERE a.client_id IS NOT NULL
  AND a.client_id ~ '^[0-9]{10,15}$'
  AND NOT EXISTS (SELECT 1 FROM public.dental_clients c WHERE c.id = a.client_id);

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_client_id_not_phone_like;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_id_not_phone_like CHECK (
    client_id IS NULL
    OR client_id !~ '^[0-9]{10,15}$'
  );

COMMENT ON CONSTRAINT appointments_client_id_not_phone_like ON public.appointments IS
  'client_id — только внешний ключ на dental_clients.id; «голый» телефон в этом поле запрещён.';
