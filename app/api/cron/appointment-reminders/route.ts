import { NextResponse } from "next/server";

import { processAppointmentReminders } from "@/lib/server/appointmentTelegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Vercel Cron: каждые 15 мин — напоминания за 24 ч и 2 ч до приёма.
 * Env: CRON_SECRET (Authorization: Bearer …), TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processAppointmentReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[cron/appointment-reminders]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
