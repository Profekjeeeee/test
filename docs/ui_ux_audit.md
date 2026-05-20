# UI/UX-аудит · Telegram Mini App «Стоматология»

**Дата:** 20.05.2026  
**Метод:** статический разбор кодовой базы (Next.js App Router, Tailwind, Supabase), сверка с `.cursor/rules`, ориентиры Apple HIG / Material (touch target ≥ 44×44 CSS px), WCAG 2.1 AA для контраста (качественно).

**Предыдущая версия:** `docs/ui_ux_audit_old.md` (18.05.2026).

---

## Резюме для продукта

| Область | Оценка | Комментарий |
|---------|--------|-------------|
| Эргономика TMA (touch) | ⚠️ 6/10 | Критично: зубная формула и календарь записи клиента; врачебный календарь и sheet — лучше |
| Light / Dark | ⚠️ 7/10 | Токены в `globals.css` зрелые; остаются «дырявые» `text-gray-*` без `dark:` |
| Оверлеи (modal / sheet / toast) | ✅ 8/10 | Паттерн «над таббаром» внедрён; есть рассинхрон z-index и магическое `72px` |
| User Effort по ролям | ⚠️ 7/10 | Клиент: длинная запись; врач: сильный кабинет; админ: компактные CRUD-контролы |

**Главный риск продукта:** на узком холсте (390px) интерактивная **32-зубная сетка** остаётся визуально богатой, но **эргономически на грани** — промахи и соседние тапы особенно у врача при смене статуса зуба.

**Главный плюс:** единая дизайн-система (синий `primary`, `pb-safe`, Toast с `variant`, full-screen sheet врача с крупными статусами зуба).

---

## Методология

- Холст: `body { max-width: 390px }` (`app/globals.css`).
- Нижний отступ контента: `.pb-safe` = pill tabbar (~52px) + зазор + `safe-area-inset-bottom`.
- Toast пациента: `bottom: calc(72px + env(safe-area-inset-bottom))` (`components/ui/Toast.tsx`).
- Bottom sheet «над таббаром»: `bottom: max(1rem, calc(env(safe-area-inset-bottom) + 5.25rem))` — ~84px от низа (5.25rem ≈ 84px).
- Зубная сетка: 16 колонок (8+8), gap 4px, `aspect-ratio: 1/1.4`, псевдо-hit `after:inset-[-3px]`.

### Что улучшилось с прошлого аудита (18.05)

| Было | Стало |
|------|--------|
| Toast `bottom-[88px]` без safe-area, тёмный фон | `variant` + `safe-area` + `bg-primary` / `destructive`, перенос строк |
| Header «Назад» 36×36 | `min-w/h-[44px]` (`components/layout/Header.tsx`) |
| Календарь врача `h-9` | `min-h-[44px]` (`DoctorMonthCalendar.tsx`) |
| Табы записей `h-9` | `min-h-[44px]` (`07_My_Appointments`) |
| CTA главной `h-9` | `h-11` для «Подробнее / Перенести» |
| Прайс «Записаться» `h-7` | `h-11 min-h-[44px]` (`14_PriceList`) |

---

## 1. Эргономика мобильных интерфейсов

### 1.1 Зубная формула (`components/dental/PatientToothFormula.tsx`)

**Контексты:** пациент (`/formula`, карточка зуба), врач (`PatientMedicalSheet`).

| Параметр | Фактическое значение | Норма | Вердикт |
|----------|---------------------|-------|---------|
| Ширина ячейки зуба | ~20–24px (358px контент / 16 колонок − gap) | ≥44px визуально или расширенный hit-area | 🔴 |
| Высота ячейки | ~28–34px (`aspect-ratio 1/1.4`) | ≥44px | 🔴 |
| Hit-area псевдоэлемент | `after:inset-[-3px]` → ~+6px | +10–12px минимум для TMA | 🟠 |
| Номера зубов | `text-[9px]` | ≥11px для вторичного текста | 🟡 |
| Sheet выбора статуса (врач) | `min-h-[52px]` на пункт | ≥44px | ✅ |

**UX-эффект:** пациент открывает карточку зуба (крупный следующий экран) — терпимо. Врач меняет статус **32 раза за приём** — высокая цена ошибки (соседний зуб, двойной тап).

**Рекомендации (по приоритету):**

1. **Режим квадранта:** свайп / табы Q1–Q4, сетка 8 зубов на экран → ~44px+ на зуб.
2. **Список-фолбэк:** «Выбрать зуб №…» с поиском + превью иконки.
3. Увеличить hit-area до `after:inset-[-8px]` + `touch-action: manipulation` + haptic (`lib/telegramHaptic.ts` уже в проекте).
4. После тапа по зубу у врача — **не открывать sheet поверх формулы без zoom**, а подсвечивать выбранный зуб (уже есть `ring-primary`) и sticky-панель статусов снизу.

### 1.2 Календари

| Экран | Компонент | Размер таргета | Вердикт |
|-------|-----------|----------------|---------|
| Кабинет врача | `DoctorMonthCalendar.tsx` | `min-h-[44px]`, стрелки `min-w/h-[44px]` | ✅ |
| Запись клиента, шаг «Дата» | `06_Appointment_Booking/page.tsx` | дни `h-8` (**32px**), сетка 7×? | 🔴 |
| Слоты времени | тот же файл | `h-10` (**40px**), grid 4 col | 🟠 |
| Перенос (врач) | modal в `Doctor/Cabinet/page.tsx` | слоты из `CLINIC_TIME_SLOTS` — проверить высоту в разметке | 🟠 |

**Доп. проблема booking-календаря:** рендер **всегда 31 день** без привязки к месяцу/дню недели — визуальная путаница (UX-логика, не только touch).

### 1.3 Нижняя навигация (Tabbar)

`BottomBar` / `AdminBottomBar`: pill `min-h-[3.25rem]`, ссылка `max-w-[4.5rem] py-1`.

| Элемент | Оценка |
|---------|--------|
| Высота всей pill | ~64–72px с `pt-3` + safe-area — достаточно |
| Зона одного таба | ~72×48px — **на нижней границе** 44px по высоте иконки+подписи |
| Badge на «Записи» | 16px — читаемо |

**Рекомендация:** `min-h-[48px]` на `<Link>` таба или убрать `max-w-[4.5rem]`, дать `flex-1` с `min-h-[44px]`.

### 1.4 Прочие touch-находки

| № | Критичность | Путь | Проблема |
|---|-------------|------|----------|
| E1 | 🔴 | `PatientToothFormula.tsx` | Зубы <44px (см. §1.1) |
| E2 | 🔴 | `06_Appointment_Booking/page.tsx` | Дни `h-8` |
| E3 | 🟠 | `07_My_Appointments/page.tsx` | «Перенести / Отменить» в карточке — `h-9` |
| E4 | 🟠 | `03_Main/page.tsx` | CTA «Записаться» в empty-state — `h-9` |
| E5 | 🟠 | `11_My_Bills/page.tsx` | Фильтры / оплата — `h-9` |
| E6 | 🟠 | `components/ui/Button.tsx` | `size="sm"` → `min-h-[36px]` — использовать только для плотных админ-таблиц |
| E7 | 🟠 | Admin: `Dashboard`, `Logs`, `Doctors`, `Price` | Иконки `w-9 h-9` / `h-8` |
| E8 | 🟡 | `12_Prevention/page.tsx` | Иконки `w-7 h-7` |
| E9 | 🟡 | `BottomBar` | Табы на грани 44px |

---

## 2. Контрастность и Light / Dark

### 2.1 Сильные стороны

- Централизованные токены в `@theme` + `html.dark` переопределение `--color-primary` (`app/globals.css`).
- Карточки: `elevated-panel`, `shadow-raised-surface` с веткой `html.dark`.
- Зубная формула: **две палитры** `CONDITION_CFG` / `CONDITION_CFG_DARK` + `useDarkMode()`.
- Зелёный бренд **не используется** (поиск `green-`, `emerald-`, `#00665E` — пусто), кроме одного артефакта ниже.

### 2.2 Хардкод и «дыры» тёмной темы

| № | Критичность | Путь | Проблема | Рекомендация |
|---|-------------|------|----------|--------------|
| C1 | 🟠 | `09_Treatment_Plan/page.tsx` | Много `text-gray-400/500`, `bg-gray-100` **без** `dark:` — на `#0f172a` контраст падает | Синхронизировать с паттерном `03_Main` (`dark:text-slate-400/500`) |
| C2 | 🟠 | `12_Prevention/page.tsx`, `13_Contacts/page.tsx`, `15_Doctors/page.tsx` | Подзаголовки только `text-gray-400` | Добавить `dark:text-slate-500` |
| C3 | 🟠 | `14_PriceList/page.tsx` | Поиск: `text-gray-400 hover:text-gray-600` без dark | `dark:text-slate-500 dark:hover:text-slate-300` |
| C4 | 🟡 | `components/ui/Input.tsx` | `hint` — `text-gray-400` без dark | `dark:text-slate-500` |
| C5 | 🟡 | `03_Main/page.tsx` | Дата в шапке `style={{ color: "#9ab0c5" }}` | `text-secondary` (токен `--color-secondary`) |
| C6 | 🟡 | `10_Profile/page.tsx` | `dark:bg-[#0F172A]` вместо `dark:bg-app-canvas` | Унифицировать холст |
| C7 | 🟠 | `06_Appointment_Booking/page.tsx` | Иконка `text-[#2d6a5d]` — **зелёный**, против правил проекта | `text-primary` |
| C8 | 🟡 | `STAGE_STATUS_CONFIG` в Treatment Plan | `pending`: `bg-gray-100` в dark | `dark:bg-slate-800 dark:text-slate-400` |
| C9 | 🟡 | Inline SVG в счетах (`11_My_Bills`) | Градиенты только light | Допустимо для иллюстрации; текст рядом с `dark:` |

### 2.3 Контраст зубов (медицинская семантика)

В light теме `healthy.stroke #CBD5E1` на белом — **низкий контур** (декоративно ок). В dark — `#4b5563` на `slate-900` — приемлемо. Критичные состояния (кариес, пульпит) различимы в обеих темах.

---

## 3. Модальные окна, Bottom Sheets, Toast

### 3.1 Z-index карта (фрагмент)

| z-index | Компонент |
|---------|-----------|
| 50 | `BottomBar`, `AdminBottomBar`, `LogsTable` drawer |
| 60 | `Toast` (базовый) |
| 100 | `PatientMedicalSheet`, booking sheet, admin modals |
| 110–115 | nested sheets (статус зуба, консилиум) |
| 125 | Toast внутри medical sheet |
| 9999 | `FormulaHelpModal`, tax modal в счетах |

**Наблюдение:** Toast (60) **ниже** tabbar (50) — numerically ok, но sheet toast (125) выше sheet (110) — корректно для врача.

### 3.2 Перекрытие таббара

| Паттерн | Реализация | Вердикт |
|---------|------------|---------|
| Toast пациента | `variant="patientWithTabBar"`, `left-4 right-4`, над tabbar | ✅ |
| Toast врач/стафф | `staffPlain` + safe-area | ✅ |
| Formula help / tax cert / bills modal | `bottom: max(1rem, safe-area + 5.25rem)` | ✅ не перекрывает pill |
| Admin CRUD modal | `pb-[max(1rem, safe-area + 5.25rem)]` | ✅ |
| `PatientMedicalSheet` | full-screen `z-[100]`, **без** patient tabbar | ✅ |
| Booking confirm sheet | `z-[100]`, отступ снизу с safe-area | ✅ |

### 3.3 Риски и улучшения

| № | Критичность | Проблема | Решение |
|---|-------------|----------|---------|
| O1 | 🟠 | Toast `72px` — магическое число, не синхронизировано с реальной высотой pill (~76–88px с padding) | CSS-переменная `--tabbar-offset` из одного источника с `.pb-safe` |
| O2 | 🟡 | Два разных нижних отступа: `.pb-safe` vs `5.25rem` в модалках | Один токен `--bottom-chrome` |
| O3 | 🟡 | `FormulaHelpModal` `z-[9999]` vs sheet `z-[100]` — избыточный разрыв | Шкала 40/50/60/70 |
| O4 | 🟡 | Фокус-ловушка / Esc | Нет единого hook `useModalA11y` | Для TMA — минимум `aria-modal`, focus on open (частично есть) |
| O5 | 🟢 | Двойной Toast при sheet врача | `z-[125]` — ок, не перекрывается таббаром (его нет) |

### 3.4 Toast vs регламент `.cursor/rules`

| Требование правил | Факт |
|-------------------|------|
| Почти на всю ширину | `left-4 right-4` ✅ |
| Синий заливной фон | `bg-primary` ✅ |
| Белая галочка | есть ✅ |
| Над tabbar | `patientWithTabBar` ✅ |
| Ошибки | `tone="error"` → `destructive` ✅ |

---

## 4. User Effort (путь пользователя по ролям)

Шкала: **1** — минимум усилий, **5** — высокая когнитивная/моторная нагрузка.  
*Effort = шаги × риск ошибки × отсутствие обратной связи.*

### 4.1 Клиент (пациент)

**Точка входа:** `/auth` → OTP → `/screens/03_Main` (tabbar: Главная, Формула, Записи, Профиль).

| Сценарий | Шаги | Effort | Трение |
|----------|------|--------|--------|
| Первый вход / регистрация | телефон → OTP → (регистрация) | 2–3 | **2** — регистрация с «Назад к входу» (`min-h-[44px]`) ✅ |
| Запись на приём | до 5 шагов (услуга → врач → дата → время → подтверждение) | 5 | **4** — календарь 31 день, мелкие дни; длинный funnel |
| Перенос записи | главная / список → booking с query | 3 | **3** — ок |
| Зубная формула → карточка зуба | tab → тап зуб → `/tooth/[id]` | 2 | **3** — мелкий тап зуба |
| Оплата / счета | tab Профиль → счета | 2–3 | **3** — модалки tax с правильным bottom offset ✅ |
| Поддержка | профиль / чат | 2 | **2** — composer 44px+ ✅ |
| План лечения | профиль / главная | 2 | **3** — dark-контраст слабее |

**Критический путь продукта:** Запись на приём — **приоритет №1** для UX-спринта (календарь + слоты + progress indicator на шагах).

**Quick wins клиента:**

- Увеличить дни/слоты до 44px.
- Stepper «Шаг 2 из 5» на booking.
- На главной empty-state CTA `h-11` вместо `h-9`.

### 4.2 Врач

**Точка входа:** авторизация как `dental_employees` → `/screens/doctor/cabinet`.

| Сценарий | Шаги | Effort | Трение |
|----------|------|--------|--------|
| День приёма: дата → список → карта пациента | 2–3 | **3** | Календарь ✅; agenda читаема |
| Смена статуса зуба | sheet → тап зуб → sheet статуса | 3 | **4** — мелкая формула |
| Консилиум | кнопка → выбор коллеги → чат | 3 | **2** — sheet 52px+ ✅ |
| Перенос/отмена приёма | карточка → modal → слот | 3–4 | **3** | |
| Ординаторская / чаты | tab в кабинете | 2 | **2** | |
| Заметки (auto-save) | ввод в textarea | 1 | **1** — debounce + «Сохранено» ✅ |

**Сильная сторона:** `PatientMedicalSheet` — единый hub (формула, заметки, план, история) без tabbar, Toast `staffPlain` / `z-[125]`.

**Приоритет врача:** эргономика формулы > всё остальное.

### 4.3 Админ

**Точка входа:** телефон `77777777777` → dashboard tabbar (Дашборд, Чаты, Врачи, Прайс) + Logs отдельным маршрутом.

| Сценарий | Шаги | Effort | Трение |
|----------|------|--------|--------|
| Обзор метрик | 1 | **1** | Dashboard `pb-safe` ✅ |
| Редактирование прайса | tab → категория → modal | 3–4 | **3** — мелкие `w-8` delete/toggle |
| Врачи CRUD | аналогично | 3–4 | **3** |
| Логи / скачивание | `/screens/admin/logs` | 2 | **2** — drawer `z-50` |
| Чаты с пациентами | tab Чаты | 2 | **2** — переиспользует StaffMessages |

**Риск:** админские модалки с `5.25rem` рассчитаны на **patient** tabbar geometry — у админа **свой** `AdminBottomBar` той же высоты → визуально согласовано, но токен должен быть общим.

**Приоритет админа:** увеличить touch на row-actions в Price/Doctors; проверить бейджи уровней логов на dashboard (`logLevelBadgeClasses` — не смешивать `text-[#475569]` с `dark:text-*` в одной ветке).

### 4.4 Сводная матрица User Effort

| Роль | Средний effort | Самый дорогой сценарий | Самый лёгкий |
|------|----------------|------------------------|--------------|
| Клиент | **3.2** | Новая запись (4) | Чат поддержки (2) |
| Врач | **2.8** | Редактирование формулы (4) | Внутренние заметки (1) |
| Админ | **2.5** | CRUD прайс/врачи (3) | Дашборд (1) |

---

## 5. Сводная таблица находок (приоритизированная)

### 🔴 Высокая критичность

| ID | Название | Путь |
|----|----------|------|
| H1 | Touch зубов <<44px | `components/dental/PatientToothFormula.tsx` |
| H2 | Touch дней записи h-8 (32px) | `screens/06_Appointment_Booking/page.tsx` |
| H3 | Календарь записи: 31 день без сетки месяца | `screens/06_Appointment_Booking/page.tsx` |

### 🟠 Средняя критичность

| ID | Название | Путь |
|----|----------|------|
| M1 | Слоты времени h-10 (40px) | `06_Appointment_Booking` |
| M2 | Treatment Plan без dark-пар для gray | `09_Treatment_Plan` |
| M3 | Toast offset 72px vs реальный tabbar | `components/ui/Toast.tsx` + `globals.css` |
| M4 | Кнопки h-9 в записях / счетах / empty-state | `07_My_Appointments`, `11_My_Bills`, `03_Main` |
| M5 | Зелёная иконка в booking | `06_Appointment_Booking` (~1057) |
| M6 | Admin/compact controls 32–36px | `Admin/Price`, `Admin/Doctors`, `LogsTable` |
| M7 | Tabbar item на грани 44px | `BottomBar`, `AdminBottomBar` |
| M8 | Button `sm` 36px в формах | `components/ui/Button.tsx` |

### 🟡 Низкая / полировка

| ID | Название | Путь |
|----|----------|------|
| L1 | Inline `#9ab0c5` вместо токена | `03_Main` |
| L2 | z-index 9999 | `05_Dental_Formula`, `11_My_Bills` |
| L3 | Prevention/Contacts/Doctors gray-only | соответствующие `screens/*` |
| L4 | `Button sm` документировать как «только админ-таблицы» | `Button.tsx` |

---

## 6. Рекомендуемый roadmap (2 спринта)

### Спринт A — «Моторика и конверсия записи»

1. Booking: реальный month grid + `min-h-[44px]` на день и слот.
2. CSS `--bottom-chrome` для `.pb-safe`, Toast, bottom sheets.
3. `h-11` на все patient secondary CTA (appointments, bills empty-state).

### Спринт B — «Клиническая точность»

1. Квадрантный режим / список для `PatientToothFormula`.
2. Treatment Plan + Prevention — пройтись `dark:` по `text-gray-*`.
3. Убрать `#2d6a5d`, унифицировать `text-secondary`.

---

## 7. Итоговые счётчики

| Уровень | Количество |
|---------|------------|
| 🔴 Высокая | **3** |
| 🟠 Средняя | **8** |
| 🟡 Низкая | **4** |
| **Всего** | **15** |

*Один архитектурный PR (токен `--bottom-chrome` + правка Toast) закрывает M3 и часть O2. Один PR по booking-календарю закрывает H2, H3, M1, M5.*

---

## Приложение: ключевые файлы по ролям

| Роль | Shell / layout | Ключевые экраны |
|------|----------------|-----------------|
| Клиент | `BottomBar`, `Header`, `pb-safe` | `03_Main`, `05_Dental_Formula`, `06_Appointment_Booking`, `07_My_Appointments`, `10_Profile` |
| Врач | без tabbar, `pb-page-end` | `Doctor/Cabinet`, `PatientMedicalSheet`, `DoctorMonthCalendar` |
| Админ | `AdminBottomBar`, `pb-safe` | `Admin/Dashboard`, `Admin/Price`, `Admin/Doctors`, `Admin/Logs`, `StaffMessages` |

---

*Документ подготовлен для команды разработки и продуктового дизайна. Для проверки в рантайме рекомендуется прогон в Telegram WebView (iOS + Android) с включённой тёмной темой и устройством с home indicator.*
