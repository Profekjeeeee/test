import { getDentalEmployees, getCurrentUserId, getDentalSession } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export interface PatientVisit {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  visitDate: string;
  procedureTitle: string;
  procedureDescription: string;
  toothNumbers: number[];
  diagnosis: string;
  clinicalNotes: string;
  materials: string;
  price?: number;
  visibleToPatient: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PatientVisitRow {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_id: string | null;
  visit_date: string;
  procedure_title: string;
  procedure_description: string;
  tooth_numbers: number[] | null;
  diagnosis: string;
  clinical_notes: string;
  materials: string;
  price: number | string | null;
  visible_to_patient: boolean;
  created_at: string;
  updated_at: string;
}

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function resolveDoctorName(doctorId: string | null | undefined): string | undefined {
  if (!doctorId) return undefined;
  const doc = getDentalEmployees().find((e) => e.id === doctorId);
  return doc?.fullName;
}

function rowToVisit(row: PatientVisitRow): PatientVisit {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id ?? undefined,
    doctorName: resolveDoctorName(row.doctor_id),
    appointmentId: row.appointment_id ?? undefined,
    visitDate: row.visit_date,
    procedureTitle: row.procedure_title,
    procedureDescription: row.procedure_description,
    toothNumbers: row.tooth_numbers ?? [],
    diagnosis: row.diagnosis,
    clinicalNotes: row.clinical_notes,
    materials: row.materials,
    price: row.price != null ? Number(row.price) : undefined,
    visibleToPatient: row.visible_to_patient,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getClientSubjectId(): string | null {
  const uid = getCurrentUserId();
  if (uid) return uid;
  const session = getDentalSession();
  if (session?.role === "client" && session.id) return session.id;
  return null;
}

function dispatchPatientVisitsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("patientVisitsUpdated"));
}

let patientVisitsCache: PatientVisit[] | null = null;

export function formatVisitDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatVisitPrice(price: number | undefined): string {
  if (price == null || price === 0) return "Бесплатно";
  return `${price.toLocaleString("ru-RU")} ₽`;
}

export function formatToothNumbers(nums: number[]): string {
  if (!nums.length) return "";
  return nums.map((n) => `№${n}`).join(", ");
}

export async function refreshPatientVisitsCache(): Promise<void> {
  const { data, error } = await supabase
    .from("patient_visits")
    .select("*")
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[patientVisits]", error);
    return;
  }

  patientVisitsCache = ((data ?? []) as PatientVisitRow[]).map(rowToVisit);
  dispatchPatientVisitsUpdated();
}

export async function initPatientVisits(): Promise<void> {
  await refreshPatientVisitsCache();
}

export function getPatientVisits(): PatientVisit[] {
  const subjectId = getClientSubjectId();
  if (!subjectId || !patientVisitsCache) return [];
  return patientVisitsCache.filter(
    (v) => v.patientId === subjectId && v.visibleToPatient
  );
}

export function getPatientVisitsForTooth(toothNum: number): PatientVisit[] {
  return getPatientVisits().filter((v) => v.toothNumbers.includes(toothNum));
}

export async function fetchPatientVisitsForPatient(
  patientId: string,
  staffView = false
): Promise<PatientVisit[]> {
  const { data, error } = await supabase
    .from("patient_visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[patientVisits] fetchForPatient", error);
    return [];
  }

  const fetched = ((data ?? []) as PatientVisitRow[]).map(rowToVisit);
  const rest = (patientVisitsCache ?? []).filter((v) => v.patientId !== patientId);
  patientVisitsCache = [...rest, ...fetched];

  if (staffView) return fetched;
  return fetched.filter((v) => v.visibleToPatient);
}

export interface CreatePatientVisitInput {
  patientId: string;
  visitDate: string;
  procedureTitle: string;
  procedureDescription?: string;
  toothNumbers?: number[];
  diagnosis?: string;
  clinicalNotes?: string;
  materials?: string;
  price?: number | null;
  appointmentId?: string;
  visibleToPatient?: boolean;
}

export async function createPatientVisit(
  input: CreatePatientVisitInput
): Promise<PatientVisit | null> {
  const session = getDentalSession();
  const doctorId =
    session && (session.role === "doctor" || session.role === "admin")
      ? session.id
      : null;

  const { data, error } = await supabase
    .from("patient_visits")
    .insert([
      {
        patient_id: input.patientId,
        doctor_id: doctorId,
        appointment_id: input.appointmentId ?? null,
        visit_date: input.visitDate,
        procedure_title: input.procedureTitle.trim(),
        procedure_description: input.procedureDescription?.trim() ?? "",
        tooth_numbers: input.toothNumbers ?? [],
        diagnosis: input.diagnosis?.trim() ?? "",
        clinical_notes: input.clinicalNotes?.trim() ?? "",
        materials: input.materials?.trim() ?? "",
        price: input.price ?? null,
        visible_to_patient: input.visibleToPatient ?? true,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("[patientVisits] create", error);
    return null;
  }

  await refreshPatientVisitsCache();
  return rowToVisit(data as PatientVisitRow);
}

export function parseToothNumbersInput(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.replace(/\D/g, ""), 10))
    .filter((n) => n >= 11 && n <= 48);
}
