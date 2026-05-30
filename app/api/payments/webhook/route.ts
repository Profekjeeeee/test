import { NextResponse } from "next/server";

import { getAcquiringProvider, verifyAcquiringWebhook } from "@/lib/server/acquiring";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook
 * Callback от эквайринга (YooKassa и др.).
 * Env: ACQUIRING_WEBHOOK_SECRET — опциональная проверка заголовка.
 */
export async function POST(request: Request) {
  const provider = getAcquiringProvider();
  if (provider === "mock") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const webhookSecret = process.env.ACQUIRING_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const sig = request.headers.get("x-webhook-secret");
    if (sig !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = verifyAcquiringWebhook(provider, request.headers, body);
  if (!verified) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = getSupabaseServiceRole();
  const { error } = await admin
    .from("payments")
    .update({
      status: verified.status,
      completed_at: verified.status === "succeeded" ? new Date().toISOString() : null,
    })
    .eq("id", verified.paymentId)
    .eq("external_id", verified.externalId);

  if (error) {
    console.error("[api/payments/webhook]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
