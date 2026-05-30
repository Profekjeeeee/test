import "server-only";

import type { PaymentProvider } from "@/types";

export type AcquiringProvider = PaymentProvider;

export interface AcquiringIntentInput {
  paymentId: string;
  billId: string;
  amount: number;
  description: string;
  returnUrl: string;
  patientId: string;
}

export interface AcquiringIntentResult {
  externalId: string;
  confirmationUrl?: string;
  /** mock-провайдер завершает платёж сразу на сервере. */
  immediateSuccess: boolean;
}

function resolveProvider(): AcquiringProvider {
  const raw = process.env.ACQUIRING_PROVIDER?.trim().toLowerCase();
  if (raw === "yookassa" || raw === "tinkoff" || raw === "sberbank") return raw;
  return "mock";
}

/**
 * Заготовка интеграции с эквайрингом.
 * Env: ACQUIRING_PROVIDER=mock|yookassa|tinkoff|sberbank
 *      YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY (для yookassa)
 */
export async function createAcquiringIntent(
  input: AcquiringIntentInput
): Promise<AcquiringIntentResult> {
  const provider = resolveProvider();

  switch (provider) {
    case "yookassa":
      return createYooKassaIntent(input);
    case "tinkoff":
    case "sberbank":
      throw new Error(`Провайдер ${provider} ещё не подключён. Установите ACQUIRING_PROVIDER=mock.`);
    case "mock":
    default:
      return {
        externalId: `mock_${input.paymentId}`,
        immediateSuccess: true,
      };
  }
}

async function createYooKassaIntent(
  input: AcquiringIntentInput
): Promise<AcquiringIntentResult> {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secret = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (!shopId || !secret) {
    throw new Error("YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY не заданы.");
  }

  const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Idempotence-Key": input.paymentId,
    },
    body: JSON.stringify({
      amount: { value: input.amount.toFixed(2), currency: "RUB" },
      confirmation: { type: "redirect", return_url: input.returnUrl },
      capture: true,
      description: input.description.slice(0, 128),
      metadata: { bill_id: input.billId, patient_id: input.patientId, payment_id: input.paymentId },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YooKassa: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    id: string;
    confirmation?: { confirmation_url?: string };
  };

  return {
    externalId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url,
    immediateSuccess: false,
  };
}

export interface WebhookVerifyResult {
  paymentId: string;
  externalId: string;
  status: "succeeded" | "failed";
  amount: number;
}

/** Проверка webhook от провайдера (заготовка). */
export function verifyAcquiringWebhook(
  provider: AcquiringProvider,
  _headers: Headers,
  body: unknown
): WebhookVerifyResult | null {
  if (provider === "mock") return null;

  if (provider === "yookassa") {
    const payload = body as {
      event?: string;
      object?: {
        id?: string;
        status?: string;
        amount?: { value?: string };
        metadata?: { payment_id?: string };
      };
    };
    const obj = payload.object;
    if (!obj?.id || !obj.metadata?.payment_id) return null;

    const status =
      payload.event === "payment.succeeded" || obj.status === "succeeded"
        ? "succeeded"
        : obj.status === "canceled"
          ? "failed"
          : null;
    if (!status) return null;

    return {
      paymentId: obj.metadata.payment_id,
      externalId: obj.id,
      status,
      amount: Number(obj.amount?.value ?? 0),
    };
  }

  return null;
}

export function getAcquiringProvider(): AcquiringProvider {
  return resolveProvider();
}
