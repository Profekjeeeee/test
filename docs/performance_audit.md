# Аудит архитектуры и производительности · React / Next.js

**Дата:** 20.05.2026  
**Стек:** Next.js 15 (App Router), React 19, Supabase JS, Recharts, Vercel / Telegram Mini App  
**Метод:** статический разбор `lib/`, `screens/`, `components/`, `hooks/`, `app/`.

---

## Резюме

| Область | Оценка | Комментарий |
|---------|--------|-------------|
| Утечки памяти (Realtime / таймеры) | ⚠️ 7/10 | Отписки в чатах **в целом есть**; риски — гонки async-эффектов, фиксированное имя канала врачебного чата, `setTimeout` без cleanup на главной |
| Лишние ререндеры | ⚠️ 6/10 | Зубная формула и Recharts-дашборд без стабилизации колбэков/мемоизации тяжёлых дочерних узлов |
| Кэш и async | ⚠️ 5/10 | Модульные in-memory кэши без dedupe/TTL; полные `SELECT *` при каждой инвалидации |

**Главный технический долг:** чат и справочники живут в **глобальных переменных модуля** + **дублирующие Realtime-подписки** на каждом экране вместо одного провайдера на сессию.

**Главный плюс:** паттерн `cancelled` + `unsub?.()` в `screens/SupportChat/page.tsx` и `screens/StaffMessages/page.tsx`; уникальные имена каналов в `subscribeDentalMessagesRealtime`.

---

## 1. Архитектура данных (контекст)

```
┌─────────────────────────────────────────────────────────────┐
│  PatientAppGate (mount)                                     │
│    refreshDentalCaches()  → clientsCache, employeesCache    │
│    refreshAppointmentsCache() → clinicCache                   │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────────────────┐
│ supportChat.ts   │          │ appointments.ts              │
│ messagesCache    │          │ clinicCache                  │
│ + Realtime ×N    │          │ window: appointmentsUpdated  │
└──────────────────┘          └──────────────────────────────┘
```

- **Нет** React Query / SWR / серверных Route Handlers для чтения — всё с клиента через `@/lib/supabaseClient`.
- Инвалидация: `window.dispatchEvent` (`CHAT_UPDATED_EVENT`, `appointmentsUpdated`, …).
- Зубная формула пациента: только `localStorage` (`lib/teeth.ts`); у врача — Supabase через `lib/patientTeeth.ts`.

**Рекомендация (архитектура):** вынести `ChatRealtimeProvider` + `DentalDataProvider` на уровень layout роли (client / admin / doctor) с ref-count подписок.

---

## 2. Утечки памяти и Realtime

### 2.1 Пациентский / staff чат (`chat_messages`) — в целом корректно

| Файл | Подписка | Cleanup |
|------|----------|---------|
| `lib/supportChat.ts` | `subscribeDentalMessagesRealtime` → `removeChannel` | ✅ возвращает `() => void` |
| `screens/SupportChat/page.tsx` | async effect + `cancelled` | ✅ `unsub?.()` в return |
| `screens/StaffMessages/page.tsx` | то же для списка диалогов | ✅ |
| `screens/StaffMessages/page.tsx` | `CHAT_UPDATED_EVENT` на audit / thread | ✅ `removeEventListener` |

Пример корректного lifecycle (уже в проекте):

```tsx
useEffect(() => {
  let cancelled = false;
  let unsub: (() => void) | undefined;

  void (async () => {
    await hydrateDentalMessages();
    if (cancelled) return;
    refresh();
    if (cancelled) return;
    unsub = subscribeDentalMessagesRealtime(refresh);
    if (cancelled) {
      unsub();
    }
  })();

  return () => {
    cancelled = true;
    unsub?.();
  };
}, [refresh]);
```

### 2.2 Проблема: `setState` после unmount (гонка async)

**Файлы:** `screens/SupportChat/page.tsx`, `screens/StaffMessages/page.tsx`, `lib/supportChat.ts`

Цепочка: Realtime `UPDATE` → `hydrateDentalMessages()` (сеть) → `onReloaded()` → `setMessages` / `setPreviews`. Если пользователь ушёл со страницы **до** завершения `hydrate`, колбэк всё ещё может вызвать `refresh()` (а отписка канала уже прошла).

**Рефакторинг:** передавать `AbortSignal` в `hydrateDentalMessages` или проверять `cancelled` внутри `refresh`:

```ts
// lib/supportChat.ts — опционально
export async function hydrateDentalMessages(signal?: AbortSignal): Promise<void> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .abortSignal(signal); // supabase-js v2
  if (signal?.aborted) return;
  // ...
}
```

```tsx
const refresh = useCallback(() => {
  if (cancelledRef.current) return;
  setMessages(getPatientBranchMessages(tab));
}, [tab]);
```

### 2.3 Врачебный внутренний чат — фиксированное имя канала

**Файл:** `lib/doctorOrdinatorskayaChat.ts` (константа `GLOBAL_CHANNEL = "doctor_messages_global_inserts_v1"`)

В отличие от `subscribeDentalMessagesRealtime`, здесь **одно имя канала на все инстансы**. При быстром remount (Strict Mode, смена вкладки кабинета) возможны:

- повторная подписка до `removeChannel`;
- ошибка Supabase *«cannot add postgres_changes callbacks after subscribe»* (уже решали для `chat_messages` через UUID).

**Файл для рефакторинга:** `lib/doctorOrdinatorskayaChat.ts`

```ts
export function subscribeAllDoctorMessageInserts(
  onInsert: (msg: DoctorOrdinatorskayaMessage) => void
): () => void {
  const instanceId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const channel = supabase
    .channel(`doctor_messages_inserts:${instanceId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "doctor_messages" },
      (payload) => { /* ... */ }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
```

`screens/Doctor/Cabinet/DoctorOrdinatorskayaChat.tsx` — cleanup **есть** (`return off`), менять UI не обязательно.

### 2.4 Дублирование Realtime при нескольких экранах

Если в одной сессии открыты **и** `StaffMessages`, **и** другой потребитель `subscribeDentalMessagesRealtime`, будет **2+ WebSocket-канала** и **2+ полных `hydrateDentalMessages()`** на каждый `UPDATE`.

**Файлы:** `lib/supportChat.ts`, все экраны чата.

**Рефакторинг:** singleton в модуле:

```ts
let sharedUnsub: (() => void) | null = null;
let subscriberCount = 0;
const listeners = new Set<() => void>();

export function acquireDentalMessagesRealtime(onReloaded: () => void): () => void {
  listeners.add(onReloaded);
  subscriberCount++;
  if (!sharedUnsub) {
    sharedUnsub = subscribeDentalMessagesRealtime(() => {
      listeners.forEach((fn) => fn());
    });
  }
  return () => {
    listeners.delete(onReloaded);
    if (--subscriberCount === 0) {
      sharedUnsub?.();
      sharedUnsub = null;
    }
  };
}
```

### 2.5 Таймер на главной без cleanup вложенного `setTimeout`

**Файл:** `screens/03_Main/page.tsx` (~стр. 95–101)

`setInterval` очищается, но внутренний `setTimeout(..., 350)` при unmount во время анимации совета — **нет** `clearTimeout` → возможен `setState` на размонтированном компоненте.

```tsx
useEffect(() => {
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const tipInterval = setInterval(() => {
    setTipVisible(false);
    const t = setTimeout(() => {
      setTipIndex((i) => (i + 1) % DAILY_TIPS.length);
      setTipVisible(true);
    }, 350);
    timeouts.push(t);
  }, 30000);

  return () => {
    clearInterval(tipInterval);
    timeouts.forEach(clearTimeout);
  };
}, []);
```

### 2.6 Полная перезагрузка кэша после каждой отправки

**Файл:** `lib/supportChat.ts` — `appendChatMessage` вызывает `await hydrateDentalMessages()` после insert, хотя Realtime INSERT уже обновляет `messagesCache`.

**Эффект:** лишний round-trip + риск гонки с колбэком Realtime.

**Рефакторинг:** обновлять `messagesCache` из `.select().single()` без full hydrate; full hydrate — только в Realtime fallback.

---

## 3. Лишние ререндеры

### 3.1 Зубная формула (пациент)

| Файл | Проблема |
|------|----------|
| `screens/05_Dental_Formula/page.tsx` | `handleToothClick` не в `useCallback`; `stats` пересчитывается каждый render; `rightSlot={<HeaderActions onInfoClick={() => setShowInfo(true)} />}` — новая функция |
| `components/dental/PatientToothFormula.tsx` | `renderJaw` / `getCondition` создаются заново; 32× `FormulaToothIcon` без `memo` |

**Оптимизированный фрагмент страницы:**

```tsx
// screens/05_Dental_Formula/page.tsx
const handleToothClick = useCallback(
  (num: number) => {
    setSelected(num);
    router.push(`/tooth/${num}`);
  },
  [router]
);

const stats = useMemo(() => {
  const palette = getFormulaConditionPalette(darkPalette);
  return (["healthy", "treated", "caries", "pulpitis", "removed"] as ToothCondition[]).map(
    (cond) => ({
      cond,
      count: teeth.filter((t) => t.condition === cond).length,
      cfg: palette[cond],
    })
  );
}, [teeth, darkPalette]);

const openInfo = useCallback(() => setShowInfo(true), []);
// ...
<Header rightSlot={<HeaderActions onInfoClick={openInfo} />} />
```

**Оптимизация ячейки зуба:**

```tsx
// components/dental/PatientToothFormula.tsx
const ToothCell = memo(function ToothCell({
  num,
  condition,
  isSelected,
  hasNote,
  isLower,
  darkPalette,
  onToothClick,
}: { /* ... */ }) {
  // один зуб
});

// в renderJaw:
<ToothCell
  key={num}
  num={num}
  condition={getCondition(num)}
  onToothClick={onToothClick}
  // ...
/>
```

**Файл врача (тяжелее):** `screens/Doctor/Cabinet/PatientMedicalSheet.tsx` — смена одного зуба делает `setFormulaTeeth` на весь массив → перерисовка всех 32 SVG. Имеет смысл патчить по индексу и мемоизировать `PatientToothFormula` с `React.memo` + стабильный `onToothClick`.

### 3.2 Дашборд аналитики (админ)

| Файл | Проблема |
|------|----------|
| `screens/Admin/Dashboard/page.tsx` | Recharts в основном бандле; inline `formatter` / `labelFormatter` на каждом render |
| `screens/Admin/Dashboard/page.tsx` | Два `ResponsiveContainer` + тяжёлые графики при любом `setStats` |
| `lib/admin/dashboard.ts` | Нет кэша — каждый mount = 2 запроса Supabase |

**Динамический импорт графиков:**

```tsx
import dynamic from "next/dynamic";

const RevenueChart = dynamic(
  () => import("@/components/admin/RevenueBarChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
```

**Стабильные пропсы Recharts:**

```tsx
const revenueTooltipFormatter = useCallback(
  (v: number) => [`${formatRub(v)} ₽`, "Выручка"],
  []
);

const chartData = useMemo(() => chart, [chart]);
// <BarChart data={chartData}> ...
```

**Кэш дашборда (модуль или SWR):**

```ts
// lib/admin/dashboard.ts
let dashboardCache: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
let dashboardCacheAt = 0;
const TTL_MS = 60_000;

export async function getDashboardStatsCached(): Promise</* ... */> {
  if (dashboardCache && Date.now() - dashboardCacheAt < TTL_MS) {
    return dashboardCache;
  }
  const res = await getDashboardStats();
  dashboardCache = res;
  dashboardCacheAt = Date.now();
  return res;
}
```

### 3.3 Staff Messages — список без виртуализации

**Файл:** `screens/StaffMessages/page.tsx` — `previews.map` / `thread.map` рендерят все DOM-узлы. При сотнях диалогов — лаг скролла. Для TMA обычно достаточно пагинации или `react-window` (опционально).

`handleSendStaff` — обернуть в `useCallback` с зависимостями `[selected, draft, mode, session, thread]`, чтобы не плодить лишние замыкания в `onKeyDown`.

---

## 4. Асинхронные запросы и кэширование БД

### 4.1 Таблица «тяжёлых» запросов

| Операция | Файл | Запрос | Проблема |
|----------|------|--------|----------|
| Гидратация чата | `lib/supportChat.ts` | `chat_messages` `select *` | Вся таблица в RAM на каждый UPDATE fallback |
| Справочники | `lib/auth.ts` `refreshDentalCaches` | `dental_clients`, `dental_employees` `select *` | Без лимита; при каждом gate mount |
| Записи | `lib/appointments.ts` | `appointments` `select *` | Вся клиника в `clinicCache` |
| Дашборд | `lib/admin/dashboard.ts` | appointments за месяц + doctors | Нет кэша/TTL |
| Отправка сообщения | `lib/supportChat.ts` `appendChatMessage` | insert + **full hydrate** | Дублирование с Realtime |

### 4.2 Нет dedupe параллельных запросов

**Сценарий:** `PatientAppGate` и `screens/SupportChat/page.tsx` одновременно вызывают `refreshDentalCaches()` / `hydrateDentalMessages()`.

**Рефакторинг (паттерн in-flight promise):**

```ts
let hydratePromise: Promise<void> | null = null;

export function hydrateDentalMessages(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, sender_id, recipient_id, text, chat_type, sender_role, sender_name, created_at")
          .order("created_at", { ascending: true });
        if (!error) messagesCache = (data ?? []).map(dbRowToChatMessage);
      } finally {
        hydratePromise = null;
      }
    })();
  }
  return hydratePromise;
}
```

Указать **явный список колонок** вместо `*` — меньше payload.

### 4.3 Фильтрация в памяти O(N×M)

**Файл:** `lib/supportChat.ts` — `getStaffDialogPreviews` / `getDoctorDialogPreviews` для **каждого** клиента вызывают `getStaffBranchMessages` (полный scan `messagesCache`).

**Файлы для рефакторинга:** `lib/supportChat.ts`

Индекс при гидратации:

```ts
type MessagesIndex = {
  byPatientClinic: Map<string, ChatMessage[]>;
  // ...
};

function rebuildIndex(cache: ChatMessage[]): MessagesIndex {
  // один проход O(N)
}
```

### 4.4 Зубная формула vs Supabase

| Роль | Источник | Файл |
|------|----------|------|
| Пациент `/formula` | `localStorage` only | `lib/teeth.ts`, `screens/05_Dental_Formula/page.tsx` |
| Врач | Supabase `formula_teeth` | `lib/patientTeeth.ts`, `PatientMedicalSheet.tsx` |

Риск рассинхрона и лишней работы при будущей синхронизации — отдельная задача продукта; для perf: при открытии sheet не вызывать `refreshDentalCaches()` без нужды (сейчас вызывается в нескольких местах кабинета).

### 4.5 `clinicCache === null`

**Файл:** `lib/appointments.ts` — до первого `refreshAppointmentsCache()` `getAppointments()` возвращает `[]`. UI может мигать. Gate уже вызывает refresh — достаточно документировать порядок инициализации или экспортировать `appointmentsReady(): boolean`.

---

## 5. Next.js / бандл (кратко)

| Тема | Файлы | Рекомендация |
|------|-------|--------------|
| Recharts ~200KB+ | `screens/Admin/Dashboard/page.tsx` | `next/dynamic`, вынести в `components/admin/*Chart.tsx` |
| Все страницы `"use client"` | `screens/*`, `app/**/page.tsx` | Для статичных оболочек — Server Components + client islands |
| React Strict Mode | dev | Двойной mount усиливает гонки Realtime — UUID-каналы обязательны |

---

## 6. Приоритетный backlog

| P | Задача | Файлы |
|---|--------|-------|
| P0 | UUID-канал для `doctor_messages` (как в dental chat) | `lib/doctorOrdinatorskayaChat.ts` |
| P0 | Singleton / ref-count для `subscribeDentalMessagesRealtime` | `lib/supportChat.ts` |
| P1 | Убрать full `hydrateDentalMessages` из `appendChatMessage` | `lib/supportChat.ts` |
| P1 | `useCallback` / `useMemo` на странице формулы | `screens/05_Dental_Formula/page.tsx` |
| P1 | `memo` на ячейку зуба | `components/dental/PatientToothFormula.tsx` |
| P2 | In-flight dedupe + узкий `select` | `lib/supportChat.ts`, `lib/auth.ts`, `lib/appointments.ts` |
| P2 | TTL-кэш дашборда + dynamic Recharts | `lib/admin/dashboard.ts`, `screens/Admin/Dashboard/page.tsx` |
| P2 | Индекс сообщений по patientId | `lib/supportChat.ts` |
| P3 | `clearTimeout` для советов на главной | `screens/03_Main/page.tsx` |
| P3 | AbortSignal в hydrate / refresh | чат-экраны, `lib/supportChat.ts` |

---

## 7. Чеклист регрессии после рефакторинга

1. Открыть чат пациента → уйти на главную → в DevTools **нет** растущего числа `channel` в Supabase Realtime.
2. Strict Mode: зайти в staff messages дважды — нет ошибки postgres_changes.
3. Отправка сообщения — UI обновляется **один раз**, без двойной вспышки списка.
4. `/formula` — тап по зубу не вызывает лаг > 1 frame (Performance panel).
5. Админ-дашборд — повторный заход в течение 60 с не дергает Supabase (при включённом TTL).
6. Ординаторская: переключение комнат — сообщения не дублируются, unread корректен.

---

## Связанные документы

- UI/UX: `docs/ui_ux_audit.md`
- Безопасность: `docs/qa_security_audit.md`
- Правила проекта: `.cursor/rules`
