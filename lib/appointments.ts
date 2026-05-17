import { supabase } from "@/lib/supabaseClient";
import {
  DENTAL_USER_SESSION_STORAGE_KEY,
  findClientByPhone,
  getCurrentUserId,
  getDentalClients,
  getDentalEmployees,
  getDentalSession,
  isDentalClientUuidKey,
  normalizePhone,
} from "@/lib/auth";

export type AppointmentStatus =
  | "pending"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "rescheduled";

/** Телефоны врачей (seed `dental_employees`) — id как на экране записи (d1…d10). */
export const DOCTOR_BOOKING_ID_TO_PHONE: Record<string, string> = {
  d1: "79991112233",
  d2: "79001001002",
  d3: "79001001003",
  d4: "79994445566",
  d5: "79001001005",
  d6: "79001001006",
  d7: "79001001007",
  d8: "79001001008",
  d9: "79001001009",
  d10: "79001001010",
};

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

/** Родительный падеж (15 мая 2026) — для уведомлений и UI. */
export const RU_MONTHS_GENITIVE = [
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

/** Слоты расписания клиники (как на экране записи). */
export const CLINIC_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

export function formatAppointmentDateRu(apt: Pick<Appointment, "day" | "monthNum" | "year">): string {
  const m = RU_MONTHS_GENITIVE[apt.monthNum - 1] ?? "";
  return `${apt.day} ${m} ${apt.year}`.trim();
}

interface AppointmentRow {
  id: string;
  client_id: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  doctor_display_name: string | null;
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
  let doctor =
    row.doctor_name?.trim() ||
    row.doctor_display_name?.trim() ||
    "";
  if (!doctor && row.doctor_id) {
    const emp = getDentalEmployees().find((e) => e.id === row.doctor_id);
    if (emp) doctor = emp.fullName;
  }
  if (!doctor) doctor = "Врач";
  const service = row.service?.trim() ? row.service : "Запись на приём";
  return {
    id: row.id,
    day,
    monthNum,
    month,
    year,
    time: row.appointment_time,
    doctor,
    specialty: row.specialty ?? "",
    service,
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
  const session = getDentalSession();
  const all = clinicCache ?? [];

  const phoneCandidates = new Set<string>();
  if (session?.phone) {
    const p = normalizePhone(session.phone);
    if (p.length >= 10) phoneCandidates.add(p);
  }
  if (uid) {
    const c = getDentalClients().find((x) => x.id === uid);
    if (c?.phone) {
      const p = normalizePhone(c.phone);
      if (p.length >= 10) phoneCandidates.add(p);
    }
    const uidDigits = uid.replace(/\D/g, "");
    if (uidDigits.length >= 10) phoneCandidates.add(normalizePhone(uid));
  }

  if (!uid && phoneCandidates.size === 0) return [];

  return all.filter((a) => {
    const pid = a.patientId;
    if (!pid) return false;
    if (uid && pid === uid) return true;
    const pNorm = normalizePhone(String(pid));
    for (const ph of phoneCandidates) {
      if (ph === pNorm) return true;
    }
    return false;
  });
}

function isActiveUpcomingStatus(s: AppointmentStatus): boolean {
  return s === "scheduled" || s === "rescheduled" || s === "pending";
}

export function getUpcomingCount(): number {
  return getAppointments().filter((a) => isActiveUpcomingStatus(a.status)).length;
}

/** Данные для вставки в `appointments`: без `id` — идентификатор выдаёт Supabase/БД. */
export type NewAppointmentInput = {
  day: number;
  monthNum: number;
  year: number;
  time: string;
  doctorName: string;
  /** Телефон для поиска строки в `dental_clients` (в `client_id` уходит только её `id`). */
  clientPhone?: string | null;
  status?: AppointmentStatus;
};

/**
 * Первичный ключ `dental_clients.id` для FK `appointments.client_id`.
 * Не подставляет номер телефона: при UUID в сессии сверяет строку в БД; иначе ищет клиента по телефону.
 */
async function resolveDentalClientPrimaryKeyForInsert(
  explicitPhone?: string | null
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Запись на приём доступна только в браузере.");
  }

  const uid = getCurrentUserId();
  const phoneFromArg = explicitPhone?.trim() || null;
  const phoneFromSession = resolveClientPhoneForAppointment();

  if (uid && isDentalClientUuidKey(uid)) {
    const { data, error } = await supabase
      .from("dental_clients")
      .select("id")
      .eq("id", uid)
      .maybeSingle();
    if (!error && data?.id) return data.id;
  }

  if (uid && !isDentalClientUuidKey(uid)) {
    const digits = uid.replace(/\D/g, "");
    if (digits.length >= 10) {
      const row = await findClientByPhone(uid);
      if (row?.id) return row.id;
    }
  }

  const phone = phoneFromArg ?? phoneFromSession;
  if (!phone || normalizePhone(phone).length < 10) {
    throw new Error("Не удалось определить пациента. Войдите в аккаунт или обновите страницу.");
  }

  const normalized = normalizePhone(phone);
  const { data: byPhoneCol, error: phoneColErr } = await supabase
    .from("dental_clients")
    .select("id")
    .eq("phone", normalized)
    .maybeSingle();
  if (!phoneColErr && byPhoneCol?.id) return byPhoneCol.id;

  const row = await findClientByPhone(phone);
  if (row?.id) return row.id;

  throw new Error(
    "Пациент не найден в базе клиники. Запись возможна только после регистрации номера."
  );
}

/** ID пациента (`dental_clients.id`) для сценариев вне вставки записи; без подстановки телефона в `client_id`. */
export async function resolveClientIdForAppointment(): Promise<string | null> {
  try {
    return await resolveDentalClientPrimaryKeyForInsert(null);
  } catch {
    return null;
  }
}

/** Телефон текущего пользователя для поиска строки в `dental_clients` (не для поля `client_id`). */
export function resolveClientPhoneForAppointment(): string | null {
  if (typeof window === "undefined") return null;
  const session = getDentalSession();
  if (session?.phone) {
    const p = normalizePhone(session.phone);
    if (p.length >= 10) return p;
  }
  try {
    const raw = localStorage.getItem(DENTAL_USER_SESSION_STORAGE_KEY);
    if (raw) {
      const j = JSON.parse(raw) as { phone?: string };
      if (j.phone) {
        const p = normalizePhone(j.phone);
        if (p.length >= 10) return p;
      }
    }
  } catch {
    /* ignore */
  }
  const uid = getCurrentUserId();
  if (uid) {
    const fromCache = getDentalClients().find((c) => c.id === uid);
    if (fromCache?.phone) {
      const p = normalizePhone(fromCache.phone);
      if (p.length >= 10) return p;
    }
    const digits = uid.replace(/\D/g, "");
    if (digits.length >= 10) return normalizePhone(uid);
  }
  return null;
}

export async function addAppointment(apt: NewAppointmentInput): Promise<Appointment> {
  const status: AppointmentStatus = apt.status ?? "pending";
  const name = apt.doctorName.trim() || "Врач";

  const clientId = await resolveDentalClientPrimaryKeyForInsert(apt.clientPhone);

  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        client_id: clientId,
        doctor_name: name,
        appointment_date: isoDateLocal(apt.year, apt.monthNum, apt.day),
        appointment_time: apt.time,
        status,
      },
    ])
    .select("*")
    .single();

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
      if (!isActiveUpcomingStatus(a.status)) return false;
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
