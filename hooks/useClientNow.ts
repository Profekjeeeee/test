"use client";

import { useEffect, useState } from "react";

/**
 * После SSR и первого react-прохода в браузере `null`; затем ставится локальное «сейчас».
 * Нужно, чтобы не сравнивать в гидратации текст/классы, завязанные на `Date` в браузере vs Node.
 */
export function useClientNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}
