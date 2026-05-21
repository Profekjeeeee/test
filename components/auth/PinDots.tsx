"use client";

import { PIN_MAX_LEN } from "@/lib/auth/pinApi";

type PinDotsProps = {
  length: number;
  filled: number;
  error?: boolean;
};

export function PinDots({ length, filled, error }: PinDotsProps) {
  const slots = Math.min(length, PIN_MAX_LEN);
  return (
    <div className="flex justify-center gap-3 mb-8" aria-hidden>
      {Array.from({ length: slots }).map((_, i) => (
        <span
          key={i}
          className={[
            "w-3.5 h-3.5 rounded-full transition-all duration-150",
            i < filled
              ? error
                ? "bg-red-500 scale-110"
                : "bg-primary scale-110"
              : "bg-slate-200 dark:bg-slate-600",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
