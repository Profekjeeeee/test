"use client";

import { useEffect } from "react";
import { initTelegramWebAppLifecycle } from "@/lib/telegramWebApp";

/** Инициализация Telegram Mini App после монтирования React-дерева. */
export function TelegramWebAppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => initTelegramWebAppLifecycle(), []);
  return <>{children}</>;
}
