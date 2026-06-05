# Project Overview

Актуальный аудит репозитория стоматологического Telegram Mini App. Документ сгенерирован заново по текущему коду, SQL-миграциям и конфигам. Если старые документы, roadmap или правила проекта расходятся с кодом, источником истины считается код.

---

## 1. Текущий Статус Проекта

Проект — Next.js 15 App Router приложение для стоматологической клиники с тремя рабочими зонами:

- пациентский личный кабинет;
- кабинет врача;
- админ-панель клиники;
- дополнительно присутствует SaaS/platform зона для super-admin управления клиниками.

Основная БД и серверная интеграция — Supabase: Postgres, Auth, Storage, Realtime, RLS, RPC-функции. Приложение ориентировано на запуск внутри Telegram Mini App, но часть сценариев работает и вне Telegram, если включены dev-режимы/резервные входы.

Важное состояние на момент аудита:

- Bitrix-интеграции в коде не обнаружены.
- Основные критичные данные уже вынесены из localStorage в Supabase: клиенты, сотрудники, записи, чаты, счета, платежи, планы лечения, медкарта, файлы, CRM/KPI, аудит, видеоконсультации.
- localStorage всё ещё используется для клиентской сессии, темы, пользовательских настроек и legacy-миграций старых данных.
- `app/` содержит маршруты и API; большинство UI-страниц в `app/` являются тонкими re-export wrappers на компоненты из `screens/`.
- `/api/dental-db` сохранён как deprecated gateway для совместимости; новый код преимущественно использует REST endpoints и `dentalApiFetch`.
- `.cursor/rules` содержит часть устаревших инструкций про "магический админ-флаг" и localStorage-роль; реальный код уже использует Supabase Auth session tokens, `dental_session`, shadow Auth users и PIN-gate.

---

## 2. Технологический Стек

| Слой | Реальная технология |
|---|---|
| Framework | Next.js `15.3.8`, App Router |
| UI runtime | React `19.0.0`, React DOM `19.0.0` |
| Язык | TypeScript 5, `strict: true` |
| Стили | Tailwind CSS 4 через `@tailwindcss/postcss`, custom `tailwind.config.ts`, `app/globals.css`, `app/responsive.css` |
| Шрифты | `Manrope` и `Inter` через `next/font/google` |
| БД/BaaS | Supabase JS `^2.105.4` |
| Server-only guard | `server-only` |
| Charts | `recharts` |
| Icons | `lucide-react` |
| UI utils | `class-variance-authority` |
| Deploy | Vercel, `vercel.json` содержит cron jobs |
| Package manager | npm, есть `package-lock.json` |

`package.json` scripts:

| Script | Команда | Назначение |
|---|---|---|
| `dev` | `next dev` | локальный dev server |
| `build` | `next build` | production build |
| `start` | `next start` | запуск production server |
| `lint` | `next lint` | legacy lint-команда; для Next 15 это потенциальный риск, так как `next lint` удалён в новых версиях Next |
| `demo:docs` | `echo See docs/DEMO_STAND.md — run seed_demo_commercial.sql in Supabase SQL Editor` | подсказка по демо-стенду |

---

## 3. Корневая Структура Репозитория

```text
/
├── app/                         # Next.js App Router: страницы, layouts, API routes
├── screens/                     # Реальные UI-экраны приложения
├── components/                  # Переиспользуемые UI/feature компоненты
├── contexts/                    # React contexts: Auth, Clinic
├── hooks/                       # Клиентские hooks
├── lib/                         # Клиентская и серверная бизнес-логика
├── types/                       # Общие TypeScript доменные типы
├── supabase/                    # SQL migrations и seed-файлы
├── public/                      # PWA manifest
├── docs/                        # Аудиты, демо-доки, презентация
├── .cursor/rules                # AI/project rules, частично устаревшие
├── .cursorrules                 # Design tokens и правила проекта
├── package.json                 # npm scripts и зависимости
├── next.config.ts               # Redirects
├── tailwind.config.ts           # Tailwind theme tokens
├── postcss.config.mjs           # Tailwind PostCSS plugin
├── tsconfig.json                # TS strict config, alias @/*
├── vercel.json                  # Cron jobs
├── all_migrations.sql           # Большой агрегированный/исторический SQL-файл
├── ROADMAP.md                   # Roadmap, частично реализован
└── ROADMAP_EXTENSION_11_15.md   # Расширенный roadmap, частично реализован
```

Отсутствует `README.md`. Документация проекта фактически распределена между `PROJECT_OVERVIEW.md`, `docs/*`, `ROADMAP*.md`, `.cursor/rules` и `.cursorrules`.

---

## 4. Конфигурация

### `next.config.ts`

Содержит только redirects:

| Source | Destination | Purpose |
|---|---|---|
| `/main` | `/screens/03_Main` | legacy alias на главную пациента |
| `/admin` | `/screens/admin/dashboard` | alias админки |
| `/admin/feed` | `/screens/admin/feed` | legacy admin feed |
| `/admin/doctors` | `/screens/admin/doctors` | legacy doctors route |
| `/admin/price` | `/screens/admin/price` | legacy price route |

### `tailwind.config.ts`

Реальные токены:

- `darkMode: "class"`;
- content: `app/**/*`, `components/**/*`, `screens/**/*`;
- font: `Manrope`, `Inter`;
- primary: `#248bcf`, `primary.dark: #1d6eb8`, `primary.light: #e3f2fa`;
- secondary: `#9AB0C5`;
- surface: `#f8fafc`;
- destructive/error: `#BA1A1A`;
- tooth colors: healthy, treated, caries, removed, crown, implant;
- radius: `card: 12px`, `card-lg: 16px`, `btn: 4px`, `tooth: 2px`;
- max width mobile: `390px`.

### `tsconfig.json`

Ключевые настройки:

- `strict: true`;
- `allowJs: true`;
- `moduleResolution: "bundler"`;
- `jsx: "preserve"`;
- `paths: { "@/*": ["./*"] }`;
- `include` покрывает все `.ts/.tsx` и `.next/types`.

### `vercel.json`

Настроены два cron jobs:

| Path | Schedule | Реальный handler |
|---|---|---|
| `/api/cron/appointment-reminders` | `0 9 * * *` | `processAppointmentReminders()` |
| `/api/cron/crm-campaigns` | `0 9 * * *` | `processCrmCron()` |

Комментарий: в коде `/api/cron/appointment-reminders` описан как "каждые 15 минут", но `vercel.json` запускает его один раз в день в 09:00. Это реальное расхождение.

### `public/manifest.json`

PWA manifest:

- `name`: `Стоматология`;
- `short_name`: `Стоматология`;
- `start_url`: `/`;
- `display`: `standalone`;
- `orientation`: `portrait-primary`;
- `background_color`: `#F8FAFB`;
- `theme_color`: `#248bcf`.

---

## 5. Runtime Layout И Providers

### `app/layout.tsx`

Root layout:

- подключает `globals.css` и `responsive.css`;
- подключает Telegram SDK `https://telegram.org/js/telegram-web-app.js` через `next/script` `beforeInteractive`;
- задаёт `metadata` и `viewport`;
- грузит `Manrope` и `Inter`;
- до гидрации применяет сохранённую тему из `localStorage.theme`;
- до гидрации пытается применить Telegram `themeParams.bg_color`;
- оборачивает приложение в:
  - `TelegramWebAppProvider`;
  - `ClinicProvider`;
  - `ClinicBrandingStyles`;
  - `ThemeProvider`;
  - `AuthProvider`;
  - `PatientAppGate`.

### `components/TelegramWebAppProvider.tsx`

Клиентский provider для Telegram Mini App. Он отвечает за Telegram WebApp runtime-инициализацию и интеграцию с WebView окружением. Фактические helpers лежат в `lib/telegramWebApp.ts` и `lib/telegramHaptic.ts`.

### `contexts/ClinicProvider.tsx`

Клиентский provider публичных настроек клиники:

- стартует с `DEFAULT_CLINIC_SETTINGS`;
- на mount вызывает `/api/clinic/settings?slug=<DEFAULT_CLINIC_SLUG>`;
- при ошибке возвращается к default settings;
- exposes `settings`, `loading`, `refresh`.

`DEFAULT_CLINIC_SLUG` берётся из `NEXT_PUBLIC_CLINIC_SLUG` или `"default"`.

### `components/ClinicBrandingStyles.tsx`

Применяет брендинг клиники из `ClinicProvider`: primary/accent colors и связанные CSS-переменные.

### `components/ThemeProvider.tsx`

Хранит тему в `localStorage.theme`. Реальная тема управляется CSS-классом `dark` на `document.documentElement`.

### `contexts/AuthContext.tsx`

Главный клиентский Auth context:

- состояние: `loading | anonymous | authenticated`;
- PIN-состояние: `none | create | verify`;
- Supabase Auth user id;
- PIN unlock state;
- методы входа:
  - `signInWithTelegram()`;
  - `signInEmployeeByPhone(phone, "admin" | "doctor")`;
  - deprecated `signInAdminByPhone(phone)`;
  - `completeRegistration(session)`;
  - `submitCreatePin(pin)`;
  - `submitVerifyPin(pin)`;
  - `signOut()`.

Реальная логика:

1. Серверный auth endpoint возвращает Supabase access/refresh token и dental payload.
2. `applyAuthSessionPayload()` вызывает `supabase.auth.setSession()`.
3. Проверяется Supabase user id.
4. Создаётся/проверяется `profiles` row.
5. В localStorage сохраняется `dental_session`.
6. Запускается PIN-gate:
   - если `profiles.pin_hash` отсутствует — создание PIN;
   - если есть — verify PIN.

PIN RPC:

- `ensure_profile_row`;
- `set_user_pin`;
- `verify_user_pin`.

### `components/auth/PatientAppGate.tsx`

Клиентский route guard:

- гидратирует `dental_session` из localStorage;
- вызывает `refreshDentalCaches()` и `refreshAppointmentsCache()`;
- синхронизирует сессию из Supabase по телефону через `refreshDentalSessionFromSupabase()`;
- слушает `storage` и `DENTAL_SESSION_CHANGED_EVENT`;
- проверяет роль по pathname;
- проверяет platform-admin через `/api/platform/me`;
- если PIN-flow активен, возвращает пользователя на `/auth`;
- для защищённых зон без сессии делает redirect на `/auth`.

Реальные route guards:

| Zone | Условие |
|---|---|
| `PUBLIC_ROUTE_PREFIXES` | `/auth`, `/registration` |
| `PATIENT_ROUTE_PREFIXES` | только `session.role === "client"` |
| `/screens/admin` | только `session.role === "admin"` |
| `/screens/doctor` | только `session.role === "doctor"` |
| `/screens/platform` | сессия есть + `/api/platform/me` вернул `isPlatformAdmin` |
| `/consultation` | любая роль `client`, `doctor`, `admin` |

---

## 6. Роли И Авторизация

### Реальные роли в коде

Тип роли повторяется в нескольких местах, но набор одинаковый:

- `client`;
- `doctor`;
- `admin`.

Дополнительно есть "platform admin", но это не значение `DentalRole`. Это отдельная super-admin проверка через таблицу `platform_admins` или env allowlist.

### Источник ролей

| Роль | Таблица | Условие |
|---|---|---|
| `client` | `dental_clients` | строка пациента |
| `doctor` | `dental_employees` | `role = 'doctor'` |
| `admin` | `dental_employees` | `role = 'admin'` |
| platform admin | `platform_admins` или env | `auth_user_id` совпадает или email/phone в env |

### Вход пациента через Telegram

Кодовый путь:

1. `screens/02_Auth/page.tsx` вызывает `useAuth().signInWithTelegram()`.
2. `AuthContext.signInWithTelegram()` берёт `initData` из `getTelegramInitData()`.
3. POST `/api/auth/telegram` получает `{ initData }`.
4. Сервер вызывает `verifyDentalGateRequest(initData)`.
5. Требуется `gate.kind === "telegram"`.
6. Telegram user id ищется в `dental_clients.telegram_id`.
7. Если клиент не найден, ответ `{ ok: true, needs_registration: true }`.
8. Если найден:
   - `ensureShadowAuthForRow("dental_clients", client.id)`;
   - `ensureProfileRowExists(authId)`;
   - `issueSupabaseSessionForUserId(authId)`;
   - `profileHasPinHash(authId)`;
   - `clientRowToPayload()`;
   - ответ `{ ok: true, session }`.
9. Клиент применяет Supabase tokens, dental session и PIN-gate.
10. Редирект после PIN: `/screens/03_Main`.

### Регистрация пациента

Кодовый путь:

1. `/registration` рендерит `screens/02_Registration/page.tsx`.
2. Форма собирает phone, firstName, lastName, email.
3. POST `/api/auth/register`:
   - нормализует телефон;
   - валидирует RU mobile phone;
   - пытается извлечь Telegram user id из `initData`;
   - создаёт Supabase Auth user через `auth.admin.createUser`;
   - создаёт `profiles` row;
   - вставляет `dental_clients` row с `id = auth_user_id`, `auth_user_id`, `role: "client"`, phone/name/email, optional `telegram_id`;
   - при ошибке отсутствия `telegram_id` колонки делает fallback insert без неё;
   - выдаёт Supabase session tokens;
   - возвращает auth payload.
4. `AuthContext.completeRegistration()` применяет payload и запускает PIN creation.

### Вход врача и администратора по телефону

Кодовый путь:

1. `screens/02_Auth/page.tsx` показывает резервные режимы "администратор" и "врач".
2. `AuthContext.signInEmployeeByPhone(phone, role)` выбирает endpoint:
   - admin: `/api/auth/admin-phone`;
   - doctor: `/api/auth/doctor-phone`.
3. Endpoint вызывает `loginEmployeeByPhone(phone, role)`.
4. `loginEmployeeByPhone()`:
   - нормализует и валидирует телефон;
   - ищет строку в `dental_employees` по suffix pattern и роли;
   - создаёт shadow Auth user при необходимости;
   - создаёт `profiles`;
   - выдаёт Supabase tokens;
   - возвращает `employeeRowToPayload`.
5. Клиент применяет session payload и PIN-gate.
6. Редирект:
   - admin: `/screens/admin/dashboard`;
   - doctor: `/screens/doctor/cabinet`.

### Shadow Auth

Механизм `ensureShadowAuthForRow()` связывает legacy строки `dental_clients` / `dental_employees` с Supabase Auth:

- если `auth_user_id` уже есть, он используется;
- если нет, создаётся технический user:
  - `shadow+c_<pk>@dental-miniapp.invalid`;
  - `shadow+e_<pk>@dental-miniapp.invalid`;
- random password;
- `email_confirm: true`;
- user metadata содержит table/pk;
- затем `auth_user_id` прописывается в строку доменной таблицы.

Это нужно для RLS-политик, которые завязаны на `auth.uid()`.

### PIN-gate

PIN хранится не в `dental_clients` / `dental_employees`, а в `profiles`:

- `profiles.id = auth.users.id`;
- `pin_hash`;
- `pin_failed_attempts`;
- `pin_locked_until`;
- `updated_at`.

RPC:

- `ensure_profile_row(p_user_id uuid)`;
- `set_user_pin(p_user_id uuid, p_pin text)`;
- `verify_user_pin(p_user_id uuid, p_pin text)`.

PIN создаётся после первого успешного входа без `pin_hash`. При последующих входах требуется verify.

### Platform Admin

`/screens/platform/*` и `/api/platform/*` используют отдельную проверку:

- client-side route guard вызывает `fetchPlatformMe()`;
- API требует `Authorization: Bearer <Supabase access_token>`;
- `requirePlatformAdminFromRequest()` валидирует JWT через Supabase anon client;
- затем проверяет:
  - `platform_admins.auth_user_id = user.id`;
  - или `PLATFORM_ADMIN_EMAILS`;
  - или `PLATFORM_ADMIN_PHONES`, сверяя телефон сотрудника в `dental_employees`.

---

## 7. Routing Model

### Canonical route constants

`lib/routes.ts`:

| Key | Path |
|---|---|
| `auth` | `/auth` |
| `registration` | `/registration` |
| `bookingSuccess` | `/booking/success` |
| `clientHome` | `/screens/03_Main` |
| `adminDashboard` | `/screens/admin/dashboard` |
| `adminAnalytics` | `/screens/admin/analytics` |
| `adminFinance` | `/screens/admin/finance` |
| `adminCrm` | `/screens/admin/crm` |
| `adminLogs` | `/screens/admin/logs` |
| `adminAudit` | `/screens/admin/audit` |
| `adminSettings` | `/screens/admin/settings` |
| `adminMessages` | `/screens/admin/messages` |
| `platformDashboard` | `/screens/platform/dashboard` |
| `platformClinics` | `/screens/platform/clinics` |
| `platformOnboarding` | `/screens/platform/onboarding` |
| `platformMonitoring` | `/screens/platform/monitoring` |
| `doctorCabinet` | `/screens/doctor/cabinet` |
| `doctorMessages` | `/screens/doctor/messages` |
| `patientSupportChat` | `/screens/support-chat` |

### App Router Pages

Root/application:

| URL | File | Реализация |
|---|---|---|
| `/` | `app/page.tsx` | entry page, redirect/landing logic |
| `/auth` | `app/auth/page.tsx` | re-export `screens/02_Auth/page` |
| `/registration` | `app/registration/page.tsx` | `screens/02_Registration/page` |

Patient zone:

| URL | Screen |
|---|---|
| `/screens/03_Main` | `screens/03_Main/page.tsx` |
| `/formula` | `screens/05_Dental_Formula/page.tsx` |
| `/tooth/[id]` | `screens/08_Tooth_Card/page.tsx` |
| `/booking` | `screens/06_Appointment_Booking/page.tsx` |
| `/booking/success` | `screens/Booking_Success/page.tsx` |
| `/appointments` | `screens/07_My_Appointments/page.tsx` |
| `/bills` | `screens/11_My_Bills/page.tsx` |
| `/profile` | `screens/10_Profile/page.tsx` |
| `/prevention` | `screens/12_Prevention/page.tsx` |
| `/contacts` | `screens/13_Contacts/page.tsx` |
| `/doctors` | `screens/15_Doctors/page.tsx` |
| `/price-list` | `screens/14_PriceList/page.tsx` |
| `/treatment-plan` | `screens/09_Treatment_Plan/page.tsx` |
| `/treatment-history` | `screens/16_Treatment_History/page.tsx` |
| `/documents` | `screens/17_Patient_Documents/page.tsx` |
| `/cabinet` | `screens/18_Patient_Cabinet/page.tsx` |
| `/screens/support-chat` | `screens/SupportChat/page.tsx` |
| `/consultation/[appointmentId]` | `screens/19_Video_Consultation/page.tsx` |

Doctor zone:

| URL | Screen |
|---|---|
| `/screens/doctor/cabinet` | `screens/Doctor/Cabinet/page.tsx` |
| `/screens/doctor/messages` | `screens/StaffMessages/page.tsx` with `mode="doctor"` |

Admin zone:

| URL | Screen |
|---|---|
| `/screens/admin/dashboard` | `screens/Admin/Dashboard/page.tsx` |
| `/screens/admin/analytics` | `screens/Admin/Analytics/page.tsx` |
| `/screens/admin/finance` | `screens/Admin/Finance/page.tsx` |
| `/screens/admin/crm` | `screens/Admin/CRM/page.tsx` |
| `/screens/admin/logs` | `screens/Admin/Logs/page.tsx` |
| `/screens/admin/audit` | `screens/Admin/Audit/page.tsx` |
| `/screens/admin/settings` | `screens/Admin/Settings/page.tsx` |
| `/screens/admin/messages` | `screens/StaffMessages/page.tsx` with `mode="admin"` |
| `/screens/admin/doctors` | `screens/Admin/Doctors/page.tsx` |
| `/screens/admin/price` | `screens/Admin/Price/page.tsx` |
| `/screens/admin/feed` | `screens/Admin/Feed/page.tsx` |
| `/admin/logs` | duplicate direct wrapper to same `screens/Admin/Logs/page.tsx` |

Platform zone:

| URL | Screen |
|---|---|
| `/screens/platform/dashboard` | `screens/Platform/Dashboard/page.tsx` |
| `/screens/platform/clinics` | `screens/Platform/Clinics/page.tsx` |
| `/screens/platform/clinics/[id]` | `screens/Platform/ClinicDetail/page.tsx` |
| `/screens/platform/onboarding` | `screens/Platform/Onboarding/page.tsx` |
| `/screens/platform/monitoring` | `screens/Platform/Monitoring/page.tsx` |

---

## 8. Frontend Screens

### Patient Screens

`screens/02_Auth/page.tsx`

- Вход в кабинет.
- Проверяет Supabase public config.
- Поддерживает Telegram sign-in.
- Поддерживает резервный вход по телефону для `admin` и `doctor`.
- Использует `useAuth`, `Input`, `Button`, `FormulaToothIcon`, `ROUTES`, `logger`.

`screens/02_Registration/page.tsx`

- Регистрация пациента после Telegram login, если `dental_clients.telegram_id` не найден.
- Собирает телефон, имя, фамилию, email.
- Сохраняет legacy `userProfile`.
- Отправляет `/api/auth/register`.
- Передаёт auth payload в `AuthContext.completeRegistration()`.

`screens/03_Main/page.tsx`

- Главная пациента.
- Загружает ближайшую запись из `lib/appointments`.
- Инициализирует bills через `initBills()`.
- Получает pending debt через `getTotalPending()`.
- Получает профиль через `getProfile()`.
- Слушает `DENTAL_SESSION_CHANGED_EVENT`.
- Показывает unread count через `usePatientUnreadCount`.

`screens/05_Dental_Formula/page.tsx`

- Пациентская зубная формула.
- Использует `lib/teeth` localStorage state для клиентской формулы.
- Рендерит `PatientToothFormula`.
- Навигация к `/tooth/[id]`.

`screens/08_Tooth_Card/page.tsx`

- Карточка зуба.
- Берёт состояние зуба из `lib/teeth`.
- Отображает condition, treatment history/recommendations UI.
- Это пациентская локальная карта, не основная медицинская карта врача.

`screens/06_Appointment_Booking/page.tsx`

- Многошаговая запись: category → doctor → service → date → confirm.
- Использует hardcoded `DOCTORS_MOCK` и `SERVICES_MOCK` для UI выбора врача/услуги.
- Создание записи идёт через `addAppointment()` из `lib/appointments`.
- После записи создаёт счёт через `addBillForAppointment()`.
- Асинхронно отправляет уведомление `postAppointmentNotifyAsync("booking_created")`.
- Поддерживает reschedule flow через query params.
- Для Vercel compatibility использует Suspense вокруг search params.

`screens/Booking_Success/page.tsx`

- Страница успеха записи.
- Читает параметры записи из URL.
- Показывает дату/время и CTA.

`screens/07_My_Appointments/page.tsx`

- Список записей пациента.
- Использует `getAppointments`, `cancelAppointment`, `rescheduleAppointment`, `refreshAppointmentsCache`.
- При отмене/переносе обновляет счета через `removeBillByAppointmentId`.
- Отправляет notify events.
- Есть fallback price lookup для legacy appointments без price.
- Для video appointments показывает join, если `canJoinVideoWindow()`.

`screens/11_My_Bills/page.tsx`

- Счета и платежи пациента.
- Использует `getBills`, `initBills`, `payBillById`, `getPatientPayments`.
- Онлайн-оплата создаёт платеж через `lib/payments`.
- Mock provider может завершать платеж сразу.

`screens/09_Treatment_Plan/page.tsx`

- План лечения пациента.
- Использует `lib/treatmentPlan` и `lib/planUtils`.
- Данные хранятся в `treatment_plan_items`; legacy localStorage мигрируется один раз.

`screens/10_Profile/page.tsx`

- Профиль пациента.
- Читает `getDentalSession`, `getCurrentUserId`, `getProfile`.
- Сохраняет профиль через `updateClientPersonalProfile`.
- Управляет локальными notification settings.
- Logout через `lib/auth.logout`.

`screens/12_Prevention/page.tsx`

- Профилактика и рекомендации.
- Использует `lib/patientRecommendations`.

`screens/13_Contacts/page.tsx`

- Контакты клиники.
- Данные берёт из `ClinicProvider` / `/api/clinic/settings`.

`screens/14_PriceList/page.tsx`

- Прайс-лист.
- UI со статическим/клиентским набором категорий и цен.
- Не является прямым CRUD-экраном `services`.

`screens/15_Doctors/page.tsx`

- Пациентский список врачей.
- UI-каталог врачей.

`screens/16_Treatment_History/page.tsx`

- История лечения.
- Использует `patient_visits` и `medical_records`.
- Есть AI explain diagnosis action через `ExplainDiagnosisButton`.

`screens/17_Patient_Documents/page.tsx`

- Документы пациента.
- Использует `lib/patientFiles`.
- Работает с Supabase Storage bucket `patient-files` и таблицей `patient_files`.

`screens/18_Patient_Cabinet/page.tsx`

- Расширенный пациентский кабинет.
- Собирает профиль, визиты, счета, документы.
- Включает `PatientAiAssistant`.

`screens/SupportChat/page.tsx`

- Пациентский чат поддержки.
- Использует `lib/supportChat`.
- Основная таблица сообщений — `chat_messages`.
- Realtime/hydration поддержка реализованы в `supportChat`.

`screens/19_Video_Consultation/page.tsx`

- Страница видеоконсультации.
- Доступна для пациента, врача, админа по shared route guard.
- Проверяет appointment id и session.
- Рендерит `VideoConsultationRoom`.

### Doctor Screens

`screens/Doctor/Cabinet/page.tsx`

- Главный кабинет врача.
- Загружает сессию через `resolveHydratedSession()`.
- Обновляет `dental_clients` и `appointments` кэши.
- Фильтрует записи врача по `session.fullName`.
- Вкладки:
  - календарь/расписание;
  - чаты;
  - настройки.
- Компоненты:
  - `DoctorMonthCalendar`;
  - `DoctorOrdinatorskayaChat`;
  - `PatientMedicalSheet`;
  - `StaffMessagesPage`;
  - `ThemeToggleButton`.
- Поддерживает cancel/reschedule appointments.
- Может открывать медкарту пациента через custom event `DOCTOR_OPEN_PATIENT_MEDICAL_SHEET_EVENT`.
- Для video appointments использует `canJoinVideoWindow`.

`screens/Doctor/Cabinet/PatientMedicalSheet.tsx`

- Полноценная медкарта пациента для врача.
- Использует:
  - `appointments`;
  - `treatmentPlan`;
  - `patientVisits`;
  - `medicalRecords`;
  - `patientFiles`;
  - `patientTeeth`;
  - `DoctorAiToolbar`.
- Может сохранять формулу зубов в `dental_clients.formula_teeth`.
- Может редактировать internal notes.
- Может отправлять consilium case в doctor room.

`screens/Doctor/Cabinet/DoctorOrdinatorskayaChat.tsx`

- Внутренний чат врачей.
- Использует `doctor_rooms` и `doctor_messages`.
- Поддерживает general room, private DM rooms, Realtime insert subscription.
- Может отправлять consilium preview через `ConsiliumFormulaPreview`.

`screens/StaffMessages/page.tsx`

- Общий staff chat UI для admin/doctor zones.
- Используется в:
  - `/screens/admin/messages`;
  - `/screens/doctor/messages`;
  - embedded внутри doctor cabinet.
- Работает с `chat_messages`.
- Учитывает permissions из `chatMessagePermissions`.

### Admin Screens

`screens/Admin/Dashboard/page.tsx`

- Dashboard клиники.
- Загружает `getDashboardStats()` и `fetchAnalyticsOverview()`.
- Показывает revenue, debt, patients, KPI, CRM link.
- Использует dynamic imports для Recharts компонентов.

`screens/Admin/Analytics/page.tsx`

- KPI врачей и аналитика пациентов.
- Использует `lib/admin/analytics`.
- RPC:
  - `refresh_doctor_metrics`;
  - `refresh_patient_metrics`.
- Работает с `doctor_metrics`, `patient_metrics`, `payments`.

`screens/Admin/Finance/page.tsx`

- Финансы, счета и платежи.
- Использует `lib/admin/finance`, `lib/payments`.
- Может записывать manual payments.
- Показывает provider state; для mock provider есть UI-пояснение.

`screens/Admin/CRM/page.tsx`

- CRM-сегменты и маркетинговые кампании.
- Использует `lib/admin/crm`.
- Может запускать campaigns через `/api/crm/campaigns/run`.
- Таблицы: `patient_metrics`, `marketing_campaigns`, `campaign_deliveries`.

`screens/Admin/Logs/page.tsx`

- Системные logs.
- Использует `lib/logger`, `LogsTable`, `useDownloadLogs`.
- Таблица: `app_logs`.

`screens/Admin/Audit/page.tsx`

- Audit Trail медицинских данных.
- Использует `lib/auditLogs`, `AuditLogsTable`.
- Таблица: `audit_logs`.

`screens/Admin/Settings/page.tsx`

- Настройки клиники.
- Использует `ClinicProvider` и PATCH `/api/clinic/settings`.
- Может менять display name, branding, контакты, working hours/booking settings в рамках возможностей `clinicSettingsService`.

`screens/Admin/Doctors/page.tsx`

- Управление врачами из таблицы `doctors`.
- Использует `lib/admin/doctors`.

`screens/Admin/Price/page.tsx`

- Управление услугами из таблицы `services`.
- Использует `lib/admin/services`.

`screens/Admin/Feed/page.tsx`

- Админская "лента".
- По текущему коду выглядит как UI/prototype с hardcoded/mock данными, не ключевой production data flow.

### Platform Screens

`screens/Platform/Dashboard/page.tsx`

- SaaS dashboard.
- Использует `fetchPlatformStats()`.
- Показывает total clinics, active/trial, MRR, appointments/errors.

`screens/Platform/Clinics/page.tsx`

- Список клиник.
- Использует `fetchPlatformClinics()`.

`screens/Platform/ClinicDetail/page.tsx`

- Детали клиники.
- GET/PATCH `/api/platform/clinics/[id]`.
- Управляет active flag, plan, subscription status, onboarding status.

`screens/Platform/Onboarding/page.tsx`

- Создание новой клиники.
- Использует `createPlatformClinic()` и тарифы.

`screens/Platform/Monitoring/page.tsx`

- Мониторинг клиник.
- Использует `/api/platform/monitoring`.

---

## 9. Components

### UI components

| File | Responsibility |
|---|---|
| `components/ui/Button.tsx` | базовая кнопка |
| `components/ui/Card.tsx` | card container |
| `components/ui/Input.tsx` | input |
| `components/ui/Toast.tsx` | toast UI |
| `components/ui/ConfirmDialog.tsx` | confirmation dialog |
| `components/ui/ThemeToggleButton.tsx` | переключатель темы |

### Layout

| File | Responsibility |
|---|---|
| `components/layout/Header.tsx` | пациентский header |
| `components/layout/BottomBar.tsx` | пациентский bottom navigation |
| `components/layout/AdminBottomBar.tsx` | admin bottom navigation |
| `components/platform/PlatformNav.tsx` | platform zone navigation |

### Auth

| File | Responsibility |
|---|---|
| `components/auth/PatientAppGate.tsx` | route guard |
| `components/auth/PinScreen.tsx` | PIN create/verify screen |
| `components/auth/PinKeypad.tsx` | PIN keypad |
| `components/auth/PinDots.tsx` | PIN visual dots |

### Chat

| File | Responsibility |
|---|---|
| `components/chat/LongPressBubble.tsx` | message bubble with long press |
| `components/chat/ChatMessageContextMenu.tsx` | edit/delete context menu |
| `components/chat/ChatMessageMetaRow.tsx` | message metadata row |

### AI

| File | Responsibility |
|---|---|
| `components/ai/PatientAiAssistant.tsx` | пациентский AI assistant |
| `components/ai/DoctorAiToolbar.tsx` | врачебный AI toolbar |
| `components/ai/AiResultPanel.tsx` | вывод AI результата |

### Dental / Consultation

| File | Responsibility |
|---|---|
| `components/dental/PatientToothFormula.tsx` | визуальная формула зубов |
| `components/icons/FormulaToothIcon.tsx` | иконка зуба |
| `components/consultation/VideoConsultationRoom.tsx` | WebRTC/video room UI |
| `components/consultation/ConsultationFilePanel.tsx` | файлы консультации + realtime |
| `components/consultation/XrayViewer.tsx` | просмотр снимков |

### Admin charts/tables

| File | Responsibility |
|---|---|
| `components/admin/DashboardRevenueChart.tsx` | revenue chart |
| `components/admin/DashboardAppointmentsChart.tsx` | appointments chart |
| `components/admin/FinanceRevenueChart.tsx` | finance chart |
| `components/admin/DoctorKpiChart.tsx` | doctor KPI chart |
| `components/admin/PatientSegmentChart.tsx` | patient segments chart |
| `components/admin/LogsTable.tsx` | app logs table |
| `components/admin/AuditLogsTable.tsx` | audit table |
| `components/admin/DownloadLogsButton.tsx` | export logs |

---

## 10. Hooks

| Hook | File | Назначение |
|---|---|---|
| `useToast` | `hooks/useToast.ts` | toast state |
| `useConfirmDialog` | `hooks/useConfirmDialog.tsx` | confirm dialog state |
| `useDarkMode` | `hooks/useDarkMode.ts` | dark mode helper |
| `useLongPress` | `hooks/useLongPress.ts` | long press gesture |
| `useClientNow` | `hooks/useClientNow.ts` | client-only current Date to avoid hydration mismatch |
| `useUpcomingCount` | `hooks/useUpcomingCount.ts` | upcoming appointments count |
| `usePatientUnreadCount` | `hooks/usePatientUnreadCount.ts` | unread chat count |
| `useDownloadLogs` | `hooks/useDownloadLogs.ts` | logs export |
| `useClinicTimeSlots` | `hooks/useClinicTimeSlots.ts` | booking slots from clinic settings |

---

## 11. Lib Architecture

### Client-side domain libs

| File | Responsibility |
|---|---|
| `lib/auth.ts` | dental session localStorage, client/employee caches, legacy helpers, profile updates |
| `lib/auth/applyAuthSession.ts` | apply Supabase tokens and dental session |
| `lib/auth/pinApi.ts` | Supabase RPC calls for PIN |
| `lib/auth/lookupByPhoneApi.ts` | phone lookup client |
| `lib/api/fetchApi.ts` | `dentalApiFetch` and deprecated `dentalGw` |
| `lib/appointments.ts` | appointments cache and client operations |
| `lib/appointmentNotify.ts` | async notification call helper |
| `lib/supportChat.ts` | patient/staff chat, hydration, realtime/polling, unread state |
| `lib/doctorOrdinatorskayaChat.ts` | doctor rooms/messages client logic |
| `lib/bills.ts` | bills CRUD and legacy migration |
| `lib/payments.ts` | payment reads/manual payments/client create payment |
| `lib/treatmentPlan.ts` | treatment plan items and legacy migration |
| `lib/planUtils.ts` | merged treatment plan stats |
| `lib/teeth.ts` | local patient tooth formula state |
| `lib/patientTeeth.ts` | Supabase-backed patient formula helpers |
| `lib/medicalRecords.ts` | medical records CRUD |
| `lib/patientVisits.ts` | visits CRUD |
| `lib/patientFiles.ts` | Storage + patient_files |
| `lib/patientCabinet.ts` | aggregate patient cabinet data |
| `lib/patientRecommendations.ts` | prevention/recommendations |
| `lib/userProfile.ts` | local profile/preferences + merge with dental session |
| `lib/logger.ts` | app logs to Supabase |
| `lib/telegramWebApp.ts` | Telegram runtime helpers |
| `lib/telegramHaptic.ts` | haptic feedback |
| `lib/videoConsultation.ts` | consultation helper/window logic |
| `lib/webrtc/consultationPeer.ts` | WebRTC peer abstraction |
| `lib/aiAssistant.ts` | shared AI assistant client types/helpers |

### Admin/platform libs

| File | Responsibility |
|---|---|
| `lib/admin/dashboard.ts` | dashboard stats |
| `lib/admin/analytics.ts` | analytics/KPI and CSV/export data |
| `lib/admin/finance.ts` | finance stats/payments/bills |
| `lib/admin/crm.ts` | CRM segments/campaign UI data |
| `lib/admin/doctors.ts` | doctors CRUD |
| `lib/admin/services.ts` | services CRUD |
| `lib/admin/settings.ts` | settings helpers |
| `lib/admin/types.ts` | admin DTOs |
| `lib/platform/client.ts` | platform API client |
| `lib/platform/types.ts` | platform DTOs |
| `lib/platform/plans.ts` | fallback plans and formatting |

### Server-only libs

| File | Responsibility |
|---|---|
| `lib/supabase/serverAdmin.ts` | service role Supabase client |
| `lib/server/supabaseAnon.ts` | server anon Supabase client |
| `lib/server/dentalGateVerify.ts` | Telegram initData verification/dev gate |
| `lib/server/api/parseDentalRequest.ts` | reads `X-Telegram-Init-Data` and `X-Dental-Actor` |
| `lib/server/api/apiResponse.ts` | `withApiHandler`, `jsonOk`, error response |
| `lib/server/api/apiError.ts` | typed API errors |
| `lib/server/services/shared/accessControl.ts` | actor validation, row loading, permissions |
| `lib/server/services/authService.ts` | gateway auth operations |
| `lib/server/services/appointmentService.ts` | appointment list/create/cancel/reschedule |
| `lib/server/services/chatService.ts` | chat messages REST service |
| `lib/server/services/doctorRoomService.ts` | doctor room REST service |
| `lib/server/services/clientProfileService.ts` | client profile/formula/internal notes |
| `lib/server/services/patientResolverService.ts` | resolves client id for appointments |
| `lib/server/services/cacheService.ts` | dental clients/employees cache payloads |
| `lib/server/services/videoConsultationService.ts` | video consultation CRUD/status/annotations |
| `lib/server/services/aiService.ts` | AI assistant permissions/actions |
| `lib/server/ai/openaiClient.ts` | OpenAI-compatible client |
| `lib/server/ai/patientContext.ts` | patient context prompt data |
| `lib/server/ai/prompts.ts` | AI prompts |
| `lib/server/appointmentTelegram.ts` | appointment notifications/reminders |
| `lib/server/telegramBot.ts` | Telegram Bot API wrapper |
| `lib/server/crmMarketing.ts` | CRM metrics/campaign send/cron |
| `lib/server/acquiring.ts` | mock/YooKassa acquiring abstraction |
| `lib/server/clinicService.ts` | public clinic settings |
| `lib/server/clinicSettingsService.ts` | admin clinic settings patch |
| `lib/server/platformService.ts` | SaaS platform operations |
| `lib/server/planLimits.ts` | subscription plan feature gates |
| `lib/server/requireAdminApi.ts` | admin bearer auth |
| `lib/server/requirePlatformAdminApi.ts` | platform bearer auth |

---

## 12. API Routes

Все routes лежат в `app/api/**/route.ts`. Часть endpoints использует стандартную обёртку `{ ok: true, data }`, часть legacy endpoints возвращает plain JSON `{ ok: true }` или `{ error }`.

### Auth API

| Endpoint | Method | Body | Response | Permissions / Notes |
|---|---|---|---|---|
| `/api/auth/telegram` | POST | `{ initData }` | `{ ok, session? , needs_registration? }` | Требует валидный Telegram Mini App initData; только пациентский вход |
| `/api/auth/register` | POST | `{ phone, firstName, lastName, email?, initData? }` | `{ ok, session }` | Создаёт Supabase Auth user + `dental_clients` |
| `/api/auth/admin-phone` | POST | `{ phone }` | `{ ok, session }` | Ищет `dental_employees.role = admin` |
| `/api/auth/doctor-phone` | POST | `{ phone }` | `{ ok, session }` | Ищет `dental_employees.role = doctor` |
| `/api/auth/lookup-by-phone` | POST | `{ phone }` | `{ ok, employee, client }` | Service-role lookup by phone suffix; route file has no Telegram gate / actor auth |
| `/api/auth/telegram-id` | POST | `{ telegramId? }` + dental headers | `{ ok: true }` | Привязывает Telegram id, если поле пустое |

### Appointment API

| Endpoint | Method | Body / Query | Response | Permissions |
|---|---|---|---|---|
| `/api/appointments` | GET | headers actor/initData | list appointments | client видит свои; doctor/admin шире; actor-less request is a service-role leakage risk |
| `/api/appointments` | POST | appointment payload | created appointment | только `client` в `appointmentService` |
| `/api/appointments/[id]` | POST | none | cancel result | actor must have access |
| `/api/appointments/[id]` | PATCH | `{ day, monthNum, year, time }` | reschedule result | actor must have access |
| `/api/appointments/notify` | POST | `{ event, appointment_id }` | `{ ok: true }` | server notification helper; не проверяет user session |

Важно: comments в `[id]/route.ts` говорят `/cancel` и `/reschedule`, но реальный маршрут — `/api/appointments/[id]` с `POST` для cancel и `PATCH` для reschedule.

### Chat API

| Endpoint | Method | Body / Query | Response | Permissions |
|---|---|---|---|---|
| `/api/chat/messages` | GET | `?limit=` | messages | actor-scoped |
| `/api/chat/messages` | POST | chat message payload | inserted message | client/staff rules |
| `/api/chat/messages` | PATCH | `{ messageId, text }` | updated message | own/staff permissions |
| `/api/chat/messages` | DELETE | `?messageId=` | delete result | own/staff permissions |
| `/api/doctor/rooms` | GET | `action=general|dm-map|poll|messages` | room data/messages | doctor only in service |
| `/api/doctor/rooms` | POST | `{ action, ... }` | room/message/poll result | doctor only |

### Client/Profile API

| Endpoint | Method | Body / Query | Response | Permissions |
|---|---|---|---|---|
| `/api/clients/profile` | PATCH | personal profile fields | updated row | only `client` |
| `/api/clients/resolve` | POST | `{ uid?, explicitPhone? }` | client pk | actor-scoped |
| `/api/clients/[id]` | GET | none | client row | access control in service |
| `/api/clients/[id]` | PATCH | `{ formulaTeeth|teeth }` or `{ internalNotes|notes }` | updated row | formula/notes permissions |
| `/api/cache/dental` | POST | headers actor/initData | clients/employees cache payload | role scoped |

### Deprecated Gateway

| Endpoint | Method | Body | Response | Status |
|---|---|---|---|---|
| `/api/dental-db` | POST | `{ op, payload, telegramInitData, actor }` | `{ ok, data }` with `Deprecation: true` | Deprecated compatibility layer |

Supported operations include:

- `authLookupEmployeeClient`;
- `refreshDentalCaches`;
- `registerClient`;
- `shadowEnsureActor`;
- `patchTelegramIdIfEmpty`;
- `selectClientByPatientUuid`;
- `resolveClientPkForAppointment`;
- `appointmentList`;
- `appointmentInsert`;
- `appointmentCancel`;
- `appointmentReschedule`;
- `chatListMessages`;
- `chatInsertMessage`;
- `doctorEnsureGeneralRoom`;
- `doctorDmPeerMap`;
- `doctorFindOrCreatePrivateRoom`;
- `doctorFetchRoomMessages`;
- `doctorInsertRoomMessage`;
- `doctorPollRooms`;
- `updateClientFormulaTeethById`;
- `updateClientInternalNotes`;
- `updateClientPersonalProfile`.

`lib/api/fetchApi.ts` still exports deprecated `dentalGw()` that calls this endpoint.

### Clinic API

| Endpoint | Method | Body / Query | Response | Permissions |
|---|---|---|---|---|
| `/api/clinic/settings` | GET | `?slug=` | public clinic settings | public/anon allowed |
| `/api/clinic/settings` | PATCH | `ClinicSettingsPatch` | updated settings | admin via `clinicSettingsService` |

### AI API

| Endpoint | Method | Body | Response | Permissions |
|---|---|---|---|---|
| `/api/ai` | POST | `{ action, ... }` | AI result | actor role checked in `aiService` |

AI env:

- `OPENAI_API_KEY`;
- `OPENAI_MODEL`;
- `OPENAI_BASE_URL`.

`aiService` restricts actions per role:

- patient actions;
- doctor actions;
- admin can access broader context.

### Video Consultation API

| Endpoint | Method | Body / Query | Response | Permissions |
|---|---|---|---|---|
| `/api/consultations` | GET | `?appointmentId=` | consultation by appointment | `assertVideoEnabled()` + appointment access |
| `/api/consultations` | POST | `{ appointmentId }` | get/create consultation | video plan enabled |
| `/api/consultations/[id]` | PATCH | `{ status, sharedFileId? }` | updated consultation | actor access |
| `/api/consultations/[id]` | GET | `?annotations=1` | annotations or `{ id }` | actor access |
| `/api/consultations/[id]` | POST | `{ fileId, strokes }` | saved annotation | actor access |

### Payments API

| Endpoint | Method | Body | Response | Permissions / Notes |
|---|---|---|---|---|
| `/api/payments/create` | POST | `{ billId }` | `{ paymentId, status, confirmationUrl? }` | Uses service role; current file does not parse dental actor |
| `/api/payments/webhook` | POST | provider webhook | `{ ok }` | For non-mock provider; optional `ACQUIRING_WEBHOOK_SECRET` |

Payment provider:

- default `mock`: immediate success;
- `yookassa`: creates payment through YooKassa API;
- `tinkoff` and `sberbank`: declared enum values but not implemented, throw error.

### Telegram / Notifications / Cron API

| Endpoint | Method | Body / Query | Response | Permissions |
|---|---|---|---|---|
| `/api/send-tg-notification` | POST | `{ telegram_id, message }` | `{ ok, message_id }` | sends arbitrary Telegram message; no actor auth in route |
| `/api/telegram/webhook` | POST | Telegram update | `{ ok: true }` | optional `?secret=TELEGRAM_WEBHOOK_SECRET` |
| `/api/cron/appointment-reminders` | GET/POST | Authorization bearer cron secret | counts | requires `CRON_SECRET`, dev allows missing secret |
| `/api/cron/crm-campaigns` | GET/POST | Authorization bearer cron secret | metrics/campaign results | requires `CRON_SECRET`, dev allows missing secret |
| `/api/crm/campaigns/run` | POST | `{ campaignId }` + admin Bearer | `{ ok, sent, failed, skipped }` | requires clinic admin bearer auth |

### Platform API

All platform endpoints require platform admin bearer token except `/api/platform/me`, which returns false instead of throwing.

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/api/platform/me` | GET | none | `{ isPlatformAdmin, email }` |
| `/api/platform/stats` | GET | none | platform stats |
| `/api/platform/monitoring` | GET | none | monitoring rows |
| `/api/platform/plans` | GET | none | subscription plans |
| `/api/platform/clinics` | GET | none | clinics list |
| `/api/platform/clinics` | POST | `CreateClinicInput` | created clinic |
| `/api/platform/clinics/[id]` | GET | none | clinic detail |
| `/api/platform/clinics/[id]` | PATCH | `{ isActive?, planCode?, subscriptionStatus?, onboardingStatus? }` | updated clinic |

---

## 13. Environment Variables

Verified by code search.

| Env var | Used in | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/publicConfig.ts`, `serverAdmin.ts`, platform auth | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/publicConfig.ts`, platform bearer validation | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/serverAdmin.ts` | Server-only service role |
| `TELEGRAM_BOT_TOKEN` | `dentalGateVerify`, `telegramBot` | Verify initData and send bot messages |
| `DENTAL_GATE_DEV_ALLOW` | `dentalGateVerify` | Dev bypass for Telegram gate outside production |
| `TELEGRAM_MINI_APP_URL` | `telegramBot` | URL for Telegram inline keyboard |
| `NEXT_PUBLIC_SITE_URL` | `telegramBot` | fallback mini app/site URL |
| `VERCEL_URL` | `telegramBot` | fallback deployed URL |
| `TELEGRAM_WEBHOOK_SECRET` | `/api/telegram/webhook` | optional webhook URL secret |
| `CRON_SECRET` | cron routes | bearer secret for cron routes |
| `CLINIC_TZ_OFFSET` | `appointmentTelegram` | appointment reminder date parsing |
| `CLINIC_SLUG` | `clinicService` | server-side clinic slug |
| `NEXT_PUBLIC_CLINIC_SLUG` | `clinic/defaults`, `clinicService` | client/default clinic slug |
| `PLATFORM_ADMIN_EMAILS` | `requirePlatformAdminApi` | env allowlist for platform admins |
| `PLATFORM_ADMIN_PHONES` | `requirePlatformAdminApi` | env allowlist by employee phone |
| `OPENAI_API_KEY` | `openaiClient` | AI provider key |
| `OPENAI_MODEL` | `openaiClient` | AI model override |
| `OPENAI_BASE_URL` | `openaiClient` | OpenAI-compatible base URL |
| `ACQUIRING_PROVIDER` | `acquiring` | `mock`, `yookassa`, `tinkoff`, `sberbank` |
| `YOOKASSA_SHOP_ID` | `acquiring` | YooKassa credentials |
| `YOOKASSA_SECRET_KEY` | `acquiring` | YooKassa credentials |
| `ACQUIRING_WEBHOOK_SECRET` | `/api/payments/webhook` | optional webhook shared secret |
| `NODE_ENV` | gate/cron docs/code | production/dev branch logic |

Docs mention `NEXT_PUBLIC_DEMO_OTP_CODES`, but current production code search only found it inside `docs/qa_security_audit.md`, not active code.

---

## 14. Database Schema

Migrations live in `supabase/migrations`. `001_master.sql` creates base schema; later migrations extend it. `all_migrations.sql` exists as a large aggregated/historical SQL file and should not be treated as the only canonical migration source without manual review.

### Migration Inventory

| File | Purpose |
|---|---|
| `001_master.sql` | base schema: clients, employees, doctors, services, appointments, chats, rooms, logs, profiles, core RLS/RPC |
| `002_bills_treatment_plan.sql` | bills, treatment_plan_items, doctor patient access helpers |
| `003_medical_records_patient_visits.sql` | medical_records, patient_visits |
| `004_patient_files_storage.sql` | Storage bucket `patient-files`, table `patient_files`, storage policies |
| `005_appointment_notifications.sql` | appointment reminder/confirmation columns and pending reminder index |
| `006_payments_finance.sql` | payments, bill-payment sync triggers |
| `007_crm_marketing.sql` | patient_metrics, marketing_campaigns, campaign_deliveries, refresh_patient_metrics |
| `008_analytics_kpi.sql` | doctor_metrics, refresh_doctor_metrics |
| `009_audit_logs.sql` | audit_logs and audit triggers on medical data |
| `010_multi_tenant.sql` | clinics, clinic_settings, clinic_id on business tables, tenant RLS helpers/policies |
| `011_video_consultations.sql` | video_consultations, consultation_annotations, realtime, video file upload policy |
| `012_saas_platform.sql` | subscription_plans, clinic_subscriptions, platform_admins, SaaS policies |

Seed files:

| File | Purpose |
|---|---|
| `seed_doctors_services.sql` | doctors/services seed |
| `seed_demo_commercial.sql` | commercial demo dataset |
| `seed_demo_reset.sql` | demo reset |
| `seed_demo_tenant_b.sql` | second tenant demo |

### Table Catalog

#### `dental_clients`

Business meaning: пациенты клиники.

Key columns:

- `id text primary key default gen_random_uuid()::text`;
- `phone text not null`;
- `role text default 'client'`;
- `first_name`, `last_name`, `name`, `email`;
- `formula_teeth jsonb`;
- `internal_notes text`;
- legacy columns `pin_hash`, `pin_attempts`, `pin_locked_until` still present, but active PIN-flow uses `profiles`;
- `telegram_id bigint`;
- `telegram_username`;
- `auth_user_id uuid references auth.users`;
- `created_at`;
- after multi-tenant: `clinic_id uuid not null references clinics`.

Indexes/constraints:

- unique `auth_user_id` where not null;
- after `010`: unique `(clinic_id, phone)`;
- after `010`: unique `(clinic_id, telegram_id)` where not null.

Important triggers:

- `dental_clients_protect_internal_notes_trg` prevents clients from changing internal notes;
- `audit_dental_clients_medical` audits `formula_teeth` and `internal_notes`;
- `set_clinic_id_dental_clients` fills clinic id.

#### `dental_employees`

Business meaning: staff auth directory for doctors/admins.

Columns:

- `id text primary key default gen_random_uuid()::text`;
- `phone text not null`;
- `name`;
- `role text check role in ('admin', 'doctor')`;
- `specialization`;
- `first_name`, `last_name`, `email`;
- legacy PIN fields;
- `telegram_id`, `telegram_username`;
- `auth_user_id`;
- `created_at`;
- after `010`: `clinic_id`.

Indexes/constraints:

- unique `auth_user_id` where not null;
- after `010`: unique `(clinic_id, phone)`;
- after `010`: unique `(clinic_id, telegram_id)` where not null.

Business note: do not confuse with `doctors`. `dental_employees` is auth/role directory; `doctors` is public/admin catalog.

#### `doctors`

Business meaning: doctor catalog used by admin and public UI.

Columns:

- `id uuid primary key`;
- `created_at`;
- `name`;
- `specialization`;
- `photo_url`;
- `is_active`;
- `sort_order`;
- after `010`: `clinic_id`.

Indexes:

- `(sort_order, name)`;
- `is_active`;
- `clinic_id`.

#### `services`

Business meaning: services/price catalog.

Columns:

- `id uuid primary key`;
- `created_at`;
- `name`;
- `price numeric check >= 0`;
- `category`;
- `is_visible`;
- after `010`: `clinic_id`.

Indexes:

- `category`;
- `is_visible`;
- `clinic_id`.

#### `appointments`

Business meaning: appointments/booking records.

Columns:

- `id bigint generated always as identity primary key`;
- `created_at`;
- `client_id text references dental_clients(id)`;
- `doctor_id text references dental_employees(id)`;
- `doctor_name`;
- `appointment_date text`;
- `appointment_time text`;
- `status text default 'pending'`;
- `comment`;
- `service_id uuid references services(id)`;
- `patient_name`;
- notification columns:
  - `reminder_24h_sent_at`;
  - `reminder_2h_sent_at`;
  - `confirmed_at`;
  - `confirmation_tg_message_id`;
- video:
  - `visit_mode text default 'in_person' check in ('in_person', 'video')`;
- after `010`: `clinic_id`.

Indexes:

- `client_id`;
- `doctor_id`;
- `appointment_date`;
- reminder partial index on `(appointment_date, appointment_time)` for active statuses.

Constraint:

- `appointments_client_id_not_phone_like` prevents raw phone numbers as `client_id`.

#### `dental_messages`

Business meaning: legacy chat table kept for compatibility.

Columns:

- `id text primary key`;
- `sender_id`;
- `sender_role`;
- `sender_name`;
- `recipient_id`;
- `text`;
- `chat_type`;
- `created_at`.

Realtime enabled in `001_master.sql`, but active chat implementation uses `chat_messages`.

#### `chat_messages`

Business meaning: main patient/staff chat messages.

Columns:

- `id text primary key`;
- `created_at`;
- `sender_id`;
- `recipient_id`;
- `text`;
- `sender_role check in ('client', 'doctor', 'admin')`;
- `chat_type check in ('support', 'clinic', 'doctor')`;
- `sender_name`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `created_at`;
- `clinic_id`.

Realtime enabled.

#### `doctor_rooms`

Business meaning: internal doctor chat rooms.

Columns:

- `id text primary key`;
- `name`;
- `is_general`;
- `created_at`;
- `peer_low uuid`;
- `peer_high uuid`;
- after `010`: `clinic_id`.

Indexes:

- unique `(peer_low, peer_high)` for private rooms where not general.

#### `doctor_messages`

Business meaning: messages inside doctor rooms.

Columns:

- `id uuid primary key`;
- `created_at`;
- `room_id references doctor_rooms(id)`;
- `sender_id uuid`;
- `sender_name`;
- `text`;
- `body`;
- `metadata jsonb`;
- `updated_at`;
- after `010`: `clinic_id`.

Index:

- `(room_id, created_at desc)`.

Realtime enabled.

#### `app_logs`

Business meaning: application logs/events.

Columns:

- `id uuid primary key`;
- `created_at`;
- `level check in ('INFO', 'WARN', 'ERROR')`;
- `message`;
- `user_id`;
- `metadata jsonb`;
- after `012`: `clinic_id nullable`.

Indexes:

- `created_at desc`;
- `level`;
- `user_id where not null`;
- `clinic_id where not null`.

#### `profiles`

Business meaning: Supabase Auth profile row with PIN state.

Columns:

- `id uuid primary key references auth.users`;
- `pin_hash`;
- `pin_failed_attempts`;
- `pin_locked_until`;
- `updated_at`.

Triggers:

- `on_auth_user_created_profile` creates profile after auth user insert.

#### `bills`

Business meaning: patient bills/invoices.

Columns:

- `id uuid primary key`;
- `patient_id uuid references dental_clients`;
- `appointment_id bigint references appointments`;
- `amount`;
- `paid_amount`;
- `status check in ('pending', 'paid', 'partial', 'overdue')`;
- `description`;
- `bill_number`;
- `metadata`;
- `paid_at`;
- `due_date`;
- `created_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `patient_id`;
- `appointment_id`;
- `status`;
- unique pending/open bill per appointment for statuses pending/overdue.

Triggers:

- `bills_set_updated_at`;
- payment sync updates status/paid amount through payments triggers.

#### `treatment_plan_items`

Business meaning: treatment plan rows.

Columns:

- `id uuid primary key`;
- `patient_id uuid references dental_clients`;
- `doctor_id uuid references dental_employees`;
- `appointment_id bigint references appointments`;
- `title`;
- `description`;
- `category`;
- `price`;
- `priority`;
- `status check in ('pending', 'in_progress', 'completed', 'cancelled')`;
- `planned_date`;
- `completed_date`;
- `created_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `patient_id`;
- `doctor_id`;
- `planned_date`.

Audited by `audit_treatment_plan_items`.

#### `medical_records`

Business meaning: persistent medical facts: allergies, chronic diseases, medications, contraindications, general notes.

Columns:

- `id uuid primary key`;
- `patient_id uuid references dental_clients`;
- `record_type check in ('allergy', 'chronic', 'medication', 'contraindication', 'general')`;
- `title`;
- `description`;
- `severity check null or low/medium/high`;
- `is_active`;
- `visible_to_patient`;
- `created_by uuid references dental_employees`;
- `created_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `patient_id`;
- `record_type`.

Audited by `audit_medical_records`.

#### `patient_visits`

Business meaning: treatment history by visit.

Columns:

- `id uuid primary key`;
- `patient_id uuid references dental_clients`;
- `doctor_id uuid references dental_employees`;
- `appointment_id bigint references appointments`;
- `visit_date date`;
- `procedure_title`;
- `procedure_description`;
- `tooth_numbers integer[]`;
- `diagnosis`;
- `clinical_notes`;
- `materials`;
- `price`;
- `visible_to_patient`;
- `created_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `patient_id`;
- `doctor_id`;
- `appointment_id`;
- `visit_date desc`.

Audited by `audit_patient_visits`.

#### `patient_files`

Business meaning: metadata for patient files stored in Supabase Storage bucket `patient-files`.

Columns:

- `id uuid primary key`;
- `patient_id uuid references dental_clients`;
- `storage_path unique`;
- `file_name`;
- `mime_type check in ('image/jpeg', 'image/png', 'application/pdf')`;
- `file_category check in ('xray', 'photo', 'document', 'scan', 'other')`;
- `file_size`;
- `visit_id uuid references patient_visits`;
- `appointment_id bigint references appointments`;
- `description`;
- `visible_to_patient`;
- `uploaded_by uuid references dental_employees`;
- `created_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `patient_id`;
- `visit_id`;
- `file_category`.

Storage:

- bucket `patient-files`;
- private;
- 10 MB limit;
- allowed MIME: JPG, PNG, PDF.

Audited by `audit_patient_files`.

#### `payments`

Business meaning: payments for bills.

Columns:

- `id uuid primary key`;
- `bill_id uuid references bills`;
- `patient_id uuid references dental_clients`;
- `amount numeric > 0`;
- `method check in ('online', 'cash', 'card_terminal', 'transfer')`;
- `status check in ('pending', 'processing', 'succeeded', 'failed', 'refunded')`;
- `provider check in ('mock', 'yookassa', 'tinkoff', 'sberbank')`;
- `external_id`;
- `metadata`;
- `completed_at`;
- `created_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `bill_id`;
- `patient_id`;
- `status`;
- `completed_at where status = 'succeeded'`;
- unique `(provider, external_id)` where external id exists.

Triggers:

- `payments_sync_bill` updates bill paid amount/status;
- `payments_set_updated_at`.

#### `patient_metrics`

Business meaning: cached CRM patient metrics.

Columns:

- `patient_id uuid primary key references dental_clients`;
- `total_visits`;
- `last_visit_date`;
- `days_since_visit`;
- `total_paid`;
- `overdue_debt`;
- `segment_key check in ('new', 'active', 'at_risk', 'dormant', 'high_value', 'debtor')`;
- `has_telegram`;
- `last_reactivation_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `segment_key`;
- `last_reactivation_at where has_telegram`.

Updated by RPC `refresh_patient_metrics()`.

#### `marketing_campaigns`

Business meaning: CRM Telegram campaigns.

Columns:

- `id uuid primary key`;
- `name`;
- `segment_key`;
- `message_template`;
- `trigger_type check in ('manual', 'reactivation_auto')`;
- `min_days_since_visit`;
- `max_sends_per_run`;
- `status check in ('draft', 'active', 'paused', 'completed')`;
- `last_run_at`;
- `created_at`;
- `updated_at`;
- after `010`: `clinic_id`.

Index:

- `(status, trigger_type)`.

#### `campaign_deliveries`

Business meaning: per-patient delivery log for campaigns.

Columns:

- `id uuid primary key`;
- `campaign_id references marketing_campaigns`;
- `patient_id references dental_clients`;
- `status check in ('pending', 'sent', 'failed', 'skipped')`;
- `error_message`;
- `telegram_message_id`;
- `sent_at`;
- `created_at`;
- unique `(campaign_id, patient_id)`;
- after `010`: `clinic_id`.

Index:

- `(campaign_id, status)`.

#### `doctor_metrics`

Business meaning: cached KPI per doctor.

Columns:

- `doctor_key text primary key`;
- `doctor_id`;
- `doctor_name`;
- `specialization`;
- monthly/total appointment counts;
- completed/cancelled counts;
- unique patients month;
- revenue month/total;
- completion rate;
- `updated_at`;
- after `010`: `clinic_id`.

Indexes:

- `revenue_month desc`;
- `doctor_id where not null`.

Updated by RPC `refresh_doctor_metrics()`.

#### `audit_logs`

Business meaning: immutable audit trail for medical data changes.

Columns:

- `id uuid primary key`;
- `table_name`;
- `record_id`;
- `patient_id`;
- `action check in ('insert', 'update', 'delete')`;
- `actor_id`;
- `actor_role`;
- `old_data`;
- `new_data`;
- `changed_fields text[]`;
- `created_at`;
- after `010`: `clinic_id`.

Indexes:

- `created_at desc`;
- `patient_id where not null`;
- `table_name`;
- `(table_name, record_id)`.

Triggers audit:

- `medical_records`;
- `patient_visits`;
- `patient_files`;
- `treatment_plan_items`;
- `dental_clients` medical fields.

#### `clinics`

Business meaning: tenant/clinic in SaaS model.

Columns:

- `id uuid primary key`;
- `slug unique`;
- `name`;
- `is_active`;
- `created_at`;
- `updated_at`;
- `onboarding_status check in ('draft', 'pending', 'completed')`;
- `onboarded_at`.

Indexes:

- unique slug;
- active partial index.

#### `clinic_settings`

Business meaning: public branding/contact/booking settings per clinic.

Columns:

- `clinic_id uuid primary key references clinics`;
- `display_name`;
- `tagline`;
- `logo_url`;
- `primary_color`;
- `accent_color`;
- address/contact fields;
- `working_hours jsonb`;
- `booking_slots jsonb`;
- `timezone`;
- `tz_offset`;
- `telegram_bot_username`;
- `telegram_mini_app_url`;
- `locale`;
- `metadata`;
- `updated_at`.

#### `video_consultations`

Business meaning: WebRTC consultation session tied to appointment.

Columns:

- `id uuid primary key`;
- `clinic_id`;
- `appointment_id bigint unique references appointments`;
- `patient_id uuid references dental_clients`;
- `doctor_id uuid references dental_employees`;
- `status check in ('waiting', 'active', 'ended', 'cancelled')`;
- `room_token`;
- `started_at`;
- `ended_at`;
- `shared_file_id references patient_files`;
- `metadata`;
- `created_at`;
- `updated_at`.

Indexes:

- `clinic_id`;
- `patient_id`;
- active status partial index.

Realtime enabled.

#### `consultation_annotations`

Business meaning: shared image/X-ray annotations during consultation.

Columns:

- `id uuid primary key`;
- `clinic_id`;
- `consultation_id references video_consultations`;
- `file_id references patient_files`;
- `author_id`;
- `author_role check in ('doctor', 'admin', 'client')`;
- `strokes jsonb`;
- `created_at`;
- `updated_at`.

Index:

- `consultation_id`.

Realtime enabled.

#### `subscription_plans`

Business meaning: SaaS pricing plans.

Columns:

- `id uuid primary key`;
- `code unique`;
- `name`;
- `description`;
- `price_monthly`;
- `currency`;
- `limits jsonb`;
- `features jsonb`;
- `sort_order`;
- `is_active`;
- `created_at`.

Seed plans:

- `starter`;
- `pro`;
- `enterprise`.

#### `clinic_subscriptions`

Business meaning: active subscription per clinic.

Columns:

- `clinic_id primary key references clinics`;
- `plan_id references subscription_plans`;
- `status check in ('trial', 'active', 'past_due', 'cancelled', 'suspended')`;
- `trial_ends_at`;
- `current_period_start`;
- `current_period_end`;
- `metadata`;
- `created_at`;
- `updated_at`.

Indexes:

- `plan_id`;
- `status`.

#### `platform_admins`

Business meaning: platform super admins.

Columns:

- `id uuid primary key`;
- `auth_user_id unique references auth.users`;
- `email`;
- `full_name`;
- `created_at`.

Index:

- lower email where email not empty.

### RPC / Functions

Core functions:

- `phone_digits_normalized(p_raw text)`;
- `subject_client_pk()`;
- `is_staff_user()`;
- `is_admin_user()`;
- `doctor_can_access_patient(p_patient_id text)`;
- `chat_staff_can_read_row(...)`;
- `dental_clients_protect_internal_notes()`;
- `handle_new_auth_user_profile()`;
- `ensure_profile_row(p_user_id uuid)`;
- `set_user_pin(p_user_id uuid, p_pin text)`;
- `verify_user_pin(p_user_id uuid, p_pin text)`;
- legacy `set_client_pin`, `set_employee_pin`;
- `delete_old_logs()`;
- `set_updated_at_timestamp()`;
- `sync_bill_from_payments(p_bill_id uuid)`;
- `payments_sync_bill_trigger()`;
- `refresh_patient_metrics()`;
- `refresh_doctor_metrics()`;
- `audit_resolve_actor()`;
- `audit_jsonb_changed_keys(p_old, p_new)`;
- `audit_medical_row_change()`;
- `audit_dental_client_medical_change()`;
- `default_clinic_id()`;
- `staff_clinic_id()`;
- `client_clinic_id()`;
- `user_clinic_id()`;
- `same_user_clinic(p_clinic_id uuid)`;
- `set_row_clinic_id_default()`;
- `is_platform_admin()`;
- `clinic_plan_limits(p_clinic_id uuid)`.

### Realtime

Tables added to `supabase_realtime`:

- `dental_messages`;
- `chat_messages`;
- `doctor_messages`;
- `video_consultations`;
- `consultation_annotations`.

Client usage also creates realtime channels for consultation files and doctor message inserts.

---

## 15. Data Flow

### Supabase Clients

Client anon:

- `lib/supabaseClient.ts`;
- uses `NEXT_PUBLIC_SUPABASE_URL`;
- uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- warns in console if not configured.

Server service role:

- `lib/supabase/serverAdmin.ts`;
- imports `server-only`;
- uses `SUPABASE_SERVICE_ROLE_KEY`;
- disables session persistence/refresh/url detection.

Server anon:

- `lib/server/supabaseAnon.ts`;
- used where RLS/auth-user context matters or where service role is not necessary.

### API Auth Headers

`dentalApiFetch()` attaches:

- `Content-Type: application/json`;
- `X-Telegram-Init-Data` from Telegram WebApp if available;
- `X-Dental-Actor` serialized from local dental session.

Server parsing:

- `parseDentalRequest()` verifies Telegram gate;
- parses actor from header or body;
- creates service context with service-role Supabase client.

Security implication: REST service layer uses service role, so actor validation and Telegram gate checks in code are critical. RLS is not the only protection for those endpoints.

### Caches

`PatientAppGate` and other screens refresh caches:

- dental clients/employees via `refreshDentalCaches`;
- appointments via `refreshAppointmentsCache`;
- chat messages via `hydrateDentalMessages`.

Events:

- `DENTAL_SESSION_CHANGED_EVENT`;
- `appointmentsUpdated`;
- `dentalClientsUpdated`;
- chat update custom events.

---

## 16. Business Logic

### Booking Flow

1. Patient opens `/booking`.
2. Selects category, doctor, service, date/time.
3. UI uses hardcoded doctor/service mock arrays, not directly `doctors/services` tables.
4. `addAppointment()` resolves patient id and posts to `/api/appointments`.
5. `appointmentService.insertAppointment()` checks actor role client.
6. Appointment row inserted into `appointments`.
7. Client refreshes appointment cache.
8. `addBillForAppointment()` creates bill in `bills`.
9. `postAppointmentNotifyAsync("booking_created")` calls `/api/appointments/notify`.
10. Notification service sends:
    - doctor notification if doctor employee has `telegram_id`;
    - patient confirmation message with inline keyboard if patient has `telegram_id`.
11. Success screen shows booking confirmation.

### Appointment Lifecycle

Real statuses used across code/schema:

- `pending`;
- `scheduled`;
- `rescheduled`;
- `completed`;
- `cancelled`;
- legacy/analytics code also checks `done` and `canceled` in some places.

Operations:

- create: client only;
- cancel: patient/doctor/admin if access passes;
- reschedule: patient/doctor/admin if access passes;
- doctor calendar filters by doctor full name;
- reminders use active statuses `pending`, `scheduled`, `rescheduled`;
- Telegram confirm changes `pending` to `scheduled`;
- Telegram cancel sets `cancelled`.

### Notifications

Telegram bot:

- low-level in `lib/server/telegramBot.ts`;
- appointment-specific in `lib/server/appointmentTelegram.ts`;
- arbitrary send endpoint `/api/send-tg-notification`.

Appointment notifications:

- booking created;
- patient rescheduled;
- patient cancelled;
- doctor rescheduled;
- doctor cancelled;
- 24h reminder;
- 2h reminder;
- inline confirm/cancel webhook.

Cron mismatch:

- handler comments say appointment reminders should run every 15 minutes;
- `vercel.json` runs once daily.

### Chats

Patient/staff chat:

- table `chat_messages`;
- `sender_role`: `client | doctor | admin`;
- `chat_type`: `support | clinic | doctor`;
- client messages and staff messages use `supportChat`/`chatService`;
- doctor visibility is limited to assigned patients or doctor thread logic;
- admin can see broader set.

Doctor internal chat:

- tables `doctor_rooms`, `doctor_messages`;
- general room plus private rooms by peer pair;
- used by `DoctorOrdinatorskayaChat`;
- consilium messages can include formula metadata.

Legacy:

- `dental_messages` remains in DB/realtime but active chat code uses `chat_messages`.

### Medical Records

Doctor med sheet aggregates:

- `dental_clients` profile/formula/internal notes;
- `appointments`;
- `treatment_plan_items`;
- `medical_records`;
- `patient_visits`;
- `patient_files`;
- AI draft/explanation actions.

Audit:

- changes to medical records, visits, files, treatment plan items and key dental client medical fields are captured in `audit_logs`.

### Bills And Payments

Bills:

- stored in `bills`;
- legacy localStorage bills migrate once in `lib/bills.ts`;
- status derived from payments and due date.

Payments:

- stored in `payments`;
- mock provider immediately succeeds;
- YooKassa intent implemented;
- webhook updates payment status;
- DB trigger syncs bill status and paid amount.

Security note:

- `/api/payments/create` currently uses service role and only takes `billId`; it does not parse dental actor/session in the route file. Access control should be reviewed.

### CRM

Patient metrics:

- generated by RPC `refresh_patient_metrics()`;
- segment keys: `new`, `active`, `at_risk`, `dormant`, `high_value`, `debtor`.

Campaigns:

- stored in `marketing_campaigns`;
- deliveries in `campaign_deliveries`;
- manual run via `/api/crm/campaigns/run` requiring admin bearer;
- auto run via cron `/api/cron/crm-campaigns`.

### AI Assistant

Endpoint:

- `/api/ai`;
- server service `runAiAssistant()`.

Data context:

- `lib/server/ai/patientContext.ts` loads patient, medical records, visits, plan items, files.

Provider:

- OpenAI-compatible HTTP client with `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.

Prompt rules:

- system prompt instructs to use provided medical data and not invent facts.

### Video Consultations

Flow:

1. Appointment may have `visit_mode = 'video'`.
2. User opens `/consultation/[appointmentId]`.
3. Client checks `canJoinVideoWindow()`.
4. `/api/consultations` checks `assertVideoEnabled()` from plan limits.
5. Creates or loads `video_consultations`.
6. `VideoConsultationRoom` manages UI and WebRTC.
7. Shared files come from `patient_files`.
8. Annotations stored in `consultation_annotations`.
9. Realtime enabled for consultation state and annotations.

Plan gating:

- `assertVideoEnabled()` uses subscription plan limits.

### Clinic Settings / Multi-tenant

Current app is multi-tenant-ready:

- default clinic exists with fixed UUID;
- most business tables get `clinic_id`;
- `ClinicProvider` uses `NEXT_PUBLIC_CLINIC_SLUG` or default;
- `clinic_settings` controls public branding/contacts/slots;
- platform screens can create/manage clinics and subscriptions.

Practical caveat:

- many older client flows still assume one default clinic or hardcoded doctor/service data; multi-tenant support is present but not fully productized everywhere.

---

## 17. Docs And Assets

### `docs/`

Current docs:

- `PRODUCT_PRESENTATION.md`;
- `qa_security_audit.md`;
- `QA_AUDIT_CLARIFICATIONS.md`;
- `ui_ux_audit.md`;
- `ui_ux_audit_old.md`;
- `performance_audit.md`;
- `tma_readiness_audit.md`;
- `DEMO_STAND.md`;
- `CLINIC_INTERVIEW_GUIDE.md`.

These documents are useful context but not canonical for current implementation. Several audit docs intentionally describe prior risks or states.

### `.cursor/`

Repository has `.cursor/rules` as a file, not a directory with multiple rule files. It contains project guidance, but some auth details are stale relative to current code.

### Legacy HTML prototypes

`screens` contains `.html` prototypes:

- `screens/02_Auth/auth.html`;
- `screens/03_Main/main.html`;
- `screens/05_Dental_Formula/dental_formula.html`;
- `screens/06_Appointment_Booking/booking.html`;
- `screens/07_My_Appointments/my_appointments.html`;
- `screens/08_Tooth_Card/tooth_card.html`;
- `screens/09_Treatment_Plan/treatment_plan.html`;
- `screens/10_Profile/profile.html`;
- `screens/11_My_Bills/my_bills.html`;
- `screens/12_Prevention/prevention.html`;
- `screens/13_Contacts/contacts.html`.

These are not imported by App Router and should be treated as prototypes/reference artifacts.

---

## 18. Technical Debt Audit

### Known Issues

1. `vercel.json` cron schedule for appointment reminders is daily, while route comments say reminders should run every 15 minutes. This can cause missed 2h/24h windows.

2. `GET /api/appointments` can reach `listAppointments()` with valid Telegram gate but without `actor`; because the route uses service role, this path can expose all appointments unless the service layer rejects actor-less access.

3. `POST /api/auth/lookup-by-phone` has no Telegram gate or actor auth and returns full `dental_employees` / `dental_clients` rows by phone suffix. This is a PII leak endpoint unless it is intentionally limited by deployment controls.

4. `/api/payments/create` uses service role and accepts only `billId` without parsing dental actor/session. A patient could potentially request payment creation for another bill if endpoint is exposed and bill id is known.

5. `/api/send-tg-notification` sends arbitrary Telegram messages by `telegram_id` and `message` without actor/session auth. If public, it should be protected or removed.

6. `/api/appointments/notify` accepts `{ event, appointment_id }` without actor/session auth and can trigger Telegram messages for any known appointment id.

7. `POST /api/cache/dental` can be called without actor and then returns broad employee/cache data through service-role code paths.

8. Staff login endpoints authenticate doctors/admins by phone only. Knowing a staff phone can be enough to obtain Supabase tokens unless an external control protects the flow.

9. Booking UI uses hardcoded `DOCTORS_MOCK` and `SERVICES_MOCK`, while admin maintains `doctors` and `services` tables. This creates duplicate source of truth for doctors/services.

10. Doctor schedule filtering uses `session.fullName` and appointment `doctor_name`; this is less reliable than `doctor_id`.

11. Route comment in `app/api/appointments/[id]/route.ts` claims `/cancel` and `/reschedule`, but actual route is `[id]` POST/PATCH.

12. `package.json` uses `next lint`; with Next 15 this may fail because `next lint` has been removed/deprecated.

13. `app/admin/logs/page.tsx` duplicates `app/screens/admin/logs/page.tsx` for the same screen.

14. `.cursor/rules` still describes old "magic admin phone saves isAdmin in localStorage" flow. Current code uses role-specific phone endpoints, Supabase session and PIN.

15. `dental_clients` and `dental_employees` still contain legacy PIN columns even though active PIN is in `profiles`.

16. `all_migrations.sql` overlaps with numbered migrations and contains historical policy comments; applying both blindly can create confusion.

17. Some API routes return `{ error }` plain JSON while newer routes return `{ ok, data }`. Client error handling is not uniform.

18. Active code still includes localStorage fallbacks/migrations for bills/treatment plan/profile/teeth. They are useful for migration but keep old complexity alive.

19. `screens/Admin/Feed/page.tsx` appears to be hardcoded/prototype feed, not connected to real data.

20. `tinkoff` and `sberbank` are declared payment providers but intentionally throw "not connected".

### Legacy Code

- `/api/dental-db` and `lib/server/dentalDbGateway.ts`: deprecated gateway.
- `lib/api/fetchApi.ts` `dentalGw()`: deprecated client gateway wrapper.
- `lib/dentalGwClient.ts`: deprecated alias.
- `dental_messages`: legacy table.
- `.html` files in `screens/**`: static prototypes.
- `screens/Untitled`: artifact file.
- legacy localStorage keys in `lib/auth.ts`: `currentUserId`, `isLoggedIn`, `isAdmin`, old dental session keys.
- legacy localStorage migrations in `lib/bills.ts` and `lib/treatmentPlan.ts`.
- legacy chat support for doctor sender id as phone.
- legacy PIN columns in domain tables.
- `lib/supabase/adminService.ts`, `components/admin/DownloadLogsButton.tsx`, `components/shared/useActiveTab.ts`, `components/shared/types.ts`: found as unused/dead frontend-side modules during audit.
- `types/index.ts` contains domain types that drift from active runtime types in `lib/*`, for example appointment statuses/shapes.

### Risks

1. Service-role API architecture means application-layer actor checks must be correct everywhere. RLS does not protect service-role routes.

2. The route guard is client-only (`PatientAppGate`); there is no `middleware.ts`. UI redirects protect normal browser flow, but server routes and direct requests must enforce their own authorization.

3. Telegram gate can be bypassed in non-production when `DENTAL_GATE_DEV_ALLOW=1`. This is useful for dev but dangerous if misconfigured.

4. Platform admin can be granted by env email/phone allowlists. Operationally convenient, but needs careful env management.

5. `TELEGRAM_WEBHOOK_SECRET` and `ACQUIRING_WEBHOOK_SECRET` are optional in code. If unset in production, webhook authenticity depends on provider/runtime assumptions instead of a hard shared secret check.

6. Multi-tenant migration adds `clinic_id`, but some older flows still rely on defaults/hardcoded data. Tenant isolation should be tested end-to-end before selling as full SaaS.

7. Payment creation, phone lookup, appointment notify, appointment list without actor, cache refresh without actor and arbitrary Telegram notification endpoints are the highest-priority security review targets.

8. Doctor/appointment linkage by name in parts of UI can break with duplicate names or renamed employees.

9. Mixed id types (`text`, `uuid`, `bigint`) and legacy `text` ids increase conversion bugs.

10. `dental_clients.id` is `text` in base migration, but several later tables reference it as `uuid`. Current SQL comments acknowledge compatibility assumptions. This should be validated against the actual Supabase DB before fresh deployment.

11. Realtime tables include legacy `dental_messages`; unnecessary realtime exposure can increase noise and policy complexity.

12. AI endpoint depends on role/action checks and prompt context. It should be rate-limited and audited if exposed in production.

### TODO Candidates

1. Replace booking hardcoded doctors/services with `doctors` and `services` tables.

2. Make `appointments.doctor_id` the primary UI linkage for doctor cabinet and analytics instead of doctor name matching.

3. Protect `/api/payments/create` with dental actor/session and bill ownership checks.

4. Protect `/api/send-tg-notification` or remove it in favor of internal notification services only.

5. Require actor/session checks for `/api/auth/lookup-by-phone`, `/api/appointments/notify`, `/api/cache/dental`, and actor-less `/api/appointments` reads.

6. Add OTP/TMA confirmation or another second factor for staff phone login.

7. Align appointment reminder cron schedule with implementation intent.

8. Remove or archive HTML prototypes and `screens/Untitled`.

9. Split or delete stale docs/rules that contradict current auth flow.

10. Standardize all API responses to `withApiHandler` / `{ ok, data }`.

11. Replace `next lint` script with current ESLint command for Next 15.

12. Decide whether `all_migrations.sql` is canonical or archival; document/apply only one migration path.

13. Remove legacy PIN columns after confirming no production dependency.

14. Reduce direct localStorage business fallbacks after migration windows expire.

15. Add tests around access control for service-role endpoints.

16. Add route/API smoke tests to validate every App Router page and API method.

17. Add DB schema validation for fresh Supabase deployment from migrations.

---

## 19. Final Validation Checklist

Performed against current repository files:

- Routes verified from `app/**/*/page.tsx`.
- API endpoints verified from `app/api/**/route.ts`.
- Database tables verified from `supabase/migrations/*.sql`.
- Environment variables verified by searching active code for `process.env.*`.
- Roles verified in active TypeScript code: `client`, `doctor`, `admin`; platform admin is separate.
- Used features traced to active files where present.
- Old `PROJECT_OVERVIEW.md` was not trusted as source of truth; only current code and SQL were used for this regeneration.

