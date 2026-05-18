"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";
import { initTeeth, getTeeth } from "@/lib/teeth";
import type { ToothCondition, ToothStatus } from "@/types";
import { ROUTES } from "@/lib/routes";
import { useDarkMode } from "@/hooks/useDarkMode";
import PatientToothFormula, {
  FormulaToothIcon,
  FORMULA_LEGEND_CONDITIONS,
  getFormulaConditionPalette,
} from "@/components/dental/PatientToothFormula";

// ─── Formula help modal ──────────────────────────────────────────────────────

const BULLET_ITEMS = [
  {
    num: "1",
    label: "Нумерация",
    text: "Мы используем международную систему, где первая цифра — это сектор челюсти, а вторая — номер зуба.",
  },
  {
    num: "2",
    label: "Интерактив",
    text: "Нажмите на любой зуб, чтобы открыть его электронную карту с историей лечения и гарантиями.",
  },
  {
    num: "3",
    label: "Цвета",
    text: "Голубой цвет — зуб пролечен, Красный — требует внимания врача.",
  },
];

function FormulaHelpModal({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-labelledby="formula-help-title">
      <button
        type="button"
        className={`fixed inset-0 cursor-default border-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out outline-none ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
        aria-label="Закрыть справку"
      />

      <div
        className={`fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+5.25rem))] left-1/2 z-[1] w-[calc(100%-32px)] max-w-sm origin-bottom -translate-x-1/2 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] max-h-[min(72vh,calc(100dvh-6rem-env(safe-area-inset-bottom,0px)))] overflow-y-auto ${
          visible ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        style={{ fontFamily: "Manrope, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="formula-help-title"
          className="text-[19px] font-bold text-[#0F172A] dark:text-white mb-3 pr-8"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Как работает формула?
        </h2>

        <button
          type="button"
          onClick={handleClose}
          className="interactive-press-sm absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-slate-100 hover:text-[#64748B] dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label="Закрыть"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <p className="text-[14px] text-[#64748B] dark:text-slate-400 leading-relaxed mb-5">
          Здесь отображается актуальное состояние вашей полости рта.
        </p>

        <div className="flex flex-col gap-4 mb-6">
          {BULLET_ITEMS.map((item) => (
            <div key={item.num} className="flex gap-3 items-start">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold mt-0.5"
                style={{
                  backgroundColor: "var(--color-primary-light)",
                  color: "var(--color-primary)",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                {item.num}
              </span>
              <p className="text-[13px] text-[#374151] dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-[#0F172A] dark:text-white">{item.label}:&nbsp;</span>
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={handleClose}
          className="interactive-press-sm w-full h-[52px] rounded-[14px] text-white text-[15px] font-semibold shadow-[0_4px_14px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/25"
          style={{ backgroundColor: "var(--color-primary)", fontFamily: "Manrope, sans-serif" }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

// ─── Header right actions ──────────────────────────────────────────────────────

function HeaderActions({ onInfoClick }: { onInfoClick: () => void }) {
  return (
    <button
      onClick={onInfoClick}
      className="interactive-press-sm w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-raised-surface"
      aria-label="Справка"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="9" stroke="#9CA3AF" strokeWidth="1.5" />
        <path d="M11 10V15M11 7.5V8.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DentalFormulaPage() {
  const router = useRouter();
  const darkPalette = useDarkMode();
  const [teeth, setTeeth] = useState<ToothStatus[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    initTeeth();
    setTeeth(getTeeth());
  }, []);

  const handleToothClick = (num: number) => {
    setSelected(num);
    router.push(`/tooth/${num}`);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const condPalette = getFormulaConditionPalette(darkPalette);
  const stats = (["healthy", "treated", "caries", "pulpitis", "removed"] as ToothCondition[]).map((c) => ({
    cond: c,
    count: teeth.filter((t) => t.condition === c).length,
    cfg: condPalette[c],
  }));

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title="Формула" showBack backHref={ROUTES.clientHome} rightSlot={<HeaderActions onInfoClick={() => setShowInfo(true)} />} />

      {showInfo && <FormulaHelpModal onClose={() => setShowInfo(false)} />}

      <main className="px-4 py-4 flex flex-col gap-5 pb-24">

        {/* ── Doctor card ── */}
        <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-white/8 px-4 py-3 flex items-center gap-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.22)]">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#e3f2fa] to-[#c7e2f9] dark:from-[#131e2f] dark:to-[#171f31]"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary">
              <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3.5 17.5C3.5 14.5 6.5 12 10 12C13.5 12 16.5 14.5 16.5 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">
              Врач не назначен
            </p>
            <p className="text-[11px] mt-0.5 text-secondary">
              Будет указан после первого приёма
            </p>
          </div>
        </div>

        <PatientToothFormula
          teeth={teeth}
          readOnly={false}
          selectedTooth={selected}
          onToothClick={handleToothClick}
        />

        {/* ── Legend ── */}
        <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-white/8 px-4 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.22)]">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            Обозначения
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {FORMULA_LEGEND_CONDITIONS.map((cond) => {
              const cfg = condPalette[cond];
              return (
                <div key={cond} className="flex items-center gap-2.5">
                  {/* Mini tooth swatch */}
                  <div
                    className="w-7 h-9 flex-shrink-0 rounded-[3px] border overflow-hidden dark:border-white/15"
                    style={{ borderColor: cfg.stroke, background: cfg.fill }}
                  >
                    <FormulaToothIcon condition={cond} darkPalette={darkPalette} />
                  </div>
                  <span className="text-[11px] text-[#374151] dark:text-slate-300 leading-tight">
                    {cfg.legendLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-5 gap-1.5">
          {stats.map(({ cond, count, cfg }) => (
            <div
              key={cond}
              className="bg-white dark:bg-slate-900 rounded-[12px] border border-slate-200 dark:border-white/8 px-1 py-3 text-center shadow-raised-surface"
            >
              <p className="text-[22px] font-bold leading-none" style={{ color: cfg.stroke }}>
                {count}
              </p>
              <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-1 leading-tight">
                {cfg.legendLabel.split(" / ")[0]}
              </p>
            </div>
          ))}
        </div>

      </main>

      <BottomBar />
    </div>
  );
}
