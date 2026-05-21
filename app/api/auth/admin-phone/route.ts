import { NextResponse } from "next/server";

import { profileHasPinHash } from "@/lib/server/authProfilePin";
import { employeeRowToPayload } from "@/lib/server/authSessionPayload";
import { ensureShadowAuthForRow } from "@/lib/server/ensureShadowAuth";
import { issueSupabaseSessionForUserId } from "@/lib/server/issueSupabaseSession";
import { isCompleteRuMobileDigits, normalizePhone, phoneDigitsSuffixPattern } from "@/lib/phone";
import { getSupabaseAnonServer } from "@/lib/server/supabaseAnon";
import { isSupabaseConfigured } from "@/lib/supabase/publicConfig";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен." }, { status: 503 });
  }

  let body: { phone?: unknown };
  try {
    body = (await req.json()) as { phone?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON." }, { status: 400 });
  }

  const cleanPhone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  if (!isCompleteRuMobileDigits(cleanPhone)) {
    return NextResponse.json({ ok: false, error: "Некорректный номер." }, { status: 400 });
  }

  const pattern = phoneDigitsSuffixPattern(cleanPhone);

  try {
    const supabase = getSupabaseAnonServer();
    const { data: emp, error } = await supabase
      .from("dental_employees")
      .select("*")
      .ilike("phone", pattern)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    if (!emp) {
      return NextResponse.json(
        { ok: false, error: "Администратор с таким номером не найден." },
        { status: 404 },
      );
    }

    const authId = await ensureShadowAuthForRow("dental_employees", String(emp.id));
    const tokens = await issueSupabaseSessionForUserId(authId);
    const hasPin = await profileHasPinHash(authId);
    const session = employeeRowToPayload(emp as Record<string, unknown>, tokens, hasPin);

    return NextResponse.json({ ok: true, session });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
