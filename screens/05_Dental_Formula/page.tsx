"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";
import { initTeeth, getTeeth } from "@/lib/teeth";
import type { ToothCondition, ToothStatus } from "@/types";

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
    fill: "#E6F0EF",
    stroke: "#6AAFD0",
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
}: {
  condition: ToothCondition;
  flipped?: boolean;
}) {
  const cfg = CONDITION_CFG[condition];

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
          fill="#EF4444"
          opacity="0.88"
        />
      )}

      {/* ── Removed: X through crown area ── */}
      {cfg.showX && (
        <>
          <line x1="5" y1="3.5" x2="17" y2="11.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17" y1="3.5" x2="5" y2="11.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

// ─── Info BottomSheet ──────────────────────────────────────────────────────────

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

function InfoBottomSheet({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  // Trigger enter animation on next frame after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    // Wait for slide-out transition before unmounting
    setTimeout(onClose, 300);
  };

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 9999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(15,23,42,0.5)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full bg-white dark:bg-slate-900 rounded-t-[28px] px-6 pt-5"
        style={{
          fontFamily: "Manrope, sans-serif",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
          maxWidth: "480px",
          boxShadow: "0 -4px 32px rgba(15,23,42,0.12)",
        }}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-[#E2E8F0] mx-auto mb-6" />

        {/* Title */}
        <h2
          className="text-[19px] font-bold text-[#0F172A] dark:text-white mb-3"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Как работает формула?
        </h2>

        {/* Intro */}
        <p className="text-[14px] text-[#64748B] leading-relaxed mb-5">
          Здесь отображается актуальное состояние вашей полости рта.
        </p>

        {/* Bullets */}
        <div className="flex flex-col gap-4 mb-6">
          {BULLET_ITEMS.map((item) => (
            <div key={item.num} className="flex gap-3 items-start">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold mt-0.5"
                style={{
                  backgroundColor: "#E6F5F4",
                  color: "#00665E",
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

        {/* CTA */}
        <button
          onClick={handleClose}
          className="w-full h-[52px] rounded-[14px] text-white text-[15px] font-semibold active:scale-95 transition-transform"
          style={{ backgroundColor: "#00665E", fontFamily: "Manrope, sans-serif" }}
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
      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 active:scale-95 transition-all"
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
        className="text-center leading-none select-none"
        style={{ fontSize: "9px", color: "#94A3B8", fontFamily: "Manrope, sans-serif" }}
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
          className="relative w-full active:scale-95 transition-transform focus:outline-none"
          style={{ aspectRatio: "1 / 1.4" }}
        >
          {isSelected && (
            <span className="absolute inset-[-2px] rounded-[3px] ring-[1.5px] ring-primary z-10 pointer-events-none" />
          )}
          <ToothIcon condition={condition} flipped={isLower} />
          {hasNote && (
            <span
              className="absolute w-[5px] h-[5px] rounded-full bg-amber-400 border border-white pointer-events-none z-20"
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
        <div className="w-px bg-[#CBD5E1]" />
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
  const stats = (["healthy", "treated", "caries", "removed"] as ToothCondition[]).map((c) => ({
    cond: c,
    count: teeth.filter((t) => t.condition === c).length,
    cfg: CONDITION_CFG[c],
  }));

  return (
    <div className="min-h-dvh bg-surface dark:bg-slate-950 pb-safe">
      <Header title="Формула" showBack backHref="/main" rightSlot={<HeaderActions onInfoClick={() => setShowInfo(true)} />} />

      {showInfo && <InfoBottomSheet onClose={() => setShowInfo(false)} />}

      <main className="px-4 py-4 flex flex-col gap-4 pb-24">

        {/* ── Patient card ── */}
        <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-[#E2E8F0] dark:border-slate-700 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E2E8F0] to-[#CBD5E1] flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="4" stroke="#64748B" strokeWidth="1.4" />
              <path d="M3 18C3 15 6.13 12.5 10 12.5C13.87 12.5 17 15 17 18" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">Александр Коновалов</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              План лечения: №452-В&nbsp;•&nbsp;Обновлено 12.10.2023
            </p>
          </div>
        </div>

        {/* ── Teeth grid card ── */}
        {/* -mx-1 extends card 4px on each side to reclaim padding space for wider teeth */}
        <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-[#E2E8F0] dark:border-slate-700 -mx-1 px-2 py-3 flex flex-col gap-0">

          {/* UPPER JAW label */}
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Верхняя челюсть
            </p>
            <p className="text-[9px] font-medium text-gray-300">
              18&nbsp;—&nbsp;11&nbsp;&nbsp;|&nbsp;&nbsp;21&nbsp;—&nbsp;28
            </p>
          </div>

          {/* Upper jaw: numbers row → teeth row (Q1 left | Q2 right) */}
          <div className="flex flex-col gap-[5px]">
            {renderJaw(Q1, Q2, false)}
          </div>

          {/* ── Midline (horizontal jaw separator) ── */}
          <div className="flex items-center gap-[6px] my-3">
            <div className="h-px flex-1 border-t border-dashed border-[#E2E8F0] dark:border-slate-700" />
            <div className="w-2 h-2 rounded-full border border-[#CBD5E1] dark:border-slate-600 bg-white dark:bg-slate-900 flex-shrink-0" />
            <div className="h-px flex-1 border-t border-dashed border-[#E2E8F0] dark:border-slate-700" />
          </div>

          {/* Lower jaw: teeth row (flipped) → numbers row (Q4 left | Q3 right) */}
          <div className="flex flex-col gap-[5px]">
            {renderJaw(Q4, Q3, true)}
          </div>

          {/* LOWER JAW label */}
          <div className="flex items-center justify-between px-1 mt-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Нижняя челюсть
            </p>
            <p className="text-[9px] font-medium text-gray-300">
              48&nbsp;—&nbsp;41&nbsp;&nbsp;|&nbsp;&nbsp;31&nbsp;—&nbsp;38
            </p>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-[#E2E8F0] dark:border-slate-700 px-4 py-4">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            Обозначения
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {LEGEND_CONDITIONS.map((cond) => {
              const cfg = CONDITION_CFG[cond];
              return (
                <div key={cond} className="flex items-center gap-2.5">
                  {/* Mini tooth swatch */}
                  <div
                    className="w-7 h-9 flex-shrink-0 rounded-[3px] border overflow-hidden"
                    style={{ borderColor: cfg.stroke, background: cfg.fill }}
                  >
                    <ToothIcon condition={cond} />
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
              className="bg-white dark:bg-slate-900 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700 px-1 py-3 text-center"
            >
              <p className="text-[22px] font-bold leading-none" style={{ color: cfg.stroke }}>
                {count}
              </p>
              <p className="text-[9px] text-gray-400 mt-1 leading-tight">
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
