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

export function formatScheduleHeaderDate(d: Date): string {
  const w = d.toLocaleString("ru-RU", { weekday: "long" });
  const cap = w.charAt(0).toUpperCase() + w.slice(1);
  const rest = d.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return `${cap}, ${rest}`;
}
