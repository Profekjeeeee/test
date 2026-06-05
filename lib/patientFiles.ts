import { getDentalSession, getCurrentUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export const PATIENT_FILES_BUCKET = "patient-files";

export const ALLOWED_FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export type PatientFileMimeType = (typeof ALLOWED_FILE_MIME_TYPES)[number];

export type PatientFileCategory = "xray" | "photo" | "document" | "scan" | "other";

export interface PatientFile {
  id: string;
  patientId: string;
  storagePath: string;
  fileName: string;
  mimeType: PatientFileMimeType;
  fileCategory: PatientFileCategory;
  fileSize: number;
  visitId?: string;
  appointmentId?: string;
  description: string;
  visibleToPatient: boolean;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string;
}

interface PatientFileRow {
  id: string;
  patient_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_category: string;
  file_size: number | string;
  visit_id: string | null;
  appointment_id: string | null;
  description: string;
  visible_to_patient: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export const FILE_CATEGORY_LABELS: Record<PatientFileCategory, string> = {
  xray: "Рентген / снимок",
  photo: "Фото",
  document: "Документ",
  scan: "Скан",
  other: "Прочее",
};

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SIGNED_URL_TTL_SEC = 3600;

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function rowToFile(row: PatientFileRow): PatientFile {
  return {
    id: row.id,
    patientId: row.patient_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type as PatientFileMimeType,
    fileCategory: row.file_category as PatientFileCategory,
    fileSize: Number(row.file_size),
    visitId: row.visit_id ?? undefined,
    appointmentId: row.appointment_id != null ? String(row.appointment_id) : undefined,
    description: row.description,
    visibleToPatient: row.visible_to_patient,
    uploadedBy: row.uploaded_by ?? undefined,
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

function dispatchPatientFilesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("patientFilesUpdated"));
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "file";
  return base.slice(0, 120);
}

function buildStoragePath(patientId: string, uploadKey: string, fileName: string): string {
  return `${patientId}/${uploadKey}/${sanitizeFileName(fileName)}`;
}

export function formatFileDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function inferCategoryFromMime(mime: string): PatientFileCategory {
  if (mime === "application/pdf") return "document";
  if (mime.startsWith("image/")) return "xray";
  return "other";
}

export function validatePatientFile(file: File): string | null {
  if (!ALLOWED_FILE_MIME_TYPES.includes(file.type as PatientFileMimeType)) {
    return "Допустимы только JPG, PNG и PDF.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Размер файла не более 10 МБ.";
  }
  if (file.size <= 0) {
    return "Файл пустой.";
  }
  return null;
}

async function attachSignedUrls(files: PatientFile[]): Promise<PatientFile[]> {
  if (files.length === 0) return [];

  const withUrls = await Promise.all(
    files.map(async (f) => {
      const { data, error } = await supabase.storage
        .from(PATIENT_FILES_BUCKET)
        .createSignedUrl(f.storagePath, SIGNED_URL_TTL_SEC);

      if (error || !data?.signedUrl) {
        console.error("[patientFiles] signedUrl", error);
        return f;
      }
      return { ...f, signedUrl: data.signedUrl };
    })
  );

  return withUrls;
}

let patientFilesCache: PatientFile[] | null = null;

export interface RefreshPatientFilesOptions {
  /** Подписанные URL нужны только на экране документов — дорогая операция. */
  withSignedUrls?: boolean;
}

export async function refreshPatientFilesCache(
  options?: RefreshPatientFilesOptions,
): Promise<void> {
  const subjectId = getClientSubjectId();
  let query = supabase.from("patient_files").select("*");
  if (subjectId) {
    query = query.eq("patient_id", subjectId).eq("visible_to_patient", true);
  }
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[patientFiles]", error);
    return;
  }

  const rows = ((data ?? []) as PatientFileRow[]).map(rowToFile);
  patientFilesCache =
    options?.withSignedUrls === true ? await attachSignedUrls(rows) : rows;
  dispatchPatientFilesUpdated();
}

/** Быстрый кэш метаданных без signed URL — для кабинета и списков. */
export async function initPatientFiles(): Promise<void> {
  await refreshPatientFilesCache({ withSignedUrls: false });
}

/** Полный кэш с signed URL — для экрана документов. */
export async function initPatientFilesForViewer(): Promise<void> {
  await refreshPatientFilesCache({ withSignedUrls: true });
}

export function getPatientFiles(): PatientFile[] {
  const subjectId = getClientSubjectId();
  if (!subjectId || !patientFilesCache) return [];
  return patientFilesCache.filter(
    (f) => f.patientId === subjectId && f.visibleToPatient
  );
}

export async function fetchPatientFilesForPatient(
  patientId: string,
  staffView = false
): Promise<PatientFile[]> {
  const { data, error } = await supabase
    .from("patient_files")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[patientFiles] fetchForPatient", error);
    return [];
  }

  const fetched = ((data ?? []) as PatientFileRow[]).map(rowToFile);
  const visible = staffView ? fetched : fetched.filter((f) => f.visibleToPatient);
  const withUrls = await attachSignedUrls(visible);

  const rest = (patientFilesCache ?? []).filter((f) => f.patientId !== patientId);
  patientFilesCache = [...rest, ...withUrls];

  return withUrls;
}

export interface UploadPatientFileInput {
  patientId: string;
  file: File;
  fileCategory?: PatientFileCategory;
  description?: string;
  visitId?: string;
  appointmentId?: string;
  visibleToPatient?: boolean;
}

export async function uploadPatientFile(
  input: UploadPatientFileInput
): Promise<PatientFile | null> {
  const validationError = validatePatientFile(input.file);
  if (validationError) {
    console.error("[patientFiles] validate", validationError);
    return null;
  }

  const session = getDentalSession();
  const uploadedBy =
    session && (session.role === "doctor" || session.role === "admin")
      ? session.id
      : null;

  const uploadKey =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const storagePath = buildStoragePath(
    input.patientId,
    uploadKey,
    input.file.name
  );

  const { error: uploadError } = await supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[patientFiles] upload", uploadError);
    return null;
  }

  const { data, error } = await supabase
    .from("patient_files")
    .insert([
      {
        patient_id: input.patientId,
        storage_path: storagePath,
        file_name: input.file.name,
        mime_type: input.file.type,
        file_category: input.fileCategory ?? inferCategoryFromMime(input.file.type),
        file_size: input.file.size,
        visit_id: input.visitId ?? null,
        appointment_id: input.appointmentId ?? null,
        description: input.description?.trim() ?? "",
        visible_to_patient: input.visibleToPatient ?? true,
        uploaded_by: uploadedBy,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("[patientFiles] insert", error);
    await supabase.storage.from(PATIENT_FILES_BUCKET).remove([storagePath]);
    return null;
  }

  await refreshPatientFilesCache();
  const created = rowToFile(data as PatientFileRow);
  const [withUrl] = await attachSignedUrls([created]);
  return withUrl ?? created;
}

export async function deletePatientFile(id: string): Promise<boolean> {
  const cached = (patientFilesCache ?? []).find((f) => f.id === id);
  let storagePath = cached?.storagePath;

  if (!storagePath) {
    const { data } = await supabase
      .from("patient_files")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    storagePath = (data as { storage_path?: string } | null)?.storage_path;
  }

  const { error: dbError } = await supabase.from("patient_files").delete().eq("id", id);
  if (dbError) {
    console.error("[patientFiles] delete", dbError);
    return false;
  }

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(PATIENT_FILES_BUCKET)
      .remove([storagePath]);
    if (storageError) {
      console.error("[patientFiles] storage remove", storageError);
    }
  }

  await refreshPatientFilesCache();
  return true;
}

export async function updatePatientFileVisibility(
  id: string,
  visibleToPatient: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("patient_files")
    .update({ visible_to_patient: visibleToPatient })
    .eq("id", id);

  if (error) {
    console.error("[patientFiles] visibility", error);
    return false;
  }

  await refreshPatientFilesCache();
  return true;
}
