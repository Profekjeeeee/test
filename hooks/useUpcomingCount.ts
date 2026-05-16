"use client";

import { useState, useEffect } from "react";
import { getUpcomingCount, initAppointments } from "@/lib/appointments";

export function useUpcomingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    void initAppointments().then(() => setCount(getUpcomingCount()));

    const update = () => setCount(getUpcomingCount());

    window.addEventListener("appointmentsUpdated", update);
    window.addEventListener("storage", update);

    return () => {
      window.removeEventListener("appointmentsUpdated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return count;
}
