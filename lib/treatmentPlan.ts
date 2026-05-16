import { getCurrentUserId } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TreatmentItemStatus = "completed" | "in-progress" | "pending";

export interface TreatmentPlanItem {
  id: string;
  appointmentId?: string;
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

// ─── Stats ────────────────────────────────────────────────────────────────────

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

  return { completed, inProgress, pending, total, paidAmount, totalAmount, progressPercent };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const BASE_KEY = "treatment_plan";
const BASE_VERSION_KEY = "treatment_plan_version";
const STORAGE_VERSION = "v3"; // bumped for user-scoped migration

function storageKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_KEY}_${uid}` : BASE_KEY;
}

function versionKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_VERSION_KEY}_${uid}` : BASE_VERSION_KEY;
}

export function initTreatmentPlan(): void {
  if (typeof window === "undefined") return;

  const version = localStorage.getItem(versionKey());

  if (version !== STORAGE_VERSION) {
    // New user or migration: start with empty plan
    localStorage.setItem(storageKey(), JSON.stringify([]));
    localStorage.setItem(versionKey(), STORAGE_VERSION);
    return;
  }

  if (!localStorage.getItem(storageKey())) {
    localStorage.setItem(storageKey(), JSON.stringify([]));
  }
}

export function getStaticPlanItems(): TreatmentPlanItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(storageKey());
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TreatmentPlanItem[];
    return parsed.filter((item) => !item.appointmentId);
  } catch {
    return [];
  }
}

export function saveStaticPlanItems(items: TreatmentPlanItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(), JSON.stringify(items));
  window.dispatchEvent(new Event("treatmentPlanUpdated"));
}

/** Все позиции плана лечения пользователя (по patientId в localStorage). */
export function getTreatmentPlanItemsForUser(userId: string): TreatmentPlanItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${BASE_KEY}_${userId}`);
    if (!raw) return [];
    return JSON.parse(raw) as TreatmentPlanItem[];
  } catch {
    return [];
  }
}
