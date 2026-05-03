"use client";

import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";

function IconBrush() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="5.5" y="2.5" width="4" height="6" rx="1.2" stroke="#9ab0c5" strokeWidth="1.3" />
      <path d="M6.5 4.5H8.5M6.5 6H8.5" stroke="#9ab0c5" strokeWidth="1" strokeLinecap="round" />
      <path d="M7.5 8.5V12.5" stroke="#9ab0c5" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconFloss() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M3 5C3 3.9 3.9 3 5 3H10C11.1 3 12 3.9 12 5V7C12 9.2 10.2 11 8 11H7C4.8 11 3 9.2 3 7V5Z"
        stroke="#9ab0c5" strokeWidth="1.3" />
      <path d="M6 7C6 5.9 6.9 5 8 5" stroke="#9ab0c5" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M7 12.5H8" stroke="#9ab0c5" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconIrrigator() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M3 9.5C3 8.7 3.7 8 4.5 8H7V5.5C7 4.7 7.7 4 8.5 4H10C10.8 4 11.5 4.7 11.5 5.5V8H12.5"
        stroke="#9ab0c5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9.5C3 10.3 3.7 11 4.5 11H7" stroke="#9ab0c5" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="5" cy="13" r="0.8" fill="#9ab0c5" />
      <circle cx="7.5" cy="13" r="0.8" fill="#9ab0c5" />
      <circle cx="10" cy="13" r="0.8" fill="#9ab0c5" />
    </svg>
  );
}

function IconDroplet() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2C7.5 2 4 6 4 9C4 10.9 5.6 12.5 7.5 12.5C9.4 12.5 11 10.9 11 9C11 6 7.5 2 7.5 2Z"
        stroke="#9ab0c5" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.8 10C5.8 10.7 6.5 11.2 7.5 11.2"
        stroke="#9ab0c5" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

const RECS = [
  { id: 1, title: "Электрическая зубная щётка", icon: <IconBrush /> },
  { id: 2, title: "Зубная нить ежедневно", icon: <IconFloss /> },
  { id: 3, title: "Ирригатор 2x в день", icon: <IconIrrigator /> },
  { id: 4, title: "Ополаскиватель без спирта", icon: <IconDroplet /> },
];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatRuDate(d: Date): string {
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function PreventionPage() {
  const today = new Date();
  const lastVisit = addMonths(today, -6);
  const nextVisit = addMonths(today, 6);
  const hygienistVisit = addMonths(today, 6);

  const daysUntil = Math.ceil((nextVisit.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const progress = Math.round(((180 - daysUntil) / 180) * 100);

  return (
    <div className="min-h-dvh bg-surface dark:bg-slate-950 pb-safe">
      <Header title="Профилактика" />

      <main className="px-6 py-4 flex flex-col gap-4">
        {/* Next visit */}
        <Card>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Следующий осмотр
          </p>
          <div className="flex justify-between items-end mb-3">
            <p className="text-[28px] font-bold text-[#0F172A]">
              {daysUntil}{" "}
              <span className="text-[16px] font-medium text-gray-400">дней</span>
            </p>
            <p className="text-[14px] text-gray-400">{formatRuDate(nextVisit)}</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[12px] text-gray-400 mt-1.5">
            {progress}% до следующего визита
          </p>
        </Card>

        {/* Recommendations */}
        <Card>
          <p
            className="text-[12px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#9ab0c5" }}
          >
            Рекомендации врача
          </p>
          {RECS.map((rec, i) => (
            <div
              key={rec.id}
              className="flex items-center gap-3 py-2.5"
              style={{ borderBottom: i < RECS.length - 1 ? "1px solid #f0f4f7" : "none" }}
            >
              <div
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#EEF3F7" }}
              >
                {rec.icon}
              </div>
              <p className="text-[14px] font-medium text-[#0F172A] dark:text-white">
                {rec.title}
              </p>
            </div>
          ))}
        </Card>

        {/* Planner */}
        <Card>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Плановые осмотры
          </p>
          {[
            { label: "Последний осмотр", date: formatRuDate(lastVisit) },
            { label: "Следующий осмотр", date: formatRuDate(nextVisit), upcoming: true },
            { label: "Чистка (гигиенист)", date: formatRuDate(hygienistVisit), upcoming: true },
          ].map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <p className="text-[14px] text-gray-500">{item.label}</p>
              <p
                className={`text-[14px] font-semibold ${
                  item.upcoming ? "text-primary" : "text-[#0F172A]"
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
