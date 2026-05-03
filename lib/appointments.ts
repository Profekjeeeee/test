export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

export interface Appointment {
  id: string;
  day: number;
  monthNum: number; // 1–12
  month: string;    // "мая", "апреля" и т.д.
  year: number;
  time: string;
  doctor: string;
  specialty: string;
  service: string;
  price?: number;
  cabinet: string;
  status: AppointmentStatus;
}

const STORAGE_KEY = "appointments";

const DEFAULT_APPOINTMENTS: Appointment[] = [
  {
    id: "1",
    day: 9,
    monthNum: 5,
    month: "мая",
    year: 2026,
    time: "10:30",
    doctor: "Михайлова А.В.",
    specialty: "Терапевт",
    service: "Терапия. Лечение кариеса",
    price: 7950,
    cabinet: "№ 5",
    status: "scheduled",
  },
  {
    id: "2",
    day: 15,
    monthNum: 4,
    month: "апреля",
    year: 2026,
    time: "14:00",
    doctor: "Иванов С.П.",
    specialty: "Гигиенист",
    service: "Профилактика. Профессиональная гигиена",
    price: 4500,
    cabinet: "№ 3",
    status: "completed",
  },
];

export function initAppointments(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_APPOINTMENTS));
  }
}

export function getAppointments(): Appointment[] {
  if (typeof window === "undefined") return DEFAULT_APPOINTMENTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Appointment[]) : DEFAULT_APPOINTMENTS;
  } catch {
    return DEFAULT_APPOINTMENTS;
  }
}

export function saveAppointments(appointments: Appointment[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
  window.dispatchEvent(new CustomEvent("appointmentsUpdated"));
}

export function getUpcomingCount(): number {
  const all = getAppointments();
  return all.filter((a) => a.status === "scheduled").length;
}

export function addAppointment(apt: Omit<Appointment, "id">): Appointment {
  const all = getAppointments();
  const newApt: Appointment = { ...apt, id: Date.now().toString() };
  saveAppointments([newApt, ...all]);
  return newApt;
}

export function cancelAppointment(id: string): void {
  const all = getAppointments();
  saveAppointments(
    all.map((a) =>
      a.id === id ? { ...a, status: "cancelled" as AppointmentStatus } : a
    )
  );
}

export function rescheduleAppointment(
  id: string,
  updates: Pick<Appointment, "day" | "monthNum" | "month" | "year" | "time">
): void {
  const all = getAppointments();
  saveAppointments(
    all.map((a) =>
      a.id === id
        ? { ...a, ...updates, status: "scheduled" as AppointmentStatus }
        : a
    )
  );
}

export function getNextAppointment(): Appointment | null {
  const all = getAppointments();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduled = all
    .filter((a) => {
      if (a.status !== "scheduled") return false;
      const d = new Date(a.year, a.monthNum - 1, a.day);
      return d >= today;
    })
    .sort((a, b) => {
      const da = new Date(a.year, a.monthNum - 1, a.day).getTime();
      const db = new Date(b.year, b.monthNum - 1, b.day).getTime();
      return da - db;
    });
  return scheduled[0] ?? null;
}
