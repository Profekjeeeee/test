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
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** PostgREST/Postgres-код «колонка не найдена» (схема ещё без миграции 013). */
function isMissingColumnError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = (e?.message ?? "").toLowerCase();
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("could not find") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

function buildPatientName(clientRow: Record<string, unknown>): string {
  const name = String(clientRow.name ?? "").trim();
  if (name) return name;
  const first = String(clientRow.first_name ?? "").trim();
  const last = String(clientRow.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return String(clientRow.phone ?? "").trim();
}

/** Счёт к записи — только service role; у клиента RLS на INSERT в bills закрыт (010). */
async function createPendingBillForAppointment(
  adm: SupabaseClient,
  params: {
    appointmentId: string | number;
    patientId: string;
    serviceName: string;
    price: number;
    clinicId?: string | null;
  },
): Promise<void> {
  if (!params.serviceName || params.price <= 0) return;

  const aptIdRaw = params.appointmentId;
  const aptId =
    typeof aptIdRaw === "number"
      ? aptIdRaw
      : Number.isFinite(Number(aptIdRaw))
        ? Number(aptIdRaw)
        : aptIdRaw;

  const { data: existing } = await adm
    .from("bills")
    .select("id")
    .eq("appointment_id", aptId)
    .in("status", ["pending", "overdue"])
    .maybeSingle();
  if (existing?.id) return;

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 14);
  const year = now.getFullYear();
  const aptSuffix = String(aptId).replace(/\D/g, "").slice(-4).padStart(4, "0");
  const billNumber = `№ ${year}-${aptSuffix}`;
  const dateIso = now.toISOString().split("T")[0];

  const row: Record<string, unknown> = {
    patient_id: params.patientId,
    appointment_id: aptId,
    amount: params.price,
    paid_amount: 0,
    status: "pending",
    description: params.serviceName,
    bill_number: billNumber,
    due_date: dueDate.toISOString().split("T")[0],
    metadata: {
      items: [
        {
          id: `item-apt-${aptId}`,
          service: params.serviceName,
          quantity: 1,
          unitPrice: params.price,
          total: params.price,
          date: dateIso,
        },
      ],
      can_pay_online: true,
    },
    ...(params.clinicId ? { clinic_id: params.clinicId } : {}),
  };

  const { error } = await adm.from("bills").insert([row] as never);
  if (error) {
    console.error("[appointments] create bill:", error);
  }
}

export async function insertAppointment(
  ctx: DentalServiceContext,
  payload: Record<string, unknown>,
) {
  const act = requireActor(ctx.actor);
  if (act.role !== "client") apiError(403, "Запись на приём — только аккаунт пациента.");
  const clientRow = await loadClient(ctx.adm, act, ctx.gate);

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
  const priceRaw = payload.price;
  const priceNum =
    typeof priceRaw === "number" && Number.isFinite(priceRaw)
      ? priceRaw
      : typeof priceRaw === "string" && priceRaw.trim() !== "" && Number.isFinite(Number(priceRaw))
        ? Number(priceRaw)
        : null;
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
  const patientName = buildPatientName(clientRow);

  // Лучшее усилие: связать с прайсом для аналитики, если название совпадает.
  let serviceId: string | null = null;
  if (serviceTitle) {
    const { data: svc } = await ctx.adm
      .from("services")
      .select("id")
      .eq("name", serviceTitle)
      .maybeSingle();
    serviceId = (svc as { id?: string } | null)?.id ?? null;
  }

  // Колонки, гарантированно существующие в каноничной схеме (001/005/010/011).
  const baseRow: Record<string, unknown> = {
    client_id: clientId,
    doctor_name: doctorNameTrim || "Врач",
    appointment_date: isoDateLocal(year, monthNum, day),
    appointment_time: timeSlot,
    status,
    visit_mode: visitMode,
    ...(patientName ? { patient_name: patientName } : {}),
    ...(serviceId ? { service_id: serviceId } : {}),
  };

  // Поля из миграции 013 (service/price). Если миграция ещё не применена —
  // повторяем вставку без них, чтобы запись всё равно создалась.
  const richRow: Record<string, unknown> = {
    ...baseRow,
    ...(serviceTitle ? { service: serviceTitle } : {}),
    ...(priceNum != null ? { price: priceNum } : {}),
  };

  let { data, error } = await ctx.adm
    .from("appointments")
    .insert([richRow] as never)
    .select("*")
    .single();

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await ctx.adm
      .from("appointments")
      .insert([baseRow] as never)
      .select("*")
      .single());
  }

  if (error) throw error;

  const inserted = data as Record<string, unknown>;
  const clinicId =
    typeof clientRow.clinic_id === "string" ? clientRow.clinic_id : null;

  if (priceNum != null && priceNum > 0 && serviceTitle && inserted?.id != null) {
    await createPendingBillForAppointment(ctx.adm, {
      appointmentId: inserted.id as string | number,
      patientId: clientId,
      serviceName: serviceTitle,
      price: priceNum,
      clinicId,
    });
  }

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
