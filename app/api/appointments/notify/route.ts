import { NextResponse } from "next/server";

import {
  notifyDoctorPatientCancelled,
  notifyDoctorPatientRescheduled,
  notifyDoctorNewBooking,
  notifyPatientCancelled,
  notifyPatientRescheduled,
  sendPatientBookingConfirmation,
} from "@/lib/server/appointmentTelegram";

export const dynamic = "force-dynamic";

type NotifyEvent =
  | "booking_created"
  | "doctor_reschedule"
  | "doctor_cancel"
  | "patient_reschedule"
  | "patient_cancel";

/**
 * POST { event: NotifyEvent, appointment_id: string | number }
 * Серверные Telegram-уведомления по событию записи (читает telegram_id из Supabase).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be object" }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const event = rec.event as NotifyEvent | undefined;
  const appointmentId = rec.appointment_id;

  if (!event) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }
  const id: string | number =
    typeof appointmentId === "number"
      ? appointmentId
      : typeof appointmentId === "string"
        ? appointmentId.trim()
        : String(appointmentId);

  if (String(id).trim() === "") {
    return NextResponse.json({ error: "appointment_id is required" }, { status: 400 });
  }

  try {
    switch (event) {
      case "booking_created":
        await notifyDoctorNewBooking(id);
        await sendPatientBookingConfirmation(id);
        break;
      case "doctor_reschedule":
        await notifyPatientRescheduled(id);
        break;
      case "doctor_cancel":
        await notifyPatientCancelled(id);
        break;
      case "patient_reschedule":
        await notifyDoctorPatientRescheduled(id);
        break;
      case "patient_cancel":
        await notifyDoctorPatientCancelled(id);
        break;
      default:
        return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[appointments/notify]", event, id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
