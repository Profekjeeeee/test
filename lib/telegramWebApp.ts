/**
 * Telegram Mini App: типы SDK, инициализация (ready/expand), фон по themeParams.
 */
export interface TelegramThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  header_bg_color?: string;
}

export interface TelegramWebAppInstance {
  ready: () => void;
  expand: () => void;
  themeParams: TelegramThemeParams;
  colorScheme?: "light" | "dark";
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
    };
  };
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
  onEvent?: (eventType: string, handler: () => void) => void;
  offEvent?: (eventType: string, handler: () => void) => void;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred?: (type: "error" | "success" | "warning") => void;
    selectionChanged?: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppInstance;
    };
  }
}

/** Безопасный доступ к `window.Telegram.WebApp` (вне Telegram — null). */
export function getTelegramWebApp(): TelegramWebAppInstance | null {
  if (typeof window === "undefined") return null;
  try {
    return window.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export function isTelegramMiniApp(): boolean {
  return getTelegramWebApp() !== null;
}

/**
 * Фон html/body + `setBackgroundColor` в chrome Telegram по themeParams.
 */
export function applyTelegramWebAppBackground(webApp?: TelegramWebAppInstance | null): void {
  if (typeof document === "undefined") return;
  const tg = webApp ?? getTelegramWebApp();
  if (!tg) return;

  try {
    const params = tg.themeParams ?? {};
    const bg = params.bg_color ?? params.secondary_bg_color;
    if (!bg) return;

    document.documentElement.style.backgroundColor = bg;
    if (document.body) {
      document.body.style.backgroundColor = bg;
    }
    tg.setBackgroundColor?.(bg);
  } catch {
    /* вне WebView или устаревший клиент */
  }
}

/**
 * ready(), expand(), синхронизация фона и подписка на themeChanged.
 * Возвращает cleanup для useEffect.
 */
export function initTelegramWebAppLifecycle(): () => void {
  const tg = getTelegramWebApp();
  if (!tg) return () => {};

  try {
    tg.ready();
    tg.expand();
  } catch {
    /* noop */
  }

  applyTelegramWebAppBackground(tg);

  const onThemeChanged = () => applyTelegramWebAppBackground(tg);
  tg.onEvent?.("themeChanged", onThemeChanged);

  return () => {
    try {
      tg.offEvent?.("themeChanged", onThemeChanged);
    } catch {
      /* noop */
    }
  };
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

/**
 * Подписанный initData для POST /api/dental-db (проверка на сервере с TELEGRAM_BOT_TOKEN).
 * В обычном браузере без Telegram SDK — null.
 */
export function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.Telegram?.WebApp?.initData;
    if (typeof raw !== "string" || !raw.trim()) return null;
    return raw;
  } catch {
    return null;
  }
}
