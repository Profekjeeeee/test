"use client";

import { useMemo } from "react";

import { buildTimeSlotsFromConfig } from "@/lib/clinic/bookingSlots";
import { DEFAULT_CLINIC_SETTINGS } from "@/lib/clinic/defaults";
import { useClinic } from "@/contexts/ClinicProvider";

/** Слоты онлайн-записи из настроек клиники. */
export function useClinicTimeSlots(): string[] {
  const { settings } = useClinic();
  return useMemo(
    () => buildTimeSlotsFromConfig(settings.bookingSlots ?? DEFAULT_CLINIC_SETTINGS.bookingSlots),
    [settings.bookingSlots],
  );
}
