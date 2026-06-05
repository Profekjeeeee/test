import { getCurrentUserId, getDentalSession } from "@/lib/auth";
import { resolveClientIdForAppointment } from "@/lib/appointments";
import { supabase } from "@/lib/supabaseClient";

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

interface TreatmentPlanItemRow {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_id: string | null;
  title: string;
  description: string;
  category: string;
  price: number | string;
  priority: number;
  status: string;
  planned_date: string | null;
  completed_date: string | null;
  created_at: string;
  updated_at: string;
}

interface CachedTreatmentPlanItem extends TreatmentPlanItem {
  patientId: string;
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

function dbStatusFromItemStatus(status: TreatmentItemStatus): string {
  if (status === "completed") return "completed";
  if (status === "in-progress") return "in_progress";
  return "pending";
}

function rowToCachedItem(row: TreatmentPlanItemRow): CachedTreatmentPlanItem {
  const date =
    row.planned_date ??
    row.completed_date ??
    row.created_at.split("T")[0];

  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id ?? undefined,
    category: row.category || "Прочее",
    title: row.title,
    price: Number(row.price),
    date,
  };
}

function stripPatientId(item: CachedTreatmentPlanItem): TreatmentPlanItem {
  const { patientId: _pid, ...rest } = item;
  void _pid;
  return rest;
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

// ─── Storage (Supabase) ───────────────────────────────────────────────────────

const LEGACY_BASE_KEY = "treatment_plan";
const LEGACY_VERSION_KEY = "treatment_plan_version";
const MIGRATION_FLAG = "treatment_plan_migrated_to_supabase_v1";

function getClientSubjectIdForFilters(): string | null {
  const uid = getCurrentUserId();
  if (uid) return uid;
  const session = getDentalSession();
  if (session?.role === "client" && session.id) return session.id;
  return null;
}

function legacyStorageKey(uid?: string | null): string {
  const id = uid ?? getCurrentUserId();
  return id ? `${LEGACY_BASE_KEY}_${id}` : LEGACY_BASE_KEY;
}

function migrationFlagKey(uid: string): string {
  return `${MIGRATION_FLAG}_${uid}`;
}

function dispatchTreatmentPlanUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("treatmentPlanUpdated"));
}

let treatmentPlanCache: CachedTreatmentPlanItem[] | null = null;

export async function refreshTreatmentPlanCache(): Promise<void> {
  const subjectId = getClientSubjectIdForFilters();
  let query = supabase
    .from("treatment_plan_items")
    .select("*")
    .is("appointment_id", null);
  if (subjectId) {
    query = query.eq("patient_id", subjectId);
  }
  const { data, error } = await query
    .order("planned_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[treatmentPlan]", error);
    return;
  }

  treatmentPlanCache = ((data ?? []) as TreatmentPlanItemRow[]).map(rowToCachedItem);
  dispatchTreatmentPlanUpdated();
}

async function resolvePatientIdForWrite(): Promise<string | null> {
  const uid = getCurrentUserId();
  if (uid) return uid;
  return resolveClientIdForAppointment();
}

async function migrateTreatmentPlanFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  const patientId = await resolvePatientIdForWrite();
  if (!patientId) return;

  const flagKey = migrationFlagKey(patientId);
  if (localStorage.getItem(flagKey)) return;

  const raw = localStorage.getItem(legacyStorageKey(patientId));
  if (!raw) {
    localStorage.removeItem(legacyStorageKey(null));
    localStorage.removeItem(`${LEGACY_VERSION_KEY}_${patientId}`);
    localStorage.setItem(flagKey, "1");
    return;
  }

  let legacyItems: TreatmentPlanItem[] = [];
  try {
    legacyItems = JSON.parse(raw) as TreatmentPlanItem[];
  } catch {
    localStorage.setItem(flagKey, "1");
    return;
  }

  for (const item of legacyItems.filter((i) => !i.appointmentId)) {
    const phase = getItemStatus(item.date);
    const { error } = await supabase.from("treatment_plan_items").insert([
      {
        patient_id: patientId,
        title: item.title,
        description: item.title,
        category: item.category,
        price: item.price,
        priority: getCategoryStageNum(item.category),
        status: dbStatusFromItemStatus(phase),
        planned_date: item.date,
        completed_date: phase === "completed" ? item.date : null,
      },
    ]);

    if (error) {
      console.error("[treatmentPlan] migrate", error);
    }
  }

  localStorage.removeItem(legacyStorageKey(patientId));
  localStorage.removeItem(legacyStorageKey(null));
  localStorage.removeItem(`${LEGACY_VERSION_KEY}_${patientId}`);
  localStorage.removeItem(LEGACY_VERSION_KEY);
  localStorage.setItem(flagKey, "1");
}

export async function initTreatmentPlan(): Promise<void> {
  await migrateTreatmentPlanFromLocalStorage();
  await refreshTreatmentPlanCache();
}

export function getStaticPlanItems(): TreatmentPlanItem[] {
  const subjectId = getClientSubjectIdForFilters();
  if (!subjectId || !treatmentPlanCache) return [];

  return treatmentPlanCache
    .filter((item) => item.patientId === subjectId && !item.appointmentId)
    .map(stripPatientId);
}

/** Загрузить позиции плана для пациента (кабинет врача). Обновляет кэш для этого patientId. */
export async function fetchTreatmentPlanItemsForPatient(
  patientId: string
): Promise<TreatmentPlanItem[]> {
  const { data, error } = await supabase
    .from("treatment_plan_items")
    .select("*")
    .eq("patient_id", patientId)
    .is("appointment_id", null)
    .order("planned_date", { ascending: true });

  if (error) {
    console.error("[treatmentPlan] fetchForPatient", error);
    return getTreatmentPlanItemsForUser(patientId);
  }

  const fetched = ((data ?? []) as TreatmentPlanItemRow[]).map(rowToCachedItem);
  const rest = (treatmentPlanCache ?? []).filter((i) => i.patientId !== patientId);
  treatmentPlanCache = [...rest, ...fetched];

  return fetched.map(stripPatientId);
}

/** Позиции плана пациента из кэша (после initTreatmentPlan или fetchTreatmentPlanItemsForPatient). */
export function getTreatmentPlanItemsForUser(userId: string): TreatmentPlanItem[] {
  if (!treatmentPlanCache) return [];

  return treatmentPlanCache
    .filter((item) => item.patientId === userId && !item.appointmentId)
    .map(stripPatientId);
}

export async function saveStaticPlanItems(items: TreatmentPlanItem[]): Promise<void> {
  const patientId = await resolvePatientIdForWrite();
  if (!patientId) return;

  const existing = getStaticPlanItems();
  const existingIds = new Set(existing.map((i) => i.id));
  const nextIds = new Set(items.map((i) => i.id));

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      const { error } = await supabase.from("treatment_plan_items").delete().eq("id", id);
      if (error) console.error("[treatmentPlan] delete", error);
    }
  }

  for (const item of items) {
    const phase = getItemStatus(item.date);
    const payload = {
      patient_id: patientId,
      title: item.title,
      description: item.title,
      category: item.category,
      price: item.price,
      priority: getCategoryStageNum(item.category),
      status: dbStatusFromItemStatus(phase),
      planned_date: item.date,
      completed_date: phase === "completed" ? item.date : null,
      appointment_id: null,
    };

    if (existingIds.has(item.id)) {
      const { error } = await supabase
        .from("treatment_plan_items")
        .update(payload)
        .eq("id", item.id);
      if (error) console.error("[treatmentPlan] update", error);
    } else {
      const { error } = await supabase.from("treatment_plan_items").insert([payload]);
      if (error) console.error("[treatmentPlan] insert", error);
    }
  }

  await refreshTreatmentPlanCache();
}
