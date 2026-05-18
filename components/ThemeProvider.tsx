"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Включаем transitions только после первой загрузки — предотвращает FOUC
    requestAnimationFrame(() => {
      document.documentElement.classList.add("theme-ready");
    });

    const handler = (e: Event) => {
      const { dark } = (e as CustomEvent<{ dark: boolean }>).detail;
      if (dark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem(THEME_STORAGE_KEY, "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem(THEME_STORAGE_KEY, "light");
      }
    };

    window.addEventListener("themeChange", handler);
    return () => window.removeEventListener("themeChange", handler);
  }, []);

  return <>{children}</>;
}
