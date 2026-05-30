"use client";

import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_STYLES,
  AUDIT_TABLE_LABELS,
  formatAuditSummary,
  type AuditLogEntry,
} from "@/lib/auditLogs";

function formatAuditTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ActionBadge({ action }: { action: AuditLogEntry["action"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${AUDIT_ACTION_STYLES[action]}`}
    >
      {AUDIT_ACTION_LABELS[action]}
    </span>
  );
}

function AuditDetailPanel({ entry, onClose }: { entry: AuditLogEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tableLabel = AUDIT_TABLE_LABELS[entry.tableName] ?? entry.tableName;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-[-8px_0_32px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[-8px_0_32px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
              Audit Trail
            </p>
            <h2 className="mt-1 text-[16px] font-bold text-[#0F172A] dark:text-white">
              {formatAuditSummary(entry)}
            </h2>
            <p className="mt-1 text-[12px] text-secondary">
              {tableLabel} · {formatAuditTime(entry.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="interactive-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-surface dark:border-slate-700 dark:bg-slate-800"
            aria-label="Закрыть панель"
          >
            <X className="h-4 w-4 text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <section className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-xl border border-slate-200 bg-surface p-3 dark:border-slate-700 dark:bg-app-canvas">
              <p className="text-secondary">Пациент</p>
              <p className="mt-0.5 font-mono text-[11px] break-all text-navy dark:text-white">
                {entry.patientId ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-surface p-3 dark:border-slate-700 dark:bg-app-canvas">
              <p className="text-secondary">Актор</p>
              <p className="mt-0.5 font-semibold text-navy dark:text-white">
                {entry.actorRole ?? "—"}
              </p>
              {entry.actorId ? (
                <p className="mt-0.5 font-mono text-[10px] break-all text-secondary">
                  {entry.actorId}
                </p>
              ) : null}
            </div>
          </section>

          {entry.changedFields.length > 0 ? (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-primary">
                Изменённые поля
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {entry.changedFields.map((f) => (
                  <span
                    key={f}
                    className="rounded-lg bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary dark:bg-primary/15"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {entry.oldData ? (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-primary">
                До
              </h3>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-surface p-3 text-[11px] leading-relaxed text-navy dark:border-slate-700 dark:bg-app-canvas dark:text-slate-200">
                {JSON.stringify(entry.oldData, null, 2)}
              </pre>
            </section>
          ) : null}

          {entry.newData ? (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-primary">
                После
              </h3>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-surface p-3 text-[11px] leading-relaxed text-navy dark:border-slate-700 dark:bg-app-canvas dark:text-slate-200">
                {JSON.stringify(entry.newData, null, 2)}
              </pre>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

type Props = {
  entries: AuditLogEntry[];
};

export default function AuditLogsTable({ entries }: Props) {
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null);

  return (
    <>
      <div className="rounded-[16px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 overflow-hidden shadow-[0_4px_16px_rgba(36,139,207,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] ring-1 ring-primary/5">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-primary/15 dark:border-slate-700 bg-primary-light/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-300">
            <span className="hidden min-w-[108px] sm:inline">Время</span>
            <span className="w-[72px] shrink-0 text-center">Действие</span>
            <span className="min-w-0 flex-1">Событие</span>
            <span className="hidden w-10 shrink-0 text-center sm:inline">Дет.</span>
          </div>
        </div>

        <div className="max-h-[calc(100dvh-280px)] overflow-auto p-2 sm:p-3 space-y-2">
          {entries.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-secondary">
              Записей audit trail пока нет
            </p>
          ) : (
            entries.map((row) => {
              const tableLabel = AUDIT_TABLE_LABELS[row.tableName] ?? row.tableName;
              const summary = formatAuditSummary(row);

              return (
                <article
                  key={row.id}
                  className="flex flex-col gap-1.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-surface/80 dark:bg-app-canvas/40 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3 hover:bg-primary-light/25 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <time
                    dateTime={row.createdAt}
                    className="hidden shrink-0 whitespace-nowrap text-[11px] text-secondary tabular-nums sm:block sm:min-w-[108px] sm:pt-0.5"
                  >
                    {formatAuditTime(row.createdAt)}
                  </time>
                  <div className="flex items-start gap-2 sm:contents">
                    <ActionBadge action={row.action} />
                    <div className="min-w-0 flex-1 text-[12px] sm:text-[13px] text-navy dark:text-white break-words leading-snug">
                      <span className="font-medium">{summary}</span>
                      <span className="mt-0.5 block text-[10px] text-secondary">
                        {tableLabel}
                        {row.actorRole ? ` · ${row.actorRole}` : ""}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-secondary tabular-nums sm:hidden">
                        {formatAuditTime(row.createdAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailEntry(row)}
                      title="Подробности"
                      className="interactive-press-sm inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 sm:mt-0"
                      aria-label="Подробности"
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {detailEntry ? (
        <AuditDetailPanel entry={detailEntry} onClose={() => setDetailEntry(null)} />
      ) : null}
    </>
  );
}
