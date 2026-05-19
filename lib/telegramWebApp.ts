/**
 * Telegram Mini App: безопасное чтение user id вне Telegram (браузер) — null.
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id?: number;
          };
        };
        HapticFeedback?: {
          impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred?: (type: "error" | "success" | "warning") => void;
          selectionChanged?: () => void;
        };
      };
    };
  }
}

/**
 * Реальный Telegram user id из SDK (число → строка для text/bigint в PostgREST).
 * В обычном браузере / без initData — null.
 */
export function getTelegramUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (raw === undefined || raw === null) return null;
    return String(raw);
  } catch {
    return null;
  }
}
