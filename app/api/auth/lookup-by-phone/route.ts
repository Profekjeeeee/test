import { NextResponse } from "next/server";

import { isCompleteRuMobileDigits, normalizePhone, phoneDigitsSuffixPattern } from "@/lib/phone";
import { isSupabaseConfigured } from "@/lib/supabase/publicConfig";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase не настроен на сервере. Проверьте .env.local." },
      { status: 503 },
    );
  }

  let body: { phone?: unknown };
  try {
    body = (await req.json()) as { phone?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON." }, { status: 400 });
  }

  const cleanPhone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  if (!isCompleteRuMobileDigits(cleanPhone)) {
    return NextResponse.json({ ok: false, error: "Некорректный номер телефона." }, { status: 400 });
  }

  const pattern = phoneDigitsSuffixPattern(cleanPhone);

  try {
    const supabase = getSupabaseServiceRole();

    const [empRes, cliRes] = await Promise.all([
      supabase.from("dental_employees").select("*").ilike("phone", pattern).limit(1).maybeSingle(),
      supabase.from("dental_clients").select("*").ilike("phone", pattern).limit(1).maybeSingle(),
    ]);

    if (empRes.error) {
      return NextResponse.json(
        { ok: false, error: empRes.error.message, code: empRes.error.code ?? "" },
        { status: 502 },
      );
    }
    if (cliRes.error) {
      return NextResponse.json(
        { ok: false, error: cliRes.error.message, code: cliRes.error.code ?? "" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      employee: empRes.data ?? null,
      client: cliRes.data ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
