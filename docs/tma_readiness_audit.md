# Технический аудит готовности к Telegram Mini App

**Проект:** Стоматология · Next.js 15 (App Router) · Vercel  
**Дата:** 2026-05-20  
**Объект:** продакшен-приложение (`app/`, `screens/`, `components/`) + legacy `tma/index.html`  
**Метод:** статический анализ репозитория (без прогона в Telegram WebView на устройствах)

---

## Резюме

| Область | Статус | Комментарий |
|--------|--------|-------------|
| Viewport / anti-zoom | **Частично** | Next `viewport` настроен корректно; legacy HTML и `tma/index.html` — нет |
| `manifest.json` | **Минимально** | Есть базовые поля, нет `icons` / `screenshots` |
| Safe areas | **Частично** | Много экранов с `env(safe-area-inset-*)`; дыры на Auth/Registration и Admin Feed |
| Telegram WebApp API | **Слабо** | Нет SDK в layout, нет централизованной инициализации, нет синхронизации темы TG |
| Блокирующие диалоги | **Критично** | 9× `alert`, 3× `confirm` в продакшен-экранах |
| **Итоговая готовность** | **~55%** | Запуск возможен, «100% нативный» опыт — после доработок из раздела 6 |

---

## 1. Manifest и viewport (отключение зума)

### 1.1 Что уже хорошо

**Next.js root layout** — viewport через `export const viewport` (рекомендуемый способ App Router):

```33:39:app/layout.tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
```

- `maximumScale: 1` + `userScalable: false` — pinch-zoom отключён (требование TMA).
- `viewportFit: "cover"` — включает `env(safe-area-inset-*)` на iOS.

**`public/manifest.json`** подключён в metadata:

```22:26:app/layout.tsx
export const metadata: Metadata = {
  title: "Стоматологическая клиника",
  description: "Личный кабинет пациента",
  manifest: "/manifest.json",
```

Содержимое manifest — валидный минимум для PWA-подобного поведения:

```1:12:public/manifest.json
{
  "name": "Стоматология",
  "short_name": "Стоматология",
  "description": "Личный кабинет пациента стоматологической клиники",
  "lang": "ru",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#F8FAFB",
  "theme_color": "#248bcf"
}
```

### 1.2 Пробелы

| # | Проблема | Где | Риск в TMA |
|---|----------|-----|------------|
| M1 | В manifest **нет** `icons` (192/512), `screenshots`, `id` | `public/manifest.json` | BotFather / «Добавить на экран» / splash — без иконок хуже превью; не блокер открытия в Mini App |
| M2 | Legacy **`tma/index.html`**: viewport без `maximum-scale=1, user-scalable=no` | `tma/index.html:5` | Если URL когда-либо отдаёт этот файл — зум жестами возможен |
| M3 | Прототипы **`screens/**/*.html`**: `width=device-width, initial-scale=1.0` без anti-zoom | например `screens/03_Main/main.html` | Не в продакшен-роутинге Next; игнорировать или синхронизировать при реюзе |
| M4 | Нет `<meta name="theme-color">` в дополнение к manifest (опционально для Android Chrome) | `app/layout.tsx` | В TG WebView вторично; `theme_color` в manifest уже есть |

### 1.3 Рекомендации

1. Добавить в `manifest.json` массив `icons` (минимум 192×192 и 512×512 PNG в `public/`).
2. Если `tma/index.html` ещё деплоится — выровнять viewport с `app/layout.tsx`.
3. Для единообразия: `theme_color` / `background_color` синхронизировать с фактическим `--color-surface` / `--color-app-canvas`.

---

## 2. Safe areas (`env(safe-area-inset-*)`)

### 2.1 Что уже хорошо

- **Глобальные утилиты** в `app/globals.css`: `.pb-safe`, `.pb-page-end` учитывают `safe-area-inset-bottom`.
- **Нижний tabbar**: `BottomBar.tsx`, `AdminBottomBar.tsx` — `pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]`.
- **Toast**: `components/ui/Toast.tsx` — `bottom-[calc(72px+env(safe-area-inset-bottom,...))]`.
- **Многие экраны** с верхним отступом: `pt-[calc(env(safe-area-inset-top,0px)+3rem)]` (кабинет врача, админка, чат, главная и др.).
- **Sticky header**: `components/layout/Header.tsx` — `pt-[max(12px,env(safe-area-inset-top,0px))]`.

### 2.2 Пробелы

| # | Экран / компонент | Проблема |
|---|-------------------|----------|
| S1 | `screens/02_Auth/page.tsx`, `screens/02_Registration/page.tsx` | `min-h-dvh` + `justify-center`, **нет** `padding-top` с `safe-area-inset-top` — логотип/поля могут уехать под статус-бар / вырез |
| S2 | `screens/Admin/Feed/page.tsx` | Фиксированный `pt-12` **без** `env(safe-area-inset-top)` |
| S3 | Единый слой | Нет компонента-обёртки `TopSafeInset` / CSS-переменной `--app-top-inset` — копипаста `calc(...+3rem)` расходится между экранами |
| S4 | `app/globals.css` `body { max-width: 390px; margin: 0 auto }` | На широких WebView возможны боковые полосы; safe-area по бокам на landscape редко, но поведение не «full bleed» как у нативных TMA |

### 2.3 Рекомендации

1. Ввести утилиту или компонент:

   ```tsx
   // пример: components/layout/TopSafeInset.tsx
   className="pt-[max(12px,env(safe-area-inset-top,0px))]"
   ```

2. Auth / Registration: `pt-[max(1rem,env(safe-area-inset-top))]` на `<main>` + сохранить центрирование через `min-h-dvh` и flex.
3. Admin Feed: заменить `pt-12` на `pt-[calc(env(safe-area-inset-top,0px)+3rem)]` как на Dashboard.
4. Аудит оставшихся `pt-12` / `pt-6` без `safe-area` — `rg "pt-12|pt-6" screens --glob "*.tsx"`.

---

## 3. Telegram WebApp API

### 3.1 Текущее состояние

| Возможность | Реализация |
|-------------|------------|
| Чтение `user.id` | `lib/telegramWebApp.ts` → `getTelegramUserId()` |
| Haptic | `lib/telegramHaptic.ts`; вызовы только в `Admin/Doctors`, `Admin/Price` |
| Верификация `initData` на сервере | `lib/server/telegramWebAppVerify.ts`, `dentalGateVerify.ts` — **шлюз не подключён к `app/api/`** |
| SDK script | **Только** в `tma/index.html`, **не** в `app/layout.tsx` |
| `WebApp.ready()` / `expand()` | **Только** в `tma/index.html` |
| `initData` на клиенте | Функция `getTelegramInitData()` **упоминается в docs**, в коде **отсутствует** |
| Тема TG (`themeParams`, `--tg-theme-*`) | **Не используется** |
| `colorScheme` / `themeChanged` | **Не слушается**; тема только `localStorage` (`ThemeProvider`) |
| BackButton / MainButton | **Не используется** |
| `disableVerticalSwipes` / scroll | **Не настроено**; частично `overscroll-contain` в чатах |
| `setHeaderColor` / `setBackgroundColor` | **Не вызывается** |
| `viewportStableHeight` / `isExpanded` | **Не обрабатывается** |

**Legacy `tma/index.html`** (не основной Next-бандл):

```533:538:tma/index.html
const tg = window.Telegram?.WebApp;

(async function init() {
  tg?.ready();
  tg?.expand();
```

### 3.2 Критический разрыв: нет инициализации в Next.js

Продакшен-приложение **не подключает** `https://telegram.org/js/telegram-web-app.js` и **не вызывает** `ready()` / `expand()` при старте. В части клиентов `window.Telegram` может появиться без скрипта, но это **ненадёжно**; без `ready()` возможна задержка/мигание UI и некорректная высота viewport.

`ThemeProvider` управляет только `localStorage` и классом `.dark` — **не синхронизируется** с `Telegram.WebApp.colorScheme` и событием `themeChanged`. Пользователь с тёмной темой Telegram может получить светлый UI приложения (и наоборот).

### 3.3 Рекомендуемая архитектура (целевое состояние)

1. **`components/TelegramWebAppProvider.tsx`** (client), в `app/layout.tsx` внутри `<body>`:

   ```tsx
   useEffect(() => {
     const tg = window.Telegram?.WebApp;
     if (!tg) return;
     tg.ready();
     tg.expand();
     tg.disableVerticalSwipes?.(); // Bot API 7.7+, iOS — меньше конфликта со свайпом «закрыть»
     // sync theme
     applyTelegramTheme(tg.themeParams, tg.colorScheme);
     tg.onEvent?.("themeChanged", () => applyTelegramTheme(tg.themeParams, tg.colorScheme));
     tg.onEvent?.("viewportChanged", () => { /* reflow fixed footers if needed */ });
   }, []);
   ```

2. **Скрипт SDK** — `next/script` с `strategy="beforeInteractive"` в layout **или** пакет `@twa-dev/sdk` (типы + обёртка).

3. **`lib/telegramWebApp.ts`** — расширить:
   - `getTelegramInitData(): string | null` (для будущего `POST /api/dental-db`);
   - `isTelegramMiniApp(): boolean`;
   - `useTelegramBackButton(onBack)` для вложенных экранов (booking, medical sheet).

4. **CSS переменные Telegram** в `globals.css`:

   ```css
   :root {
     --tg-bg: var(--tg-theme-bg-color, #f8fafc);
     --tg-text: var(--tg-theme-text-color, #0f172a);
     --tg-hint: var(--tg-theme-hint-color, #9ab0c5);
     --tg-button: var(--tg-theme-button-color, #248bcf);
     --tg-button-text: var(--tg-theme-button-text-color, #ffffff);
   }
   ```

   Постепенно маппить `bg-surface` / `text-*` на эти токены **или** при `isTelegramMiniApp()` не давать ручному переключателю темы перебивать TG (режим «следовать Telegram» по умолчанию).

5. **`tg.setBackgroundColor` / `tg.setHeaderColor`** — выставлять из `--color-surface` / `--color-app-canvas` при смене темы, чтобы не было белой полосы под WebView.

6. **Скролл:** на full-height экранах (`SupportChat`, `StaffMessages`) уже есть `overscroll-contain`; добавить на `html, body` в TMA:

   ```css
   html.telegram-mini-app,
   html.telegram-mini-app body {
     overscroll-behavior: none;
     height: 100%;
   }
   ```

   (класс вешать из провайдера при наличии `Telegram.WebApp`).

7. **Подключить API gateway** с `telegramInitData` — иначе `getTelegramUserId()` / привязка `telegram_id` остаются клиентскими без криптографической привязки сессии (см. `docs/qa_security_audit.md`).

---

## 4. Блокирующие системные окна (`alert` / `confirm` / `prompt`)

В WebView Telegram `alert` / `confirm` часто выглядят чужеродно, блокируют поток, не поддерживают брендинг и на части сборок ведут себя нестабильно. **`prompt` в коде не найден** — хорошо.

### 4.1 Инвентарь

| Тип | Файл | Контекст |
|-----|------|----------|
| `alert` | `screens/02_Auth/page.tsx:178` | Ошибка сессии |
| `alert` | `screens/02_Registration/page.tsx:118` | Ошибка БД |
| `alert` | `screens/06_Appointment_Booking/page.tsx:549, 616` | Валидация / ошибка записи |
| `alert` | `screens/SupportChat/page.tsx:103` | Ошибка отправки |
| `alert` | `screens/StaffMessages/page.tsx:189` | Ошибка отправки |
| `alert` | `screens/10_Profile/page.tsx:254` | Ошибка профиля |
| `alert` | `screens/Doctor/Cabinet/page.tsx:220, 252` | Ошибки кабинета |
| `confirm` | `screens/Doctor/Cabinet/page.tsx:239` | Отмена приёма |
| `confirm` | `screens/Admin/Price/page.tsx:120, 135` | Удаление услуг |

**Итого:** 9 `alert`, 3 `confirm`, 0 `prompt`.

### 4.2 Замена (паттерн проекта)

- **Ошибки / успех:** существующий `Toast` (`components/ui/Toast.tsx`) с `tone="error"` / `tone="success"`.
- **Подтверждение:** bottom sheet / modal с двумя кнопками (как на booking) **или** `Telegram.WebApp.showConfirm(message, callback)` / `showPopup` (Bot API 6.2+).
- **Деструктивные действия:** `showConfirm` + haptic `notificationOccurred('warning')` перед удалением.

---

## 5. Прочие TMA-замечания

| # | Тема | Деталь |
|---|------|--------|
| T1 | Haptic не везде | Только админские Doctors/Price; пациентские CTA (запись, отправка чата) без отклика |
| T2 | `touch-action: manipulation` | В коде **не применён** (есть только в UI-аудите как рекомендация) — уменьшает double-tap zoom на старых WebView |
| T3 | Дублирование стека | `tma/index.html` (vanilla + localStorage) параллельно Next — риск путаницы при деплое; зафиксировать один entry point в BotFather |
| T4 | `appleWebApp` в metadata | Для TMA избыточно, не вредит |
| T5 | Тестовый чеклист перед релизом | iOS + Android, светлая/тёмная тема TG, iPhone с home indicator, Android gesture nav, клавиатура в чатах, поворот (если разрешён — сейчас `portrait-primary`) |

---

## 6. Backlog улучшений для «100% нативного» опыта

Приоритет: **P0** — блокеры UX/интеграции; **P1** — сильно влияет на ощущение «своего» приложения; **P2** — полировка.

### P0 — перед публичным запуском в Telegram

| ID | Задача | Оценка |
|----|--------|--------|
| P0-1 | Подключить `telegram-web-app.js` + `TelegramWebAppProvider` с `ready()`, `expand()` | S |
| P0-2 | Заменить все `alert` / `confirm` на Toast + confirm UI / `WebApp.showConfirm` | M |
| P0-3 | Safe-area на Auth, Registration, Admin Feed | S |
| P0-4 | Реализовать `getTelegramInitData()` и подключить серверный gateway (безопасность) | L |

### P1 — нативность UI и темы

| ID | Задача | Оценка |
|----|--------|--------|
| P1-1 | Синхронизация темы: `themeParams` + `themeChanged` + `setBackgroundColor` / `setHeaderColor` | M |
| P1-2 | CSS-переменные `--tg-theme-*` как fallback к дизайн-токенам | M |
| P1-3 | `disableVerticalSwipes` + `overscroll-behavior: none` на root в TMA | S |
| P1-4 | `icons` в `manifest.json` | S |
| P1-5 | BackButton на вложенных flow (booking, medical sheet, registration) | M |

### P2 — полировка

| ID | Задача | Оценка |
|----|--------|--------|
| P2-1 | Haptic на ключевых действиях пациента (запись, чат, табbar) | S |
| P2-2 | `touch-action: manipulation` на интерактивных элементах | S |
| P2-3 | Компонент `TopSafeInset` + единая `--app-top-inset` | S |
| P2-4 | `viewportChanged` — пересчёт fixed bottom sheets | S |
| P2-5 | Удалить или заархивировать `tma/index.html` после миграции | S |
| P2-6 | MainButton для primary CTA (опционально: «Записаться», «Отправить») | M |

---

## 7. Чеклист приёмки в Telegram

- [ ] Открытие из бота: нет белой вспышки, `ready()` вызван до первого paint (или anti-FOUC скрипт согласован с TG theme).
- [ ] Pinch-zoom не работает на всех экранах.
- [ ] Верхний контент не под вырезом (iPhone 14+), низ не под home indicator.
- [ ] Тёмная тема Telegram ↔ UI без рассинхрона фона WebView.
- [ ] Свайп вниз не закрывает Mini App при скролле списка (после `disableVerticalSwipes` где доступно).
- [ ] Ошибки сети — только Toast / inline, без системных alert.
- [ ] Отмена приёма / удаление прайса — нативный confirm, не `window.confirm`.
- [ ] Haptic на успешной записи и отправке сообщения (опционально P2).
- [ ] `initData` проверяется на сервере для чувствительных операций.

---

## 8. Связанные документы

- `docs/ui_ux_audit.md` — safe areas, Toast, hit-area (частично закрыто с прошлого аудита).
- `docs/qa_security_audit.md` — `initData`, gateway, dev-байпас Telegram.
- `.cursor/rules` — продуктовые требования к Toast и ролям.

---

*Аудит статический. Финальную оценку готовности дайте после прогона чеклиста §7 на реальных iOS/Android в Telegram 10+.*
