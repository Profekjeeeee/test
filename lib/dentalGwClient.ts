import { getDentalSession } from "@/lib/auth";
import type { DentalGwActor } from "@/lib/dentalGwTypes";
import { getTelegramInitData } from "@/lib/telegramWebApp";

interface DentalGwJsonResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

function sessionToActor(): DentalGwActor | null {
  const session = getDentalSession();
  if (!session) return null;
  return {
    id: session.id,
    role: session.role,
    phone: session.phone,
  };
}

/** Клиентский вызов шлюза /api/dental-db (op + payload + Telegram initData + actor). */
export async function dentalGw<T>(op: string, payload?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/dental-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op,
      payload,
      telegramInitData: getTelegramInitData() ?? undefined,
      actor: sessionToActor(),
    }),
  });

  const json = (await res.json()) as DentalGwJsonResponse<T>;
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "Gateway error");
  }
  return json.data as T;
}
