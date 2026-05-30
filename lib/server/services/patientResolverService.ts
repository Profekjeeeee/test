import "server-only";

import type { DentalGwActor } from "@/lib/dentalGwTypes";
import { apiError } from "@/lib/server/api/apiError";
import {
  loadClient,
  requireActor,
  safeDentalScalarId,
  telegramMatchesRowTelegram,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone, phoneDigitsSuffixPattern } from "@/lib/phone";
import type { DentalGateVerified } from "@/lib/server/dentalGateVerify";

export async function gatewayResolvePatientClientId(params: {
  adm: SupabaseClient;
  gate: DentalGateVerified;
  actor: DentalGwActor | null;
  uidHint?: string | null | undefined;
  explicitPhone?: string | null | undefined;
  enforceClientOwnership: boolean;
}): Promise<string> {
  const { adm, gate, actor, uidHint: uidHintRaw, explicitPhone: explicitRaw, enforceClientOwnership } = params;

  let uidPass = typeof uidHintRaw === "string" && uidHintRaw.trim().length ? uidHintRaw.trim() : null;

  if (
    enforceClientOwnership &&
    (!uidPass || !uidPass.length) &&
    actor?.role === "client" &&
    typeof actor?.id === "string"
  ) {
    uidPass = actor.id;
  }

  let explicitPhoneDigits: string | null = explicitRaw?.trim().length ? normalizePhone(explicitRaw) : null;
  const sessionPhoneDigits =
    typeof actor?.phone === "string" && actor.phone.trim() ? normalizePhone(actor.phone) : "";
  if ((!explicitPhoneDigits || explicitPhoneDigits.length < 10) && sessionPhoneDigits.length >= 10) {
    explicitPhoneDigits = sessionPhoneDigits;
  }

  if (uidPass) {
    uidPass = safeDentalScalarId(uidPass, "client");
    if (enforceClientOwnership && actor?.role === "client") {
      const actorRow = await loadClient(adm, requireActor(actor), gate);
      if (String(actorRow.id ?? "") !== uidPass) apiError(403, "Несогласованный профиль пациента.");
    }
    const { data, error } = await adm.from("dental_clients").select("*").eq("id", uidPass).maybeSingle();
    if (error) apiError(500, error.message);
    const picked = data as Record<string, unknown> | null;
    if (!picked?.id) apiError(404, "Пациент не найден.");
    if (!telegramMatchesRowTelegram(picked as { telegram_id?: unknown }, gate)) {
      apiError(403, "Профиль привязан к другому Telegram.");
    }
    return safeDentalScalarId(picked.id, "patient");
  }

  const digits = normalizePhone(explicitPhoneDigits ?? "");
  if (!digits || digits.length < 10) apiError(400, "Не удалось определить пациента по телефону.");

  {
    const { data, error } = await adm.from("dental_clients").select("*").eq("phone", digits).maybeSingle();
    if (error && error.code !== "PGRST116") apiError(500, error.message);
    const picked = data as Record<string, unknown> | null;
    if (picked?.id) {
      if (!telegramMatchesRowTelegram(picked as { telegram_id?: unknown }, gate)) apiError(403, "Привязка Telegram.");
      const id = safeDentalScalarId(picked.id, "patient");
      if (enforceClientOwnership && actor?.role === "client") {
        if (normalizePhone(actor.phone ?? "") !== normalizePhone(String(picked.phone ?? ""))) {
          apiError(403, "Не ваш профиль.");
        }
        if (actor.id.trim() !== id) apiError(403, "Клиент может записывать только со своего профиля.");
      }
      return id;
    }
  }

  const pat = phoneDigitsSuffixPattern(digits);
  const { data: bySx, error: sxErr } = await adm
    .from("dental_clients")
    .select("*")
    .ilike("phone", pat)
    .maybeSingle();

  if (sxErr && sxErr.code !== "PGRST116") apiError(500, sxErr.message);
  const sx = bySx as Record<string, unknown> | null;

  if (!sx?.id) {
    apiError(404, "Пациент не найден в базе (нужна регистрация).");
  }
  if (!telegramMatchesRowTelegram(sx as { telegram_id?: unknown }, gate)) apiError(403, "Привязка Telegram.");

  const id = safeDentalScalarId(sx.id, "patient");
  if (enforceClientOwnership && actor?.role === "client") {
    if (normalizePhone(actor.phone ?? "") !== normalizePhone(String(sx.phone ?? ""))) {
      apiError(403, "Не ваш профиль.");
    }
    if (actor.id.trim() !== id) apiError(403, "Клиент может записать только свой профиль.");
  }
  return id;
}

export async function resolveClientPkForAppointment(
  ctx: DentalServiceContext,
  payload: { uid?: string | null; explicitPhone?: string | null },
): Promise<{ clientId: string }> {
  const clientId = await gatewayResolvePatientClientId({
    adm: ctx.adm,
    gate: ctx.gate,
    actor: ctx.actor,
    uidHint: payload.uid ?? null,
    explicitPhone: payload.explicitPhone ?? null,
    enforceClientOwnership: ctx.actor?.role === "client",
  });
  return { clientId };
}
