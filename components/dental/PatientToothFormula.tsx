"use client";

import React, { useMemo } from "react";
import type { ToothCondition, ToothStatus } from "@/types";
import { useDarkMode } from "@/hooks/useDarkMode";

/** Порядок как на экране пациента (ЛК): Q1 | Q2 сверху, Q4 | Q3 снизу */
export const FORMULA_Q1 = [18, 17, 16, 15, 14, 13, 12, 11];
export const FORMULA_Q2 = [21, 22, 23, 24, 25, 26, 27, 28];
export const FORMULA_Q4 = [48, 47, 46, 45, 44, 43, 42, 41];
export const FORMULA_Q3 = [31, 32, 33, 34, 35, 36, 37, 38];

export interface FormulaConditionCfg {
  fill: string;
  stroke: string;
  showX?: boolean;
  cariesDot?: boolean;
  pulpitisDot?: boolean;
  legendLabel: string;
}

const CONDITION_CFG: Record<ToothCondition, FormulaConditionCfg> = {
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
  pulpitis: {
    fill: "#FFF7ED",
    stroke: "#EA580C",
    pulpitisDot: true,
    legendLabel: "Пульпит",
  },
  removed: {
    fill: "none",
    stroke: "#CBD5E1",
    showX: true,
    legendLabel: "Отсутствует / Удален",
  },
  crown: {
    fill: "#dbeafe",
    stroke: "#1d6dae",
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

const CONDITION_CFG_DARK: Record<ToothCondition, FormulaConditionCfg> = {
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
  pulpitis: {
    fill: "#3b2418",
    stroke: "#ea580c",
    pulpitisDot: true,
    legendLabel: CONDITION_CFG.pulpitis.legendLabel,
  },
  removed: {
    fill: "none",
    stroke: "#575f72",
    showX: true,
    legendLabel: CONDITION_CFG.removed.legendLabel,
  },
  crown: {
    fill: "#151e2e",
    stroke: "#5b9bd5",
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

const TOOTH_PATH =
  "M6.5 3C4.5 3 3 4.5 3 7C3 9.5 4.5 11 5.5 12C5.5 12 5 15 5 18C5 20.5 6 21.5 7.5 21.5C9 21.5 10 20.5 10.5 18.5C11 16.5 11.5 13 12 13C12.5 13 13 16.5 13.5 18.5C14 20.5 15 21.5 16.5 21.5C18 21.5 19 20.5 19 18C19 15 18.5 12 18.5 12C19.5 11 21 9.5 21 7C21 4.5 19.5 3 17.5 3C15.5 3 14 4.5 12 4.5C10 4.5 8.5 3 6.5 3Z";

export function FormulaToothIcon({
  condition,
  flipped = false,
  darkPalette = false,
}: {
  condition: ToothCondition;
  flipped?: boolean;
  darkPalette?: boolean;
}) {
  const palette = darkPalette ? CONDITION_CFG_DARK : CONDITION_CFG;
  const cfg = palette[condition] ?? palette.healthy;

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
      <path
        d={TOOTH_PATH}
        fill={cfg.fill}
        stroke={cfg.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
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
      {cfg.pulpitisDot && (
        <>
          <ellipse
            cx="12"
            cy="7.5"
            rx="3"
            ry="2.4"
            fill={darkPalette ? "#ea580c" : "#F97316"}
            opacity={darkPalette ? 0.72 : 0.88}
          />
          <circle cx="12" cy="14.5" r="2.1" fill={darkPalette ? "#c2410c" : "#EA580C"} opacity={0.85} />
        </>
      )}
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

export const FORMULA_LEGEND_CONDITIONS: ToothCondition[] = ["healthy", "treated", "caries", "removed"];

export function getFormulaConditionPalette(darkPalette: boolean): Record<ToothCondition, FormulaConditionCfg> {
  return darkPalette ? CONDITION_CFG_DARK : CONDITION_CFG;
}

export interface PatientToothFormulaProps {
  teeth: ToothStatus[];
  /** Только просмотр: без кликов и без кольца выбора */
  readOnly?: boolean;
  selectedTooth?: number | null;
  onToothClick?: (num: number) => void;
  /** Обёртка как у карточки на экране «Формула» пациента */
  variant?: "card" | "flush";
  className?: string;
}

/**
 * Сетка зубной формулы — те же SVG и раскладка, что в ЛК пациента (`screens/05_Dental_Formula`).
 */
export default function PatientToothFormula({
  teeth,
  readOnly = false,
  selectedTooth = null,
  onToothClick,
  variant = "card",
  className = "",
}: PatientToothFormulaProps) {
  const darkPalette = useDarkMode();

  const teethMap = useMemo(() => Object.fromEntries(teeth.map((t) => [t.number, t])), [teeth]);

  const getCondition = (num: number): ToothCondition => {
    const c = teethMap[num]?.condition;
    if (c && c in CONDITION_CFG) return c;
    return "healthy";
  };

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
      const isSelected = selectedTooth === num;
      const hasNote = teethMap[num]?.hasNote;
      const glyph = (
        <>
          <FormulaToothIcon condition={condition} flipped={isLower} darkPalette={darkPalette} />
          {hasNote && (
            <span
              className="absolute w-[5px] h-[5px] rounded-full bg-amber-400/90 border border-white dark:border-white/25 pointer-events-none z-20"
              style={isLower ? { bottom: "-1px", right: "-1px" } : { top: "-1px", right: "-1px" }}
            />
          )}
        </>
      );

      if (readOnly || !onToothClick) {
        return (
          <div key={num} className="relative w-full" style={{ aspectRatio: "1 / 1.4" }}>
            {glyph}
          </div>
        );
      }

      return (
        <button
          key={num}
          type="button"
          onClick={() => onToothClick(num)}
          className="relative z-10 hover:z-20 w-full interactive-press-sm focus:outline-none after:absolute after:inset-[-6px] after:content-['']"
          style={{ aspectRatio: "1 / 1.4" }}
        >
          {isSelected && (
            <span className="absolute inset-[-2px] rounded-[3px] ring-[1.5px] ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-950 dark:ring-primary/50 z-10 pointer-events-none" />
          )}
          {glyph}
        </button>
      );
    };

    const halfGrid = (nums: number[], renderer: (n: number) => React.ReactNode) => (
      <div className="grid" style={{ gridTemplateColumns: "repeat(8, 1fr)", flex: 1, minWidth: 0 }}>
        {nums.map(renderer)}
      </div>
    );

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

  const inner = (
    <>
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
          Верхняя челюсть
        </p>
        <p className="text-[9px] font-medium text-gray-400 dark:text-slate-600">
          18&nbsp;—&nbsp;11&nbsp;&nbsp;|&nbsp;&nbsp;21&nbsp;—&nbsp;28
        </p>
      </div>

      <div className="flex flex-col gap-[5px]">{renderJaw(FORMULA_Q1, FORMULA_Q2, false)}</div>

      <div className="flex items-center gap-[6px] my-3">
        <div className="h-px flex-1 border-t border-dashed border-[#E2E8F0] dark:border-slate-800/70" />
        <div className="w-2 h-2 rounded-full border border-[#CBD5E1] dark:border-white/15 bg-white dark:bg-slate-900 flex-shrink-0" />
        <div className="h-px flex-1 border-t border-dashed border-[#E2E8F0] dark:border-slate-800/70" />
      </div>

      <div className="flex flex-col gap-[5px]">{renderJaw(FORMULA_Q4, FORMULA_Q3, true)}</div>

      <div className="flex items-center justify-between px-1 mt-2">
        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
          Нижняя челюсть
        </p>
        <p className="text-[9px] font-medium text-gray-400 dark:text-slate-600">
          48&nbsp;—&nbsp;41&nbsp;&nbsp;|&nbsp;&nbsp;31&nbsp;—&nbsp;38
        </p>
      </div>
    </>
  );

  if (variant === "flush") {
    return <div className={className}>{inner}</div>;
  }

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-white/6 -mx-1 px-2 py-3 flex flex-col gap-0 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.22)] ${className}`}
    >
      {inner}
    </div>
  );
}
