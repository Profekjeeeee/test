# Project Overview

Telegram Mini App стоматологической клиники. Пациенты, врачи и администраторы работают в одном Next.js-приложении; данные — в Supabase. Интеграция с Bitrix CRM удалена.

---

## Стек технологий

| Слой | Технология |
|------|------------|
| Framework | **Next.js 15.3** (App Router), React 19, TypeScript 5 |
| Стили | **Tailwind CSS 4**, шрифты Manrope + Inter (Google Fonts) |
| БД / BaaS | **Supabase** (`@supabase/supabase-js` 2.x): Postgres, Auth, Realtime, RLS |
| Графики | **Recharts** (админ-дашборд) |
| Иконки | **lucide-react** |
| UI-утилиты | `class-variance-authority`, `server-only` |
| Среда | **Telegram Mini App** (SDK `telegram-web-app.js`) |
| Деплой | **Vercel** (авто `VERCEL_URL`) |
| Линтер | ESLint + `eslint-config-next` |

**Архитектурные паттерны:**
- UI-экраны живут в `screens/`; маршруты App Router в `app/` — тонкие re-export обёртки.
- Клиентский Supabase — `lib/supabaseClient.ts` (anon key).
- Серверные операции с повышенными правами — `lib/supabase/serverAdmin.ts` (service role), API Routes.
- Единый защищённый шлюз мутаций — `POST /api/dental-db` → `lib/server/dentalDbGateway.ts` (проверка Telegram `initData`).
- Сессия приложения — `localStorage` + Supabase Auth JWT; роут-гард — `components/auth/PatientAppGate.tsx`.
- Часть данных только на клиенте — `localStorage` (счета, статичные пункты плана лечения).

---

## Структура папок (с пояснением что где лежит)

```
/
├── app/                    # Next.js App Router — маршруты и API
│   ├── layout.tsx          # Root layout: Telegram SDK, ThemeProvider, AuthProvider, PatientAppGate
│   ├── page.tsx            # redirect → /auth
│   ├── auth/, registration/, booking/, appointments/, …  # re-export из screens/
│   ├── screens/            # «канонические» URL для ролевых зон
│   │   ├── 03_Main/        # главная пациента
│   │   ├── admin/          # dashboard, feed, doctors, price, logs, messages
│   │   ├── doctor/         # cabinet, messages
│   │   └── support-chat/   # чат пациента
│   └── api/                # серверные эндпоинты (см. раздел API)
│
├── screens/                # Реальная реализация страниц (client components)
│   ├── 02_Auth/, 02_Registration/, 03_Main/, …  # пациентские экраны (номера = порядок UX)
│   ├── Admin/              # Dashboard, Feed, Doctors, Price, Logs
│   ├── Doctor/Cabinet/     # кабинет врача + подкомпоненты
│   ├── SupportChat/, StaffMessages/
│   └── *.html              # legacy HTML-прототипы (не используются рантаймом)
│
├── components/
│   ├── auth/               # PinScreen, PatientAppGate, PinKeypad
│   ├── layout/             # Header, BottomBar (пациент), AdminBottomBar
│   ├── ui/                 # Button, Card, Input, Toast, ConfirmDialog, ThemeToggle
│   ├── chat/               # LongPressBubble, ContextMenu, MetaRow
│   ├── admin/              # Charts, LogsTable, DownloadLogsButton
│   ├── dental/             # PatientToothFormula
│   └── TelegramWebAppProvider.tsx, ThemeProvider.tsx
│
├── contexts/
│   └── AuthContext.tsx     # вход, PIN-flow, signOut
│
├── hooks/                  # useToast, useDarkMode, usePatientUnreadCount, useUpcomingCount, …
│
├── lib/                    # бизнес-логика и интеграции
│   ├── auth.ts             # сессия, кэш clients/employees, CRUD профиля клиента
│   ├── auth/               # applyAuthSession, pinApi, lookupByPhoneApi
│   ├── appointments.ts     # записи на приём (Supabase + кэш)
│   ├── supportChat.ts      # чат клиники/поддержки/врача
│   ├── doctorOrdinatorskayaChat.ts  # внутренний чат врачей
│   ├── dentalGwClient.ts   # клиент шлюза /api/dental-db
│   ├── server/             # только server-side: gateway, gate verify, employee login, …
│   ├── admin/              # dashboard stats, doctors, services CRUD
│   ├── supabase/           # publicConfig, serverAdmin, adminService
│   ├── routes.ts           # канонические пути и префиксы зон
│   ├── tgNotifications.ts  # Telegram push через /api/send-tg-notification
│   ├── bills.ts, treatmentPlan.ts, planUtils.ts, teeth.ts, patientTeeth.ts
│   └── phone.ts, logger.ts, theme.ts, telegramWebApp.ts, …
│
├── types/index.ts          # доменные TypeScript-интерфейсы
│
├── supabase/
│   ├── migrations/001_master.sql   # полная схема БД + RLS + seed
│   └── seed_doctors_services.sql   # доп. seed каталога
│
├── public/manifest.json    # PWA manifest
├── tma/index.html          # standalone TMA entry (если нужен вне Next)
├── docs/                   # аудиты (QA, UI/UX, performance, TMA readiness)
├── .cursor/rules           # правила проекта для AI (цвета, Supabase, роли)
├── .cursorrules            # design tokens, naming conventions
├── next.config.ts          # redirects (/main, /admin/* → /screens/…)
├── tailwind.config.ts
└── package.json
```

**Важно:** не путать `doctors` (каталог для UI/админки, uuid) и `dental_employees` (учётные записи врачей/админов для входа, text id `d1`…`d10`, `emp_admin`).

---

## Авторизация и роли (как работает, какие роли есть)

### Роли

| Роль | `DentalRole` | Источник в БД | После входа |
|------|--------------|---------------|-------------|
| Пациент | `client` | `dental_clients` | `/screens/03_Main` |
| Врач | `doctor` | `dental_employees.role = 'doctor'` | `/screens/doctor/cabinet` |
| Администратор | `admin` | `dental_employees.role = 'admin'` | `/screens/admin/dashboard` |

Тестовый админ из seed: телефон **`77777777777`**, id `emp_admin`, имя «Системный Администратор».

Тестовые врачи: id `d1`…`d10` с телефонами из `DOCTOR_BOOKING_ID_TO_PHONE` в `lib/appointments.ts`.

### Потоки входа

**1. Пациент (Telegram Mini App)**  
`AuthContext.signInWithTelegram()` → `POST /api/auth/telegram` с `initData`:
- Сервер проверяет подпись Telegram (`TELEGRAM_BOT_TOKEN`).
- Ищет строку в `dental_clients` по `telegram_id`.
- Если не найден → `{ needs_registration: true }` → `/registration`.
- Если найден → создаёт/находит shadow Supabase Auth user (`auth_user_id`), выдаёт JWT, возвращает `session` payload.

**2. Регистрация пациента**  
`POST /api/auth/register` (или gateway `registerClient`):
- Создаёт `auth.users` + строку `dental_clients` (id = auth UUID).
- Привязывает `telegram_id` из initData, если есть.
- Возвращает session → PIN-flow.

**3. Сотрудник (врач / админ) по телефону**  
На `/auth` — форма «Вход администратора» / «Вход врача»:
- `POST /api/auth/admin-phone` или `/api/auth/doctor-phone`.
- Поиск в `dental_employees` по суффиксу телефона + фильтр по `role`.
- Shadow Auth + JWT + session payload.

**4. PIN-защита (все роли после Auth)**  
- Таблица `profiles` (PK = `auth.users.id`): `pin_hash`, блокировка после 5 попыток на 15 мин.
- RPC: `set_user_pin`, `verify_user_pin`, `ensure_profile_row`.
- UI: overlay `PinScreen` в `AuthContext` (create 4–6 цифр / verify).
- Пока PIN не пройден — `PatientAppGate` редиректит на `/auth`.

**5. Сессия приложения**  
После успешного Auth + PIN:
- Supabase session: `supabase.auth.setSession({ access_token, refresh_token })`.
- Dental session в `localStorage`:
  - `user_session` / `dental_session` — полный объект `DentalSession`.
  - `dental_user_session` — компактный JSON для бронирования.
  - `currentUserId`, `isLoggedIn`, `isAdmin` (legacy flags).
- Событие `dental_session_changed` для синхронизации вкладок.

### Роут-гард (`PatientAppGate`)

- Публичные пути: `/auth`, `/registration`.
- `/screens/admin/*` — только `role === 'admin'`.
- `/screens/doctor/*` — только `role === 'doctor'`.
- Пациентские префиксы (`PATIENT_ROUTE_PREFIXES` в `lib/routes.ts`) — только `role === 'client'`.
- Без сессии на защищённых путях → redirect `/auth`.

### Shadow Auth

Для legacy-строк без `auth_user_id` сервер создаёт технического пользователя Supabase (`shadow+c_<pk>@dental-miniapp.invalid`) и прописывает `auth_user_id` в `dental_clients` / `dental_employees`. Это связывает RLS-политики с JWT.

### Dev-режим шлюза

`DENTAL_GATE_DEV_ALLOW=1` + `NODE_ENV !== production` — пропуск проверки Telegram initData в `verifyDentalGateRequest` (для локальной разработки вне TMA).

---

## Роуты и страницы (все маршруты с описанием)

### Redirects (`next.config.ts`)

| From | To |
|------|-----|
| `/main` | `/screens/03_Main` |
| `/admin` | `/screens/admin/dashboard` |
| `/admin/feed` | `/screens/admin/feed` |
| `/admin/doctors` | `/screens/admin/doctors` |
| `/admin/price` | `/screens/admin/price` |

### Корень и auth

| Маршрут | Экран | Описание |
|---------|-------|----------|
| `/` | — | redirect → `/auth` |
| `/auth` | `screens/02_Auth` | Вход: Telegram (пациент), телефон врача/админа |
| `/registration` | `screens/02_Registration` | Регистрация нового пациента (ФИО, телефон, email) |

### Пациент (BottomBar: Главная, Записи, Формула, Счета, Ещё)

| Маршрут | Экран | Описание |
|---------|-------|----------|
| `/screens/03_Main` | `03_Main` | Главная: ближайший приём, счета, план, совет дня, быстрые ссылки |
| `/appointments` | `07_My_Appointments` | Список записей, отмена/перенос |
| `/booking` | `06_Appointment_Booking` | Выбор врача, даты, слота; **Suspense обязателен** |
| `/booking/success` | `Booking_Success` | Подтверждение записи |
| `/formula` | `05_Dental_Formula` | Зубная формула (FDI 11–48), статусы зубов |
| `/tooth/[id]` | `08_Tooth_Card` | Карточка одного зуба |
| `/treatment-plan` | `09_Treatment_Plan` | План лечения (merge static + appointments) |
| `/bills` | `11_My_Bills` | Счета (localStorage) |
| `/profile` | `10_Profile` | Профиль пациента, редактирование |
| `/prevention` | `12_Prevention` | Профилактика, рекомендации |
| `/contacts` | `13_Contacts` | Контакты клиники |
| `/doctors` | `15_Doctors` | Список врачей (каталог `doctors`) |
| `/price-list` | `14_PriceList` | Прайс услуг |
| `/screens/support-chat` | `SupportChat` | Чат: клиника / поддержка / личный врач |

### Администратор (AdminBottomBar: Дашборд, Чаты, Врачи, Прайс; Logs — отдельно)

| Маршрут | Экран | Описание |
|---------|-------|----------|
| `/screens/admin/dashboard` | `Admin/Dashboard` | KPI, графики выручки/записей, таблица приёмов на сегодня |
| `/screens/admin/messages` | `StaffMessages` | Чаты с пациентами (support/clinic) |
| `/screens/admin/doctors` | `Admin/Doctors` | CRUD каталога `doctors` |
| `/screens/admin/price` | `Admin/Price` | CRUD `services`, цены, видимость |
| `/screens/admin/feed` | `Admin/Feed` | **Mock-лента** событий (статичные данные, не Supabase) |
| `/screens/admin/logs` | `Admin/Logs` | Журнал `app_logs` |
| `/admin/logs` | alias → `Admin/Logs` | |

### Врач

| Маршрут | Экран | Описание |
|---------|-------|----------|
| `/screens/doctor/cabinet` | `Doctor/Cabinet` | Календарь приёмов, медкарта пациента, ординаторская, чаты с пациентами |
| `/screens/doctor/messages` | `StaffMessages` | Чаты (режим врача) |

---

## Компоненты (ключевые, с описанием назначения)

### Auth & Gate
- **`AuthProvider`** — контекст входа, PIN overlay, signOut.
- **`PatientAppGate`** — гидратация сессии из LS, refresh кэшей, роут-гард по роли.
- **`PinScreen` / `PinKeypad` / `PinDots`** — создание и проверка PIN.

### Layout
- **`BottomBar`** — нижняя навигация пациента (5 вкладок + badge записей/чата).
- **`AdminBottomBar`** — навигация админки.
- **`Header`** — шапка экранов.
- **`TelegramWebAppProvider`** — инициализация `Telegram.WebApp`, expand, haptic.
- **`ThemeProvider`** — светлая/тёмная тема (`localStorage.theme`, class `dark`).

### UI
- **`Toast`** — плашки в стиле Telegram (над tabbar, синий фон).
- **`ConfirmDialog`**, **`Button`**, **`Card`**, **`Input`** — базовый UI-kit.
- **`ThemeToggleButton`** — переключатель темы.

### Dental
- **`PatientToothFormula`** — интерактивная зубная формула.
- **`FormulaToothIcon`** — иконка зуба для навигации/брендинга.

### Chat
- **`LongPressBubble`** — long-press на сообщении.
- **`ChatMessageContextMenu`** — редактирование/удаление своих сообщений.
- **`ChatMessageMetaRow`** — время, метка «изменено».

### Admin
- **`DashboardRevenueChart`**, **`DashboardAppointmentsChart`** — Recharts (dynamic import, ssr: false).
- **`LogsTable`**, **`DownloadLogsButton`** — просмотр/экспорт логов.

### Doctor Cabinet (в `screens/Doctor/Cabinet/`)
- **`DoctorMonthCalendar`** — месячный календарь приёмов.
- **`PatientMedicalSheet`** — медкарта: формула, internal_notes, профиль.
- **`DoctorOrdinatorskayaChat`** — общий чат врачей (`doctor_rooms` / `doctor_messages`).
- **`ConsiliumFormulaPreview`** — превью формулы в консилиуме.

---

## API и эндпоинты (все запросы, методы, назначение)

### REST Routes (`app/api/`)

| Метод | Путь | Body | Ответ | Назначение |
|-------|------|------|-------|------------|
| POST | `/api/auth/telegram` | `{ initData }` | `{ ok, session? \| needs_registration? }` | Вход пациента по Telegram id |
| POST | `/api/auth/register` | `{ phone, firstName, lastName, email, initData? }` | `{ ok, session }` | Регистрация + Auth user |
| POST | `/api/auth/admin-phone` | `{ phone }` | `{ ok, session }` | Вход админа по телефону |
| POST | `/api/auth/doctor-phone` | `{ phone }` | `{ ok, session }` | Вход врача по телефону |
| POST | `/api/auth/lookup-by-phone` | `{ phone }` | `{ ok, employee?, client? }` | Поиск сотрудника/клиента (service role) |
| POST | `/api/dental-db` | `DentalGatewayRequestBody` | `{ ok, data }` | Универсальный шлюз операций (см. ниже) |
| POST | `/api/send-tg-notification` | `{ telegram_id, message }` | `{ ok, telegram }` | Push в Telegram (HTML + кнопка Mini App) |

Все route handlers: `export const dynamic = "force-dynamic"`.

### Шлюз `/api/dental-db` — операции (`op`)

Клиент: `dentalGw(op, payload)` из `lib/dentalGwClient.ts`.  
Каждый запрос включает `telegramInitData` + `actor` (из dental session).

| `op` | Назначение |
|------|------------|
| `authLookupEmployeeClient` | Поиск employee/client по телефону с проверкой Telegram |
| `refreshDentalCaches` | Выборка clients/employees (полная для staff, только себя для client) |
| `registerClient` | Регистрация клиента (server-side duplicate register) |
| `shadowEnsureActor` | Гарантия `auth_user_id` для текущего actor |
| `patchTelegramIdIfEmpty` | Запись `telegram_id`, если пустой |
| `selectClientByPatientUuid` | SELECT клиента по UUID (с ACL) |
| `resolveClientPkForAppointment` | Резолв `dental_clients.id` для FK записи |
| `appointmentList` | Список appointments (фильтр по роли) |
| `appointmentInsert` | Создание записи (только client) |
| `appointmentCancel` | status → cancelled |
| `appointmentReschedule` | Новая дата/время, status → scheduled |
| `chatListMessages` | Список `chat_messages` с фильтрацией по роли |
| `chatInsertMessage` | Вставка сообщения с проверкой sender |
| `doctorEnsureGeneralRoom` | Получить/создать комнату «Ординаторская» |
| `doctorDmPeerMap` | Map peerId → roomId для DM врачей |
| `doctorFindOrCreatePrivateRoom` | DM-комната между двумя врачами |
| `doctorFetchRoomMessages` | Сообщения комнаты `doctor_messages` |
| `doctorInsertRoomMessage` | Отправка в `doctor_messages` (+ metadata для консилиума) |
| `doctorPollRooms` | Last message preview по комнатам |
| `updateClientFormulaTeethById` | Обновление `formula_teeth` (staff) |
| `updateClientInternalNotes` | Обновление `internal_notes` (staff) |
| `updateClientPersonalProfile` | Обновление профиля (только client, свой id) |

### Прямые вызовы Supabase с клиента (не через gateway)

Используют anon key + RLS / authenticated session:

- **`lib/appointments.ts`** — select/insert/update `appointments`.
- **`lib/supportChat.ts`** — CRUD `chat_messages`, Realtime subscription.
- **`lib/auth.ts`** — select/insert/update `dental_clients`, `dental_employees`.
- **`lib/logger.ts`** — insert `app_logs`.
- **`lib/auth/pinApi.ts`** — RPC `set_user_pin`, `verify_user_pin`, select `profiles`.
- **`lib/admin/doctors.ts`**, **`lib/admin/services.ts`** — CRUD `doctors`, `services`.
- **`lib/admin/dashboard.ts`** — агрегирующие запросы для дашборда.

### Supabase RPC (Postgres functions)

| RPC | Назначение |
|-----|------------|
| `ensure_profile_row(p_user_id)` | Создать строку profiles |
| `set_user_pin(p_user_id, p_pin)` | Установить bcrypt PIN |
| `verify_user_pin(p_user_id, p_pin)` | Проверить PIN, блокировка |
| `subject_client_pk()` | PK клиента по auth.uid() (RLS helper) |
| `is_staff_user()`, `is_admin_user()` | RLS helpers |
| `chat_staff_can_read_row(...)` | RLS для чата |
| `delete_old_logs()` | Очистка логов старше 30 дней |

---

## База данных / модели данных

Схема: `supabase/migrations/001_master.sql` (+ `all_migrations.sql` — копия для справки).

### Таблицы

| Таблица | PK | Назначение | Ключевые поля |
|---------|-----|------------|---------------|
| `dental_clients` | `id` text | Пациенты | `phone` UNIQUE, `name`, `first_name`, `last_name`, `email`, `formula_teeth` jsonb, `internal_notes`, `telegram_id`, `auth_user_id` → auth.users |
| `dental_employees` | `id` text | Врачи и админы | `phone` UNIQUE, `name`, `role` ('admin'\|'doctor'), `specialization`, `telegram_id`, `auth_user_id` |
| `doctors` | uuid | Каталог для UI/админки | `name`, `specialization`, `photo_url`, `is_active`, `sort_order` |
| `services` | uuid | Прайс | `name`, `price`, `category`, `is_visible` |
| `appointments` | bigint IDENTITY | Записи на приём | `client_id` FK, `doctor_id` FK, `doctor_name`, `appointment_date`, `appointment_time`, `status`, `service_id`, `patient_name` |
| `chat_messages` | text uuid | Основной чат | `sender_id`, `recipient_id`, `sender_role`, `chat_type` ('support'\|'clinic'\|'doctor'), `text`, `updated_at` |
| `dental_messages` | text | Legacy чат | Realtime enabled, совместимость |
| `doctor_rooms` | text | Комнаты врачей | `is_general`, `peer_low`/`peer_high` для DM |
| `doctor_messages` | uuid | Сообщения ординаторской | `room_id`, `sender_id`, `body`, `metadata` jsonb |
| `profiles` | uuid | PIN Supabase Auth | `pin_hash`, `pin_failed_attempts`, `pin_locked_until` |
| `app_logs` | uuid | Клиентские логи | `level`, `message`, `user_id`, `metadata` jsonb |

### Realtime

В publication `supabase_realtime`: `dental_messages`, `chat_messages`, `doctor_messages`.

### RLS (принцип)

- Включён на всех таблицах.
- Клиент видит/меняет только свои данные (`subject_client_pk()`, own row).
- Staff — через `is_staff_user()` / `is_admin_user()`.
- `internal_notes` защищены триггером `dental_clients_protect_internal_notes` — клиент не может изменить.
- Мутации через service role в gateway обходят RLS, но gateway проверяет Telegram + actor.

### Seed data

- 1 админ (`77777777777`), 10 врачей (`d1`…`d10`).
- Комната `ordinatorskaya`.
- Каталог `doctors` + `services` (если пусто).

### TypeScript-модели

Доменные интерфейсы: `types/index.ts` — `Appointment`, `ToothStatus`, `TreatmentPlan`, `ChatMessage`, `Bill`, `Patient`, …  
Auth-модели: `lib/auth.ts` — `DentalSession`, `DentalClientRecord`, `DentalEmployeeRecord`.

### Статусы

- **Appointment:** `pending`, `scheduled`, `completed`, `cancelled`, `rescheduled`.
- **Tooth condition:** `healthy`, `treated`, `caries`, `pulpitis`, `removed`, `crown`, `implant`, `prosthesis`.
- **Bill status:** `pending`, `paid`, `partial`, `overdue` (localStorage only).

---

## Переменные окружения (.env — какие нужны и зачем)

Файл: `.env.local` (не коммитить). Пример имён — без значений:

| Переменная | Обязательность | Назначение |
|------------|----------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Да** | URL проекта Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Да** | Anon/public key для клиента и server anon |
| `SUPABASE_SERVICE_ROLE_KEY` | **Да** (server) | Service role для API routes, gateway, register |
| `TELEGRAM_BOT_TOKEN` | **Да** (prod) | Проверка `initData`, отправка уведомлений |
| `TELEGRAM_MINI_APP_URL` | Рекомендуется | URL Mini App для inline-кнопки в push |
| `NEXT_PUBLIC_SITE_URL` | Fallback | Публичный URL сайта (если нет TELEGRAM_MINI_APP_URL) |
| `VERCEL_URL` | Auto на Vercel | Fallback URL для уведомлений |
| `DENTAL_GATE_DEV_ALLOW=1` | Dev only | Отключить строгую проверку Telegram в gateway |
| `NODE_ENV` | Auto | `production` включает строгий gate |

Проверка конфигурации на клиенте: `isSupabaseConfigured()` в `lib/supabase/publicConfig.ts`.

---

## Бизнес-логика (ключевые процессы: запись, уведомления и т.д.)

### Регистрация и первый вход
1. Пользователь открывает TMA → `/auth` → «Войти через Telegram».
2. Если `telegram_id` не привязан — `/registration` → API register → PIN create → главная.
3. `syncTelegramIdToSupabaseIfNeeded()` дописывает `telegram_id` при первом входе.

### Запись на приём
1. `/booking` — выбор врача (id `d1`…`d10` → телефон через `DOCTOR_BOOKING_ID_TO_PHONE`).
2. Слоты: `CLINIC_TIME_SLOTS` (09:00–16:30, шаг 30 мин).
3. `addAppointment()` → insert в `appointments` (**без поля `id`** — GENERATED ALWAYS).
4. `client_id` — только FK на `dental_clients.id`, не телефон.
5. Success → `/booking/success`; `notifyDoctorNewBookingAsync()` — push врачу в Telegram.
6. Статус по умолчанию: `pending`.

### Управление приёмами
- **Пациент:** `/appointments` — просмотр, отмена, перенос (через Supabase).
- **Врач:** `Doctor/Cabinet` — календарь всех приёмов клиники, фильтр по врачу; cancel/reschedule + push пациенту (`notifyPatientScheduleCancelledAsync`, `notifyPatientScheduleRescheduledAsync`).

### Зубная формула
- Данные в `dental_clients.formula_teeth` (jsonb, FDI notation).
- Пациент видит свою формулу; врач редактирует через `PatientMedicalSheet` (gateway `updateClientFormulaTeethById`).
- Fallback localStorage в `lib/teeth.ts` для legacy/офлайн-снимков.

### План лечения
- **Static items** — `localStorage` (`lib/treatmentPlan.ts`), задаёт врач.
- **From appointments** — деривируются из Supabase (`lib/planUtils.ts` merge).
- Виджет на главной и экран `/treatment-plan` используют `getMergedPlanStats()`.

### Счета
- Полностью **localStorage** (`lib/bills.ts`), ключ `dental_bills_{userId}`.
- Создаются локально при действиях (например, после приёма); оплата — UI-only.
- **Не синхронизируются с Supabase.**

### Чаты

**Пациент (`/screens/support-chat`):**
- Вкладки: `clinic` (клиника), `support` (поддержка), `doctor` (лечащий врач).
- Таблица `chat_messages`, Realtime через `lib/supabaseRealtime.ts`.
- Read receipts в localStorage (`dental_chat_patient_read_v2`).

**Staff (`StaffMessages`, admin/doctor routes):**
- Админ видит support-инbox; врач — clinic/doctor threads своих пациентов (RLS + фильтры в gateway).

**Врачи (ординаторская):**
- `doctor_rooms` + `doctor_messages`; общая комната + DM между врачами.
- Консilium: metadata jsonb с `patient_id`, `formula_teeth`.

### Админ-дашборд
- `lib/admin/dashboard.ts` — агрегация appointments + services для KPI и графиков.
- Feed — **заглушка** с mock-данными, не подключена к БД.

### Логирование
- `log(level, message, metadata)` → fire-and-forget insert в `app_logs`.
- Админ: `/screens/admin/logs`, экспорт через `useDownloadLogs`.

### Telegram-уведомления
- `lib/tgNotifications.ts` → `POST /api/send-tg-notification`.
- HTML-текст, кнопка «Открыть приложение» (web_app).
- Требует `telegram_id` у получателя в `dental_employees` / `dental_clients`.

---

## Известные особенности и нюансы

### Supabase
- **Никогда не передавать `id` при insert** в таблицы с `GENERATED ALWAYS AS IDENTITY` (`appointments`) — ошибка 400.
- Всегда проверять `error` после запросов; после успеха — toast + сброс формы.
- На страницах с `useSearchParams` (booking) — оборачивать в `<Suspense>` для сборки Vercel.

### Две модели «врачей»
- `dental_employees` — логин, telegram_id, привязка к записям (`doctor_id`).
- `doctors` — публичный каталог для пациента и админ-CRUD; id uuid, не совпадает с `d1`.

### Дублирование путей API auth
- Есть `app/api/auth/telegram/route.ts` и `app\api\auth\telegram\route.ts` (Windows path duplicate) — функционально один файл.

### Данные не в Supabase
- **Счета** — только localStorage.
- **Статичные пункты плана лечения** — localStorage.
- **Admin Feed** — hardcoded mock, не realtime.

### Legacy
- `dental_messages` — старая таблица чата, Realtime включён; основной чат — `chat_messages`.
- HTML-файлы в `screens/*/*.html` — прототипы, не участвуют в Next routing.
- `screens/Untitled` — артефакт, игнорировать.

### UI/UX правила (из `.cursor/rules`)
- Акцент **только синий** `#248bcf` (`primary`); **зелёный запрещён** для UI (кроме системного success в toast, лучше синий).
- Toast — full-width плашки **над tabbar**, не center popup.
- Лечащий врач пустой → «Врач не назначен» / «Будет указан после первого приёма».
- PIN-flow: сначала записать сессию, потом редирект; иначе guard выбросит на auth.

### Windows / Git
- В commit messages **не использовать** `()` и `[]` — PowerShell ломает команды.
- `.gitignore`: `node_modules/`, `.next/`, `bitrix/`.

### Безопасность
- Gateway `/api/dental-db` — основной контроль мутаций с проверкой Telegram + actor phone/id.
- Прямые клиентские writes к Supabase опираются на RLS; service role только на сервере.
- `lookup-by-phone` использует service role — не вызывать с недоверенного клиента без нужды (сейчас server route).

### Миграции
- Одна master-миграция `001_master.sql` заменяет 24 локальные; безопасна для повторного запуска (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- Отдельные legacy-миграции (`005_internal_notes`, `006_formula_teeth`, `007_telegram_id`) упоминаются в коде как fallback при отсутствии колонок.

### Скрипты npm
```bash
npm run dev    # next dev
npm run build  # next build
npm run start  # next start
npm run lint   # next lint
```

---

*Документ сгенерирован для использования как контекст AI-ассистента. При изменении архитектуры обновляйте соответствующие разделы.*
