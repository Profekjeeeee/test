"use client";

import { useState } from "react";
import { callAiAssistant } from "@/lib/aiAssistant";
import { AiMarkdownText, AiResultPanel, AiSparkIcon } from "@/components/ai/AiResultPanel";

export default function PatientAiAssistant() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await callAiAssistant({ action: "medcard_search", query: q });
      setText(res.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-primary/20 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <AiSparkIcon />
          </span>
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-primary">AI-помощник</h2>
            <p className="text-[11px] text-secondary mt-0.5">Спросите о своей медкарте</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            placeholder="Например: когда была последняя чистка?"
            className="flex-1 min-w-0 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 px-3 text-[14px] outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={!query.trim()}
            onClick={() => void runSearch()}
            className="interactive-press-sm shrink-0 h-11 px-4 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-45"
          >
            Спросить
          </button>
        </div>
      </section>

      <AiResultPanel
        open={open}
        title="Ответ по медкарте"
        loading={loading}
        error={error}
        onClose={() => !loading && setOpen(false)}
      >
        {text && <AiMarkdownText text={text} />}
      </AiResultPanel>
    </>
  );
}

/** Кнопка «Объяснить простым языком» для диагноза в истории лечения. */
export function ExplainDiagnosisButton({
  diagnosis,
  procedureTitle,
}: {
  diagnosis: string;
  procedureTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  const explain = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await callAiAssistant({
        action: "explain_diagnosis",
        diagnosis,
        procedureTitle,
      });
      setText(res.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void explain()}
        className="interactive-press-sm inline-flex items-center gap-1.5 mt-2 text-[12px] font-semibold text-primary"
      >
        <AiSparkIcon className="w-3.5 h-3.5" />
        Объяснить простым языком
      </button>

      <AiResultPanel
        open={open}
        title="Что это значит?"
        loading={loading}
        error={error}
        onClose={() => !loading && setOpen(false)}
      >
        {text && <AiMarkdownText text={text} />}
      </AiResultPanel>
    </>
  );
}
