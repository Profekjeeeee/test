# ROADMAP EXTENSION (Шаги 11-15)

> Продолжение существующего ROADMAP.md.
> Шаги 1-10 остаются без изменений.

# Шаг 11. Подготовка к мультитенантности (Multi-Tenant Architecture) ✅

## Цель
Подготовить систему к обслуживанию нескольких клиник на одной платформе.

## Реализовано
- **Схема** — `supabase/migrations/010_multi_tenant.sql`: `clinics`, `clinic_settings`, `clinic_id` на бизнес-таблицах, backfill дефолтной клиники `default`
- **RLS** — `user_clinic_id()`, `same_user_clinic()`, изоляция по клинике; уникальность phone/telegram в рамках клиники
- **API** — `GET /api/clinic/settings?slug=` — публичные настройки для Mini App
- **Фронт** — `ClinicProvider`, `ClinicBrandingStyles`, контакты и слоты записи из БД; env `NEXT_PUBLIC_CLINIC_SLUG` / `CLINIC_SLUG`

## Осталось (следующие итерации)
- [ ] Админ-UI редактирования `clinic_settings`
- [ ] Второй тенант на demo + проверка изоляции RLS
- [ ] Per-clinic Telegram Bot token в Vault / env mapping

## Результат
Платформа готова к работе с несколькими клиниками (single-tenant совместим с `slug=default`).

---

# Шаг 12. Пациентский кабинет нового поколения ✅

## Цель
Сделать пациента центральным элементом системы.

## Реализовано
- **Хаб `/cabinet`** — единый цифровой кабинет: прогресс лечения, визиты, архив, финансы, рекомендации
- **`lib/patientCabinet.ts`** — агрегация данных из Supabase (visits, records, files, bills, payments, plan)
- **`lib/patientRecommendations.ts`** — рекомендации из `clinical_notes` визитов + `medical_records`
- **Профилактика** — реальные рекомендации и расчёт следующего осмотра по истории визитов
- **Счета** — секция «История оплат» из таблицы `payments`
- **Tabbar** — вкладка «Кабинет» вместо «Ещё» → `/cabinet`

## Задачи (закрыты)
- История лечения → `/treatment-history` + превью в кабинете
- Архив документов и снимков → `/documents` + превью в кабинете
- Прогресс лечения → виджет + `/treatment-plan`
- История счетов и оплат → `/bills` + payments
- Рекомендации врача → из БД + `/prevention`
- Личный медицинский архив → medical_records в кабинете

## Результат
Полноценный цифровой кабинет пациента.

---

# Шаг 13. AI-помощник врача и пациента ✅

## Цель
Повысить ценность продукта за счет AI-инструментов.

## Реализовано
- **API** — `POST /api/ai` с действиями: `exam_draft`, `recommendations`, `medcard_search`, `patient_summary`, `explain_diagnosis`
- **Сервер** — `lib/server/ai/*`, `lib/server/services/aiService.ts` — контекст медкарты из Supabase, OpenAI через fetch
- **Врач** — `DoctorAiToolbar` в `PatientMedicalSheet`: сводка, рекомендации, поиск, черновик осмотра (+ кнопка ✦ AI в форме визита)
- **Пациент** — `PatientAiAssistant` в `/cabinet` (поиск по медкарте), `ExplainDiagnosisButton` в `/treatment-history`
- **Env** — `OPENAI_API_KEY`, опционально `OPENAI_MODEL`, `OPENAI_BASE_URL`

## Задачи (закрыты)
- Генерация черновика осмотра
- Генерация рекомендаций
- AI-поиск по медкарте
- AI-сводка пациента
- Объяснение диагноза пациенту простым языком

## Результат
AI-assisted стоматологическая платформа.

---

# Шаг 14. Видеоконсультации и удаленное взаимодействие ✅

## Цель
Добавить дистанционные консультации.

## Реализовано
- **Схема** — `supabase/migrations/011_video_consultations.sql`: `visit_mode` на `appointments`, таблицы `video_consultations`, `consultation_annotations`, RLS + Realtime
- **WebRTC** — `lib/webrtc/consultationPeer.ts`: P2P через STUN + Supabase Realtime broadcast (signaling)
- **API** — `POST/GET /api/consultations`, `PATCH/POST /api/consultations/[id]` (статус, аннотации снимков)
- **UI** — `/consultation/[appointmentId]`: видео, разбор снимков (`XrayViewer`), обмен файлами (`ConsultationFilePanel`)
- **Запись** — выбор «Онлайн» при booking; услуга «Предварительная консультация (онлайн)»
- **Интеграция** — кнопки входа в `07_My_Appointments` и `Doctor/Cabinet`

## Задачи (закрыты)
- WebRTC-интеграция
- Онлайн-разбор снимков
- Предварительные консультации
- Передача файлов во время консультации

## Осталось (следующие итерации)
- [ ] TURN-сервер для сложных NAT (LiveKit / coturn)
- [ ] Realtime-синхронизация аннотаций без перезагрузки
- [ ] Telegram deep-link «Войти в консультацию»

## Результат
Удаленное взаимодействие врача и пациента.

---

# Шаг 15. SaaS-подготовка и масштабирование продукта ✅

## Цель
Подготовить продукт к коммерческому росту.

## Реализовано
- **Схема** — `supabase/migrations/012_saas_platform.sql`: `subscription_plans`, `clinic_subscriptions`, `platform_admins`, онбординг на `clinics`, `clinic_id` на `app_logs`
- **Тарифы** — Starter / Pro / Enterprise с лимитами (`ai_enabled`, `video_enabled`, `max_doctors`); enforcement в `/api/ai` и `/api/consultations`
- **Super Admin** — `/screens/platform/*`: дашборд (MRR, клиники), список клиник, детали/подписка, мониторинг `app_logs`
- **Онбординг** — wizard `/screens/platform/onboarding` + `POST /api/platform/clinics`
- **Clinic settings UI** — `/screens/admin/settings` + `PATCH /api/clinic/settings`
- **Auth** — `platform_admins` + env `PLATFORM_ADMIN_EMAILS` / `PLATFORM_ADMIN_PHONES`
- **Demo** — `supabase/seed_demo_tenant_b.sql` (вторая клиника `demo-b` для RLS-теста)

## Задачи (закрыты)
- Тарифные планы
- Онбординг клиник
- Super Admin Panel
- Мониторинг платформы
- Демо-стенд (seed tenant B + docs)
- Презентация продукта (SaaS-слайд)

## Осталось (следующие итерации)
- [ ] Stripe / ЮKassa billing
- [ ] Self-service signup без Super Admin
- [ ] Subdomain routing (`clinic.platform.ru`)
- [ ] Per-clinic Telegram Bot token в Vault

## Результат
Готовность к масштабированию и продажам.
