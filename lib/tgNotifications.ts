"use client";

import {
  getCurrentUserId,
  getDentalClients,
  getDentalEmployees,
  getDentalSession,
  normalizePhone,
} from "@/lib/auth";
import {
  DOCTOR_BOOKING_ID_TO_PHONE,
  formatAppointmentDateRu,
  type Appointment,
} from "@/lib/appointments";

function escapeHtmlTg(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function postSendTgNotification(telegramId: string, message: string): Promise<void> {
  const res = await fetch("/api/send-tg-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegram_id: telegramId, message }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    console.warn("[tgNotifications] send failed", res.status, j);
  }
}

/** Врач с экрана записи (d1…d10) → `dental_employees.telegram_id`. */
export function resolveTelegramIdForBookingDoctorId(bookingDoctorId: string | null): string | null {
  if (!bookingDoctorId) return null;
  const rawPhone = DOCTOR_BOOKING_ID_TO_PHONE[bookingDoctorId];
  if (!rawPhone) return null;
  const n = normalizePhone(rawPhone);
  const emp = getDentalEmployees().find((e) => normalizePhone(e.phone) === n);
  const tid = emp?.telegramId?.trim();
  return tid || null;
}

export function resolvePatientTelegramIdByClientId(clientId: string | undefined | null): string | null {
  if (!clientId?.trim()) return null;
  const c = getDentalClients().find((x) => x.id === clientId.trim());
  const tid = c?.telegramId?.trim();
  return tid || null;
}

export function resolveCurrentClientDisplayName(): string {
  const s = getDentalSession();
  if (s?.role === "client") {
    const fn = s.firstName?.trim() ?? "";
    const ln = s.lastName?.trim() ?? "";
    const both = `${fn} ${ln}`.trim();
    if (both) return both;
  }
  const full = s?.fullName?.trim();
  if (full) return full;
  const uid = getCurrentUserId();
  const c = uid ? getDentalClients().find((x) => x.id === uid) : null;
  if (c) {
    const n = `${c.firstName} ${c.lastName}`.trim();
    if (n) return n;
  }
  return "Пациент";
}

/** После успешной записи — врачу (не блокирует UI). */
export function notifyDoctorNewBookingAsync(params: {
  bookingDoctorId: string | null;
  clientName: string;
  appointment: Appointment;
}): void {
  const { bookingDoctorId, clientName, appointment } = params;
  const tid = resolveTelegramIdForBookingDoctorId(bookingDoctorId);
  if (!tid) return;

  const safeName = escapeHtmlTg(clientName);
  const dateRu = escapeHtmlTg(formatAppointmentDateRu(appointment));
  const timeRu = escapeHtmlTg(appointment.time);

  const message =
    `<b>Новая запись!</b>\n` +
    `Пациент: ${safeName}\n` +
    `Дата: ${dateRu}\n` +
    `Время: ${timeRu}`;

  void postSendTgNotification(tid, message).catch((e) => console.warn("[tgNotifications] doctor notify", e));
}

/** После переноса приёма врачом — пациенту. */
export function notifyPatientScheduleRescheduledAsync(params: {
  patientClientId: string | undefined | null;
  doctorName: string;
  appointment: Appointment;
}): void {
  const { patientClientId, doctorName, appointment } = params;
  const tid = resolvePatientTelegramIdByClientId(patientClientId ?? undefined);
  if (!tid) return;

  const safeDoc = escapeHtmlTg(doctorName.trim() || "врача");
  const dateRu = escapeHtmlTg(formatAppointmentDateRu(appointment));
  const timeRu = escapeHtmlTg(appointment.time);

  const message =
    `<b>Изменение в расписании</b>\n` +
    `Ваш приём у врача ${safeDoc} был изменён.\n` +
    `Новое время: ${dateRu} в ${timeRu}.`;

  void postSendTgNotification(tid, message).catch((e) =>
    console.warn("[tgNotifications] patient reschedule", e)
  );
}

/** После отмены приёма врачом — пациенту. */
export function notifyPatientScheduleCancelledAsync(params: {
  patientClientId: string | undefined | null;
  doctorName: string;
}): void {
  const { patientClientId, doctorName } = params;
  const tid = resolvePatientTelegramIdByClientId(patientClientId ?? undefined);
  if (!tid) return;

  const safeDoc = escapeHtmlTg(doctorName.trim() || "врача");
  const message =
    `<b>Изменение в расписании</b>\n` + `Ваш приём у врача ${safeDoc} был отменён.`;

  void postSendTgNotification(tid, message).catch((e) =>
    console.warn("[tgNotifications] patient cancel", e)
  );
}
