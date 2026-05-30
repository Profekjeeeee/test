# Демо-стенд — инструкция по развёртыванию

> Шаг 10 ROADMAP: подготовка к коммерческому запуску

## Цель

Отдельное окружение для показа продукта клиникам, инвесторам и на интервью — **без риска для prod-данных**.

---

## 1. Инфраструктура

| Компонент | Рекомендация |
|-----------|--------------|
| **Supabase** | Отдельный проект `dental-demo` (Free tier достаточно) |
| **Vercel** | Preview deployment или отдельный проект `dental-demo` |
| **Telegram Bot** | Тестовый бот через [@BotFather](https://t.me/BotFather) |
| **Домен** | `demo.yourclinic.ru` или `*.vercel.app` |

---

## 2. Порядок развёртывания

### 2.1 Supabase

1. Создай проект в [Supabase Dashboard](https://supabase.com/dashboard).
2. SQL Editor → выполни миграции **по порядку**:
   - `supabase/migrations/001_master.sql`
   - `002_bills_treatment_plan.sql` … `011_video_consultations.sql`
   - `012_saas_platform.sql`
   - `supabase/seed_doctors_services.sql`
   - `supabase/seed_demo_commercial.sql`
   - `supabase/seed_demo_tenant_b.sql` (опционально — второй тенант для RLS-теста)
3. Storage → создай bucket `patient-files` (если не создан миграцией 004).
4. Authentication → включи Email provider (для shadow auth).

### 2.2 Vercel

1. Import репозитория → новый проект или branch `demo`.
2. Environment Variables — скопируй из `.env.demo.example`.
3. Deploy.
4. Cron jobs подхватятся из `vercel.json` автоматически.

### 2.3 Telegram Mini App

1. BotFather → `/newbot` → получи `TELEGRAM_BOT_TOKEN`.
2. BotFather → `/newapp` → привяжи URL: `https://your-demo.vercel.app`.
3. Menu Button → URL Mini App.
4. `TELEGRAM_MINI_APP_URL` = тот же URL.

---

## 3. Демо-аккаунты

### Администратор

| Поле | Значение |
|------|----------|
| Телефон | `77777777777` |
| PIN | создаётся при первом входе (4–6 цифр) |
| Маршрут | `/screens/admin/dashboard` |

### Врачи (вход по телефону)

| ID | Телефон | Специализация |
|----|---------|---------------|
| d1 | `79991112233` | Терапевт |
| d3 | `79001001003` | Хирург |
| d7 | `79001001007` | Ортодонт |
| d9 | `79001001009` | Имплантолог |

Маршрут: `/screens/doctor/cabinet`

### Пациенты (демо-данные)

12 пациентов с телефонами `79001002001` … `79001002012`.

**Вход пациента** — только через Telegram Mini App. Для демо:

1. Зарегистрируй тестовый Telegram-аккаунт.
2. Открой Mini App → регистрация с одним из демо-телефонов **или** покажи пациентский UX через кабинет врача/админа.

> Альтернатива: привяжи `telegram_id` тестового аккаунта к пациенту `79001002001` через SQL Editor.

---

## 4. Сценарий демо (15 минут)

### Блок A — Администратор (5 мин)

1. Вход: телефон `77777777777` → PIN.
2. **Дашборд** — KPI, записи на сегодня (3 приёма).
3. **Аналитика** (`/screens/admin/analytics`) — выручка по врачам, сегменты пациентов, экспорт CSV.
4. **CRM** (`/screens/admin/crm`) — сегменты, кампания reactivation.
5. **Финансы** (`/screens/admin/finance`) — счета, просрочка (Волкова).
6. **Audit** (`/screens/admin/audit`) — журнал изменений медкарты.

### Блок B — Врач (5 мин)

1. Вход: телефон `79991112233` (d1).
2. **Кабинет** — календарь, приёмы на сегодня.
3. Открыть **Петров И.С.** — зубная формула, internal notes, аллергия на лидокаин.
4. **История лечения** — визит 14 дней назад.
5. **Ординаторская** — чат врачей, консilium.

### Блок C — Пациент / Telegram (5 мин)

1. Mini App → главная — ближайший приём, план лечения.
2. **Запись** (`/booking`) — выбор врача, слота.
3. **Формула** — интерактивная карта зубов.
4. **Счета** — оплаченные / просроченные.
5. **Чат** — поддержка и личный врач.

---

## 5. Сброс и обновление демо-данных

```sql
-- Supabase SQL Editor
\i seed_demo_reset.sql      -- или вставь содержимое файла
\i seed_demo_commercial.sql
```

Или вручную:

1. `supabase/seed_demo_reset.sql` — удаляет только `[DEMO]` записи.
2. `supabase/seed_demo_commercial.sql` — заново наполняет.

После сброса KPI обновятся автоматически (`refresh_patient_metrics`, `refresh_doctor_metrics`).

---

## 6. Чеклист перед показом

- [ ] Миграции 001–012 применены
- [ ] Demo seed выполнен (12 пациентов, ~15 записей)
- [ ] Telegram Bot + Mini App URL настроены
- [ ] Cron secret задан (`CRON_SECRET` в Vercel)
- [ ] Тестовый вход админа и врача работает
- [ ] PIN создан для демо-аккаунтов
- [ ] Презентация готова (`docs/PRODUCT_PRESENTATION.md`)
- [ ] Шаблон интервью распечатан (`docs/CLINIC_INTERVIEW_GUIDE.md`)

---

## 7. Безопасность демо-стенда

- **Не** используй prod Supabase credentials.
- **Не** включай `DENTAL_GATE_DEV_ALLOW=1` на публичном demo URL.
- **Не** включай `NEXT_PUBLIC_DEMO_OTP_CODES` в production.
- Service role key — только на сервере Vercel, не в клиенте.

---

## 8. Multi-tenant и Super Admin (шаг 15)

### Platform Admin

1. Добавь email в `PLATFORM_ADMIN_EMAILS` в Vercel env **или** запись в `platform_admins`:
   ```sql
   INSERT INTO platform_admins (auth_user_id, email, full_name)
   VALUES ('<supabase-auth-uuid>', 'you@company.ru', 'Super Admin');
   ```
2. Войди как admin → открой `/screens/platform/dashboard`.

### Второй тенант (RLS-тест)

1. Выполни `supabase/seed_demo_tenant_b.sql`.
2. Создай второй Vercel Preview с `NEXT_PUBLIC_CLINIC_SLUG=demo-b`.
3. Убедись, что данные `default` и `demo-b` не пересекаются.

---

*См. также: `docs/PRODUCT_PRESENTATION.md`, `docs/CLINIC_INTERVIEW_GUIDE.md`*
