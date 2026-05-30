/**
 * planUtils — единый источник истины для экрана "План лечения" и виджета на главной.
 *
 * Логика:
 *  1. Статичные элементы плана (от врача, без appointmentId) — из Supabase `treatment_plan_items`.
 *  2. Элементы из записей пациента — деривируются из записей Supabase (appointments), синхронизируемых через refreshAppointmentsCache.
 *  Итоговый список = merge(static, fromAppointments).
 *
 * Ни appointments.ts, ни treatmentPlan.ts не импортируют друг друга —
 * только этот файл знает об обоих, нет циклических зависимостей.
 */

import { getAppointments, initAppointments, type Appointment } from "@/lib/appointments";
import {
  getStaticPlanItems,
  initTreatmentPlan,
  computeStats,
  type TreatmentPlanItem,
  type TreatmentPlanStats,
} from "@/lib/treatmentPlan";

// ─── Convert one appointment → TreatmentPlanItem ─────────────────────────────

export function aptToPlanItem(apt: Appointment): TreatmentPlanItem {
  const parts = apt.service.split(".");
  const category = parts[0].trim();
  const title =
    parts.length > 1 ? parts.slice(1).join(".").trim() : apt.service;
  const mm = String(apt.monthNum).padStart(2, "0");
  const dd = String(apt.day).padStart(2, "0");

  return {
    id: `apt-${apt.id}`,
    appointmentId: apt.id,
    category,
    title,
    price: apt.price ?? 0,
    date: `${apt.year}-${mm}-${dd}`,
  };
}

// ─── Build merged list ────────────────────────────────────────────────────────

/**
 * Returns the unified list of plan items:
 *   - static doctor-created items (no appointmentId)
 *   - items derived from non-cancelled appointments
 * Sorted within each category by date (ascending).
 */
export function buildMergedPlanItems(): TreatmentPlanItem[] {
  const staticItems = getStaticPlanItems(); // from Supabase treatment_plan_items
  const appointments = getAppointments();

  const fromAppointments: TreatmentPlanItem[] = appointments
    .filter((a) => a.status !== "cancelled")
    .map(aptToPlanItem);

  return [...staticItems, ...fromAppointments];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getMergedPlanStats(): TreatmentPlanStats {
  return computeStats(buildMergedPlanItems());
}

// ─── Init both stores ─────────────────────────────────────────────────────────

export async function initPlanSources(): Promise<void> {
  await initAppointments();
  initTreatmentPlan();
}
