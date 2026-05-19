/** Короткий тактильный отклик в Telegram Mini App (no-op вне Telegram). */
export function tgHapticImpact(style: "light" | "medium" | "heavy" = "light"): void {
  if (typeof window === "undefined") return;
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    /* ignore */
  }
}

export function tgHapticSuccess(): void {
  if (typeof window === "undefined") return;
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
  } catch {
    /* ignore */
  }
}
