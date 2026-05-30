"use client";

import { useEffect } from "react";

interface AiResultPanelProps {
  open: boolean;
  title: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  children?: React.ReactNode;
}

export function AiResultPanel({
  open,
  title,
  loading,
  error,
  onClose,
  children,
}: AiResultPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end sm:justify-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] border-0 cursor-default"
        aria-label="Закрыть"
        onClick={() => !loading && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-panel-title"
        className="relative z-[1] w-full max-w-[440px] mx-auto rounded-t-[22px] sm:rounded-[22px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_-12px_40px_rgba(15,23,42,0.16)] max-h-[min(88dvh,640px)] flex flex-col"
      >
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary">
                <path
                  d="M7 1.5L8.2 5.2L12 6L8.5 8.5L9.2 12.5L7 10.8L4.8 12.5L5.5 8.5L2 6L5.8 5.2L7 1.5Z"
                  stroke="currentColor"
                  strokeWidth="0.9"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">AI-помощник</p>
              <h3 id="ai-panel-title" className="text-[16px] font-bold text-[#0F172A] dark:text-white truncate">
                {title}
              </h3>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-[13px] text-secondary">Генерация ответа…</p>
            </div>
          ) : error ? (
            <p className="text-[13px] text-red-600 dark:text-red-400 leading-snug">{error}</p>
          ) : (
            children
          )}
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-primary text-white text-[14px] font-semibold interactive-press-sm disabled:opacity-50"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

export function AiMarkdownText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((p, i) => {
        const lines = p.split("\n");
        const isList = lines.every((l) => /^[-•*]\s/.test(l.trim()) || l.trim() === "");
        if (isList) {
          return (
            <ul key={i} className="flex flex-col gap-1.5 pl-1">
              {lines
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li
                    key={j}
                    className="text-[13px] text-[#0F172A] dark:text-slate-200 leading-snug flex gap-2"
                  >
                    <span className="text-primary shrink-0">•</span>
                    <span>{l.replace(/^[-•*]\s*/, "")}</span>
                  </li>
                ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[13px] text-[#0F172A] dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {p}
          </p>
        );
      })}
    </div>
  );
}

export function AiSparkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M8 1.5L9.4 5.8L13.5 6.5L10.2 9.5L11 13.5L8 11.8L5 13.5L5.8 9.5L2.5 6.5L6.6 5.8L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
