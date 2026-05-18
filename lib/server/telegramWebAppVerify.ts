import "server-only";

import crypto from "crypto";

/**
 * Документ: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export interface TelegramValidatedUser {
  id: string;
}

function timingSafeEqHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Бот-токен + querystring init_data из Telegram.WebApp.initData.
 * При истёкшем auth_date возвращает null.
 */
export function verifyTelegramWebAppInitData(
  initData: string | undefined | null,
  botToken: string | undefined | null,
  maxAgeSec = 86400,
): TelegramValidatedUser | null {
  const token = botToken?.trim();
  const raw = typeof initData === "string" ? initData.trim() : "";
  if (!token || !raw) return null;

  const params = new URLSearchParams(raw);
  const incomingHash = params.get("hash");
  if (!incomingHash || !incomingHash.trim()) return null;

  const authDateRaw = params.get("auth_date");
  if (authDateRaw) {
    const authDate = Number.parseInt(authDateRaw, 10);
    if (!Number.isFinite(authDate)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSec) return null;
  }

  params.delete("hash");

  const checkParts: string[] = [];
  for (const key of [...params.keys()].sort()) {
    const v = params.get(key);
    if (v !== null && v !== "") {
      checkParts.push(`${key}=${v}`);
    }
  }
  const dataCheckString = checkParts.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token, "utf8").digest();

  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString, "utf8").digest("hex");

  if (!timingSafeEqHex(incomingHash.trim(), computedHash)) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    const parsed = JSON.parse(userJson) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const id = (parsed as { id?: unknown }).id;
    if (typeof id === "number") return { id: String(Math.trunc(id)) };
    if (typeof id === "string" && id.trim()) return { id: id.trim() };
  } catch {
    return null;
  }
  return null;
}
