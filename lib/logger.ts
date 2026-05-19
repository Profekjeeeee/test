import { getCurrentUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export type LogLevel = "INFO" | "WARN" | "ERROR";
export type LogRole = "client" | "doctor" | "admin" | "guest";

export interface LogMetadata {
  role?: LogRole;
  userId?: string;
  action?: string;
  details?: string;
  /** Состояние приложения в момент события (данные формы и т.п.). */
  context?: Record<string, unknown>;
  timestamp?: string;
  pathname?: string;
  userAgent?: string;
  stack?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

export interface AppLogRow {
  id: string;
  created_at: string;
  level: LogLevel;
  message: string;
  user_id: string | null;
  metadata: LogMetadata | null;
}

/** Строка для UI админки (совместимость с прежним DentalLog). */
export interface DentalLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  role: LogRole;
  userId: string;
  action: string;
  details?: string;
  message: string;
  pathname?: string;
  metadata: LogMetadata | null;
}

export const APP_LOGS_UPDATED_EVENT = "app_logs_updated";

function logNetworkFailure(
  level: LogLevel,
  message: string,
  metadata: LogMetadata,
  error?: unknown
): void {
  console.error("[logger] Supabase insert failed", {
    level,
    message,
    metadata,
    error,
  });
}

function findErrorInMetadata(metadata: LogMetadata): Error | null {
  if (metadata.error instanceof Error) return metadata.error;
  for (const value of Object.values(metadata)) {
    if (value instanceof Error) return value;
  }
  return null;
}

function sanitizeMetadataForStorage(metadata: Record<string, unknown>): LogMetadata {
  const result: LogMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value instanceof Error) continue;
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function buildEnrichedMetadata(
  level: LogLevel,
  message: string,
  metadata: LogMetadata,
  userId: string | null
): LogMetadata {
  const errorObj = findErrorInMetadata(metadata);
  const { error: _error, context, userId: _userId, ...rest } = metadata;

  const enriched: LogMetadata = {
    ...sanitizeMetadataForStorage(rest as Record<string, unknown>),
    timestamp: new Date().toISOString(),
    pathname: window.location.pathname,
    action: metadata.action ?? message,
    context: context ?? {},
    ...(userId ? { userId } : {}),
  };

  if (errorObj) {
    enriched.errorMessage = errorObj.message;
    if (level === "ERROR" && errorObj.stack) {
      enriched.stack = errorObj.stack;
    }
  }

  if (level === "ERROR") {
    enriched.userAgent = navigator.userAgent;
  }

  return enriched;
}

export function appLogRowToDentalLog(row: AppLogRow): DentalLog {
  const meta = row.metadata ?? {};
  const userId = row.user_id ?? (meta.userId != null ? String(meta.userId) : "");
  return {
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    level: row.level,
    role: (meta.role as LogRole) ?? "guest",
    userId,
    action: String(meta.action ?? row.message),
    details: meta.details != null ? String(meta.details) : undefined,
    message: row.message,
    pathname: meta.pathname != null ? String(meta.pathname) : undefined,
    metadata: row.metadata,
  };
}

/**
 * Асинхронная запись в Supabase (fire-and-forget).
 * При сетевой ошибке или отказе INSERT — дублирование в console.error.
 */
export function log(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
  if (typeof window === "undefined") return;

  const userId = metadata.userId ?? getCurrentUserId() ?? null;
  const enrichedMetadata = buildEnrichedMetadata(level, message, metadata, userId);

  const row = {
    level,
    message,
    user_id: userId,
    metadata: enrichedMetadata,
  };

  void (async () => {
    try {
      const { error } = await supabase.from("app_logs").insert(row);

      if (error) {
        logNetworkFailure(level, message, enrichedMetadata, error);
        return;
      }

      window.dispatchEvent(new Event(APP_LOGS_UPDATED_EVENT));
    } catch (err) {
      logNetworkFailure(level, message, enrichedMetadata, err);
    }
  })();
}

export async function fetchAppLogs(): Promise<{ data: DentalLog[]; error: string | null }> {
  const { data, error } = await supabase
    .from("app_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => appLogRowToDentalLog(row as AppLogRow)),
    error: null,
  };
}

export async function clearAppLogs(): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("app_logs")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");

  return { error: error?.message ?? null };
}
