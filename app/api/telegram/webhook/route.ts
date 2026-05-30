import { NextResponse } from "next/server";

import { escapeHtmlTg, formatDateRuFromIso } from "@/lib/server/appointmentTelegram";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import {
  answerCallbackQuery,
  appOpenKeyboard,
  editTelegramMessage,
} from "@/lib/server/telegramBot";

export const dynamic = "force-dynamic";

function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === expected;
}

interface TgCallbackQuery {
  id: string;
  from: { id: number };
  data?: string;
  message?: { message_id: number; chat: { id: number } };
}

interface TgUpdate {
  callback_query?: TgCallbackQuery;
}

function parseCallbackData(data: string): { action: "confirm" | "cancel"; appointmentId: string } | null {
  const m = /^apt:(confirm|cancel):(\d+)$/.exec(data.trim());
  if (!m) return null;
  return { action: m[1] as "confirm" | "cancel", appointmentId: m[2]! };
}

/**
 * Telegram Bot webhook — inline-кнопки подтверждения/отмены записи.
 * Настройка: setWebhook → https://<domain>/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const cq = update.callback_query;
  if (!cq?.data || !cq.message) {
    return NextResponse.json({ ok: true });
  }

  const parsed = parseCallbackData(cq.data);
  if (!parsed) {
    await answerCallbackQuery({ callbackQueryId: cq.id, text: "Неизвестная команда" });
    return NextResponse.json({ ok: true });
  }

  const sb = getSupabaseServiceRole();
  const { data: apt } = await sb.from("appointments").select("*").eq("id", parsed.appointmentId).maybeSingle();

  if (!apt) {
    await answerCallbackQuery({ callbackQueryId: cq.id, text: "Запись не найдена", showAlert: true });
    return NextResponse.json({ ok: true });
  }

  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const doctorName = escapeHtmlTg(String(apt.doctor_name ?? "врача"));
  const dateRu = escapeHtmlTg(formatDateRuFromIso(String(apt.appointment_date)));
  const timeRu = escapeHtmlTg(String(apt.appointment_time));

  if (parsed.action === "confirm") {
    if (apt.status === "cancelled") {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: "Запись уже отменена", showAlert: true });
      return NextResponse.json({ ok: true });
    }

    await sb
      .from("appointments")
      .update({
        confirmed_at: new Date().toISOString(),
        status: apt.status === "pending" ? "scheduled" : apt.status,
      })
      .eq("id", parsed.appointmentId);

    const text =
      `<b>✅ Запись подтверждена</b>\n` +
      `Врач: ${doctorName}\n` +
      `${dateRu}, ${timeRu}.\n\n` +
      `До встречи в клинике!`;

    await editTelegramMessage({ chatId, messageId, text, replyMarkup: appOpenKeyboard() });
    await answerCallbackQuery({ callbackQueryId: cq.id, text: "Запись подтверждена" });
    return NextResponse.json({ ok: true });
  }

  if (apt.status === "cancelled") {
    await answerCallbackQuery({ callbackQueryId: cq.id, text: "Запись уже отменена" });
    return NextResponse.json({ ok: true });
  }

  await sb.from("appointments").update({ status: "cancelled" }).eq("id", parsed.appointmentId);

  const { notifyDoctorPatientCancelled } = await import("@/lib/server/appointmentTelegram");
  await notifyDoctorPatientCancelled(parsed.appointmentId);

  const text =
    `<b>❌ Запись отменена</b>\n` +
    `Приём у врача ${doctorName}\n` +
    `${dateRu}, ${timeRu}.\n\n` +
    `Чтобы записаться снова — откройте приложение.`;

  await editTelegramMessage({ chatId, messageId, text, replyMarkup: appOpenKeyboard() });
  await answerCallbackQuery({ callbackQueryId: cq.id, text: "Запись отменена" });
  return NextResponse.json({ ok: true });
}
