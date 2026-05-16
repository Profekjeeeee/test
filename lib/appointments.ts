import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserId } from "@/lib/auth";

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

export interface Appointment {
  id: string;
  day: number;
  monthNum: number;
  month: string;
  year: number;
  time: string;
  doctor: string;
  specialty: string;
  service: string;
  price?: number;
  cabinet: string;
  status: AppointmentStatus;
  patientId?: string;
}

/** То же поле, что раньше; источник — таблица `appointments` в Supabase. */
export type ClinicAppointment = Appointment;

export const RU_MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

interface AppointmentRow {
  id: string;
  client_id: string | null;
  doctor_id: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  doctor_display_name: string;
  specialty: string | null;
  service: string | null;
  price: number | string | null;
  cabinet: string | null;
}

function isoDateLocal(year: number, monthNum: number, day: number): string {
  const mm = String(monthNum).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function rowToAppointment(row: AppointmentRow): Appointment {
  const parts = row.appointment_date.split("-").map((x) => parseInt(x, 10));
  const year = parts[0] ?? 1970;
  const monthNum = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const month = RU_MONTHS_SHORT[monthNum - 1] ?? "";
  return {
    id: row.id,
    day,
    monthNum,
    month,
    year,
    time: row.appointment_time,
    doctor: row.doctor_display_name,
    specialty: row.specialty ?? "",
    service: row.service ?? "",
    price: row.price != null ? Number(row.price) : undefined,
    cabinet: row.cabinet ?? "",
    status: row.status as AppointmentStatus,
    patientId: row.client_id ?? undefined,
  };
}

let clinicCache: ClinicAppointment[] | null = null;

export async function refreshAppointmentsCache(): Promise<void> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });
  if (error) {
    console.error("[appointments]", error);
    return;
  }
  clinicCache = ((data ?? []) as AppointmentRow[]).map(rowToAppointment);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("appointmentsUpdated"));
  }
}

export async function initAppointments(): Promise<void> {
  await refreshAppointmentsCache();
}

export function getAppointments(): Appointment[] {
  const uid = getCurrentUserId();
  const all = clinicCache ?? [];
  if (!uid) return [];
  return all.filter((a) => a.patientId === uid);
}

export function getUpcomingCount(): number {
  return getAppointments().filter((a) => a.status === "scheduled").length;
}

export type NewAppointmentInput = Omit<Appointment, "id"> & { doctorId?: string | null };

export async function addAppointment(apt: NewAppointmentInput): Promise<Appointment> {
  const uid = getCurrentUserId();
  const patientId = apt.patientId ?? uid ?? null;
  const insertPayload = {
    client_id: patientId,
    doctor_id: apt.doctorId ?? null,
    appointment_date: isoDateLocal(apt.year, apt.monthNum, apt.day),
    appointment_time: apt.time,
    status: apt.status,
    doctor_display_name: apt.doctor,
    specialty: apt.specialty || null,
    service: apt.service || null,
    price: apt.price ?? null,
    cabinet: apt.cabinet || null,
  };
  const { data, error } = await supabase.from("appointments").insert(insertPayload).select("*").single();
  if (error) throw error;
  await refreshAppointmentsCache();
  return rowToAppointment(data as AppointmentRow);
}

export function getAllClinicAppointments(): ClinicAppointment[] {
  return clinicCache ?? [];
}

export async function cancelAppointment(id: string): Promise<void> {
  const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
  await refreshAppointmentsCache();
}

export async function rescheduleAppointment(
  id: string,
  updates: Pick<Appointment, "day" | "monthNum" | "month" | "year" | "time">
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({
      appointment_date: isoDateLocal(updates.year, updates.monthNum, updates.day),
      appointment_time: updates.time,
      status: "scheduled",
    })
    .eq("id", id);
  if (error) throw error;
  await refreshAppointmentsCache();
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
