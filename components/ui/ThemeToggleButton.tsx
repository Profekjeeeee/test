"use client";

import { useDarkMode } from "@/hooks/useDarkMode";
import { setThemeDark } from "@/lib/theme";

type Props = {
  /** Например w-9 h-9 чтобы совпасть с компактной кнопкой выхода в админке */
  sizeClass?: string;
  className?: string;
};

/**
 * Telegram-стиль: луна в светлой теме (включить ночь), солнце в тёмной (включить день).
 */
export default function ThemeToggleButton({
  sizeClass = "w-10 h-10",
  className = "",
}: Props) {
  const isDark = useDarkMode();

  return (
    <button
      type="button"
      onClick={() => setThemeDark(!isDark)}
      className={`interactive-press-sm ${sizeClass} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] ${className}`}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
    >
      {!isDark ? (
        /* Луна — приглушённый синевато-серый */
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          className="text-secondary"
          aria-hidden
        >
          <path
            d="M21 13.234A8.498 8.498 0 0111.766 3a8.498 8.498 0 109.234 10.234z"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        /* Солнце — светится на глубоком фоне */
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          className="text-amber-300"
          aria-hidden
        >
          <circle cx="12" cy="12" r="3.85" stroke="currentColor" strokeWidth="1.65" />
          <path
            d="M12 3.25v1.95M12 18.8v1.95M3.25 12h1.95M18.8 12h1.95M5.64 5.64l1.38 1.38M17 17l1.38 1.38M18.36 5.64L17 7.03M7.03 17l-1.38 1.38"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
