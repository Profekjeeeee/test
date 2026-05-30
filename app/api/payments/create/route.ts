import { NextResponse } from "next/server";

import { createAcquiringIntent, getAcquiringProvider } from "@/lib/server/acquiring";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export const dynamic = "force-dynamic";

interface BillRow {
  id: string;
  patient_id: string;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  description: string;
  bill_number: string;
}

/**
 * POST /api/payments/create
 * Body: { billId: string }
 * Создаёт pending-платёж и инициирует эквайринг.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { billId?: string };
    const billId = body.billId?.trim();
    if (!billId) {
      return NextResponse.json({ error: "billId обязателен." }, { status: 400 });
    }

    const admin = getSupabaseServiceRole();

    const { data: bill, error: billErr } = await admin
      .from("bills")
      .select("id, patient_id, amount, paid_amount, status, description, bill_number")
      .eq("id", billId)
      .single();

    if (billErr || !bill) {
      return NextResponse.json({ error: "Счёт не найден." }, { status: 404 });
    }

    const row = bill as BillRow;
    const total = Number(row.amount);
    const paid = Number(row.paid_amount);
    const remaining = total - paid;

    if (remaining <= 0 || row.status === "paid") {
      return NextResponse.json({ error: "Счёт уже оплачен." }, { status: 400 });
    }

    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert([
        {
          bill_id: billId,
          patient_id: row.patient_id,
          amount: remaining,
          method: "online",
          status: "pending",
          provider: getAcquiringProvider(),
        },
      ])
      .select("id")
      .single();

    if (payErr || !payment) {
      return NextResponse.json({ error: payErr?.message ?? "Ошибка создания платежа." }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/bills?paid=${payment.id}`;

    const intent = await createAcquiringIntent({
      paymentId: payment.id,
      billId,
      amount: remaining,
      description: row.description || row.bill_number || "Оплата услуг клиники",
      returnUrl,
      patientId: row.patient_id,
    });

    if (intent.immediateSuccess) {
      const { error: updErr } = await admin
        .from("payments")
        .update({
          status: "succeeded",
          external_id: intent.externalId,
          completed_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        paymentId: payment.id,
        status: "succeeded",
      });
    }

    const { error: procErr } = await admin
      .from("payments")
      .update({
        status: "processing",
        external_id: intent.externalId,
      })
      .eq("id", payment.id);

    if (procErr) {
      return NextResponse.json({ error: procErr.message }, { status: 500 });
    }

    return NextResponse.json({
      paymentId: payment.id,
      status: "processing",
      confirmationUrl: intent.confirmationUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[api/payments/create]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
