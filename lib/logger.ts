export interface DentalLog {
  id: string;
  timestamp: number;
  level: "INFO" | "WARN" | "ERROR";
  role: "client" | "doctor" | "admin" | "guest";
  userId: string;
  action: string;
  details?: string;
}

export const DENTAL_LOGS_KEY = "dental_logs";

const MAX_LOGS = 200;

function newLogId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function parseDentalLogs(raw: string | null): DentalLog[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as DentalLog[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getDentalLogs(): DentalLog[] {
  if (typeof window === "undefined") return [];
  return parseDentalLogs(localStorage.getItem(DENTAL_LOGS_KEY));
}

/** Свежие логи — с большим timestamp (для таблицы «сверху вниз»). */
export function getDentalLogsNewestFirst(): DentalLog[] {
  return [...getDentalLogs()].sort((a, b) => b.timestamp - a.timestamp);
}

export function clearDentalLogs(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DENTAL_LOGS_KEY);
}

export function addDentalLog(
  level: DentalLog["level"],
  role: DentalLog["role"],
  userId: string,
  action: string,
  details?: string
): void {
  if (typeof window === "undefined") return;
  try {
    const prev = parseDentalLogs(localStorage.getItem(DENTAL_LOGS_KEY));
    const row: DentalLog = {
      id: newLogId(),
      timestamp: Date.now(),
      level,
      role,
      userId,
      action,
      details,
    };
    const next = [...prev, row].slice(-MAX_LOGS);
    localStorage.setItem(DENTAL_LOGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("dental_logs_updated"));
  } catch {
    /* quota / serialization */
  }
}
