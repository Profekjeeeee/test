import { NextResponse } from "next/server";

import { appOpenKeyboard, sendTelegramMessage } from "@/lib/server/telegramBot";

export const dynamic = "force-dynamic";

function normalizeTelegramId(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.trunc(raw));
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length ? t : null;
  }
  return null;
}

/**
 * POST JSON: { telegram_id: string | number, message: string }
 * Текст — HTML (parse_mode HTML): <b>, <i>, ссылки и т.д. по доке Telegram.
 * Env: TELEGRAM_BOT_TOKEN (обязательно), TELEGRAM_MINI_APP_URL или NEXT_PUBLIC_SITE_URL / VERCEL_URL для кнопки.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const telegramId = normalizeTelegramId(rec.telegram_id);
  const message = typeof rec.message === "string" ? rec.message : "";

  if (!telegramId) {
    return NextResponse.json({ error: "telegram_id is required" }, { status: 400 });
  }
  if (!message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const keyboard = appOpenKeyboard();
    const { messageId } = await sendTelegramMessage({
      chatId: telegramId,
      text: message,
      replyMarkup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
    });
    return NextResponse.json({ ok: true as const, message_id: messageId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    if (msg.includes("Mini App URL") || msg.includes("TELEGRAM_BOT_TOKEN")) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: "Telegram sendMessage failed", detail: msg }, { status: 502 });
  }
}
