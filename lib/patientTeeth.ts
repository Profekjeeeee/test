import { getDentalClients, updateClientFormulaTeeth } from "@/lib/auth";
import { buildDefaultTeeth, getTeethSnapshotForUser, saveTeethSnapshotForUser } from "@/lib/teeth";
import type { ToothStatus } from "@/types";

const FULL_FORMULA = 32;

/** Актуальное состояние формулы: приоритет dental_clients.formulaTeeth → dental_formula_<id> → дефолт. */
export function getPatientTeethState(patientId: string): ToothStatus[] {
  const client = getDentalClients().find((c) => c.id === patientId);
  if (client?.formulaTeeth && client.formulaTeeth.length >= FULL_FORMULA) {
    return client.formulaTeeth.map((t) => ({ ...t }));
  }
  const snap = getTeethSnapshotForUser(patientId);
  if (snap.length >= FULL_FORMULA) return snap.map((t) => ({ ...t }));
  return buildDefaultTeeth();
}

/** Пишет в dental_clients и синхронизирует ключ dental_formula_<patientId> для ЛК пациента. */
export function persistPatientTeeth(patientId: string, teeth: ToothStatus[]): void {
  updateClientFormulaTeeth(patientId, teeth);
  saveTeethSnapshotForUser(patientId, teeth);
}
