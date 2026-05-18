"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";

interface Doctor {
  id: string;
  name: string;
  shortName: string;
  specialty: string;
  specialtyTag: "Терапия" | "Хирургия" | "Ортодонтия" | "Имплантология";
  experience: string;
  education: string;
  research: string;
  initials: string;
  color: string;
}

const DOCTORS: Doctor[] = [
  {
    id: "mikhailova",
    name: "Михайлова Анна Владимировна",
    shortName: "Михайлова А.В.",
    specialty: "Терапевт",
    specialtyTag: "Терапия",
    experience: "12 лет опыта",
    education: "НГМУ, кафедра терапевтической стоматологии",
    research:
      "Автор 18 научных публикаций по методам лечения кариеса и реставрационной стоматологии. Участник ежегодных конференций СтАР.",
    initials: "АМ",
    color: "#E3F2FA",
  },
  {
    id: "ivanov",
    name: "Иванов Сергей Петрович",
    shortName: "Иванов С.П.",
    specialty: "Хирург-имплантолог",
    specialtyTag: "Хирургия",
    experience: "17 лет опыта",
    education: "Первый МГМУ им. Сеченова, специализация по хирургии",
    research:
      "Участник международных симпозиумов ITI. Провёл более 2000 операций по имплантации. Автор 15 публикаций по методам костной пластики.",
    initials: "СИ",
    color: "#EFF6FF",
  },
  {
    id: "petrova",
    name: "Петрова Наталья Константиновна",
    shortName: "Петрова Н.К.",
    specialty: "Ортодонт",
    specialtyTag: "Ортодонтия",
    experience: "9 лет опыта",
    education: "КГМУ, ординатура по ортодонтии",
    research:
      "Специалист по системам Invisalign и брекет-терапии. Участник European Orthodontic Society. Автор методических пособий по ретенционному периоду.",
    initials: "НП",
    color: "#FDF4FF",
  },
  {
    id: "sokolov",
    name: "Соколов Дмитрий Игоревич",
    shortName: "Соколов Д.И.",
    specialty: "Хирург-имплантолог",
    specialtyTag: "Имплантология",
    experience: "14 лет опыта",
    education: "СПбГМУ им. Павлова, факультет стоматологии",
    research:
      "Сертифицированный специалист Nobel Biocare и Straumann. Автор 12 публикаций по немедленной нагрузке имплантатов. Кандидат медицинских наук.",
    initials: "ДС",
    color: "#FFF7ED",
  },
];

const FILTERS = ["Все", "Терапия", "Хирургия", "Ортодонтия", "Имплантология"] as const;
type FilterTag = (typeof FILTERS)[number];

const SPECIALTY_BOOKING_SERVICE: Record<string, string> = {
  Терапия: "Терапия",
  Хирургия: "Хирургия",
  Ортодонтия: "Ортодонтия",
  Имплантология: "Хирургия",
};

export default function DoctorsPage() {
  const pathname = usePathname();
  const adminShell = pathname?.startsWith("/screens/admin") ?? false;
  const [activeFilter, setActiveFilter] = useState<FilterTag>("Все");

  const filtered =
    activeFilter === "Все"
      ? DOCTORS
      : DOCTORS.filter((d) => d.specialtyTag === activeFilter);

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header
        title="Наши врачи"
        rightSlot={adminShell ? <ThemeToggleButton sizeClass="w-9 h-9" /> : undefined}
      />

      {/* Filter chips */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`
                interactive-press-sm flex-shrink-0 h-8 px-4 rounded-full text-[13px] font-semibold
                border transition-all duration-150 ease-out shadow-raised-surface
                ${
                  activeFilter === f
                    ? "bg-primary text-white border-primary shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600 active:border-primary active:text-primary"
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <main className="px-6 py-3 flex flex-col gap-4 pb-24">
        {filtered.map((doctor) => (
          <DoctorCard key={doctor.id} doctor={doctor} />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-[15px] text-gray-400">Нет врачей по выбранному фильтру</p>
          </div>
        )}
      </main>

      <BottomBar />
    </div>
  );
}

function DoctorCard({ doctor }: { doctor: Doctor }) {
  const [expanded, setExpanded] = useState(false);
  const bookingService = SPECIALTY_BOOKING_SERVICE[doctor.specialtyTag] ?? "Терапия";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)]">
      {/* Main row */}
      <div className="p-4 flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-[14px] flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: doctor.color }}
        >
          <span className="text-[18px] font-bold text-primary">{doctor.initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#0F172A] dark:text-white leading-tight">{doctor.name}</p>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
              {doctor.specialty}
            </span>
            <span className="text-[12px] text-gray-400">{doctor.experience}</span>
          </div>

          <p className="text-[12px] text-gray-400 mt-1.5 leading-relaxed line-clamp-1">
            {doctor.education}
          </p>
        </div>
      </div>

      {/* Research (expandable) */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="interactive-press-sm flex items-center gap-1.5 text-[12px] text-primary font-medium transition-opacity duration-150 active:opacity-80"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path
              d="M3 5L7 9L11 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Научная деятельность
        </button>

        {expanded && (
          <div className="mt-2 p-3 bg-surface dark:bg-slate-800 rounded-[10px] border border-slate-200 dark:border-slate-700 shadow-inner">
            <p className="text-[13px] text-[#475569] dark:text-slate-400 leading-relaxed">{doctor.research}</p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-[1px] bg-[#E2E8F0] dark:bg-slate-700 mx-4" />

      {/* Action */}
      <div className="p-4">
        <Link
          href={`/booking?doctor=${encodeURIComponent(doctor.shortName)}&service=${encodeURIComponent(bookingService)}`}
          className="
            interactive-press-sm flex items-center justify-center gap-2
            h-11 w-full rounded-[10px]
            bg-primary text-white
            text-[14px] font-semibold
            shadow-[0_4px_14px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/25
          "
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
            <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="white" strokeWidth="1.3" />
            <path d="M5 2V4M11 2V4M2 7H14" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Записаться
        </Link>
      </div>
    </div>
  );
}
