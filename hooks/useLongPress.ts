"use client";

import { useCallback, useRef } from "react";

const DEFAULT_DELAY_MS = 480;

export function useLongPress(onLongPress: () => void, delayMs = DEFAULT_DELAY_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, delayMs);
  }, [clear, delayMs, onLongPress]);

  return {
    onTouchStart: () => start(),
    onTouchEnd: () => clear(),
    onTouchCancel: () => clear(),
    onTouchMove: () => clear(),
    onMouseDown: () => start(),
    onMouseUp: () => clear(),
    onMouseLeave: () => clear(),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!firedRef.current) onLongPress();
    },
  };
}
