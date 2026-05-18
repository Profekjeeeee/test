"use client";

import { formatRuMonthYearTitleFromDate } from "@/lib/doctorSchedule";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function monthMatrix(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  const mondayOffset = (dow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface DoctorMonthCalendarProps {
  viewMonth: Date;
  selectedDate: Date;
  /** null до клиентского маунта — без подсветки «сегодня», совпадает с SSR и гидратацией */
  clientNow?: Date | null;
  daysWithAppointments: Set<number>;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export default function DoctorMonthCalendar({
  viewMonth,
  selectedDate,
  clientNow,
  daysWithAppointments,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: DoctorMonthCalendarProps) {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const cells = monthMatrix(y, m);
  const titleCap = formatRuMonthYearTitleFromDate(viewMonth);

  const isSelected = (day: number) =>
    selectedDate.getFullYear() === y &&
    selectedDate.getMonth() === m &&
    selectedDate.getDate() === day;

  const isToday = (day: number) => {
    if (!clientNow) return false;
    return clientNow.getFullYear() === y && clientNow.getMonth() === m && clientNow.getDate() === day;
  };

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)]"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onPrevMonth}
          className="interactive-press-sm min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-secondary flex items-center justify-center shadow-raised-surface"
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-white">{titleCap}</p>
        <button
          type="button"
          onClick={onNextMonth}
          className="interactive-press-sm min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-secondary flex items-center justify-center shadow-raised-surface"
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold uppercase tracking-wide text-secondary py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-3 gap-x-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} className="min-h-[44px]" />;
          }
          const selected = isSelected(day);
          const today = isToday(day);
          const hasDot = daysWithAppointments.has(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`relative min-h-[44px] rounded-xl text-[13px] font-semibold flex flex-col items-center justify-center transition-all duration-150 ease-out active:scale-95 border ${
                selected
                  ? "bg-primary text-white border-primary"
                  : today
                    ? "border-primary/80 text-[#0F172A] dark:text-white bg-white dark:bg-slate-900"
                    : "border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-white bg-white dark:bg-slate-900 hover:bg-surface dark:hover:bg-slate-800"
              }`}
            >
              <span>{day}</span>
              {hasDot && (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    selected ? "bg-white/50" : "bg-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
