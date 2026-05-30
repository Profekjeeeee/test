import type { PlanLimits, SubscriptionPlan } from "@/lib/platform/types";

/** Fallback-планы, если миграция 012 ещё не применена. */
export const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    code: "starter",
    name: "Старт",
    description: "Для небольшой клиники до 2 врачей",
    priceMonthly: 9900,
    currency: "RUB",
    limits: { max_doctors: 2, max_patients: 500, ai_enabled: false, video_enabled: false, crm_enabled: true },
    features: ["Запись и медкарта", "CRM базовый", "Telegram Mini App"],
    sortOrder: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    code: "pro",
    name: "Профи",
    description: "Полный функционал для растущей клиники",
    priceMonthly: 24900,
    currency: "RUB",
    limits: { max_doctors: 10, max_patients: 5000, ai_enabled: true, video_enabled: true, crm_enabled: true },
    features: ["AI-помощник", "Видеоконсультации", "KPI и аналитика", "Audit trail"],
    sortOrder: 2,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    code: "enterprise",
    name: "Enterprise",
    description: "Без ограничений + приоритетная поддержка",
    priceMonthly: 49900,
    currency: "RUB",
    limits: { max_doctors: 999, max_patients: 999999, ai_enabled: true, video_enabled: true, crm_enabled: true },
    features: ["White-label", "SLA", "Кастомные интеграции", "Dedicated support"],
    sortOrder: 3,
  },
];

export function parsePlanLimits(raw: unknown): PlanLimits {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    max_doctors: typeof o.max_doctors === "number" ? o.max_doctors : undefined,
    max_patients: typeof o.max_patients === "number" ? o.max_patients : undefined,
    ai_enabled: typeof o.ai_enabled === "boolean" ? o.ai_enabled : undefined,
    video_enabled: typeof o.video_enabled === "boolean" ? o.video_enabled : undefined,
    crm_enabled: typeof o.crm_enabled === "boolean" ? o.crm_enabled : undefined,
  };
}

export function formatPlanPrice(amount: number, currency = "RUB"): string {
  if (currency === "RUB") {
    return `${amount.toLocaleString("ru-RU")} ₽/мес`;
  }
  return `${amount} ${currency}/mo`;
}
