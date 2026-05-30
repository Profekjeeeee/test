import "server-only";

import { apiError } from "@/lib/server/api/apiError";
import {
  loadClient,
  loadEmployee,
  requireActor,
  safeDentalScalarId,
  isSafeUuid,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";
import { normalizePhone } from "@/lib/phone";

export async function selectClientByPatientUuid(ctx: DentalServiceContext, uuid: string) {
  const act = requireActor(ctx.actor);
  if (!isSafeUuid(uuid)) apiError(400, "UUID.");

  if (act.role === "client") {
    const me = await loadClient(ctx.adm, act, ctx.gate);
    if (String(me.id ?? "") !== uuid) apiError(403, "Не ваш профиль.");
  } else {
    await loadEmployee(ctx.adm, act, ctx.gate);
  }

  const { data, error } = await ctx.adm.from("dental_clients").select("*").eq("id", uuid).maybeSingle();
  if (error) throw error;
  return { row: data };
}

export async function updateClientFormulaTeeth(
  ctx: DentalServiceContext,
  clientId: string,
  teeth: unknown,
) {
  await loadEmployee(ctx.adm, requireActor(ctx.actor), ctx.gate);
  const cid = safeDentalScalarId(clientId.trim(), "patient");
  if (!Array.isArray(teeth)) apiError(400, "formula");

  const jsonPayload = JSON.parse(JSON.stringify(teeth));
  const { error: uErr } = await ctx.adm
    .from("dental_clients")
    .update({ formula_teeth: jsonPayload } as never)
    .eq("id", cid);
  const m = String(uErr?.message ?? "");
  if (uErr?.code === "42703" || m.includes("formula_teeth")) {
    return { ok: true as const, schemaMissing: true as const };
  }
  if (uErr) throw uErr;
  return { ok: true as const };
}

export async function updateClientInternalNotes(
  ctx: DentalServiceContext,
  clientId: string,
  internalNotes: string,
) {
  await loadEmployee(ctx.adm, requireActor(ctx.actor), ctx.gate);
  const cid = safeDentalScalarId(clientId.trim(), "patient");

  const { error: uErr } = await ctx.adm
    .from("dental_clients")
    .update({ internal_notes: internalNotes } as never)
    .eq("id", cid);

  const m = String(uErr?.message ?? "");
  if (uErr?.code === "42703" || m.includes("internal_notes")) {
    return { ok: true as const, schemaMissing: true as const };
  }
  if (uErr) throw uErr;

  return { ok: true as const };
}

export async function updateClientPersonalProfile(
  ctx: DentalServiceContext,
  payload: Record<string, unknown>,
) {
  const act = requireActor(ctx.actor);
  if (act.role !== "client") apiError(403, "Только аккаунт пациента.");
  await loadClient(ctx.adm, act, ctx.gate);

  const clientId =
    typeof payload.clientId === "string"
      ? safeDentalScalarId(payload.clientId.trim(), "patient")
      : apiError(400, "clientId");
  if (clientId !== act.id) apiError(403, "Несовпадение профиля.");

  const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
  const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const phoneDigitsRaw = typeof payload.phoneDigits === "string" ? payload.phoneDigits : "";
  const phone = normalizePhone(phoneDigitsRaw);
  if (phone.length < 10) apiError(400, "Телефон.");
  const name = `${firstName} ${lastName}`.trim();

  const { error: uErr } = await ctx.adm
    .from("dental_clients")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
      phone,
      name: name || null,
    } as never)
    .eq("id", clientId);

  if (uErr) throw uErr;

  return { ok: true as const };
}

export async function fetchClientById(ctx: DentalServiceContext, clientId: string) {
  const act = requireActor(ctx.actor);
  const cid = safeDentalScalarId(clientId.trim(), "patient");

  if (act.role === "client") {
    const me = await loadClient(ctx.adm, act, ctx.gate);
    if (String(me.id ?? "") !== cid) apiError(403, "Не ваш профиль.");
  } else {
    await loadEmployee(ctx.adm, act, ctx.gate);
  }

  const { data, error } = await ctx.adm.from("dental_clients").select("*").eq("id", cid).maybeSingle();
  if (error) throw error;
  if (!data) apiError(404, "Пациент не найден.");
  return { row: data };
}
