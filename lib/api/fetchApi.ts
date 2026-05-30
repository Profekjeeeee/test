import { getDentalSession } from "@/lib/auth";
import type { DentalGwActor } from "@/lib/dentalGwTypes";
import { getTelegramInitData } from "@/lib/telegramWebApp";

export type ApiJsonResponse<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

function sessionToActor(): DentalGwActor | null {
  const session = getDentalSession();
  if (!session) return null;
  return {
    id: session.id,
    role: session.role,
    phone: session.phone,
  };
}

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const initData = getTelegramInitData();
  if (initData) headers["X-Telegram-Init-Data"] = initData;
  const actor = sessionToActor();
  if (actor) headers["X-Dental-Actor"] = JSON.stringify(actor);
  return headers;
}

/** Унифицированный клиент REST API (замена dentalGw / прямых Supabase-мутаций). */
export async function dentalApiFetch<T>(
  path: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const method = options?.method ?? (options?.body ? "POST" : "GET");
  const res = await fetch(path, {
    method,
    headers: buildAuthHeaders(),
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const json = (await res.json()) as ApiJsonResponse<T>;
  if (!res.ok || !json.ok) {
    throw new Error("error" in json ? json.error : "API error");
  }
  return json.data;
}

/** @deprecated Используйте dentalApiFetch. Оставлен для совместимости со старым gateway. */
export async function dentalGw<T>(op: string, payload?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/dental-db", {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      op,
      payload,
      telegramInitData: getTelegramInitData() ?? undefined,
      actor: sessionToActor(),
    }),
  });

  const json = (await res.json()) as ApiJsonResponse<T>;
  if (!res.ok || !json.ok) {
    throw new Error("error" in json ? json.error : "Gateway error");
  }
  return json.data;
}

export { sessionToActor };
