import type { Payment, PaymentMethod, PaymentProvider, PaymentStatus } from "@/types";
import { getCurrentUserId, getDentalSession } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

interface PaymentRow {
  id: string;
  bill_id: string;
  patient_id: string;
  amount: number | string;
  method: string;
  status: string;
  provider: string;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    billId: row.bill_id,
    patientId: row.patient_id,
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    status: row.status as PaymentStatus,
    provider: row.provider as PaymentProvider,
    externalId: row.external_id ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function getClientSubjectId(): string | null {
  const uid = getCurrentUserId();
  if (uid) return uid;
  const session = getDentalSession();
  if (session?.role === "client" && session.id) return session.id;
  return null;
}

export interface CreatePaymentIntentResult {
  paymentId: string;
  status: PaymentStatus;
  /** URL для редиректа на страницу оплаты провайдера (если не mock). */
  confirmationUrl?: string;
}

/** Создать онлайн-платёж через server API (эквайринг). */
export async function createOnlinePayment(billId: string): Promise<CreatePaymentIntentResult> {
  const res = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ billId }),
  });

  const body = (await res.json()) as CreatePaymentIntentResult & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "Не удалось создать платёж.");
  }
  return body;
}

export async function getPaymentsForBill(billId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("bill_id", billId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[payments]", error);
    return [];
  }
  return ((data ?? []) as PaymentRow[]).map(rowToPayment);
}

export async function getPatientPayments(): Promise<Payment[]> {
  const patientId = getClientSubjectId();
  if (!patientId) return [];

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[payments]", error);
    return [];
  }
  return ((data ?? []) as PaymentRow[]).map(rowToPayment);
}

/** Ручная оплата (админ / касса). */
export async function recordManualPayment(
  billId: string,
  patientId: string,
  amount: number,
  method: PaymentMethod = "cash"
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .insert([
      {
        bill_id: billId,
        patient_id: patientId,
        amount,
        method,
        status: "succeeded",
        provider: "mock",
        completed_at: new Date().toISOString(),
        metadata: { source: "manual" },
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("[payments] manual", error);
    return null;
  }
  return rowToPayment(data as PaymentRow);
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  online: "Онлайн",
  cash: "Наличные",
  card_terminal: "Терминал",
  transfer: "Перевод",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Ожидает",
  processing: "Обработка",
  succeeded: "Успешно",
  failed: "Ошибка",
  refunded: "Возврат",
};
