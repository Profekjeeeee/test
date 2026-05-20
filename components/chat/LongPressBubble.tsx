"use client";

import type { ReactNode } from "react";
import { useLongPress } from "@/hooks/useLongPress";

type Props = {
  enabled: boolean;
  onLongPress: () => void;
  className?: string;
  children: ReactNode;
};

/** Обёртка пузыря: long-press / ПКМ — контекстное меню. */
export function LongPressBubble({ enabled, onLongPress, className = "", children }: Props) {
  const press = useLongPress(onLongPress);

  return (
    <div
      className={`${className}${enabled ? " select-none touch-manipulation" : ""}`}
      {...(enabled ? press : {})}
    >
      {children}
    </div>
  );
}
