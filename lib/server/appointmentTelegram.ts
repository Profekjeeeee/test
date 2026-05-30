import "server-only";

import {
  RU_MONTHS_GENITIVE,
  type AppointmentStatus,
} from "@/lib/appointments";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import {
  appOpenKeyboard,
  appointmentConfirmKeyboard,
  sendTelegramMessage,
} from "@/lib/server/telegramBot";

const ACTIVE_STATUSES: AppointmentStatus[] = ["pending", "scheduled", "rescheduled"];

interface AppointmentNotifyRow {
  id: number;
  client_id: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  confirmed_at: string | null;
  confirmation_tg_message_id: number | null;
}

interface ClientRow {
  id: string;
  telegram_id: number | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
}

interface EmployeeRow {
  id: string;
  telegram_id: number | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

function clinicTzOffset(): string {
  return process.env.CLINIC_TZ_OFFSET?.trim() || "+03:00";
}

export function escapeHtmlTg(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatDateRuFromIso(dateIso: string): string {
  const parts = dateIso.split("-").map((x) => parseInt(x, 10));
  const year = parts[0] ?? 1970;
  const monthNum = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const m = RU_MONTHS_GENITIVE[monthNum - 1] ?? "";
  return `${day} ${m} ${year}`.trim();
}

export function parseAppointmentDateTime(dateIso: string, time: string): Date {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${dateIso}T${normalizedTime}${clinicTzOffset()}`);
}

function hoursUntilAppointment(dateIso: string, time: string, now = new Date()): number {
  const aptMs = parseAppointmentDateTime(dateIso, time).getTime();
  return (aptMs - now.getTime()) / (1000 * 60 * 60);
}

function clientDisplayName(c: ClientRow): string {
  const both = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  if (both) return both;
  if (c.name?.trim()) return c.name.trim();
  return "Пациент";
}

function employeeDisplayName(e: EmployeeRow): string {
  const both = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim();
  if (both) return both;
  if (e.name?.trim()) return e.name.trim();
  return "Врач";
}

async function fetchClient(clientId: string | null): Promise<ClientRow | null> {
  if (!clientId) return null;
  const sb = getSupabaseServiceRole();
  const { data } = await sb
    .from("dental_clients")
    .select("id, telegram_id, first_name, last_name, name")
    .eq("id", clientId)
    .maybeSingle();
  return (data as ClientRow | null) ?? null;
}

async function fetchEmployeeById(doctorId: string | null): Promise<EmployeeRow | null> {
  if (!doctorId) return null;
  const sb = getSupabaseServiceRole();
  const { data } = await sb
    .from("dental_employees")
    .select("id, telegram_id, name, first_name, last_name")
    .eq("id", doctorId)
    .maybeSingle();
  return (data as EmployeeRow | null) ?? null;
}

async function fetchEmployeeByDoctorName(doctorName: string | null): Promise<EmployeeRow | null> {
  if (!doctorName?.trim()) return null;
  const sb = getSupabaseServiceRole();
  const needle = doctorName.trim().toLowerCase();
  const { data } = await sb
    .from("dental_employees")
    .select("id, telegram_id, name, first_name, last_name")
    .eq("role", "doctor");
  const rows = (data ?? []) as EmployeeRow[];
  return (
    rows.find((e) => {
      const dn = employeeDisplayName(e).toLowerCase();
      const nm = (e.name ?? "").trim().toLowerCase();
      return dn === needle || nm === needle || dn.includes(needle) || needle.includes(dn);
    }) ?? null
  );
}

async function fetchAppointmentById(id: string | number): Promise<AppointmentNotifyRow | null> {
  const sb = getSupabaseServiceRole();
  const { data } = await sb.from("appointments").select("*").eq("id", id).maybeSingle();
  return (data as AppointmentNotifyRow | null) ?? null;
}

async function safeSend(chatId: number | string, text: string, replyMarkup?: ReturnType<typeof appOpenKeyboard>) {
  try {
    return await sendTelegramMessage({ chatId, text, replyMarkup });
  } catch (e) {
    console.error("[appointmentTelegram] send failed", chatId, e);
    return null;
  }
}

export async function sendPatientBookingConfirmation(appointmentId: string | number): Promise<void> {
  const apt = await fetchAppointmentById(appointmentId);
  if (!apt || !ACTIVE_STATUSES.includes(apt.status as AppointmentStatus)) return;

  const client = await fetchClient(apt.client_id);
  if (!client?.telegram_id) return;

  const doctorName = escapeHtmlTg(apt.doctor_name?.trim() || "врача");
  const dateRu = escapeHtmlTg(formatDateRuFromIso(apt.appointment_date));
  const timeRu = escapeHtmlTg(apt.appointment_time);

  const text =
    `<b>Запись создана</b>\n` +
    `Врач: ${doctorName}\n` +
    `Дата: ${dateRu}\n` +
    `Время: ${timeRu}\n\n` +
    `Подтвердите, что придёте на приём:`;

  const sent = await safeSend(client.telegram_id, text, appointmentConfirmKeyboard(String(apt.id)));
  if (sent?.messageId) {
    const sb = getSupabaseServiceRole();
    await sb
      .from("appointments")
      .update({ confirmation_tg_message_id: sent.messageId })
      .eq("id", apt.id);
  }
}

export async function notifyDoctorNewBooking(appointmentId: string | number): Promise<void> {
  const apt = await fetchAppointmentById(appointmentId);
  if (!apt) return;

  const client = await fetchClient(apt.client_id);
  const employee =
    (await fetchEmployeeById(apt.doctor_id)) ?? (await fetchEmployeeByDoctorName(apt.doctor_name));
  if (!employee?.telegram_id) return;

  const patientName = escapeHtmlTg(client ? clientDisplayName(client) : "Пациент");
  const dateRu = escapeHtmlTg(formatDateRuFromIso(apt.appointment_date));
  const timeRu = escapeHtmlTg(apt.appointment_time);

  const text =
    `<b>Новая запись!</b>\n` +
    `Пациент: ${patientName}\n` +
    `Дата: ${dateRu}\n` +
    `Время: ${timeRu}`;

  await safeSend(employee.telegram_id, text, appOpenKeyboard());
}

export async function notifyPatientRescheduled(appointmentId: string | number): Promise<void> {
  const apt = await fetchAppointmentById(appointmentId);
  if (!apt) return;

  const client = await fetchClient(apt.client_id);
  if (!client?.telegram_id) return;

  const doctorName = escapeHtmlTg(apt.doctor_name?.trim() || "врача");
  const dateRu = escapeHtmlTg(formatDateRuFromIso(apt.appointment_date));
  const timeRu = escapeHtmlTg(apt.appointment_time);

  const text =
    `<b>Изменение в расписании</b>\n` +
    `Ваш приём у врача ${doctorName} был изменён.\n` +
    `Новое время: ${dateRu} в ${timeRu}.`;

  await safeSend(client.telegram_id, text, appOpenKeyboard());
}

export async function notifyPatientCancelled(appointmentId: string | number): Promise<void> {
  const apt = await fetchAppointmentById(appointmentId);
  if (!apt) return;

  const client = await fetchClient(apt.client_id);
  if (!client?.telegram_id) return;

  const doctorName = escapeHtmlTg(apt.doctor_name?.trim() || "врача");
  const text =
    `<b>Изменение в расписании</b>\n` + `Ваш приём у врача ${doctorName} был отменён.`;

  await safeSend(client.telegram_id, text, appOpenKeyboard());
}

export async function notifyDoctorPatientCancelled(appointmentId: string | number): Promise<void> {
  const apt = await fetchAppointmentById(appointmentId);
  if (!apt) return;

  const client = await fetchClient(apt.client_id);
  const employee =
    (await fetchEmployeeById(apt.doctor_id)) ?? (await fetchEmployeeByDoctorName(apt.doctor_name));
  if (!employee?.telegram_id) return;

  const patientName = escapeHtmlTg(client ? clientDisplayName(client) : "Пациент");
  const dateRu = escapeHtmlTg(formatDateRuFromIso(apt.appointment_date));
  const timeRu = escapeHtmlTg(apt.appointment_time);

  const text =
    `<b>Отмена записи</b>\n` +
    `Пациент ${patientName} отменил приём.\n` +
    `Было: ${dateRu} в ${timeRu}.`;

  await safeSend(employee.telegram_id, text, appOpenKeyboard());
}

export async function notifyDoctorPatientRescheduled(appointmentId: string | number): Promise<void> {
  const apt = await fetchAppointmentById(appointmentId);
  if (!apt) return;

  const client = await fetchClient(apt.client_id);
  const employee =
    (await fetchEmployeeById(apt.doctor_id)) ?? (await fetchEmployeeByDoctorName(apt.doctor_name));
  if (!employee?.telegram_id) return;

  const patientName = escapeHtmlTg(client ? clientDisplayName(client) : "Пациент");
  const dateRu = escapeHtmlTg(formatDateRuFromIso(apt.appointment_date));
  const timeRu = escapeHtmlTg(apt.appointment_time);

  const text =
    `<b>Перенос записи</b>\n` +
    `Пациент ${patientName} перенёс приём.\n` +
    `Новое время: ${dateRu} в ${timeRu}.`;

  await safeSend(employee.telegram_id, text, appOpenKeyboard());
}

export async function processAppointmentReminders(): Promise<{
  sent24h: number;
  sent2h: number;
  scanned: number;
}> {
  const sb = getSupabaseServiceRole();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 2);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("appointments")
    .select("*")
    .in("status", ACTIVE_STATUSES)
    .gte("appointment_date", todayIso)
    .lte("appointment_date", horizonIso);

  if (error) throw error;

  const rows = (data ?? []) as AppointmentNotifyRow[];
  let sent24h = 0;
  let sent2h = 0;

  for (const apt of rows) {
    const hours = hoursUntilAppointment(apt.appointment_date, apt.appointment_time, now);
    if (hours <= 0) continue;

    const client = await fetchClient(apt.client_id);
    if (!client?.telegram_id) continue;

    const doctorName = escapeHtmlTg(apt.doctor_name?.trim() || "врача");
    const dateRu = escapeHtmlTg(formatDateRuFromIso(apt.appointment_date));
    const timeRu = escapeHtmlTg(apt.appointment_time);

    if (!apt.reminder_24h_sent_at && hours >= 23 && hours <= 25) {
      const text =
        `<b>Напоминание</b>\n` +
        `Завтра приём у врача ${doctorName}.\n` +
        `Дата: ${dateRu}, ${timeRu}.\n\n` +
        `Если планы изменились — отмените или перенесите запись в приложении.`;
      const sent = await safeSend(client.telegram_id, text, appOpenKeyboard());
      if (sent) {
        await sb.from("appointments").update({ reminder_24h_sent_at: now.toISOString() }).eq("id", apt.id);
        sent24h++;
      }
    }

    if (!apt.reminder_2h_sent_at && hours >= 1.5 && hours <= 2.5) {
      const text =
        `<b>Напоминание</b>\n` +
        `Через 2 часа приём у врача ${doctorName}.\n` +
        `${dateRu}, ${timeRu}.\n\n` +
        `Ждём вас в клинике!`;
      const sent = await safeSend(client.telegram_id, text, appOpenKeyboard());
      if (sent) {
        await sb.from("appointments").update({ reminder_2h_sent_at: now.toISOString() }).eq("id", apt.id);
        sent2h++;
      }
    }
  }

  return { sent24h, sent2h, scanned: rows.length };
}
