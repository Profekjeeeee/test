# QA / Security Audit — Стоматология Mini App

**Дата:** 2026-05-20  
**Метод:** статический анализ репозитория (`*.ts`, `*.tsx`, `supabase/migrations/*`), без pentest и без снятия DDL с живого Supabase.  
**Оговорки:** см. [QA_AUDIT_CLARIFICATIONS.md](./QA_AUDIT_CLARIFICATIONS.md).

**Переименование:** файлов `qa_audit.md` / `qa_security_audit.md` в `docs/` не было — `qa_audit_old.md` не создавался.

---

## Краткое резюме

| Область | Вердикт |
|--------|---------|
| Supabase RLS (ПДн, записи, чаты) | **Критично:** в репо одновременно есть строгие политики (`011`) и открытые `anon` (`001`, `015`, `016`). Клиент **не** использует Supabase Auth JWT — только `anon` + `localStorage`. |
| Авторизация | **Критично:** вход по демо-кодам `1234` / `123456` без SMS; сессия подделывается через LS; админ — флаг `isAdmin`. |
| Валидация форм | **Средне:** регистрация валидируется; запись к врачу не пишет `doctor_id`, допускает пустого врача; дубликаты телефона при регистрации не блокируются. |
| Архитектура | Реализован `lib/server/dentalDbGateway.ts`, но **нет** `app/api/dental-db/route.ts` — шлюз с service role и проверкой Telegram **не подключён** к UI. |

**Приоритет №1:** единая модель доступа — либо жёсткий RLS + Supabase Auth на клиенте, либо **только** серверный API с `service_role` и проверкой `initData` (шлюз уже написан, но не смонтирован).

---

## Матрица RLS (по миграциям в git)

| Таблица | Миграция | Роль | Политика | Риск при `anon` без JWT |
|---------|----------|------|----------|-------------------------|
| `dental_clients` | `001` → `011` | anon → **только authenticated** | `011`: своя строка / staff | Если на проде остался `001`: **полный read/write всем** |
| `dental_employees` | `001` → `011` | anon read → auth SELECT `true` | Справочник сотрудников для любого `authenticated` | Если `001`: чтение всех сотрудников |
| `appointments` | `001` → `011` | anon → authenticated | По `client_id` / staff | Если `001`: все записи всех пациентов |
| `chat_messages` / `dental_messages` | `002` → `011` | anon → authenticated | Участник / staff rules | Если `001`: весь чат |
| `doctor_rooms` / `doctor_messages` | `008` → `011` | staff only | OK при `011` | Если `001`: внутренний чат врачей |
| `doctors` | `015` | **anon FOR ALL** | `USING (true)` | **Любой с anon key: CRUD каталога врачей** |
| `services` | `015` | **anon FOR ALL** | `USING (true)` | **CRUD прайса** |
| `app_logs` | `016` | **anon FOR ALL** | `USING (true)` | **Чтение/подмена/удаление логов** |

Клиент везде: `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` — ключ из бандла извлекается тривиально.

---

## Findings

### HIGH-01 — Открытый доступ через `anon` (если на БД не применён только `011`)

**Суть:** `001_dental_schema.sql` создаёт политики `*_anon_rw` с `USING (true) WITH CHECK (true)` для клиентов, записей и сообщений.

**Эксплуатация:** скрипт с `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `select * from dental_clients`, `appointments`, `chat_messages`.

**Проверка на проде:**

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('dental_clients','appointments','chat_messages','dental_employees')
ORDER BY tablename, policyname;
```

**Исправление (если ещё висят anon-политики):**

```sql
-- После бэкапа и применения 011 целиком:
DROP POLICY IF EXISTS "dental_clients_anon_rw" ON public.dental_clients;
DROP POLICY IF EXISTS "dental_employees_anon_read" ON public.dental_employees;
DROP POLICY IF EXISTS "appointments_anon_rw" ON public.appointments;
DROP POLICY IF EXISTS "dental_messages_anon_rw" ON public.dental_messages;
DROP POLICY IF EXISTS "chat_messages_anon_rw" ON public.chat_messages;
```

Дальше — только `authenticated` + привязка `auth_user_id` (см. `011_secure_rls_auth.sql`).

---

### HIGH-02 — Клиент не аутентифицируется в Supabase (разрыв с RLS `011`)

**Суть:** по коду нет `supabase.auth.signInWithPassword` / `signUp` / `setSession`. Сессия — `localStorage` (`user_session`, `dental_session`, `currentUserId`). PostgREST видит запросы как роль **`anon`**, не `authenticated`.

**Следствие:**

- При **строгом** `011` прямые вызовы из `lib/auth.ts`, `lib/appointments.ts`, `lib/supportChat.ts` должны получать **RLS violation** — функционал «случайно защищён», но сломан.
- При **legacy** `001` — полный доступ под anon.

**Исправление (вариант A — Supabase Auth на клиенте после входа):**

```typescript
// lib/supabaseSession.ts (новый модуль)
import { supabase } from "@/lib/supabaseClient";

export async function establishSupabaseSessionForProfile(params: {
  email: string;
  password: string;
}): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (error) throw error;
}
```

Связать с `ensureShadowAuthForRow` (логика уже в `dentalDbGateway.ts`) и вызывать после мастер-входа / регистрации. Пароль shadow-пользователя **не** отдавать на клиент — лучше вариант B.

**Исправление (вариант B — рекомендуется):** подключить шлюз (HIGH-03) и **убрать** прямые `supabase.from('dental_clients'|'appointments'|...)` с клиента для ПДн.

---

### HIGH-03 — `dentalDbGateway` не подключён к API

**Суть:** `lib/server/dentalDbGateway.ts` (~1000 строк) проверяет Telegram `initData`, сопоставляет `actor` с БД, использует `service_role`, но в `app/api/` есть только `send-tg-notification`. UI ходит в Supabase напрямую.

**Исправление:**

```typescript
// app/api/dental-db/route.ts
import { NextResponse } from "next/server";
import { dentalDbGateway } from "@/lib/server/dentalDbGateway";
import { DentalGateError } from "@/lib/server/dentalGateVerify";
import type { DentalGatewayRequestBody } from "@/lib/dentalGwTypes";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DentalGatewayRequestBody;
    const data = await dentalDbGateway(body);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof DentalGateError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
```

```typescript
// lib/dentalGwClient.ts (клиент)
import { getTelegramInitData } from "@/lib/telegramWebApp";
import { getDentalSession } from "@/lib/auth";

export async function dentalGw<T>(op: string, payload?: Record<string, unknown>): Promise<T> {
  const session = getDentalSession();
  const res = await fetch("/api/dental-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op,
      payload,
      telegramInitData: getTelegramInitData(),
      actor: session
        ? { id: session.id, role: session.role, phone: session.phone }
        : null,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error ?? "Gateway error");
  return json.data as T;
}
```

Постепенно заменить: `createUser`, `addAppointment`, `appendChatMessage`, `refreshDentalCaches` (для staff/client раздельно).

---

### HIGH-04 — Мастер-коды OTP `1234` / `123456`

**Файл:** `screens/02_Auth/page.tsx`

```30:34:screens/02_Auth/page.tsx
const MASTER_SMS_CODES = new Set(["1234", "123456"]);

function isMasterSmsCode(digits: string): boolean {
  return MASTER_SMS_CODES.has(digits);
}
```

**Суть:** знание номера телефона (или перебор по `ilike` суффиксу) + демо-код = полный вход как клиент/врач/админ без SMS и без Telegram.

**Исправление (prod):**

```typescript
const MASTER_SMS_CODES = new Set(
  process.env.NODE_ENV === "production"
    ? []
    : (process.env.NEXT_PUBLIC_DEMO_OTP_CODES ?? "1234,123456")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
);

function isMasterSmsCode(digits: string): boolean {
  return MASTER_SMS_CODES.size > 0 && MASTER_SMS_CODES.has(digits);
}
```

Долгосрочно: SMS-провайдер или вход **только** через `Telegram.WebApp.initData` + серверный lookup (`authLookupEmployeeClient` в gateway).

---

### HIGH-05 — Подделка сессии и обход админ-роутов

**Суть:**

1. `setDentalSession` пишет произвольный JSON в LS без подписи.
2. `PatientAppGate` для `/admin/*` допускает `localStorage.isAdmin === "true"` **без** `session.role === "admin"`.

```153:158:components/auth/PatientAppGate.tsx
    if (pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
      const adminOk =
        session?.role === "admin" ||
        (typeof window !== "undefined" && localStorage.getItem("isAdmin") === "true");
```

**Исправление:**

```typescript
// PatientAppGate — только роль из проверенной сессии
if (pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
  if (session?.role !== "admin") {
    router.replace(ROUTES.auth);
  }
  return;
}
```

Удалить установку `isAdmin` в `setAdminMode` fallback без строки в `dental_employees`. Сессию после входа подтверждать через gateway + Telegram, не только LS.

---

### HIGH-06 — `doctors` / `services` / `app_logs`: RLS `anon` read/write

**Файлы:** `supabase/migrations/015_admin_doctors_services.sql`, `016_app_logs.sql`

**Суть:** админка и логгер с клиента (`lib/admin/services.ts`, `lib/logger.ts`) — любой владелец anon key может менять прайс, удалять услуги, читать стеки ошибок и PII из `metadata`.

**Исправление (миграция):**

```sql
-- supabase/migrations/018_lock_catalog_and_logs.sql
DROP POLICY IF EXISTS "doctors_anon_rw" ON public.doctors;
DROP POLICY IF EXISTS "services_anon_rw" ON public.services;
DROP POLICY IF EXISTS "app_logs_anon_rw" ON public.app_logs;

CREATE POLICY services_select_authenticated
  ON public.services FOR SELECT TO authenticated
  USING (is_visible = true OR public.is_staff_user());

CREATE POLICY services_write_admin
  ON public.services FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- app_logs: insert authenticated, select admin
CREATE POLICY app_logs_insert_authenticated
  ON public.app_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY app_logs_select_admin
  ON public.app_logs FOR SELECT TO authenticated
  USING (public.is_admin_user());
```

Логи с клиента — через `/api/dental-db` op `appendAppLog` с rate limit, без прямого insert.

---

### HIGH-07 — Массовая выгрузка ПДн при открытом RLS

**Файлы:** `lib/auth.ts` (`refreshDentalCaches`), `lib/appointments.ts` (`refreshAppointmentsCache`)

```253:257:lib/auth.ts
export async function refreshDentalCaches(): Promise<void> {
  const [clientsRes, empRes] = await Promise.all([
    supabase.from("dental_clients").select("*").order("created_at", { ascending: true }),
    supabase.from("dental_employees").select("*").order("name", { ascending: true }),
```

```155:160:lib/appointments.ts
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
```

**Суть:** `select *` по всем клиентам/записям; при открытом RLS — утечка `internal_notes`, `formula_teeth`, телефонов. Фильтрация для пациента только на клиенте (`getAppointments`).

**Исправление:** gateway `refreshDentalCaches` уже разделяет client vs staff; для пациента — только `.eq("id", actor.id)`; для врача — не отдавать `internal_notes` в SELECT (view или column grant).

---

### MEDIUM-01 — Передача телефона между экранами без криптографической привязки

**Цепочка:** `auth_phone` (LS) → `?phone=` на регистрации → `createUser(phoneForDb)` без повторной проверки OTP.

**Риск:** подмена `?phone=` или LS до регистрации → аккаунт на чужой номер (при открытом insert в `dental_clients`).

**Исправление:** регистрация только через gateway `registerClient` с обязательным `telegramInitData` и тем же `cleanPhone`, что прошёл `authLookupEmployeeClient`; отклонять расхождение `payload.phone` vs verified session.

---

### MEDIUM-02 — Дубликаты пациентов при регистрации

**Файл:** `lib/auth.ts` — `createUser` делает `insert` без предварительного `select` по `phone`.

**Исправление:**

```typescript
export async function createUser(phone: string, profile: {...}): Promise<RegisteredUser> {
  const cleanPhone = normalizePhone(phone);
  const existing = await findClientByPhone(cleanPhone);
  if (existing) {
    throw new Error("Пациент с этим номером уже зарегистрирован. Войдите в аккаунт.");
  }
  // ... insert
}
```

В БД: `UNIQUE (phone)` уже есть в `001` — обработать `23505` с понятным UI.

---

### MEDIUM-03 — Отмена/перенос записи без проверки владельца на сервере

**Файл:** `lib/appointments.ts`

```330:347:lib/appointments.ts
export async function cancelAppointment(id: string): Promise<void> {
  const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
```

**Суть:** при открытом RLS можно отменить чужую запись, зная UUID.

**Исправление:** gateway `appointmentCancel` + `assertAppointmentAccessOrThrow` (уже есть в gateway) или RLS `011` + authenticated client pk.

---

### MEDIUM-04 — Чат: подмена `sender_id` при слабом RLS

**Файл:** `lib/supportChat.ts` — `appendChatMessage` передаёт `senderId` из UI.

**Исправление:** на сервере выставлять `sender_id` только из `actor.id` после `loadClient` / `loadEmployee`; клиенту не доверять.

---

### MEDIUM-05 — `internal_notes` уходит в общий `select *`

**Файл:** `lib/auth.ts` — `fetchDentalClientById` → `.select("*")`.

Триггер `dental_clients_protect_internal_notes` защищает только **UPDATE** от клиента, не **SELECT**.

**Исправление:** view `dental_clients_patient_safe` без `internal_notes` для роли client; staff — полная таблица.

---

### MEDIUM-06 — `dental_employees` SELECT `USING (true)` для authenticated

Любой залогиненный в Supabase Auth пользователь видит телефоны всех врачей/админов. Приемлемо для справочника; не приемлемо, если в таблице появятся чувствительные поля.

---

### MEDIUM-07 — Dev-байпас Telegram gate

**Файл:** `lib/server/dentalGateVerify.ts` — `DENTAL_GATE_DEV_ALLOW=1` + `telegramMatchesRowTelegram` → `return true` если `telegram_id` пуст.

**Исправление:** на production жёстко запрещать `dev`; не считать пустой `telegram_id` совпадением в prod (gateway).

---

### LOW-01 — UI раскрывает демо-коды

**Файл:** `screens/02_Auth/page.tsx` — подсказка «Демо: 1234 или 123456».

Убрать в production-сборке.

---

### LOW-02 — Запись к врачу: mock-врачи, нет `doctor_id`

**Файл:** `screens/06_Appointment_Booking/page.tsx` — `DOCTORS_MOCK`, в insert только `doctor_name`.

**Риск:** аналитика и RLS врача по `appointments.doctor_id` не работают; слот не привязан к реальному сотруднику.

**Исправление:**

```typescript
await addAppointment({
  // ...
  doctorId: selectedDoctorId, // d1..d10 → dental_employees.id
  doctorName: selectedDoctor?.name ?? "Врач",
});
```

```typescript
// lib/appointments.ts — в insert добавить doctor_id при наличии
...(apt.doctorId ? { doctor_id: apt.doctorId } : {}),
```

---

### LOW-03 — Валидация OTP отсутствует (кроме демо)

`handleVerify` для не-мастер кодов всегда: «Неверный код» — реального SMS-канала нет.

---

### LOW-04 — `refreshAppointmentsCache` качает все записи

Даже при RLS пациент может получить лишний трафик; при утечке RLS — полный календарь клиники. Фильтровать запрос: `.eq("client_id", session.id)`.

---

## Валидация форм (детально)

### Регистрация (`screens/02_Registration/page.tsx`)

| Поле | Проверка | Замечание |
|------|----------|-----------|
| Телефон | `isCompleteRuMobileDigits`, редирект на auth | OK; источник — LS/query, см. MEDIUM-01 |
| Имя/фамилия | `NAME_RE`, min 2 символа | OK |
| Email | `EMAIL_RE` | OK; нет проверки MX/disposable |
| `id` в insert | Не передаётся | OK (DEFAULT `012`) |
| Дубликат телефона | Нет | MEDIUM-02 |

### Запись на приём (`screens/06_Appointment_Booking/page.tsx`)

| Поле | Проверка | Замечание |
|------|----------|-----------|
| День/время | `if (!selectedDay \|\| !selectedTime) return` | OK на confirm |
| Врач | Не обязателен | LOW-02: «Врач не выбран» уходит в БД |
| `client_id` | `resolveDentalClientPrimaryKeyForInsert` | OK — не подставляет телефон в FK |
| `id` записи | Не передаётся | OK |
| `doctor_id` | Не передаётся | LOW-02 |

---

## Рекомендуемый порядок remediation

1. **Снять снимок политик на проде** (SQL выше) — понять фактическое состояние.
2. **Закрыть `anon` на `doctors`, `services`, `app_logs`** — миграция `018`.
3. **Включить `/api/dental-db`** и перевести auth/register/appointments/chat.
4. **Убрать мастер-коды из production**; вход через Telegram + опционально SMS.
5. **Supabase Auth shadow users** или полный отказ от прямого PostgREST с клиента.
6. **Убрать `isAdmin` из LS**; единый `PatientAppGate`.
7. Регрессия: регистрация, запись, чат, админ-прайс, логи.

---

## Чек-лист ручного QA (после фиксов)

- [ ] С anon key из консоли браузера **нельзя** `select`/`insert` в `dental_clients`, `appointments`, `chat_messages`.
- [ ] С anon key **нельзя** `update`/`delete` в `services`, `doctors`, `app_logs`.
- [ ] Вход с неверным OTP **невозможен** на prod.
- [ ] Подмена `localStorage.user_session` на `role: "admin"` **не** открывает админку.
- [ ] Пациент A **не** видит записи/чаты пациента B (сеть + UI).
- [ ] Регистрация на занятый телефон — понятная ошибка.
- [ ] Запись сохраняет `doctor_id` и отображается у нужного врача.

---

## Связанные файлы

| Область | Файлы |
|---------|--------|
| RLS | `supabase/migrations/001_*.sql`, `011_secure_rls_auth.sql`, `015_*.sql`, `016_app_logs.sql` |
| Auth UI | `screens/02_Auth/page.tsx`, `components/auth/PatientAppGate.tsx` |
| Сессия | `lib/auth.ts` |
| Записи | `lib/appointments.ts`, `screens/06_Appointment_Booking/page.tsx` |
| Чат | `lib/supportChat.ts` |
| Шлюз (не подключён) | `lib/server/dentalDbGateway.ts`, `lib/server/dentalGateVerify.ts` |
| Админка | `lib/admin/services.ts`, `lib/logger.ts` |

---

*Аудит подготовлен как Senior QA / AppSec review по состоянию репозитория. Для юридической оценки обработки ПДн нужен отдельный комплаенс-обзор.*
