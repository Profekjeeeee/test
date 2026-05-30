-- Вторая демо-клиника для проверки RLS-изоляции (шаг 15)
-- Запускать после 010_multi_tenant.sql и 012_saas_platform.sql

INSERT INTO public.clinics (id, slug, name, is_active, onboarding_status, onboarded_at)
VALUES (
  'c0000000-0000-4000-8000-000000000002'::uuid,
  'demo-b',
  'SmileLab Demo B',
  true,
  'completed',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinic_settings (
  clinic_id,
  display_name,
  tagline,
  address_line1,
  city,
  phone,
  email,
  primary_color,
  accent_color,
  working_hours,
  booking_slots
)
VALUES (
  'c0000000-0000-4000-8000-000000000002'::uuid,
  'SmileLab — клиника B',
  'Демо-тенант для RLS-теста',
  'ул. Демо, 1',
  'Москва',
  '+74950000001',
  'demo-b@smilelab.test',
  '#248bcf',
  '#1D4ED8',
  '[{"day":"Пн — Пт","hours":"10:00 — 19:00"}]'::jsonb,
  '{"startHour":10,"endHour":19,"stepMinutes":30}'::jsonb
)
ON CONFLICT (clinic_id) DO NOTHING;

INSERT INTO public.clinic_subscriptions (clinic_id, plan_id, status, trial_ends_at, current_period_end)
VALUES (
  'c0000000-0000-4000-8000-000000000002'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'trial',
  now() + interval '14 days',
  now() + interval '14 days'
)
ON CONFLICT (clinic_id) DO NOTHING;

-- Админ demo-b (телефон уникален в рамках клиники)
INSERT INTO public.dental_employees (id, clinic_id, phone, name, role)
VALUES (
  'emp-demo-b-admin',
  'c0000000-0000-4000-8000-000000000002'::uuid,
  '+74951111001',
  'Админ Demo B',
  'admin'
)
ON CONFLICT (id) DO NOTHING;
