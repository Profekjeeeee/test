import { getCurrentUserId, getDentalSession } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export type MedicalRecordType =
  | "allergy"
  | "chronic"
  | "medication"
  | "contraindication"
  | "general";

export type MedicalRecordSeverity = "low" | "medium" | "high";

export interface MedicalRecord {
  id: string;
  patientId: string;
  recordType: MedicalRecordType;
  title: string;
  description: string;
  severity?: MedicalRecordSeverity;
  isActive: boolean;
  visibleToPatient: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface MedicalRecordRow {
  id: string;
  patient_id: string;
  record_type: string;
  title: string;
  description: string;
  severity: string | null;
  is_active: boolean;
  visible_to_patient: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const RECORD_TYPE_LABELS: Record<MedicalRecordType, string> = {
  allergy: "Аллергия",
  chronic: "Хроническое",
  medication: "Препарат",
  contraindication: "Противопоказание",
  general: "Общее",
};

export const SEVERITY_LABELS: Record<MedicalRecordSeverity, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
};

function rowToRecord(row: MedicalRecordRow): MedicalRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    recordType: row.record_type as MedicalRecordType,
    title: row.title,
    description: row.description,
    severity: (row.severity as MedicalRecordSeverity) ?? undefined,
    isActive: row.is_active,
    visibleToPatient: row.visible_to_patient,
    createdBy: row.created_by ?? undefined,
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

function dispatchMedicalRecordsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("medicalRecordsUpdated"));
}

let medicalRecordsCache: MedicalRecord[] | null = null;

export async function refreshMedicalRecordsCache(): Promise<void> {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[medicalRecords]", error);
    return;
  }

  medicalRecordsCache = ((data ?? []) as MedicalRecordRow[]).map(rowToRecord);
  dispatchMedicalRecordsUpdated();
}

export async function initMedicalRecords(): Promise<void> {
  await refreshMedicalRecordsCache();
}

export function getMedicalRecords(): MedicalRecord[] {
  const subjectId = getClientSubjectId();
  if (!subjectId || !medicalRecordsCache) return [];
  return medicalRecordsCache.filter(
    (r) => r.patientId === subjectId && r.isActive && r.visibleToPatient
  );
}

export async function fetchMedicalRecordsForPatient(
  patientId: string,
  staffView = false
): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[medicalRecords] fetchForPatient", error);
    return [];
  }

  const fetched = ((data ?? []) as MedicalRecordRow[]).map(rowToRecord);
  const rest = (medicalRecordsCache ?? []).filter((r) => r.patientId !== patientId);
  medicalRecordsCache = [...rest, ...fetched];

  if (staffView) return fetched.filter((r) => r.isActive);
  return fetched.filter((r) => r.isActive && r.visibleToPatient);
}

export interface CreateMedicalRecordInput {
  patientId: string;
  recordType: MedicalRecordType;
  title: string;
  description?: string;
  severity?: MedicalRecordSeverity;
  visibleToPatient?: boolean;
}

export async function createMedicalRecord(
  input: CreateMedicalRecordInput
): Promise<MedicalRecord | null> {
  const session = getDentalSession();
  const createdBy =
    session && (session.role === "doctor" || session.role === "admin")
      ? session.id
      : null;

  const { data, error } = await supabase
    .from("medical_records")
    .insert([
      {
        patient_id: input.patientId,
        record_type: input.recordType,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        severity: input.severity ?? null,
        visible_to_patient: input.visibleToPatient ?? true,
        created_by: createdBy,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("[medicalRecords] create", error);
    return null;
  }

  await refreshMedicalRecordsCache();
  return rowToRecord(data as MedicalRecordRow);
}

export async function deactivateMedicalRecord(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("medical_records")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("[medicalRecords] deactivate", error);
    return false;
  }

  await refreshMedicalRecordsCache();
  return true;
}
