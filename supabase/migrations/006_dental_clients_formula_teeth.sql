-- Зубная формула пациента (jsonb): синхрон ЛК пациента ↔ кабинет врача.
-- Идемпотентно для БД, созданных до добавления поля в коде.
ALTER TABLE public.dental_clients
  ADD COLUMN IF NOT EXISTS formula_teeth jsonb;
