import { initBills, getBills, getTotalPending } from "@/lib/bills";
import { initMedicalRecords, getMedicalRecords } from "@/lib/medicalRecords";
import { initPatientFiles, getPatientFiles } from "@/lib/patientFiles";
import { initPatientVisits, getPatientVisits } from "@/lib/patientVisits";
import { getPatientPayments, PAYMENT_METHOD_LABELS } from "@/lib/payments";
import { initPlanSources, getMergedPlanStats } from "@/lib/planUtils";
import {
  buildPatientRecommendations,
  computePreventionSchedule,
  type PatientRecommendation,
} from "@/lib/patientRecommendations";
import type { TreatmentPlanStats } from "@/lib/treatmentPlan";
import type { MedicalRecord } from "@/lib/medicalRecords";
import type { PatientVisit } from "@/lib/patientVisits";
import type { PatientFile } from "@/lib/patientFiles";
import type { Payment } from "@/types";

export type { PatientRecommendation };

export interface PatientCabinetFinances {
  pendingAmount: number;
  pendingCount: number;
  paidCount: number;
  recentPayments: Payment[];
}

export interface PatientCabinetFilesSummary {
  total: number;
  xrays: number;
  docs: number;
}

export interface PatientCabinetSummary {
  planStats: TreatmentPlanStats;
  recentVisits: PatientVisit[];
  visitCount: number;
  medicalRecords: MedicalRecord[];
  filesSummary: PatientCabinetFilesSummary;
  recentFiles: PatientFile[];
  finances: PatientCabinetFinances;
  recommendations: PatientRecommendation[];
  prevention: ReturnType<typeof computePreventionSchedule>;
}

let initPromise: Promise<void> | null = null;

/** Параллельная инициализация всех источников данных кабинета. */
export async function initPatientCabinet(): Promise<void> {
  if (!initPromise) {
    initPromise = Promise.all([
      initPlanSources(),
      initBills(),
      initPatientVisits(),
      initMedicalRecords(),
      initPatientFiles(),
    ]).then(() => undefined);
  }
  await initPromise;
}

export function resetPatientCabinetCache(): void {
  initPromise = null;
}

export function getPatientCabinetSummary(): PatientCabinetSummary {
  const visits = getPatientVisits();
  const records = getMedicalRecords();
  const files = getPatientFiles();
  const bills = getBills();

  const xrays = files.filter(
    (f) => f.fileCategory === "xray" || f.fileCategory === "photo"
  ).length;
  const docs = files.length - xrays;

  const pendingBills = bills.filter(
    (b) => b.status === "pending" || b.status === "overdue" || b.status === "partial"
  );

  return {
    planStats: getMergedPlanStats(),
    recentVisits: visits.slice(0, 3),
    visitCount: visits.length,
    medicalRecords: records,
    filesSummary: { total: files.length, xrays, docs },
    recentFiles: files.slice(0, 2),
    finances: {
      pendingAmount: getTotalPending(bills),
      pendingCount: pendingBills.length,
      paidCount: bills.filter((b) => b.status === "paid").length,
      recentPayments: [],
    },
    recommendations: buildPatientRecommendations(visits, records, 5),
    prevention: computePreventionSchedule(visits),
  };
}

/** Полная загрузка с историей платежей (async). */
export async function loadPatientCabinetSummary(): Promise<PatientCabinetSummary> {
  await initPatientCabinet();
  const summary = getPatientCabinetSummary();
  const payments = await getPatientPayments();
  summary.finances.recentPayments = payments.slice(0, 5);
  return summary;
}

export function formatPaymentLabel(payment: Payment): string {
  const method = PAYMENT_METHOD_LABELS[payment.method] ?? payment.method;
  return `${payment.amount.toLocaleString("ru-RU")} ₽ · ${method}`;
}
