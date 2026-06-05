import "server-only";

import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/api/apiError";
import { AdminApiAuthError } from "@/lib/server/requireAdminApi";
import { PlatformApiAuthError } from "@/lib/server/requirePlatformAdminApi";
import { DentalGateError } from "@/lib/server/dentalGateVerify";

export type ApiSuccessResponse<T> = { ok: true; data: T };
export type ApiErrorResponse = { ok: false; error: string; code?: string };

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(
  message: string,
  status = 500,
  code?: string,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ ok: false, error: message, ...(code ? { code } : {}) }, { status });
}

export function handleApiError(e: unknown): NextResponse<ApiErrorResponse> {
  if (e instanceof ApiError) {
    return jsonError(e.message, e.status, e.code);
  }
  if (e instanceof DentalGateError) {
    return jsonError(e.message, e.status);
  }
  if (e instanceof AdminApiAuthError) {
    return jsonError(e.message, e.status);
  }
  if (e instanceof PlatformApiAuthError) {
    return jsonError(e.message, e.status);
  }
  if (e instanceof Error) {
    return jsonError(e.message, 500);
  }
  // Supabase/PostgREST возвращает обычный объект ({ message, details, hint, code }),
  // а не Error — раскрываем его, чтобы причина не пряталась за «Internal error».
  if (e && typeof e === "object") {
    const obj = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [obj.message, obj.details, obj.hint]
      .filter((p): p is string => typeof p === "string" && p.trim() !== "");
    if (parts.length > 0) {
      const code = typeof obj.code === "string" ? obj.code : undefined;
      return jsonError(parts.join(" — "), 500, code);
    }
  }
  return jsonError("Internal error", 500);
}

/** Обёртка для route handler: единый try/catch и формат ответа. */
export function withApiHandler<T>(
  handler: (req: Request) => Promise<T>,
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    try {
      const data = await handler(req);
      return jsonOk(data);
    } catch (e) {
      console.error("[api]", e);
      return handleApiError(e);
    }
  };
}
