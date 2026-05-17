"use client";

import type { ToothStatus } from "@/types";
import PatientToothFormula from "@/components/dental/PatientToothFormula";
import { dispatchDoctorOpenPatientMedicalSheet } from "@/lib/doctorMedicalSheetEvents";

export default function ConsiliumFormulaPreview({
  open,
  onClose,
  patientId,
  patientName,
  formulaTeeth,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  formulaTeeth: ToothStatus[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex flex-col justify-end sm:justify-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] border-0 cursor-default"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consilium-formula-title"
        className="relative z-[1] w-full max-w-[480px] mx-auto max-h-[min(92dvh,720px)] flex flex-col rounded-t-[22px] sm:rounded-[22px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_-12px_48px_rgba(15,23,42,0.18)] sm:shadow-[0_24px_64px_rgba(15,23,42,0.2)] overflow-hidden"
      >
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Консилиум</p>
            <h2
              id="consilium-formula-title"
              className="text-[18px] font-bold text-[#0F172A] dark:text-white leading-tight mt-0.5 truncate"
            >
              {patientName.trim() || "Пациент"}
            </h2>
            <p className="text-[12px] text-secondary mt-1">Снимок зубной формулы на момент направления</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="interactive-press-sm w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-600 text-secondary shrink-0"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="rounded-2xl border border-primary/20 bg-primary-light/40 dark:bg-primary/10 p-3">
            <PatientToothFormula teeth={formulaTeeth} readOnly variant="card" />
          </div>
        </div>
        <div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              dispatchDoctorOpenPatientMedicalSheet(patientId);
              onClose();
            }}
            className="w-full h-11 rounded-xl bg-primary text-white text-[14px] font-semibold shadow-[0_4px_14px_rgba(36,139,207,0.35)] interactive-press-sm"
          >
            Полная медкарта
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-600 text-[14px] font-semibold text-secondary interactive-press-sm"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
