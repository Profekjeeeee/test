import { dentalApiFetch } from "@/lib/api/fetchApi";
import { getDentalSession } from "@/lib/auth";
import type { SignalingRole } from "@/lib/webrtc/consultationPeer";

export type VisitMode = "in_person" | "video";

export type VideoConsultationStatus = "waiting" | "active" | "ended" | "cancelled";

export interface VideoConsultation {
  id: string;
  clinicId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string | null;
  status: VideoConsultationStatus;
  roomToken: string;
  startedAt: string | null;
  endedAt: string | null;
  sharedFileId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationStroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export function resolveSignalingRole(): SignalingRole {
  const session = getDentalSession();
  return session?.role === "doctor" || session?.role === "admin" ? "doctor" : "patient";
}

export async function joinConsultation(appointmentId: string): Promise<VideoConsultation> {
  const { consultation } = await dentalApiFetch<{ consultation: VideoConsultation }>(
    "/api/consultations",
    { method: "POST", body: { appointmentId } },
  );
  return consultation;
}

export async function fetchConsultationByAppointment(
  appointmentId: string,
): Promise<VideoConsultation | null> {
  const { consultation } = await dentalApiFetch<{ consultation: VideoConsultation | null }>(
    `/api/consultations?appointmentId=${encodeURIComponent(appointmentId)}`,
    { method: "GET" },
  );
  return consultation;
}

export async function updateConsultationStatus(
  consultationId: string,
  status: VideoConsultationStatus,
  sharedFileId?: string,
): Promise<VideoConsultation> {
  const { consultation } = await dentalApiFetch<{ consultation: VideoConsultation }>(
    `/api/consultations/${encodeURIComponent(consultationId)}`,
    {
      method: "PATCH",
      body: { status, ...(sharedFileId ? { sharedFileId } : {}) },
    },
  );
  return consultation;
}

export async function saveXrayAnnotations(
  consultationId: string,
  fileId: string,
  strokes: AnnotationStroke[],
): Promise<void> {
  await dentalApiFetch(`/api/consultations/${encodeURIComponent(consultationId)}`, {
    method: "POST",
    body: { fileId, strokes },
  });
}

export async function fetchXrayAnnotations(
  consultationId: string,
): Promise<Array<{ file_id: string; strokes: AnnotationStroke[] }>> {
  const { rows } = await dentalApiFetch<{
    rows: Array<{ file_id: string; strokes: AnnotationStroke[] }>;
  }>(`/api/consultations/${encodeURIComponent(consultationId)}?annotations=1`, {
    method: "GET",
  });
  return rows ?? [];
}

/** Окно входа: за 15 мин до и 2 ч после слота. */
export function canJoinVideoWindow(
  apt: { day: number; monthNum: number; year: number; time: string },
  now = new Date(),
): boolean {
  const match = apt.time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return true;
  const hh = parseInt(match[1]!, 10);
  const mm = parseInt(match[2]!, 10);
  const start = new Date(apt.year, apt.monthNum - 1, apt.day, hh, mm, 0, 0);
  const diff = now.getTime() - start.getTime();
  return diff >= -15 * 60_000 && diff <= 120 * 60_000;
}

export const VISIT_MODE_LABELS: Record<VisitMode, string> = {
  in_person: "Очный приём",
  video: "Онлайн-консультация",
};
