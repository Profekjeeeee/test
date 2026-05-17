"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";
import { initTeeth, getTeeth } from "@/lib/teeth";
import type { ToothCondition, ToothStatus } from "@/types";
import { ROUTES } from "@/lib/routes";
import { useDarkMode } from "@/hooks/useDarkMode";

// ─── Quadrant arrays (display order left-to-right) ────────────────────────────

const Q1 = [18, 17, 16, 15, 14, 13, 12, 11]; // upper right
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28]; // upper left
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41]; // lower right
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38]; // lower left

// ─── Condition config ──────────────────────────────────────────────────────────

interface ConditionCfg {
  fill: string;
  stroke: string;
  showX?: boolean;
  cariesDot?: boolean;
  legendLabel: string;
}

const CONDITION_CFG: Record<ToothCondition, ConditionCfg> = {
  healthy: {
    fill: "none",
    stroke: "#CBD5E1",
    legendLabel: "Здоров / Без патологий",
  },
  treated: {
    fill: "#e3f2fa",
    stroke: "#248bcf",
    legendLabel: "Пролечен / Пломба",
  },
  caries: {
    fill: "#FEE2E2",
    stroke: "#F87171",
    cariesDot: true,
    legendLabel: "Требует лечения / Кариес",
  },
  removed: {
    fill: "none",
    stroke: "#CBD5E1",
    showX: true,
    legendLabel: "Отсутствует / Удален",
  },
  crown: {
    fill: "#FEF3C7",
    stroke: "#FBBF24",
    legendLabel: "Коронка",
  },
  implant: {
    fill: "#EDE9FE",
    stroke: "#A78BFA",
    legendLabel: "Имплант",
  },
  prosthesis: {
    fill: "#F1F5F9",
    stroke: "#94A3B8",
    legendLabel: "Протез",
  },
};

/** Приглушённая палитра для svg-зубов в тёмной теме — без белых контуров. */
const CONDITION_CFG_DARK: Record<ToothCondition, ConditionCfg> = {
  healthy: {
    fill: "none",
    stroke: "#4b5563",
    legendLabel: CONDITION_CFG.healthy.legendLabel,
  },
  treated: {
    fill: "#151e2e",
    stroke: "#547fa3",
    legendLabel: CONDITION_CFG.treated.legendLabel,
  },
  caries: {
    fill: "#2f1e20",
    stroke: "#b45353",
    cariesDot: true,
    legendLabel: CONDITION_CFG.caries.legendLabel,
  },
  removed: {
    fill: "none",
    stroke: "#575f72",
    showX: true,
    legendLabel: CONDITION_CFG.removed.legendLabel,
  },
  crown: {
    fill: "#2a241b",
    stroke: "#918868",
    legendLabel: CONDITION_CFG.crown.legendLabel,
  },
  implant: {
    fill: "#1f1930",
    stroke: "#6f6494",
    legendLabel: CONDITION_CFG.implant.legendLabel,
  },
  prosthesis: {
    fill: "#1a212c",
    stroke: "#5c6574",
    legendLabel: CONDITION_CFG.prosthesis.legendLabel,
  },
};

const LEGEND_CONDITIONS: ToothCondition[] = ["healthy", "treated", "caries", "removed"];

// ─── Tooth SVG icon ────────────────────────────────────────────────────────────
//
//  viewBox "0 0 24 24" — anatomically accurate single path
//  Crown: y≈3–12 (rounded top, W-cusp silhouette)
//  Two roots: y≈12–21.5 (left root 5→7.5, right root 16.5→19)
//  Gap between root tips is visible in the path shape
//
//  flipped=true → scaleY(-1) for lower jaw (roots pointing up)

const TOOTH_PATH =
  "M6.5 3C4.5 3 3 4.5 3 7C3 9.5 4.5 11 5.5 12C5.5 12 5 15 5 18C5 20.5 6 21.5 7.5 21.5C9 21.5 10 20.5 10.5 18.5C11 16.5 11.5 13 12 13C12.5 13 13 16.5 13.5 18.5C14 20.5 15 21.5 16.5 21.5C18 21.5 19 20.5 19 18C19 15 18.5 12 18.5 12C19.5 11 21 9.5 21 7C21 4.5 19.5 3 17.5 3C15.5 3 14 4.5 12 4.5C10 4.5 8.5 3 6.5 3Z";

function ToothIcon({
  condition,
  flipped = false,
  darkPalette = false,
}: {
  condition: ToothCondition;
  flipped?: boolean;
  darkPalette?: boolean;
}) {
  const cfg = (darkPalette ? CONDITION_CFG_DARK : CONDITION_CFG)[condition];

  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={flipped ? { transform: "scaleY(-1)" } : undefined}
      overflow="visible"
    >
      {/* ── Tooth body (crown + roots as one anatomical shape) ── */}
      <path
        d={TOOTH_PATH}
        fill={cfg.fill}
        stroke={cfg.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* ── Caries: red ellipse in crown center (crown is y≈3–12, center≈7.5) ── */}
      {cfg.cariesDot && (
        <ellipse
          cx="12"
          cy="7.5"
          rx="3.2"
          ry="2.6"
          fill={darkPalette ? "#dc2626" : "#EF4444"}
          opacity={darkPalette ? 0.75 : 0.88}
        />
      )}

      {/* ── Removed: X through crown area ── */}
      {cfg.showX && (
        <>
          <line
            x1="5"
            y1="3.5"
            x2="17"
            y2="11.5"
            stroke={darkPalette ? "#64748b" : "#94A3B8"}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="17"
            y1="3.5"
            x2="5"
            y2="11.5"
            stroke={darkPalette ? "#64748b" : "#94A3B8"}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

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
          className="interactive-press-sm absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-slate-100 hover:text-[#64748B] dark:hover:bg-slate-800 dark:hover:text-slate-300"
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

  const teethMap = Object.fromEntries(teeth.map((t) => [t.number, t]));

  const handleToothClick = (num: number) => {
    setSelected(num);
    router.push(`/tooth/${num}`);
  };

  const getCondition = (num: number): ToothCondition =>
    teethMap[num]?.condition ?? "healthy";

  // ── Renders a full jaw row: left quadrant | separator | right quadrant ───────
  // isLower=true  → teeth flipped (roots up), numbers below teeth
  // isLower=false → teeth normal (roots down), numbers above teeth
  //
  // Upper: leftNums=Q1(18→11), rightNums=Q2(21→28)  — gap between 11 and 21
  // Lower: leftNums=Q4(48→41), rightNums=Q3(31→38)  — gap between 41 and 31
  const renderJaw = (leftNums: number[], rightNums: number[], isLower: boolean) => {
    const numCell = (num: number) => (
      <p
        key={num}
        className="text-center leading-none select-none text-[9px] font-medium text-slate-400 dark:text-slate-500 tracking-tight font-manrope"
      >
        {num}
      </p>
    );

    const toothCell = (num: number) => {
      const condition = getCondition(num);
      const isSelected = selected === num;
      const hasNote = teethMap[num]?.hasNote;
      return (
        <button
          key={num}
          onClick={() => handleToothClick(num)}
          className="relative w-full interactive-press-sm focus:outline-none"
          style={{ aspectRatio: "1 / 1.4" }}
        >
          {isSelected && (
            <span className="absolute inset-[-2px] rounded-[3px] ring-[1.5px] ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-950 dark:ring-primary/50 z-10 pointer-events-none" />
          )}
          <ToothIcon condition={condition} flipped={isLower} darkPalette={darkPalette} />
          {hasNote && (
            <span
              className="absolute w-[5px] h-[5px] rounded-full bg-amber-400/90 border border-white dark:border-white/25 pointer-events-none z-20"
              style={isLower ? { bottom: "-1px", right: "-1px" } : { top: "-1px", right: "-1px" }}
            />
          )}
        </button>
      );
    };

    const halfGrid = (nums: number[], renderer: (n: number) => React.ReactNode) => (
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(8, 1fr)", flex: 1, minWidth: 0 }}
      >
        {nums.map(renderer)}
      </div>
    );

    // Vertical midline separator — visible between 11/21 and 41/31
    const midSep = (
      <div className="flex-shrink-0 flex items-stretch justify-center" style={{ width: "5px" }}>
        <div className="w-px bg-[#CBD5E1] dark:bg-white/10" />
      </div>
    );

    const numberRow = (
      <div key="nums" className="flex items-center">
        {halfGrid(leftNums, numCell)}
        <div className="flex-shrink-0" style={{ width: "5px" }} />
        {halfGrid(rightNums, numCell)}
      </div>
    );

    const teethRow = (
      <div key="teeth" className="flex items-stretch">
        {halfGrid(leftNums, toothCell)}
        {midSep}
        {halfGrid(rightNums, toothCell)}
      </div>
    );

    return isLower ? [teethRow, numberRow] : [numberRow, teethRow];
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const condPalette = darkPalette ? CONDITION_CFG_DARK : CONDITION_CFG;
  const stats = (["healthy", "treated", "caries", "removed"] as ToothCondition[]).map((c) => ({
    cond: c,
    count: teeth.filter((t) => t.condition === c).length,
    cfg: condPalette[c],
  }));

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title="Формула" showBack backHref={ROUTES.clientHome} rightSlot={<HeaderActions onInfoClick={() => setShowInfo(true)} />} />

      {showInfo && <FormulaHelpModal onClose={() => setShowInfo(false)} />}

      <main className="px-4 py-4 flex flex-col gap-4 pb-24">

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
            <p className="text-[11px] mt-0.5" style={{ color: "#9ab0c5" }}>
              Будет указан после первого приёма
            </p>
          </div>
        </div>

        {/* ── Teeth grid card ── */}
        {/* -mx-1 extends card 4px on each side to reclaim padding space for wider teeth */}
        <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-white/6 -mx-1 px-2 py-3 flex flex-col gap-0 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.22)]">

          {/* UPPER JAW label */}
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              Верхняя челюсть
            </p>
            <p className="text-[9px] font-medium text-gray-400 dark:text-slate-600">
              18&nbsp;—&nbsp;11&nbsp;&nbsp;|&nbsp;&nbsp;21&nbsp;—&nbsp;28
            </p>
          </div>

          {/* Upper jaw: numbers row → teeth row (Q1 left | Q2 right) */}
          <div className="flex flex-col gap-[5px]">
            {renderJaw(Q1, Q2, false)}
          </div>

          {/* ── Midline (horizontal jaw separator) ── */}
          <div className="flex items-center gap-[6px] my-3">
            <div className="h-px flex-1 border-t border-dashed border-[#E2E8F0] dark:border-slate-800/70" />
            <div className="w-2 h-2 rounded-full border border-[#CBD5E1] dark:border-white/15 bg-white dark:bg-slate-900 flex-shrink-0" />
            <div className="h-px flex-1 border-t border-dashed border-[#E2E8F0] dark:border-slate-800/70" />
          </div>

          {/* Lower jaw: teeth row (flipped) → numbers row (Q4 left | Q3 right) */}
          <div className="flex flex-col gap-[5px]">
            {renderJaw(Q4, Q3, true)}
          </div>

          {/* LOWER JAW label */}
          <div className="flex items-center justify-between px-1 mt-2">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              Нижняя челюсть
            </p>
            <p className="text-[9px] font-medium text-gray-400 dark:text-slate-600">
              48&nbsp;—&nbsp;41&nbsp;&nbsp;|&nbsp;&nbsp;31&nbsp;—&nbsp;38
            </p>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-white/8 px-4 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.22)]">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            Обозначения
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {LEGEND_CONDITIONS.map((cond) => {
              const cfg = condPalette[cond];
              return (
                <div key={cond} className="flex items-center gap-2.5">
                  {/* Mini tooth swatch */}
                  <div
                    className="w-7 h-9 flex-shrink-0 rounded-[3px] border overflow-hidden dark:border-white/15"
                    style={{ borderColor: cfg.stroke, background: cfg.fill }}
                  >
                    <ToothIcon condition={cond} darkPalette={darkPalette} />
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
        <div className="grid grid-cols-4 gap-2">
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
