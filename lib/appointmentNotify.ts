"use client";

/**
 * Fire-and-forget вызов серверных Telegram-уведомлений по appointment_id.
 */
export function postAppointmentNotifyAsync(
  event:
    | "booking_created"
    | "doctor_reschedule"
    | "doctor_cancel"
    | "patient_reschedule"
    | "patient_cancel",
  appointmentId: string
): void {
  void fetch("/api/appointments/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, appointment_id: appointmentId }),
  }).catch((e) => console.warn("[appointmentNotify]", event, e));
}
