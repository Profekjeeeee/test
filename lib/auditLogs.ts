import { supabase } from "@/lib/supabaseClient";

export type AuditAction = "insert" | "update" | "delete";

export type AuditTableName =
  | "medical_records"
  | "patient_visits"
  | "patient_files"
  | "treatment_plan_items"
  | "dental_clients";

export interface AuditLogEntry {
  id: string;
  tableName: AuditTableName | string;
  recordId: string;
  patientId?: string;
  action: AuditAction;
  actorId?: string;
  actorRole?: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[];
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string;
  patient_id: string | null;
  action: AuditAction;
  actor_id: string | null;
  actor_role: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  created_at: string;
}

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  medical_records: "Мед. запись",
  patient_visits: "Визит",
  patient_files: "Файл",
  treatment_plan_items: "План лечения",
  dental_clients: "Карта пациента",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  insert: "Создание",
  update: "Изменение",
  delete: "Удаление",
};

export const AUDIT_ACTION_STYLES: Record<AuditAction, string> = {
  insert: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  update: "bg-primary-light text-primary dark:bg-primary/15 dark:text-blue-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export const AUDIT_TABLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Все таблицы" },
  ...Object.entries(AUDIT_TABLE_LABELS).map(([value, label]) => ({ value, label })),
];

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    patientId: row.patient_id ?? undefined,
    action: row.action,
    actorId: row.actor_id ?? undefined,
    actorRole: row.actor_role ?? undefined,
    oldData: row.old_data,
    newData: row.new_data,
    changedFields: row.changed_fields ?? [],
    createdAt: row.created_at,
  };
}

export interface FetchAuditLogsOptions {
  tableName?: string;
  patientId?: string;
  action?: AuditAction;
  limit?: number;
}

export async function fetchAuditLogs(
  options: FetchAuditLogsOptions = {},
): Promise<{ data: AuditLogEntry[]; error: string | null }> {
  const limit = options.limit ?? 200;

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.tableName?.trim()) {
    query = query.eq("table_name", options.tableName.trim());
  }
  if (options.patientId?.trim()) {
    query = query.eq("patient_id", options.patientId.trim());
  }
  if (options.action) {
    query = query.eq("action", options.action);
  }

  const { data, error } = await query;

  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as AuditLogRow[]).map(rowToEntry),
    error: null,
  };
}

export function formatAuditSummary(entry: AuditLogEntry): string {
  const tableLabel = AUDIT_TABLE_LABELS[entry.tableName] ?? entry.tableName;
  const actionLabel = AUDIT_ACTION_LABELS[entry.action];

  if (entry.action === "update" && entry.changedFields.length > 0) {
    const fields = entry.changedFields.slice(0, 4).join(", ");
    const suffix = entry.changedFields.length > 4 ? "…" : "";
    return `${actionLabel}: ${tableLabel} — ${fields}${suffix}`;
  }

  const title =
    (entry.newData?.title as string | undefined) ??
    (entry.newData?.procedure_title as string | undefined) ??
    (entry.newData?.file_name as string | undefined) ??
    (entry.oldData?.title as string | undefined) ??
    (entry.oldData?.procedure_title as string | undefined) ??
    (entry.oldData?.file_name as string | undefined);

  if (title) return `${actionLabel}: ${tableLabel} «${title}»`;
  return `${actionLabel}: ${tableLabel}`;
}

export function exportAuditLogsCsv(entries: AuditLogEntry[]): string {
  const header = [
    "created_at",
    "action",
    "table_name",
    "record_id",
    "patient_id",
    "actor_id",
    "actor_role",
    "changed_fields",
  ].join(";");

  const rows = entries.map((e) =>
    [
      e.createdAt,
      e.action,
      e.tableName,
      e.recordId,
      e.patientId ?? "",
      e.actorId ?? "",
      e.actorRole ?? "",
      e.changedFields.join("|"),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";"),
  );

  return [header, ...rows].join("\n");
}
