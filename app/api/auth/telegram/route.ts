import { NextResponse } from "next/server";

import { profileHasPinHash } from "@/lib/server/authProfilePin";
import {
  clientRowToPayload,
  employeeRowToPayload,
  type AuthSessionPayload,
} from "@/lib/server/authSessionPayload";
import { ensureShadowAuthForRow } from "@/lib/server/ensureShadowAuth";
import { issueSupabaseSessionForUserId } from "@/lib/server/issueSupabaseSession";
import { verifyDentalGateRequest } from "@/lib/server/dentalGateVerify";
import { getSupabaseAnonServer } from "@/lib/server/supabaseAnon";
import { isSupabaseConfigured } from "@/lib/supabase/publicConfig";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен." }, { status: 503 });
  }

  let body: { initData?: unknown };
  try {
    body = (await req.json()) as { initData?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON." }, { status: 400 });
  }

  const initData = typeof body.initData === "string" ? body.initData : "";
  let gate;
  try {
    gate = verifyDentalGateRequest(initData);
  } catch {
    return NextResponse.json({ ok: false, error: "Недействительные данные Telegram." }, { status: 401 });
  }

  if (gate.kind !== "telegram") {
    return NextResponse.json({ ok: false, error: "Требуется Telegram Mini App." }, { status: 400 });
  }

  const tgDigits = gate.telegramUserId.replace(/\D/g, "");
  if (tgDigits.length < 5) {
    return NextResponse.json({ ok: false, error: "Нет Telegram user id." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAnonServer();

    const { data: emp, error: eErr } = await supabase
      .from("dental_employees")
      .select("*")
      .eq("telegram_id", tgDigits)
      .limit(1)
      .maybeSingle();
    if (eErr) {
      return NextResponse.json({ ok: false, error: eErr.message }, { status: 502 });
    }

    let payload: AuthSessionPayload | null = null;

    if (emp) {
      const authId = await ensureShadowAuthForRow("dental_employees", String(emp.id));
      const tokens = await issueSupabaseSessionForUserId(authId);
      const hasPin = await profileHasPinHash(authId);
      payload = employeeRowToPayload(emp as Record<string, unknown>, tokens, hasPin);
    } else {
      const { data: cli, error: cErr } = await supabase
        .from("dental_clients")
        .select("*")
        .eq("telegram_id", tgDigits)
        .limit(1)
        .maybeSingle();
      if (cErr) {
        return NextResponse.json({ ok: false, error: cErr.message }, { status: 502 });
      }
      if (!cli) {
        return NextResponse.json({
          ok: true,
          needs_registration: true,
        });
      }
      const authId = await ensureShadowAuthForRow("dental_clients", String(cli.id));
      const tokens = await issueSupabaseSessionForUserId(authId);
      const hasPin = await profileHasPinHash(authId);
      payload = clientRowToPayload(cli as Record<string, unknown>, tokens, hasPin);
    }

    return NextResponse.json({ ok: true, session: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
