import type { MedicalRecord } from "@/lib/medicalRecords";
import type { PatientVisit } from "@/lib/patientVisits";

export interface PatientRecommendation {
  id: string;
  text: string;
  source: "visit" | "record";
  visitDate?: string;
  doctorName?: string;
  procedureTitle?: string;
  recordType?: string;
}

const DEFAULT_PREVENTION_TIPS: PatientRecommendation[] = [
  { id: "tip-brush", text: "Чистите зубы 2 раза в день не менее 2 минут", source: "record" },
  { id: "tip-floss", text: "Используйте зубную нить ежедневно", source: "record" },
  { id: "tip-checkup", text: "Профилактический осмотр каждые 6 месяцев", source: "record" },
];

/** Рекомендации из clinical_notes визитов + general medical_records. */
export function buildPatientRecommendations(
  visits: PatientVisit[],
  records: MedicalRecord[],
  limit = 10
): PatientRecommendation[] {
  const fromVisits: PatientRecommendation[] = visits
    .filter((v) => v.visibleToPatient && v.clinicalNotes.trim())
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
    .map((v) => ({
      id: `visit-${v.id}`,
      text: v.clinicalNotes.trim(),
      source: "visit" as const,
      visitDate: v.visitDate,
      doctorName: v.doctorName,
      procedureTitle: v.procedureTitle,
    }));

  const fromRecords: PatientRecommendation[] = records
    .filter(
      (r) =>
        r.visibleToPatient &&
        r.isActive &&
        (r.recordType === "general" || r.description.trim())
    )
    .map((r) => ({
      id: `record-${r.id}`,
      text: r.description.trim() ? `${r.title}: ${r.description.trim()}` : r.title,
      source: "record" as const,
      recordType: r.recordType,
    }));

  const merged = [...fromVisits, ...fromRecords];
  if (merged.length === 0) return DEFAULT_PREVENTION_TIPS.slice(0, limit);
  return merged.slice(0, limit);
}

/** Дата последнего визита и расчёт следующего осмотра (+6 мес). */
export function computePreventionSchedule(visits: PatientVisit[]): {
  lastVisitDate: Date | null;
  nextVisitDate: Date;
  daysUntilNextVisit: number;
  progressPercent: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sorted = visits
    .filter((v) => v.visibleToPatient)
    .map((v) => new Date(v.visitDate.includes("T") ? v.visitDate : `${v.visitDate}T12:00:00`))
    .sort((a, b) => b.getTime() - a.getTime());

  const lastVisitDate = sorted[0] ?? null;

  const nextVisitDate = lastVisitDate
    ? new Date(lastVisitDate.getFullYear(), lastVisitDate.getMonth() + 6, lastVisitDate.getDate())
    : new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilNextVisit = Math.max(
    0,
    Math.ceil((nextVisitDate.getTime() - today.getTime()) / msPerDay)
  );

  const intervalDays = 180;
  const elapsed = lastVisitDate
    ? Math.min(intervalDays, Math.floor((today.getTime() - lastVisitDate.getTime()) / msPerDay))
    : 0;
  const progressPercent = Math.round((elapsed / intervalDays) * 100);

  return { lastVisitDate, nextVisitDate, daysUntilNextVisit, progressPercent };
}
