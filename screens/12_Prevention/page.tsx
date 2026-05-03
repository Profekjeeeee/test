"use client";

import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";

const RECS = [
  { id: 1, title: "Электрическая зубная щётка", done: true },
  { id: 2, title: "Зубная нить ежедневно", done: true },
  { id: 3, title: "Ирригатор 2x в день", done: false },
  { id: 4, title: "Ополаскиватель без спирта", done: false },
];

export default function PreventionPage() {
  const daysUntil = 47;
  const progress = Math.round(((180 - daysUntil) / 180) * 100);

  return (
    <div className="min-h-dvh bg-surface pb-safe">
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
            <p className="text-[14px] text-gray-400">17 июня 2025</p>
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
        <div>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Рекомендации врача
          </p>
          <div className="flex flex-col gap-2">
            {RECS.map((rec) => (
              <Card key={rec.id} bordered>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                      rec.done ? "bg-primary" : "border-2 border-gray-200"
                    }`}
                  >
                    {rec.done && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <p
                    className={`text-[14px] font-medium ${
                      rec.done ? "text-gray-400 line-through" : "text-[#0F172A]"
                    }`}
                  >
                    {rec.title}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Planner */}
        <Card>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Плановые осмотры
          </p>
          {[
            { label: "Последний осмотр", date: "17 декабря 2024" },
            { label: "Следующий осмотр", date: "17 июня 2025", upcoming: true },
            { label: "Чистка (гигиенист)", date: "17 июня 2025", upcoming: true },
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
