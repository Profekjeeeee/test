"use client";

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
  daysWithAppointments: Set<number>;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export default function DoctorMonthCalendar({
  viewMonth,
  selectedDate,
  daysWithAppointments,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: DoctorMonthCalendarProps) {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const cells = monthMatrix(y, m);
  const title = viewMonth.toLocaleString("ru-RU", { month: "long", year: "numeric" });
  const titleCap = title.charAt(0).toUpperCase() + title.slice(1);

  const isSelected = (day: number) =>
    selectedDate.getFullYear() === y &&
    selectedDate.getMonth() === m &&
    selectedDate.getDate() === day;

  const isToday = (day: number) => {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === day;
  };

  return (
    <div
      className="rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onPrevMonth}
          className="w-9 h-9 rounded-xl border border-[#E2E8F0] dark:border-slate-700 text-secondary flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-white capitalize">{titleCap}</p>
        <button
          type="button"
          onClick={onNextMonth}
          className="w-9 h-9 rounded-xl border border-[#E2E8F0] dark:border-slate-700 text-secondary flex items-center justify-center active:scale-95 transition-transform"
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

      <div className="grid grid-cols-7 gap-y-2 gap-x-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} className="h-9" />;
          }
          const selected = isSelected(day);
          const today = isToday(day);
          const hasDot = daysWithAppointments.has(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`relative h-9 rounded-xl text-[13px] font-semibold flex flex-col items-center justify-center transition-colors active:scale-95 ${
                selected
                  ? "bg-[#A1D6D7] text-[#0F172A]"
                  : today
                    ? "border border-[#A1D6D7]/80 text-[#0F172A] dark:text-white"
                    : "text-[#0F172A] dark:text-white hover:bg-[#F8FAFB] dark:hover:bg-slate-800"
              }`}
            >
              <span>{day}</span>
              {hasDot && (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    selected ? "bg-[#0F172A]/50" : "bg-[#A1D6D7]"
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
