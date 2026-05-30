# Dental Mini App — Roadmap развития проекта

## Цель

Преобразовать текущий Telegram Mini App стоматологической клиники из демонстрационного проекта в коммерчески применимый MVP.

---

# Шаг 1. Перенос критических данных из localStorage в Supabase

## Цель
Устранить главный архитектурный риск проекта — хранение важных данных только на клиенте.

## Что необходимо сделать

### Создать таблицу bills
- id
- patient_id
- appointment_id
- amount
- status
- description
- created_at
- updated_at

### Создать таблицу treatment_plan_items
- id
- patient_id
- doctor_id
- title
- description
- priority
- status
- planned_date
- completed_date

### Реализовать RLS политики
- Пациент видит только свои данные
- Врач видит пациентов, с которыми работает
- Администратор имеет полный доступ

### Переписать сервисы
- lib/bills.ts
- lib/treatmentPlan.ts

### Добавить миграцию данных из localStorage

---

# Шаг 2. Полноценная медицинская карта пациента

## Что необходимо сделать
- Создать таблицу medical_records
- Создать таблицу patient_visits
- Добавить экран истории лечения
- Интегрировать историю лечения в кабинет врача

---

# Шаг 3. Хранение файлов и медицинских снимков

## Что необходимо сделать
- Настроить Supabase Storage
- Создать bucket patient-files
- Создать таблицу patient_files
- Поддержать JPG, PNG, PDF
- Добавить экран документов пациента

---

# Шаг 4. Автоматизация уведомлений

## Что необходимо сделать
- Настроить фоновые задачи
- Напоминания за 24 часа
- Напоминания за 2 часа
- Уведомления после отмены и переноса
- Telegram-кнопки подтверждения записи

---

# Шаг 5. Финансовый модуль

## Что необходимо сделать
- Доработать счета
- Создать таблицу payments
- Добавить финансовые отчеты
- Подготовить интеграцию с эквайрингом

---

# Шаг 6. CRM и маркетинг ✅

## Реализовано
- Таблицы `patient_metrics`, `marketing_campaigns`, `campaign_deliveries` — миграция `007_crm_marketing.sql`
- Сегменты: new, active, at_risk, dormant, high_value, debtor — функция `refresh_patient_metrics()`
- Cron `/api/cron/crm-campaigns` (ежедневно 09:00) — авто-кампании `reactivation_auto`
- Админ-экран `/screens/admin/crm` — сегменты, пациенты, кампании, ручной запуск в Telegram
- Кнопки возврата: «Записаться на приём» + Mini App

---

# Шаг 7. KPI врачей и аналитика ✅

## Реализовано
- Таблица `doctor_metrics`, функция `refresh_doctor_metrics()` — миграция `008_analytics_kpi.sql`
- KPI: записи, завершения, отмены, выручка, конверсия по каждому врачу
- Экран `/screens/admin/analytics` — вкладки Обзор / Врачи / Пациенты
- Графики: выручка по врачам, сегменты пациентов (recharts)
- Экспорт CSV: KPI врачей + сегменты + топ LTV
- Дашборд: карточки пациентов/KPI, ссылка на аналитику

---

# Шаг 8. Audit Trail и безопасность ✅

## Реализовано
- Таблица `audit_logs`, триггеры на med-таблицах — миграция `009_audit_logs.sql`
- Логируются: `medical_records`, `patient_visits`, `patient_files`, `treatment_plan_items`, `dental_clients` (formula_teeth, internal_notes)
- Экран `/screens/admin/audit` — фильтры, diff old/new, экспорт CSV
- RLS: чтение только админ; запись через SECURITY DEFINER триггеры

---

# Шаг 9. Рефакторинг API ✅

## Реализовано
- **Инфраструктура API** — `lib/server/api/` (`apiError`, `apiResponse`, `parseDentalRequest`); единый формат `{ ok, data }` / `{ ok, false, error }`
- **Сервисный слой** — `lib/server/services/*` (appointments, cache, chat, clients, doctor rooms, auth, patient resolver); `dentalDbGateway` — thin delegator
- **REST вместо gateway** — `/api/appointments`, `/api/cache/dental`, `/api/chat/messages`, `/api/clients/*`, `/api/doctor/rooms`, `/api/auth/telegram-id`
- **Клиент** — `lib/api/fetchApi.ts` (`dentalApiFetch`); миграция `lib/auth`, `appointments`, `supportChat`, `doctorOrdinatorskayaChat`
- **`/api/dental-db`** — deprecated (обратная совместимость)

---

# Шаг 10. Подготовка к коммерческому запуску 🔄

## Реализовано
- **Демо-стенд** — `docs/DEMO_STAND.md`, `.env.demo.example` (Supabase + Vercel + Telegram Bot)
- **Демо-данные** — `supabase/seed_demo_commercial.sql` (12 пациентов, записи, медкарта, счета, CRM-сегменты); сброс — `seed_demo_reset.sql`
- **Презентация** — `docs/PRODUCT_PRESENTATION.md` (14 слайдов + one-pager)
- **Интервью** — `docs/CLINIC_INTERVIEW_GUIDE.md` (скрипт, outreach, таблица 5+ клиник)

## Осталось (операционно)
- [ ] Развернуть demo на отдельном Supabase + Vercel
- [ ] Подключить Telegram Bot к demo URL
- [ ] Провести интервью с 5+ клиниками (заполнить таблицу в гайде)

---

# Шаг 11 (extension). Мультитенантность ✅

См. `ROADMAP_EXTENSION_11_15.md` — миграция `010_multi_tenant.sql`, API и брендинг клиники.

# Шаг 15 (extension). SaaS-подготовка ✅

См. `ROADMAP_EXTENSION_11_15.md` — миграция `012_saas_platform.sql`, Super Admin, тарифы, онбординг.

---

# Конечная цель

Создать коммерчески применимый SaaS-продукт для стоматологических клиник с CRM, медицинской картой, финансами, аналитикой и Telegram-интеграцией.
