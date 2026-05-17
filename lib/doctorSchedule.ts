import type { AppointmentStatus, ClinicAppointment } from "@/lib/appointments";

export function filterAppointmentsByDoctor(
  appointments: ClinicAppointment[],
  doctorFullName: string
): ClinicAppointment[] {
  const name = doctorFullName.trim();
  return appointments.filter((a) => a.doctor.trim() === name);
}

export function isSameCalendarDay(a: ClinicAppointment, d: Date): boolean {
  return (
    a.year === d.getFullYear() &&
    a.monthNum === d.getMonth() + 1 &&
    a.day === d.getDate()
  );
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function sortAppointmentsByTimeAsc(a: ClinicAppointment, b: ClinicAppointment): number {
  return timeToMinutes(a.time) - timeToMinutes(b.time);
}

export function sortAppointmentsHistoryDesc(a: ClinicAppointment, b: ClinicAppointment): number {
  const da = new Date(a.year, a.monthNum - 1, a.day).getTime();
  const db = new Date(b.year, b.monthNum - 1, b.day).getTime();
  if (db !== da) return db - da;
  return timeToMinutes(b.time) - timeToMinutes(a.time);
}

export function appointmentStatusLabelRu(status: AppointmentStatus): string {
  switch (status) {
    case "pending":
      return "На подтверждении";
    case "scheduled":
      return "Запланирован";
    case "completed":
      return "Завершён";
    case "cancelled":
      return "Отменён";
    case "rescheduled":
      return "Перенесён";
    default:
      return status;
  }
}

/** Понедельник-first: 0 — пн … 6 — вс — как сетка календаря в UI */
const WEEKDAY_LONG_NOM_MS = [
  "понедельник",
  "вторник",
  "среда",
  "четвер",
  "пятница",
  "суббота",
  "воскресенье",
] as const;

const MONTHS_GENITIVE_FOR_HEADER = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

export const MONTH_TITLES_NOMINATIVE = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

/** Без Intl: одинаково на SSR Node и в браузере убирает hydration mismatch текстов заголовков. */
export function formatScheduleHeaderDateStable(d: Date): string {
  const w = WEEKDAY_LONG_NOM_MS[(d.getDay() + 6) % 7] ?? "";
  const cap = w.charAt(0).toUpperCase() + w.slice(1);
  const mi = MONTHS_GENITIVE_FOR_HEADER[d.getMonth()] ?? "";
  const rest = `${d.getDate()} ${mi}, ${d.getFullYear()}`;
  return `${cap}, ${rest}`;
}

export function formatRuMonthYearTitleFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  const nom = MONTH_TITLES_NOMINATIVE[m] ?? "";
  return `${nom} ${y}`;
}

/** «17 мая, 2026» без Intl для совпадения SSR/клиента. */
export function formatRuNumericLongDateStable(d: Date): string {
  const mi = MONTHS_GENITIVE_FOR_HEADER[d.getMonth()] ?? "";
  return `${d.getDate()} ${mi}, ${d.getFullYear()}`;
}

export function formatScheduleHeaderDate(d: Date): string {
  const w = d.toLocaleString("ru-RU", { weekday: "long" });
  const cap = w.charAt(0).toUpperCase() + w.slice(1);
  const rest = d.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return `${cap}, ${rest}`;
}
