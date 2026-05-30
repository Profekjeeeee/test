import "server-only";

import { apiError } from "@/lib/server/api/apiError";
import {
  assertAppointmentAccessOrThrow,
  loadClient,
  loadEmployee,
  requireActor,
  safeDentalScalarId,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";

export type VideoConsultationStatus = "waiting" | "active" | "ended" | "cancelled";

export interface VideoConsultationRow {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string | null;
  status: VideoConsultationStatus;
  room_token: string;
  started_at: string | null;
  ended_at: string | null;
  shared_file_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface AppointmentJoinRow {
  id: string;
  client_id: string | null;
  doctor_id: string | null;
  visit_mode: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  clinic_id: string;
}

const JOIN_WINDOW_BEFORE_MIN = 15;
const JOIN_WINDOW_AFTER_MIN = 120;

function parseAppointmentDateTime(date: string, time: string): Date | null {
  const t = time.trim();
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = parseInt(match[1]!, 10);
  const mm = parseInt(match[2]!, 10);
  const parts = date.split("-").map((x) => parseInt(x, 10));
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hh, mm, 0, 0);
}

export function isWithinConsultationWindow(apt: AppointmentJoinRow, now = new Date()): boolean {
  const start = parseAppointmentDateTime(apt.appointment_date, apt.appointment_time);
  if (!start) return true;
  const ms = now.getTime() - start.getTime();
  return ms >= -JOIN_WINDOW_BEFORE_MIN * 60_000 && ms <= JOIN_WINDOW_AFTER_MIN * 60_000;
}

async function loadAppointmentOrThrow(
  ctx: DentalServiceContext,
  appointmentId: string,
): Promise<AppointmentJoinRow> {
  const id = safeDentalScalarId(appointmentId, "appointment");
  await assertAppointmentAccessOrThrow(ctx, id);

  const { data, error } = await ctx.adm
    .from("appointments")
    .select("id, client_id, doctor_id, visit_mode, appointment_date, appointment_time, status, clinic_id")
    .eq("id", id)
    .maybeSingle();

  if (error) apiError(500, error.message);
  if (!data) apiError(404, "Запись не найдена.");

  const apt = data as AppointmentJoinRow;
  if (apt.status === "cancelled") apiError(400, "Запись отменена.");
  if (apt.visit_mode !== "video") apiError(400, "Эта запись не является онлайн-консультацией.");
  if (!isWithinConsultationWindow(apt)) {
    apiError(400, "Консультация доступна за 15 мин до начала и в течение 2 ч после.");
  }
  return apt;
}

function rowToDto(row: VideoConsultationRow) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    appointmentId: String(row.appointment_id),
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    status: row.status,
    roomToken: row.room_token,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    sharedFileId: row.shared_file_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateConsultation(
  ctx: DentalServiceContext,
  appointmentId: string,
) {
  const act = requireActor(ctx.actor);
  const apt = await loadAppointmentOrThrow(ctx, appointmentId);

  const patientId = safeDentalScalarId(apt.client_id ?? "", "patient");

  if (act.role === "client") {
    const me = await loadClient(ctx.adm, act, ctx.gate);
    if (safeDentalScalarId(me.id ?? "", "patient") !== patientId) {
      apiError(403, "Не ваша запись.");
    }
  } else {
    await loadEmployee(ctx.adm, act, ctx.gate);
  }

  const { data: existing, error: findErr } = await ctx.adm
    .from("video_consultations")
    .select("*")
    .eq("appointment_id", apt.id)
    .maybeSingle();

  if (findErr) apiError(500, findErr.message);

  if (existing) {
    return { consultation: rowToDto(existing as VideoConsultationRow) };
  }

  const doctorId =
    act.role === "doctor" ? act.id : apt.doctor_id ? String(apt.doctor_id) : null;

  const { data: created, error: insErr } = await ctx.adm
    .from("video_consultations")
    .insert([
      {
        appointment_id: apt.id,
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: apt.clinic_id,
        status: "waiting",
      },
    ] as never)
    .select("*")
    .single();

  if (insErr) apiError(500, insErr.message);
  return { consultation: rowToDto(created as VideoConsultationRow) };
}

export async function getConsultationByAppointment(
  ctx: DentalServiceContext,
  appointmentId: string,
) {
  const id = safeDentalScalarId(appointmentId, "appointment");
  await assertAppointmentAccessOrThrow(ctx, id);

  const { data, error } = await ctx.adm
    .from("video_consultations")
    .select("*")
    .eq("appointment_id", id)
    .maybeSingle();

  if (error) apiError(500, error.message);
  if (!data) return { consultation: null };
  return { consultation: rowToDto(data as VideoConsultationRow) };
}

export async function updateConsultationStatus(
  ctx: DentalServiceContext,
  consultationId: string,
  status: VideoConsultationStatus,
  extra?: { sharedFileId?: string },
) {
  requireActor(ctx.actor);
  const cid = safeDentalScalarId(consultationId, "consultation");

  const { data: row, error: findErr } = await ctx.adm
    .from("video_consultations")
    .select("*")
    .eq("id", cid)
    .maybeSingle();

  if (findErr) apiError(500, findErr.message);
  if (!row) apiError(404, "Консультация не найдена.");

  await assertAppointmentAccessOrThrow(ctx, String((row as VideoConsultationRow).appointment_id));

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "active" && !(row as VideoConsultationRow).started_at) {
    patch.started_at = new Date().toISOString();
  }
  if (status === "ended" || status === "cancelled") {
    patch.ended_at = new Date().toISOString();
  }
  if (extra?.sharedFileId) {
    patch.shared_file_id = extra.sharedFileId;
  }

  const { data: updated, error } = await ctx.adm
    .from("video_consultations")
    .update(patch)
    .eq("id", cid)
    .select("*")
    .single();

  if (error) apiError(500, error.message);
  return { consultation: rowToDto(updated as VideoConsultationRow) };
}

export async function saveConsultationAnnotation(
  ctx: DentalServiceContext,
  consultationId: string,
  fileId: string,
  strokes: unknown[],
) {
  const act = requireActor(ctx.actor);
  const cid = safeDentalScalarId(consultationId, "consultation");
  const fid = safeDentalScalarId(fileId, "file");

  const { data: vc, error: vcErr } = await ctx.adm
    .from("video_consultations")
    .select("id, appointment_id, status")
    .eq("id", cid)
    .maybeSingle();

  if (vcErr) apiError(500, vcErr.message);
  if (!vc) apiError(404, "Консультация не найдена.");
  await assertAppointmentAccessOrThrow(ctx, String((vc as { appointment_id: string }).appointment_id));

  const authorRole =
    act.role === "client" ? "client" : act.role === "admin" ? "admin" : "doctor";

  const { data: existing } = await ctx.adm
    .from("consultation_annotations")
    .select("id")
    .eq("consultation_id", cid)
    .eq("file_id", fid)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await ctx.adm
      .from("consultation_annotations")
      .update({ strokes, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) apiError(500, error.message);
    return { annotation: data };
  }

  const { data, error } = await ctx.adm
    .from("consultation_annotations")
    .insert([
      {
        consultation_id: cid,
        file_id: fid,
        author_id: act.id,
        author_role: authorRole,
        strokes,
      },
    ] as never)
    .select("*")
    .single();

  if (error) apiError(500, error.message);
  return { annotation: data };
}

export async function getConsultationAnnotations(
  ctx: DentalServiceContext,
  consultationId: string,
) {
  const cid = safeDentalScalarId(consultationId, "consultation");

  const { data: vc, error: vcErr } = await ctx.adm
    .from("video_consultations")
    .select("appointment_id")
    .eq("id", cid)
    .maybeSingle();

  if (vcErr) apiError(500, vcErr.message);
  if (!vc) apiError(404, "Консультация не найдена.");
  await assertAppointmentAccessOrThrow(ctx, String((vc as { appointment_id: string }).appointment_id));

  const { data, error } = await ctx.adm
    .from("consultation_annotations")
    .select("*")
    .eq("consultation_id", cid);

  if (error) apiError(500, error.message);
  return { rows: data ?? [] };
}
