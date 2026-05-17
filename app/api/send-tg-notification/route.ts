import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getMiniAppUrl(): string | null {
  const explicit = process.env.TELEGRAM_MINI_APP_URL?.trim();
  if (explicit) return explicit;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return null;
}

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
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 500 });
  }

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

  const miniAppUrl = getMiniAppUrl();
  if (!miniAppUrl) {
    return NextResponse.json(
      {
        error:
          "Mini App URL is not configured: set TELEGRAM_MINI_APP_URL or NEXT_PUBLIC_SITE_URL (or deploy on Vercel for VERCEL_URL)",
      },
      { status: 500 }
    );
  }

  const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: telegramId,
    text: message,
    parse_mode: "HTML" as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть приложение", web_app: { url: miniAppUrl } }],
      ],
    },
  };

  let tgRes: Response;
  try {
    tgRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: "Failed to reach Telegram API", detail: msg }, { status: 502 });
  }

  const tgJson: unknown = await tgRes.json().catch(() => null);

  if (!tgRes.ok) {
    return NextResponse.json(
      { error: "Telegram sendMessage failed", status: tgRes.status, details: tgJson },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true as const, telegram: tgJson });
}
