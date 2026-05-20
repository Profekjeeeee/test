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

/** Лёгкий отклик при выборе из списка / переключении (no-op вне Telegram). */
export function tgHapticSelection(): void {
  if (typeof window === "undefined") return;
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* ignore */
  }
}
