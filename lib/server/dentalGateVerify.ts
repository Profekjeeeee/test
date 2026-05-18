import "server-only";

import { verifyTelegramWebAppInitData } from "@/lib/server/telegramWebAppVerify";

export class DentalGateError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type DentalGateVerified =
  | { kind: "telegram"; telegramUserId: string }
  | { kind: "dev" };

/** Проверенный контекст TMA или дев-байпас локальной разработки. */
export function verifyDentalGateRequest(telegramInitData: string | undefined): DentalGateVerified {
  const bot = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const raw = telegramInitData?.trim() ?? "";
  const dev =
    process.env.NODE_ENV !== "production" && process.env.DENTAL_GATE_DEV_ALLOW?.trim() === "1";

  if (bot && raw) {
    const v = verifyTelegramWebAppInitData(raw, bot);
    if (v?.id) {
      return { kind: "telegram", telegramUserId: v.id };
    }
    if (!dev && process.env.NODE_ENV === "production") {
      throw new DentalGateError(403, "Невалидные или истёкшие данные Telegram WebApp.");
    }
  }

  if (dev) {
    return { kind: "dev" };
  }

  if (!bot && process.env.NODE_ENV === "production") {
    throw new DentalGateError(
      500,
      "Сервер: задайте TELEGRAM_BOT_TOKEN для проверки Mini App.",
    );
  }

  throw new DentalGateError(
    403,
    "Не удалось установить сеанс. Откройте приложение через Telegram или задайте DENTAL_GATE_DEV_ALLOW=1 в dev.",
  );
}
