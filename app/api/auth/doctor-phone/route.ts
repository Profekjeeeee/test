import { NextResponse } from "next/server";

import { EmployeePhoneLoginError, loginEmployeeByPhone } from "@/lib/server/employeePhoneLogin";
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

  const phone = typeof body.phone === "string" ? body.phone : "";

  try {
    const session = await loginEmployeeByPhone(phone, "doctor");
    return NextResponse.json({ ok: true, session });
  } catch (e) {
    if (e instanceof EmployeePhoneLoginError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
