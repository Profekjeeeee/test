import { NextResponse } from "next/server";

import { profileHasPinHash } from "@/lib/server/authProfilePin";
import { clientRowToPayload } from "@/lib/server/authSessionPayload";
import { issueSupabaseSessionForUserId } from "@/lib/server/issueSupabaseSession";
import { verifyDentalGateRequest } from "@/lib/server/dentalGateVerify";
import { isCompleteRuMobileDigits, normalizePhone } from "@/lib/phone";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import { isSupabaseConfigured } from "@/lib/supabase/publicConfig";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен." }, { status: 503 });
  }

  let body: {
    phone?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    initData?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON." }, { status: 400 });
  }

  const cleanPhone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  if (!isCompleteRuMobileDigits(cleanPhone)) {
    return NextResponse.json({ ok: false, error: "Некорректный телефон." }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();

  const initData = typeof body.initData === "string" ? body.initData : "";
  let tgDigits = "";
  try {
    const gate = verifyDentalGateRequest(initData || undefined);
    if (gate.kind === "telegram") {
      tgDigits = gate.telegramUserId.replace(/\D/g, "");
    }
  } catch {
    /* регистрация вне Telegram — без telegram_id */
  }

  try {
    const adm = getSupabaseServiceRole();

    const { data: ua, error: auErr } = await adm.auth.admin.createUser({
      email: `signup+client_${crypto.randomUUID()}@dental-miniapp.invalid`,
      password: crypto.randomBytes(44).toString("base64url"),
      email_confirm: true,
      user_metadata: { dental_register: "client", phone: cleanPhone },
    });
    if (auErr || !ua?.user?.id) {
      return NextResponse.json(
        { ok: false, error: auErr?.message ?? "Не удалось создать Auth-пользователя." },
        { status: 500 },
      );
    }

    const authId = ua.user.id;
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

    let row = await adm.from("dental_clients").insert(insertPayload as never).select("*").single();
    const insErrMsg = row.error?.message ?? "";
    if (
      row.error &&
      (insErrMsg.includes("telegram_id") || row.error.code === "PGRST204" || row.error.code === "42703")
    ) {
      delete insertPayload.telegram_id;
      row = await adm.from("dental_clients").insert(insertPayload as never).select("*").single();
    }
    if (row.error) {
      return NextResponse.json({ ok: false, error: row.error.message }, { status: 500 });
    }

    const tokens = await issueSupabaseSessionForUserId(authId);
    const hasPin = await profileHasPinHash(authId);
    const session = clientRowToPayload(row.data as Record<string, unknown>, tokens, hasPin);

    return NextResponse.json({ ok: true, session });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
