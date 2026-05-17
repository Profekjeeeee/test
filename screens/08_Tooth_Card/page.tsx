"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import { initTeeth, getTooth } from "@/lib/teeth";
import type { ToothCondition, ToothStatus } from "@/types";

// ─── Static condition metadata ─────────────────────────────────────────────────

interface StatusMeta {
  label: string;
  subLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icdCode?: string;
}

const STATUS_META: Record<ToothCondition, StatusMeta> = {
  healthy: {
    label: "Здоров",
    subLabel: "Патологий не обнаружено",
    color: "#248bcf",
    bgColor: "#e3f2fa",
    borderColor: "#7dd3fc",
    icdCode: undefined,
  },
  treated: {
    label: "Пролечен / Пломба",
    subLabel: "Проведено пломбирование, рекомендован осмотр",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    borderColor: "#93C5FD",
    icdCode: "K02.1",
  },
  caries: {
    label: "Кариес",
    subLabel: "Требует срочного лечения",
    color: "#EF4444",
    bgColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    icdCode: "K02.1",
  },
  pulpitis: {
    label: "Пульпит",
    subLabel: "Воспаление мягких тканей зуба, нужна консультация",
    color: "#EA580C",
    bgColor: "#FFF7ED",
    borderColor: "#FDBA74",
    icdCode: "K04.0",
  },
  removed: {
    label: "Зуб удалён",
    subLabel: "Рекомендована имплантация",
    color: "#6B7280",
    bgColor: "#F9FAFB",
    borderColor: "#D1D5DB",
    icdCode: "K08.1",
  },
  crown: {
    label: "Коронка",
    subLabel: "Установлена керамическая коронка",
    color: "#248bcf",
    bgColor: "#e3f2fa",
    borderColor: "#7dd3fc",
    icdCode: undefined,
  },
  implant: {
    label: "Имплант",
    subLabel: "Установлен дентальный имплант",
    color: "#7C3AED",
    bgColor: "#F5F3FF",
    borderColor: "#C4B5FD",
    icdCode: undefined,
  },
  prosthesis: {
    label: "Протез",
    subLabel: "Установлен съёмный протез",
    color: "#64748B",
    bgColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    icdCode: undefined,
  },
};

// ─── Mock history per condition ────────────────────────────────────────────────

interface HistoryItem {
  date: string;
  procedure: string;
  doctor: string;
  price: number | null;
  note?: string;
}

function getMockHistory(condition: ToothCondition, toothNum: number): HistoryItem[] {
  if (condition === "healthy") {
    return [
      {
        date: "14 марта 2025",
        procedure: "Плановый осмотр",
        doctor: "Михайлова А.В.",
        price: 0,
      },
    ];
  }
  if (condition === "treated") {
    return [
      {
        date: "15 апреля 2025",
        procedure: "Пломбирование",
        doctor: "Михайлова А.В.",
        price: 4200,
        note: "Composite A2, стеклоиономерный штифт",
      },
      {
        date: "22 февраля 2025",
        procedure: "Препарирование кариозной полости",
        doctor: "Михайлова А.В.",
        price: 1800,
      },
      {
        date: "3 января 2025",
        procedure: "Первичный осмотр",
        doctor: "Иванов С.П.",
        price: 0,
      },
    ];
  }
  if (condition === "caries") {
    return [
      {
        date: "10 октября 2023",
        procedure: "Диагностика кариеса IV класса",
        doctor: "Михайлова А.В.",
        price: 1400,
        note: "Удаление поражённых тканей, установка светоотверждаемой пломбы",
      },
      {
        date: "22 марта 2022",
        procedure: "Профессиональная гигиена",
        doctor: "Иванов С.П.",
        price: 3500,
        note: "Удаление твёрдых зубных отложений, ультразвук, Air-flow, фторирование",
      },
      {
        date: "10 января 2020",
        procedure: "Первичный осмотр",
        doctor: "Иванов С.П.",
        price: 0,
        note: "Составление индивидуального плана лечения, RT-диагностика",
      },
    ];
  }
  if (condition === "pulpitis") {
    return [
      {
        date: "8 ноября 2024",
        procedure: "Диагностика острого пульпита",
        doctor: "Иванов С.П.",
        price: 900,
        note: "Витальное окрашивание, термодиагностика — показания к эндо",
      },
      {
        date: "14 марта 2025",
        procedure: "Плановый осмотр",
        doctor: "Михайлова А.В.",
        price: 0,
      },
    ];
  }
  if (condition === "removed") {
    return [
      {
        date: "5 июня 2022",
        procedure: "Удаление зуба",
        doctor: "Петров Д.М.",
        price: 3200,
        note: "Простое удаление, наложение швов",
      },
      {
        date: "3 июня 2022",
        procedure: "Рентгенография",
        doctor: "Иванов С.П.",
        price: 800,
      },
    ];
  }
  if (condition === "crown") {
    return [
      {
        date: "12 октября 2022",
        procedure: "Фиксация коронки",
        doctor: "Сидорова Е.А.",
        price: 18500,
        note: "Керамическая коронка на диоксиде циркония",
      },
      {
        date: "28 сентября 2022",
        procedure: "Подготовка под коронку",
        doctor: "Сидорова Е.А.",
        price: 4200,
      },
    ];
  }
  return [
    {
      date: "15 января 2025",
      procedure: "Первичный осмотр",
      doctor: "Михайлова А.В.",
      price: 0,
    },
  ];
}

function getMockMaterials(condition: ToothCondition): string | null {
  if (condition === "treated") return "Композит Aelada, стеклоиономерный штифт";
  if (condition === "crown") return "Диоксид циркония, керамика E.max";
  if (condition === "implant") return "Имплант Straumann BLX 4.5×10мм, абатмент";
  return null;
}

function getGuarantee(condition: ToothCondition): { label: string; active: boolean } | null {
  if (condition === "treated")
    return { label: "До 12.05.2025", active: false };
  if (condition === "crown")
    return { label: "До 10.10.2027", active: true };
  if (condition === "implant")
    return { label: "До 15.01.2030", active: true };
  return null;
}

// ─── Quadrant label ────────────────────────────────────────────────────────────

function getQuadrantLabel(num: number): string {
  const n = Number(num);
  if (n >= 11 && n <= 18) return "Верхняя правая";
  if (n >= 21 && n <= 28) return "Верхняя левая";
  if (n >= 31 && n <= 38) return "Нижняя левая";
  if (n >= 41 && n <= 48) return "Нижняя правая";
  return "";
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ToothCardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toothNum = Number(params?.id ?? 0);

  const [tooth, setTooth] = useState<ToothStatus | null>(null);

  useEffect(() => {
    initTeeth();
    const found = getTooth(toothNum);
    if (found) {
      setTooth(found);
    } else {
      // Fallback: show healthy state for unknown tooth
      setTooth({
        number: toothNum,
        condition: "healthy",
        jaw: toothNum < 30 ? "upper" : "lower",
        side: toothNum % 10 < 5 ? "right" : "left",
        hasNote: false,
      });
    }
  }, [toothNum]);

  if (!tooth) {
    return (
      <div className="min-h-dvh bg-surface dark:bg-app-canvas flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const meta = STATUS_META[tooth.condition];
  const history = getMockHistory(tooth.condition, toothNum);
  const materials = getMockMaterials(tooth.condition);
  const guarantee = getGuarantee(tooth.condition);

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title={`Зуб №${toothNum}`} showBack />

      <main className="px-4 py-4 flex flex-col gap-3 pb-28">
        {/* Quadrant chip */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-400">
            {getQuadrantLabel(toothNum)} • FDI {toothNum}
          </span>
        </div>

        {/* Status card */}
        <div
          className="rounded-[16px] border p-4"
          style={{
            background: meta.bgColor,
            borderColor: meta.borderColor,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: meta.color }}>
            Текущий статус
          </p>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[20px] font-bold text-[#0F172A] leading-tight">
                {meta.label}
              </p>
              {meta.icdCode && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {meta.icdCode} по МКБ-10
                </p>
              )}
              <p className="text-[13px] mt-1.5 leading-snug" style={{ color: meta.color }}>
                {meta.subLabel}
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: meta.color + "22" }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2C7.5 2 5 4 5 7C5 9 6 10.5 6.5 12C7 13.5 7 15 6.5 17C6 18.5 7 19.5 8 19.5C9 19.5 9.5 18.5 10 17"
                  stroke={meta.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M10 2C12.5 2 15 4 15 7C15 9 14 10.5 13.5 12C13 13.5 13 15 13.5 17C14 18.5 13 19.5 12 19.5C11 19.5 10.5 18.5 10 17"
                  stroke={meta.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Note banner */}
        {tooth.notes && (
          <div className="rounded-[12px] bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
              <path
                d="M8 1.5L14.5 13H1.5L8 1.5Z"
                stroke="#F59E0B"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M8 6V9.5" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.7" fill="#F59E0B" />
            </svg>
            <p className="text-[12px] text-amber-700">{tooth.notes}</p>
          </div>
        )}

        {/* Guarantee */}
        {guarantee && (
          <Card>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Гарантия
            </p>
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-[#0F172A]">
                {guarantee.label}
              </p>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  guarantee.active
                    ? "bg-primary-light text-primary"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {guarantee.active ? "Активна" : "Истекла"}
              </span>
            </div>
          </Card>
        )}

        {/* Materials */}
        {materials && (
          <Card>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Материалы
            </p>
            <p className="text-[14px] text-[#374151]">{materials}</p>
          </Card>
        )}

        {/* Treatment history */}
        <div>
          <p className="text-[12px] font-bold text-[#0F172A] uppercase tracking-wider mb-3">
            История лечения
          </p>
          <div className="flex flex-col gap-2">
            {history.map((item, i) => (
              <div key={i} className="bg-white rounded-[12px] border border-[#E2E8F0] px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-medium text-gray-400 uppercase">
                        {item.date}
                      </span>
                    </div>
                    <p className="text-[14px] font-semibold text-[#0F172A] leading-snug">
                      {item.procedure}
                    </p>
                    <p className="text-[12px] text-gray-400 mt-0.5">{item.doctor}</p>
                    {item.note && (
                      <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                        {item.note}
                      </p>
                    )}
                  </div>
                  {item.price !== null && (
                    <p
                      className={`text-[14px] font-semibold flex-shrink-0 ${
                        item.price === 0 ? "text-gray-300" : "text-[#0F172A]"
                      }`}
                    >
                      {item.price === 0 ? "0 ₽" : `${item.price.toLocaleString("ru-RU")} ₽`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[390px] px-4 pb-2 pt-2 bg-gradient-to-t from-surface to-surface/0 z-40">
        <Link
          href="/booking"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-[12px] bg-primary text-white text-[15px] font-semibold active:scale-95 transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1.5" y="3" width="15" height="13.5" rx="2" stroke="white" strokeWidth="1.4" />
            <path d="M6 1.5V4.5M12 1.5V4.5M1.5 7.5H16.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Записаться на приём
        </Link>
        <div className="mt-2 text-center">
          <button
            onClick={() => router.push("/formula")}
            className="text-[13px] font-medium text-primary"
          >
            ← Формула
          </button>
        </div>
      </div>

      <BottomBar />
    </div>
  );
}
