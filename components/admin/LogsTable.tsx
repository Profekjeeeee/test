"use client";

import { useEffect, useState } from "react";
import { Download, Eye, X } from "lucide-react";
import type { DentalLog } from "@/lib/logger";

const LEVEL_STYLES: Record<DentalLog["level"], string> = {
  INFO: "bg-blue-100 text-primary dark:bg-blue-950/50 dark:text-blue-300",
  WARN: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  ERROR: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const MESSAGE_TRUNCATE_LENGTH = 120;

function formatLogTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

function formatLogMessage(row: DentalLog): string {
  if (row.details?.trim()) {
    return `${row.action} — ${row.details}`;
  }
  return row.message || row.action;
}

function LevelBadge({ level }: { level: DentalLog["level"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center min-w-[52px] px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${LEVEL_STYLES[level]}`}
    >
      {level}
    </span>
  );
}

function ExpandableMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > MESSAGE_TRUNCATE_LENGTH;

  if (!isLong) {
    return <span className="font-medium">{text}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className="interactive-press-sm w-full text-left"
      aria-expanded={expanded}
    >
      <span className={`font-medium block ${expanded ? "" : "line-clamp-2"}`}>{text}</span>
      <span className="mt-0.5 inline-block text-[11px] font-semibold text-primary">
        {expanded ? "Свернуть" : "Показать полностью"}
      </span>
    </button>
  );
}

function LogMetadataSidePanel({ log, onClose }: { log: DentalLog; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const payload = log.metadata ?? {};
  const json = JSON.stringify(payload, null, 2);
  const hasContext =
    payload.context != null &&
    typeof payload.context === "object" &&
    Object.keys(payload.context as object).length > 0;

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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Контекст лога</p>
            <h2 className="mt-1 truncate text-[16px] font-bold text-[#0F172A] dark:text-white">
              {log.action || log.message}
            </h2>
            {log.pathname ? (
              <p className="mt-1 truncate text-[12px] text-secondary">{log.pathname}</p>
            ) : null}
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
          {hasContext ? (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-primary">
                Состояние приложения
              </h3>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-surface p-3 text-[11px] leading-relaxed text-navy dark:border-slate-700 dark:bg-app-canvas dark:text-slate-200">
                {JSON.stringify(payload.context, null, 2)}
              </pre>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-primary">
              Полные метаданные
            </h3>
            <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-surface p-3 text-[11px] leading-relaxed text-navy dark:border-slate-700 dark:bg-app-canvas dark:text-slate-200">
              {json}
            </pre>
          </section>
        </div>
      </aside>
    </div>
  );
}

type Props = {
  logs: DentalLog[];
  onDownload?: () => void;
  canDownload?: boolean;
};

export default function LogsTable({ logs, onDownload, canDownload = false }: Props) {
  const [contextLog, setContextLog] = useState<DentalLog | null>(null);

  return (
    <>
      <div className="rounded-[16px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 overflow-hidden shadow-[0_4px_16px_rgba(36,139,207,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] ring-1 ring-primary/5">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-primary/15 dark:border-slate-700 bg-primary-light/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-300">
            <span className="hidden min-w-[108px] sm:inline">Время</span>
            <span className="w-[52px] shrink-0 text-center">Ур.</span>
            <span className="min-w-0 flex-1">Сообщение</span>
            <span className="hidden w-10 shrink-0 text-center sm:inline">Конт.</span>
          </div>
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              disabled={!canDownload}
              title="Скачать JSON"
              className="interactive-press-sm inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-white dark:bg-slate-800 text-primary dark:text-blue-300 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="max-h-[calc(100dvh-220px)] overflow-auto p-2 sm:p-3 space-y-2">
          {logs.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-secondary">Логи пусты</p>
          ) : (
            logs.map((row) => {
              const displayMessage = formatLogMessage(row);
              const hasMetadata = row.metadata != null && Object.keys(row.metadata).length > 0;

              return (
                <article
                  key={row.id}
                  className="flex flex-col gap-1.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-surface/80 dark:bg-app-canvas/40 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3 hover:bg-primary-light/25 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <time
                    dateTime={new Date(row.timestamp).toISOString()}
                    className="hidden shrink-0 whitespace-nowrap text-[11px] text-secondary tabular-nums sm:block sm:min-w-[108px] sm:pt-0.5"
                  >
                    {formatLogTime(row.timestamp)}
                  </time>
                  <div className="flex items-start gap-2 sm:contents">
                    <LevelBadge level={row.level} />
                    <div className="min-w-0 flex-1 text-[12px] sm:text-[13px] text-navy dark:text-white break-words leading-snug">
                      <ExpandableMessage text={displayMessage} />
                      <span className="mt-1 block text-[10px] text-secondary tabular-nums sm:hidden">
                        {formatLogTime(row.timestamp)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContextLog(row)}
                      disabled={!hasMetadata}
                      title={hasMetadata ? "Показать контекст" : "Нет метаданных"}
                      className="interactive-press-sm inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 sm:mt-0"
                      aria-label="Показать контекст"
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

      {contextLog ? (
        <LogMetadataSidePanel log={contextLog} onClose={() => setContextLog(null)} />
      ) : null}
    </>
  );
}
