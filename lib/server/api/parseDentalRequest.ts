import "server-only";

import type { DentalGwActor } from "@/lib/dentalGwTypes";
import { ApiError } from "@/lib/server/api/apiError";
import type { DentalGateVerified } from "@/lib/server/dentalGateVerify";
import { verifyDentalGateRequest } from "@/lib/server/dentalGateVerify";

export interface DentalRequestContext {
  gate: DentalGateVerified;
  actor: DentalGwActor | null;
}

const ACTOR_HEADER = "x-dental-actor";
const INIT_DATA_HEADER = "x-telegram-init-data";

function parseActor(raw: unknown): DentalGwActor | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const role = o.role;
  if (!id) return null;
  if (role !== "client" && role !== "doctor" && role !== "admin") return null;
  return {
    id,
    role,
    phone: typeof o.phone === "string" ? o.phone : undefined,
  };
}

function readActorFromHeader(req: Request): DentalGwActor | null {
  const raw = req.headers.get(ACTOR_HEADER)?.trim();
  if (!raw) return null;
  try {
    return parseActor(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Контекст TMA-запроса: Telegram initData + dental session actor. */
export function parseDentalRequest(req: Request, body?: Record<string, unknown>): DentalRequestContext {
  const initFromHeader = req.headers.get(INIT_DATA_HEADER)?.trim();
  const initFromBody =
    body && typeof body.telegramInitData === "string" ? body.telegramInitData.trim() : "";
  const telegramInitData = initFromHeader || initFromBody || undefined;

  const gate = verifyDentalGateRequest(telegramInitData);

  const actorFromHeader = readActorFromHeader(req);
  const actorFromBody = body ? parseActor(body.actor) : null;
  const actor = actorFromHeader ?? actorFromBody ?? null;

  return { gate, actor };
}

export async function parseDentalJsonBody(req: Request): Promise<{
  body: Record<string, unknown>;
  ctx: DentalRequestContext;
}> {
  let body: Record<string, unknown>;
  try {
    const raw = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ApiError(400, "Body must be a JSON object.");
    }
    body = raw as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Некорректный JSON.");
  }
  const ctx = parseDentalRequest(req, body);
  return { body, ctx };
}
