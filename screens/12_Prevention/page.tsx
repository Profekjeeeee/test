"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import { useClientNow } from "@/hooks/useClientNow";
import { formatRuNumericLongDateStable } from "@/lib/doctorSchedule";
import { initPatientVisits, getPatientVisits } from "@/lib/patientVisits";
import { initMedicalRecords, getMedicalRecords } from "@/lib/medicalRecords";
import {
  buildPatientRecommendations,
  computePreventionSchedule,
  type PatientRecommendation,
} from "@/lib/patientRecommendations";
import { formatVisitDate } from "@/lib/patientVisits";

function RecommendationIcon({ rec }: { rec: PatientRecommendation }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path
        d="M7.5 1.5L9 5.5L13 6.2L10.2 8.8L10.8 13L7.5 11.2L4.2 13L4.8 8.8L2 6.2L6 5.5L7.5 1.5Z"
        stroke="#9ab0c5"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PreventionSkeleton() {
  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe" aria-busy>
      <Header title="Профилактика" showBack />
      <main className="px-6 py-4 flex flex-col gap-4">
        <Card>
          <div className="h-24 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
        </Card>
        <Card>
          <div className="h-32 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
        </Card>
      </main>
      <BottomBar />
    </div>
  );
}

export default function PreventionPage() {
  const clock = useClientNow();
  const [recommendations, setRecommendations] = useState<PatientRecommendation[]>([]);
  const [schedule, setSchedule] = useState<ReturnType<typeof computePreventionSchedule> | null>(null);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    void Promise.all([initPatientVisits(), initMedicalRecords()]).then(() => {
      const visits = getPatientVisits();
      const records = getMedicalRecords();
      setRecommendations(buildPatientRecommendations(visits, records));
      setSchedule(computePreventionSchedule(visits));
      setDataReady(true);
    });

    const sync = () => {
      const visits = getPatientVisits();
      const records = getMedicalRecords();
      setRecommendations(buildPatientRecommendations(visits, records));
      setSchedule(computePreventionSchedule(visits));
    };

    window.addEventListener("patientVisitsUpdated", sync);
    window.addEventListener("medicalRecordsUpdated", sync);
    return () => {
      window.removeEventListener("patientVisitsUpdated", sync);
      window.removeEventListener("medicalRecordsUpdated", sync);
    };
  }, []);

  if (!clock || !dataReady || !schedule) return <PreventionSkeleton />;

  const { lastVisitDate, nextVisitDate, daysUntilNextVisit, progressPercent } = schedule;
  const hygienistVisit = new Date(nextVisitDate);
  hygienistVisit.setMonth(hygienistVisit.getMonth());

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title="Профилактика" showBack />

      <main className="px-6 py-4 flex flex-col gap-4">
        <Card>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Следующий осмотр
          </p>
          <div className="flex justify-between items-end mb-3">
            <p className="text-[28px] font-bold text-[#0F172A] dark:text-white">
              {daysUntilNextVisit}{" "}
              <span className="text-[16px] font-medium text-gray-400">дней</span>
            </p>
            <p className="text-[14px] text-gray-400">{formatRuNumericLongDateStable(nextVisitDate)}</p>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[12px] text-gray-400 mt-1.5">
            {progressPercent}% до следующего визита
            {lastVisitDate ? ` · последний: ${formatRuNumericLongDateStable(lastVisitDate)}` : ""}
          </p>
        </Card>

        <Card>
          <p
            className="text-[12px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#9ab0c5" }}
          >
            Рекомендации врача
          </p>
          {recommendations.length === 0 ? (
            <p className="text-[13px] text-secondary py-3">
              После приёма врач добавит персональные рекомендации — они появятся здесь.
            </p>
          ) : (
            recommendations.map((rec, i) => (
              <div
                key={rec.id}
                className="flex items-start gap-3 py-2.5"
                style={{ borderBottom: i < recommendations.length - 1 ? "1px solid #f0f4f7" : "none" }}
              >
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: "#EEF3F7" }}
                >
                  <RecommendationIcon rec={rec} />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[#0F172A] dark:text-white leading-snug">
                    {rec.text}
                  </p>
                  {rec.source === "visit" && rec.procedureTitle && (
                    <p className="text-[11px] text-secondary mt-0.5">
                      {rec.procedureTitle}
                      {rec.visitDate ? ` · ${formatVisitDate(rec.visitDate)}` : ""}
                      {rec.doctorName ? ` · ${rec.doctorName}` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Плановые осмотры
          </p>
          {[
            {
              label: "Последний осмотр",
              date: lastVisitDate ? formatRuNumericLongDateStable(lastVisitDate) : "Нет данных",
              upcoming: false,
            },
            {
              label: "Следующий осмотр",
              date: formatRuNumericLongDateStable(nextVisitDate),
              upcoming: true,
            },
            {
              label: "Чистка (гигиенист)",
              date: formatRuNumericLongDateStable(hygienistVisit),
              upcoming: true,
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0"
            >
              <p className="text-[14px] text-gray-500">{item.label}</p>
              <p
                className={`text-[14px] font-semibold ${
                  item.upcoming ? "text-primary" : "text-[#0F172A] dark:text-white"
                }`}
              >
                {item.date}
              </p>
            </div>
          ))}
        </Card>
      </main>

      <BottomBar />
    </div>
  );
}
