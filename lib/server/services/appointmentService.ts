import "server-only";

import { apiError } from "@/lib/server/api/apiError";
import {
  assertAppointmentAccessOrThrow,
  isoDateLocal,
  loadClient,
  loadEmployee,
  requireActor,
  safeDentalScalarId,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";
import { gatewayResolvePatientClientId } from "@/lib/server/services/patientResolverService";

export async function listAppointments(ctx: DentalServiceContext) {
  const { adm, gate, actor } = ctx;

  if (!actor?.id) {
    const { data, error } = await adm
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    if (error) throw error;
    return { rows: data ?? [] };
  }

  if (actor.role === "doctor" || actor.role === "admin") {
    await loadEmployee(adm, actor, gate);
    const { data, error } = await adm
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    if (error) throw error;
    return { rows: data ?? [] };
  }

  const c = await loadClient(adm, actor, gate);
  const cid = safeDentalScalarId(c.id ?? "", "patient");
  const { data, error } = await adm
    .from("appointments")
    .select("*")
    .eq("client_id", cid)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });
  if (error) throw error;
  return { rows: data ?? [] };
}

export async function insertAppointment(
  ctx: DentalServiceContext,
  payload: Record<string, unknown>,
) {
  const act = requireActor(ctx.actor);
  if (act.role !== "client") apiError(403, "Запись на приём — только аккаунт пациента.");
  await loadClient(ctx.adm, act, ctx.gate);

  const monthNum = typeof payload.monthNum === "number" ? payload.monthNum : Number(payload.monthNum);
  const day = typeof payload.day === "number" ? payload.day : Number(payload.day);
  const year = typeof payload.year === "number" ? payload.year : Number(payload.year);
  const timeSlot = typeof payload.time === "string" ? payload.time : "";
  const doctorNameRaw = typeof payload.doctorName === "string" ? payload.doctorName : "";
  const status = typeof payload.status === "string" ? payload.status : "pending";
  const visitMode =
    payload.visitMode === "video" ? "video" : "in_person";
  const serviceTitle =
    typeof payload.service === "string" ? payload.service.trim() : "";
  const clientPhoneExplicit = typeof payload.clientPhone === "string" ? payload.clientPhone : null;

  const clientId = await gatewayResolvePatientClientId({
    adm: ctx.adm,
    gate: ctx.gate,
    actor: act,
    uidHint: act.id,
    explicitPhone: clientPhoneExplicit ?? act.phone ?? null,
    enforceClientOwnership: true,
  });

  const doctorNameTrim = doctorNameRaw.trim();

  const { data, error } = await ctx.adm
    .from("appointments")
    .insert([
      {
        client_id: clientId,
        doctor_name: doctorNameTrim || "Врач",
        appointment_date: isoDateLocal(year, monthNum, day),
        appointment_time: timeSlot,
        status,
        visit_mode: visitMode,
        ...(serviceTitle ? { service: serviceTitle } : {}),
      } as Record<string, unknown>,
    ] as never)
    .select("*")
    .single();

  if (error) throw error;
  return { row: data };
}

export async function cancelAppointment(ctx: DentalServiceContext, appointmentId: string) {
  const id = safeDentalScalarId(appointmentId, "appointment");
  await assertAppointmentAccessOrThrow(ctx, id);
  const { error } = await ctx.adm.from("appointments").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
  return { ok: true as const };
}

export async function rescheduleAppointment(
  ctx: DentalServiceContext,
  appointmentId: string,
  updates: Record<string, unknown>,
) {
  const id = safeDentalScalarId(appointmentId, "appointment");
  await assertAppointmentAccessOrThrow(ctx, id);
  const day = typeof updates.day === "number" ? updates.day : Number(updates.day);
  const monthNum = typeof updates.monthNum === "number" ? updates.monthNum : Number(updates.monthNum);
  const year = typeof updates.year === "number" ? updates.year : Number(updates.year);
  const slot = typeof updates.time === "string" ? updates.time : "";

  const { error } = await ctx.adm
    .from("appointments")
    .update({
      appointment_date: isoDateLocal(year, monthNum, day),
      appointment_time: slot,
      status: "scheduled",
    })
    .eq("id", id);
  if (error) throw error;
  return { ok: true as const };
}
