import { getCurrentUserId } from "@/lib/auth";

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

const BASE_KEY = "appointments";

function storageKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_KEY}_${uid}` : BASE_KEY;
}

export function initAppointments(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(storageKey())) {
    localStorage.setItem(storageKey(), JSON.stringify([]));
  }
}

export function getAppointments(): Appointment[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(storageKey());
    return stored ? (JSON.parse(stored) as Appointment[]) : [];
  } catch {
    return [];
  }
}

export function saveAppointments(appointments: Appointment[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(), JSON.stringify(appointments));
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
