"use client";

import { useState, useCallback } from "react";
import { callAiAssistant, type ExamDraftResult } from "@/lib/aiAssistant";
import { AiMarkdownText, AiResultPanel, AiSparkIcon } from "@/components/ai/AiResultPanel";

interface DoctorAiToolbarProps {
  patientId: string;
  onApplyExamDraft?: (draft: ExamDraftResult) => void;
  examBriefNotes?: string;
  examToothNumbers?: string;
}

type PanelMode = "summary" | "search" | "recommendations" | "exam_draft" | null;

export default function DoctorAiToolbar({
  patientId,
  onApplyExamDraft,
  examBriefNotes = "",
  examToothNumbers = "",
}: DoctorAiToolbarProps) {
  const [mode, setMode] = useState<PanelMode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textResult, setTextResult] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [examDraft, setExamDraft] = useState<ExamDraftResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const reset = useCallback(() => {
    setError(null);
    setTextResult("");
    setRecommendations([]);
    setExamDraft(null);
  }, []);

  const openPanel = (m: PanelMode) => {
    reset();
    setMode(m);
  };

  const closePanel = () => {
    if (loading) return;
    setMode(null);
    reset();
  };

  const runSummary = async () => {
    openPanel("summary");
    setLoading(true);
    try {
      const res = await callAiAssistant({ action: "patient_summary", patientId });
      setTextResult(res.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  const runRecommendations = async () => {
    openPanel("recommendations");
    setLoading(true);
    try {
      const res = await callAiAssistant({ action: "recommendations", patientId });
      setRecommendations(res.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  const runExamDraft = async () => {
    openPanel("exam_draft");
    setLoading(true);
    try {
      const res = await callAiAssistant({
        action: "exam_draft",
        patientId,
        briefNotes: examBriefNotes,
        toothNumbers: examToothNumbers,
      });
      setExamDraft(res.examDraft ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    openPanel("search");
    setLoading(true);
    try {
      const res = await callAiAssistant({ action: "medcard_search", patientId, query: q });
      setTextResult(res.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setLoading(false);
    }
  };

  const panelTitle =
    mode === "summary"
      ? "Сводка пациента"
      : mode === "search"
        ? "Поиск по медкарте"
        : mode === "recommendations"
          ? "Рекомендации"
          : mode === "exam_draft"
            ? "Черновик осмотра"
            : "";

  return (
    <>
      <section className="rounded-2xl border border-primary/25 bg-[#F0F7FD] dark:bg-primary/15 dark:border-primary/35 p-4 shadow-[0_4px_14px_rgba(36,139,207,0.08)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <AiSparkIcon />
          </span>
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-primary">AI-помощник</h3>
            <p className="text-[11px] text-secondary mt-0.5">Сводка, поиск, черновики</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => void runSummary()}
            className="interactive-press-sm h-10 rounded-xl border border-primary/30 bg-white dark:bg-slate-900 text-[12px] font-semibold text-primary flex items-center justify-center gap-1.5"
          >
            <AiSparkIcon className="w-3.5 h-3.5" />
            Сводка
          </button>
          <button
            type="button"
            onClick={() => void runRecommendations()}
            className="interactive-press-sm h-10 rounded-xl border border-primary/30 bg-white dark:bg-slate-900 text-[12px] font-semibold text-primary flex items-center justify-center gap-1.5"
          >
            <AiSparkIcon className="w-3.5 h-3.5" />
            Рекомендации
          </button>
          {onApplyExamDraft && (
            <button
              type="button"
              onClick={() => void runExamDraft()}
              className="interactive-press-sm h-10 rounded-xl border border-primary/30 bg-white dark:bg-slate-900 text-[12px] font-semibold text-primary flex items-center justify-center gap-1.5 col-span-2"
            >
              <AiSparkIcon className="w-3.5 h-3.5" />
              Черновик осмотра
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            placeholder="Спросить по медкарте…"
            className="flex-1 min-w-0 h-10 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[13px] outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={!searchQuery.trim()}
            onClick={() => void runSearch()}
            className="interactive-press-sm shrink-0 h-10 px-4 rounded-xl bg-primary text-white text-[13px] font-semibold disabled:opacity-45"
          >
            Найти
          </button>
        </div>
      </section>

      <AiResultPanel
        open={mode !== null}
        title={panelTitle}
        loading={loading}
        error={error}
        onClose={closePanel}
      >
        {mode === "recommendations" && recommendations.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recommendations.map((r, i) => (
              <li
                key={i}
                className="rounded-xl border border-primary/15 bg-primary-light/40 dark:bg-primary/10 px-3 py-2.5 text-[13px] text-[#0F172A] dark:text-slate-200 leading-snug"
              >
                {r}
              </li>
            ))}
          </ul>
        )}

        {mode === "exam_draft" && examDraft && (
          <div className="flex flex-col gap-3">
            {(
              [
                ["Процедура", examDraft.procedureTitle],
                ["Описание", examDraft.procedureDescription],
                ["Диагноз", examDraft.diagnosis],
                ["Рекомендации пациенту", examDraft.clinicalNotes],
                ["Материалы", examDraft.materials],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">{label}</p>
                  <p className="text-[13px] text-[#0F172A] dark:text-slate-200 mt-0.5 leading-snug">{value}</p>
                </div>
              ) : null,
            )}
            {onApplyExamDraft && (
              <button
                type="button"
                onClick={() => {
                  onApplyExamDraft(examDraft);
                  closePanel();
                }}
                className="interactive-press-sm w-full h-11 rounded-xl bg-primary text-white text-[14px] font-semibold mt-1"
              >
                Применить к форме
              </button>
            )}
          </div>
        )}

        {(mode === "summary" || mode === "search") && textResult && <AiMarkdownText text={textResult} />}
      </AiResultPanel>
    </>
  );
}
