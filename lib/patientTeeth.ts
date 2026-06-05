import {
  getDentalClients,
  requireDentalClientByPatientKey,
  resolveDentalClientFromCacheSync,
  updateClientFormulaTeethByClientId,
} from "@/lib/auth";
import { buildDefaultTeeth, getTeethSnapshotForUser, saveTeethSnapshotForUser } from "@/lib/teeth";
import type { ToothCondition, ToothJaw, ToothSide, ToothStatus } from "@/types";

const ALLOWED_CONDITIONS: ToothCondition[] = [
  "healthy",
  "treated",
  "caries",
  "pulpitis",
  "removed",
  "crown",
  "implant",
  "prosthesis",
];

/** Нормализация значения condition из JSON БД; не подставляет посторонние поля. */
export function coerceToothCondition(raw: unknown): ToothCondition {
  return typeof raw === "string" && (ALLOWED_CONDITIONS as string[]).includes(raw)
    ? (raw as ToothCondition)
    : "healthy";
}

function coerceJaw(raw: unknown): ToothJaw {
  return raw === "upper" || raw === "lower" ? raw : "upper";
}

function coerceSide(raw: unknown): ToothSide {
  return raw === "left" || raw === "right" ? raw : "left";
}

/**
 * Только допустимые поля ToothStatus — без id и прочих ключей из JSON,
 * чтобы не слать в Supabase лишнее и не ловить конфликты со схемой.
 */
export function sanitizeFormulaTeethForSupabase(teeth: ToothStatus[]): ToothStatus[] {
  return teeth.map((t) => {
    const materials = Array.isArray(t.materials)
      ? t.materials.filter((x): x is string => typeof x === "string")
      : undefined;
    const base: ToothStatus = {
      number: typeof t.number === "number" && t.number > 0 ? t.number : 0,
      condition: coerceToothCondition(t.condition),
      jaw: coerceJaw(t.jaw),
      side: coerceSide(t.side),
      hasNote: Boolean(t.hasNote),
    };
    if (typeof t.lastTreatmentDate === "string" && t.lastTreatmentDate.trim()) {
      base.lastTreatmentDate = t.lastTreatmentDate.trim();
    }
    if (typeof t.notes === "string" && t.notes.trim()) {
      base.notes = t.notes.trim();
    }
    if (materials && materials.length > 0) {
      base.materials = materials;
    }
    return base;
  });
}

/** Слияние снимка из БД с полной FDI-сеткой (32 зуба). */
export function mergeFormulaWithDefaults(fromDb: ToothStatus[]): ToothStatus[] {
  const sanitized = sanitizeFormulaTeethForSupabase(fromDb);
  if (!sanitized.length) return buildDefaultTeeth();
  const byNum = Object.fromEntries(sanitized.map((t) => [t.number, t]));
  return buildDefaultTeeth().map((d) => byNum[d.number] ?? d);
}

/** Актуальное состояние формулы: приоритет dental_clients.formula_teeth → dental_formula_<id> → дефолт. */
export function getPatientTeethState(patientKey: string): ToothStatus[] {
  const trimmed = patientKey.trim();
  const sync = resolveDentalClientFromCacheSync(trimmed);
  const client =
    sync ?? getDentalClients().find((c) => c.id === trimmed);
  if (client?.formulaTeeth && client.formulaTeeth.length > 0) {
    return mergeFormulaWithDefaults(client.formulaTeeth);
  }
  let snap = getTeethSnapshotForUser(trimmed);
  if (snap.length > 0) return mergeFormulaWithDefaults(snap);
  if (sync) {
    snap = getTeethSnapshotForUser(sync.id);
    if (snap.length > 0) return mergeFormulaWithDefaults(snap);
  }
  return buildDefaultTeeth();
}

/** Загрузка формулы текущего пациента из Supabase (для ЛК клиента). */
export async function loadClientFormulaTeeth(): Promise<ToothStatus[]> {
  const { refreshDentalCaches, getCurrentUserId } = await import("@/lib/auth");
  await refreshDentalCaches();
  const uid = getCurrentUserId();
  if (!uid) return buildDefaultTeeth();
  const teeth = getPatientTeethState(uid);
  saveTeethSnapshotForUser(uid, teeth);
  return teeth;
}

/** Пишет в Supabase (dental_clients.formula_teeth) и синхронизирует ключ dental_formula_<patientId> для ЛК пациента. */
export async function persistPatientTeeth(patientKey: string, teeth: ToothStatus[]): Promise<void> {
  const client = await requireDentalClientByPatientKey(patientKey);
  const payload = sanitizeFormulaTeethForSupabase(teeth);
  await updateClientFormulaTeethByClientId(client.id, payload);
  saveTeethSnapshotForUser(client.id, payload);
}
