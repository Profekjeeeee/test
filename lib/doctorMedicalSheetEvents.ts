/** Событие: врач открывает полную медкарту пациента из UI (чат консилиум и т.д.). */
export const DOCTOR_OPEN_PATIENT_MEDICAL_SHEET_EVENT = "dental:doctor-open-patient-medical-sheet";

export function dispatchDoctorOpenPatientMedicalSheet(patientId: string): void {
  if (typeof window === "undefined") return;
  const id = patientId.trim();
  if (!id) return;
  window.dispatchEvent(new CustomEvent(DOCTOR_OPEN_PATIENT_MEDICAL_SHEET_EVENT, { detail: id }));
}
