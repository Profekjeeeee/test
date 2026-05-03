"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import {
  getItemStatus,
  getCategoryStageNum,
  type TreatmentPlanItem,
  type TreatmentPlanStats,
  type TreatmentItemStatus,
} from "@/lib/treatmentPlan";
import {
  buildMergedPlanItems,
  getMergedPlanStats,
  initPlanSources,
} from "@/lib/planUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_RU = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU") + " ₽";
}

// ─── Stage grouping ───────────────────────────────────────────────────────────

interface Stage {
  stageNum: number;
  category: string;
  items: TreatmentPlanItem[];
}

function groupIntoStages(plan: TreatmentPlanItem[]): Stage[] {
  const map = new Map<string, TreatmentPlanItem[]>();
  for (const item of plan) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category)!.push(item);
  }

  const stages: Stage[] = [];
  map.forEach((items, category) => {
    stages.push({
      stageNum: getCategoryStageNum(category),
      category,
      // sort by date ascending within stage
      items: [...items].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    });
  });

  return stages.sort((a, b) => a.stageNum - b.stageNum);
}

// ─── Stage status badge ───────────────────────────────────────────────────────

function getStageStatus(items: TreatmentPlanItem[]): TreatmentItemStatus {
  const statuses = items.map((i) => getItemStatus(i.date));
  if (statuses.every((s) => s === "completed")) return "completed";
  if (statuses.some((s) => s === "in-progress" || s === "completed"))
    return "in-progress";
  return "pending";
}

const STAGE_STATUS_CONFIG: Record<
  TreatmentItemStatus,
  { label: string; color: string; dot: string }
> = {
  completed:    { label: "Завершён",    color: "text-primary bg-primary-light", dot: "bg-primary" },
  "in-progress":{ label: "В процессе", color: "text-amber-600 bg-amber-50",    dot: "bg-amber-400" },
  pending:      { label: "Ожидает",    color: "text-gray-500 bg-gray-100",     dot: "bg-gray-300" },
};

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TreatmentItemStatus }) {
  if (status === "completed") {
    return (
      <div className="w-5 h-5 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === "in-progress") {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex-shrink-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-amber-400" />
      </div>
    );
  }
  return <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreatmentPlanPage() {
  const [items, setItems] = useState<TreatmentPlanItem[]>([]);
  const [stats, setStats] = useState<TreatmentPlanStats>({
    completed: 0, inProgress: 0, pending: 0,
    total: 0, paidAmount: 0, totalAmount: 0, progressPercent: 0,
  });

  const refresh = () => {
    const merged = buildMergedPlanItems();
    setItems(merged);
    setStats(getMergedPlanStats());
  };

  useEffect(() => {
    initPlanSources();
    refresh();

    window.addEventListener("appointmentsUpdated", refresh);
    window.addEventListener("treatmentPlanUpdated", refresh);
    return () => {
      window.removeEventListener("appointmentsUpdated", refresh);
      window.removeEventListener("treatmentPlanUpdated", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stages = groupIntoStages(items);

  return (
    <div className="min-h-dvh bg-surface dark:bg-slate-950 pb-safe">
      <Header title="План лечения" showBack />

      <main className="px-5 py-4 flex flex-col gap-5">

        {/* ── Progress Card ──────────────────────────────────────── */}
        <Card>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Оплачено
              </p>
              <p className="text-[22px] font-bold text-primary tabular-nums">
                {formatPrice(stats.paidAmount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                Итого
              </p>
              <p className="text-[22px] font-bold text-[#0F172A] dark:text-white tabular-nums">
                {formatPrice(stats.totalAmount)}
              </p>
            </div>
          </div>

          <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-[12px] text-gray-400">{stats.progressPercent}% выполнено</p>
            <p className="text-[12px] text-gray-400">{stats.completed} из {stats.total} услуг</p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
            {[
              { label: "Выполнено",   value: stats.completed,  barColor: "bg-primary",    textColor: "text-primary" },
              { label: "В процессе",  value: stats.inProgress, barColor: "bg-amber-400",  textColor: "text-amber-600" },
              { label: "Ожидает",     value: stats.pending,    barColor: "bg-gray-200",   textColor: "text-gray-500" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className={`${item.barColor} rounded-[3px] h-1 w-full mb-2`} />
                <p className={`text-[20px] font-bold tabular-nums ${item.textColor}`}>
                  {item.value}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Empty state ─────────────────────────────────────────── */}
        {stages.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 4V18M4 11H18" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[14px] font-medium">План пуст</p>
            <p className="text-[12px] mt-1">
              Запишитесь на приём, чтобы услуги появились здесь
            </p>
          </div>
        )}

        {/* ── Stages ──────────────────────────────────────────────── */}
        {stages.map((stage, stageIdx) => {
          const stageStatus = getStageStatus(stage.items);
          const statusCfg = STAGE_STATUS_CONFIG[stageStatus];

          return (
            <div key={stage.category}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                  Этап {stageIdx + 1}. {stage.category}
                </p>
                <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {stage.items.map((item) => {
                  const status = getItemStatus(item.date);
                  const isDone = status === "completed";

                  return (
                    <Card key={item.id} bordered>
                      <div className="flex items-center gap-3">
                        <StatusIcon status={status} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[14px] font-semibold leading-snug ${isDone ? "text-gray-400 dark:text-slate-600 line-through" : "text-[#0F172A] dark:text-white"}`}>
                            {item.title}
                          </p>
                          <p className={`text-[12px] mt-0.5 ${isDone ? "text-gray-300" : "text-gray-400"}`}>
                            {formatDate(item.date)}
                          </p>
                        </div>
                        <p className={`text-[14px] font-bold flex-shrink-0 ${isDone ? "text-gray-300 dark:text-slate-600" : "text-[#0F172A] dark:text-white"}`}>
                          {formatPrice(item.price)}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

      </main>

      <BottomBar />
    </div>
  );
}
