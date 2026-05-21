"use client";

import { Delete } from "lucide-react";

type PinKeypadProps = {
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

export function PinKeypad({ disabled, onDigit, onBackspace }: PinKeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mx-auto">
      {KEYS.map((key, idx) => {
        if (key === "") {
          return <div key={`sp-${idx}`} aria-hidden />;
        }
        if (key === "back") {
          return (
            <button
              key="back"
              type="button"
              disabled={disabled}
              aria-label="Удалить цифру"
              onClick={onBackspace}
              className="h-14 rounded-2xl flex items-center justify-center text-primary active:scale-95 transition-transform disabled:opacity-40"
            >
              <Delete className="w-6 h-6" strokeWidth={1.75} />
            </button>
          );
        }
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(key)}
            className="h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[22px] font-semibold text-[#0F172A] dark:text-white shadow-sm active:scale-95 transition-transform disabled:opacity-40"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
