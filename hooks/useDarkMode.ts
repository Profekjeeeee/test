"use client";

import { useSyncExternalStore } from "react";

/**
 * Тёмная тема: класс .dark на <html>.
 * Следит за themeChange и за мутациями класса на html (первая инициализация ThemeProvider).
 */
export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribeDarkMode, getDarkSnapshot, serverDarkSnapshot);
}

function subscribeDarkMode(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onTheme = () => onStoreChange();
  window.addEventListener("themeChange", onTheme);

  const obs =
    typeof document !== "undefined"
      ? new MutationObserver(() => onStoreChange())
      : null;
  obs?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => {
    window.removeEventListener("themeChange", onTheme);
    obs?.disconnect();
  };
}

function getDarkSnapshot(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function serverDarkSnapshot(): boolean {
  return false;
}
