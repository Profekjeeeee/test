"use client";

import { useState, useEffect } from "react";

/**
 * Возвращает true когда активна тёмная тема (класс .dark на <html>).
 * Реагирует на смену темы через кастомное событие themeChange.
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));

    const handler = (e: Event) => {
      setDark((e as CustomEvent<{ dark: boolean }>).detail.dark);
    };

    window.addEventListener("themeChange", handler);
    return () => window.removeEventListener("themeChange", handler);
  }, []);

  return dark;
}
