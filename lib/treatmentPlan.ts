// ─── Types ────────────────────────────────────────────────────────────────────

export type TreatmentItemStatus = "completed" | "in-progress" | "pending";

export interface TreatmentPlanItem {
  id: string;
  appointmentId?: string; // only set for appointment-derived items
  category: string;
  title: string;
  price: number;
  date: string; // ISO "YYYY-MM-DD"
}

export interface TreatmentPlanStats {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
  paidAmount: number;
  totalAmount: number;
  progressPercent: number;
}

// ─── Category stage ordering ──────────────────────────────────────────────────

export const CATEGORY_STAGE_ORDER: Record<string, number> = {
  Профилактика: 1,
  Гигиена: 1,
  Терапия: 2,
  Хирургия: 3,
  Ортодонтия: 4,
  Имплантация: 5,
};

export function getCategoryStageNum(category: string): number {
  return CATEGORY_STAGE_ORDER[category] ?? 99;
}

// ─── Status computation ───────────────────────────────────────────────────────

export function getItemStatus(isoDate: string): TreatmentItemStatus {
  const itemDate = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (itemDate < today) return "completed";
  if (itemDate < tomorrow) return "in-progress";
  return "pending";
}

// ─── Stats (accepts any item array — used with merged data) ───────────────────

export function computeStats(items: TreatmentPlanItem[]): TreatmentPlanStats {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let paidAmount = 0;
  let totalAmount = 0;

  items.forEach((item) => {
    const status = getItemStatus(item.date);
    totalAmount += item.price;
    if (status === "completed") {
      completed++;
      paidAmount += item.price;
    } else if (status === "in-progress") {
      inProgress++;
    } else {
      pending++;
    }
  });

  const total = items.length;
  const progressPercent =
    total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completed,
    inProgress,
    pending,
    total,
    paidAmount,
    totalAmount,
    progressPercent,
  };
}

// ─── Static plan items storage ────────────────────────────────────────────────
// These are doctor-created items NOT linked to appointments.
// Appointment-derived items come from lib/planUtils.ts via getAppointments().

const STORAGE_KEY = "treatment_plan";
const STORAGE_VERSION = "v2"; // bump on breaking schema changes
const VERSION_KEY = "treatment_plan_version";

const STATIC_DEFAULT: TreatmentPlanItem[] = [
  {
    id: "tp-d1",
    category: "Профилактика",
    title: "Профессиональная гигиена",
    price: 4500,
    date: "2025-10-14",
  },
  {
    id: "tp-d2",
    category: "Профилактика",
    title: "Снятие зубного камня",
    price: 3000,
    date: "2025-11-03",
  },
  {
    id: "tp-d4",
    category: "Терапия",
    title: "Эндодонтическое лечение",
    price: 12000,
    date: "2026-06-15",
  },
  {
    id: "tp-d5",
    category: "Хирургия",
    title: "Удаление зуба",
    price: 3500,
    date: "2026-07-20",
  },
  {
    id: "tp-d6",
    category: "Ортодонтия",
    title: "Консультация ортодонта",
    price: 2000,
    date: "2026-08-10",
  },
];

export function initTreatmentPlan(): void {
  if (typeof window === "undefined") return;

  const version = localStorage.getItem(VERSION_KEY);

  if (version !== STORAGE_VERSION) {
    // Migration: wipe old data that mixed appointment-linked items into this store.
    // From now on, only truly static (no appointmentId) items live here.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATIC_DEFAULT));
    localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
    return;
  }

  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATIC_DEFAULT));
  }
}

/** Returns only the static (non-appointment) plan items. */
export function getStaticPlanItems(): TreatmentPlanItem[] {
  if (typeof window === "undefined") return STATIC_DEFAULT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return STATIC_DEFAULT;
    const parsed = JSON.parse(stored) as TreatmentPlanItem[];
    // Guard: never return appointment-linked items from here
    return parsed.filter((item) => !item.appointmentId);
  } catch {
    return STATIC_DEFAULT;
  }
}

export function saveStaticPlanItems(items: TreatmentPlanItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("treatmentPlanUpdated"));
}
