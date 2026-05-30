import "server-only";

import crypto from "crypto";

import { apiError } from "@/lib/server/api/apiError";
import {
  ensureShadowAuthForRow,
  loadClient,
  loadEmployee,
  requireActor,
  telegramMatchesRowTelegram,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";
import { isCompleteRuMobileDigits, normalizePhone, phoneDigitsSuffixPattern } from "@/lib/phone";

export async function authLookupEmployeeClient(ctx: DentalServiceContext, cleanPhone: string) {
  const digits = normalizePhone(cleanPhone);
  if (!isCompleteRuMobileDigits(digits)) apiError(400, "Телефон некорректен.");
  const pat = phoneDigitsSuffixPattern(digits);
  let employee = null as Record<string, unknown> | null;

  const { data: emp, error: eErr } = await ctx.adm
    .from("dental_employees")
    .select("*")
    .ilike("phone", pat)
    .limit(1)
    .maybeSingle();
  if (eErr) throw eErr;
  employee = emp as Record<string, unknown> | null;

  let client = null as Record<string, unknown> | null;
  if (!employee) {
    const { data: cli, error: cErr } = await ctx.adm
      .from("dental_clients")
      .select("*")
      .ilike("phone", pat)
      .limit(1)
      .maybeSingle();
    if (cErr) throw cErr;
    client = cli as Record<string, unknown> | null;
  }

  if (employee && !telegramMatchesRowTelegram(employee as { telegram_id?: unknown }, ctx.gate)) {
    employee = null;
  }
  if (client && !telegramMatchesRowTelegram(client as { telegram_id?: unknown }, ctx.gate)) {
    client = null;
  }
  return { employee, client };
}

export async function shadowEnsureActor(ctx: DentalServiceContext) {
  const act = requireActor(ctx.actor);
  if (act.role === "client") {
    await loadClient(ctx.adm, act, ctx.gate);
    return { auth_user_id: await ensureShadowAuthForRow("dental_clients", act.id) };
  }
  await loadEmployee(ctx.adm, act, ctx.gate);
  return { auth_user_id: await ensureShadowAuthForRow("dental_employees", act.id) };
}

export async function patchTelegramIdIfEmpty(
  ctx: DentalServiceContext,
  telegramIdRaw?: string,
) {
  const act = requireActor(ctx.actor);
  const tgDigits =
    typeof telegramIdRaw === "string" && telegramIdRaw.trim()
      ? telegramIdRaw.trim().replace(/\D/g, "")
      : ctx.gate.kind === "telegram"
        ? ctx.gate.telegramUserId.trim().replace(/\D/g, "")
        : "";

  const table = act.role === "client" ? "dental_clients" : "dental_employees";

  await (table === "dental_clients"
    ? loadClient(ctx.adm, act, ctx.gate)
    : loadEmployee(ctx.adm, act, ctx.gate));

  if (!tgDigits) apiError(400, "Нет telegram id.");

  const { error } = await ctx.adm
    .from(table)
    .update({ telegram_id: tgDigits })
    .eq("id", act.id)
    .is("telegram_id", null);

  if (error?.code === "42703" || String(error?.message ?? "").includes("telegram_id")) {
    return { ok: true as const };
  }
  if (error) throw error;

  void ensureShadowAuthForRow(
    table === "dental_clients" ? "dental_clients" : "dental_employees",
    act.id,
  );
  return { ok: true as const };
}

export async function registerClientGateway(
  ctx: DentalServiceContext,
  payload: Record<string, unknown>,
) {
  const cleanPhone = normalizePhone(typeof payload.phone === "string" ? payload.phone : "");
  if (cleanPhone.length < 10) apiError(400, "Телефон.");

  const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
  const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();

  const tgDigits =
    ctx.gate.kind === "telegram"
      ? ctx.gate.telegramUserId.replace(/\D/g, "")
      : typeof payload.telegramId === "string"
        ? payload.telegramId.replace(/\D/g, "")
        : "";

  const { data: ua, error: auErr } = await ctx.adm.auth.admin.createUser({
    email: `signup+client_${crypto.randomUUID()}@dental-miniapp.invalid`,
    password: crypto.randomBytes(44).toString("base64url"),
    email_confirm: true,
    user_metadata: { dental_register: "client", phone: cleanPhone },
  });
  if (auErr || !ua?.user?.id) apiError(500, auErr?.message ?? "auth.admin.createUser");

  const authId = ua.user!.id;

  const insertPayload: Record<string, unknown> = {
    id: authId,
    auth_user_id: authId,
    phone: cleanPhone,
    role: "client",
    first_name: firstName,
    last_name: lastName,
    name: fullName || null,
    email: email || null,
  };
  if (tgDigits.length > 5) insertPayload.telegram_id = tgDigits;

  let row = await ctx.adm.from("dental_clients").insert(insertPayload as never).select("*").single();
  const insErrMsg = row.error?.message ?? "";
  if (
    row.error &&
    (insErrMsg.includes("telegram_id") || row.error.code === "PGRST204" || row.error.code === "42703")
  ) {
    delete insertPayload.telegram_id;
    row = await ctx.adm.from("dental_clients").insert(insertPayload as never).select("*").single();
  }
  if (row.error) throw row.error;

  await ensureShadowAuthForRow("dental_clients", String((row.data as { id?: string }).id ?? authId)).catch(
    () => {},
  );
  return row.data;
}
