import type { BookingSlotsConfig } from "@/lib/clinic/types";

/** Генерация слотов записи из настроек клиники. */
export function buildTimeSlotsFromConfig(cfg: BookingSlotsConfig): string[] {
  const start = Math.max(0, Math.min(23, Math.floor(cfg.startHour)));
  const end = Math.max(start + 1, Math.min(24, Math.floor(cfg.endHour)));
  const step = cfg.stepMinutes === 30 ? 30 : 60;
  const slots: string[] = [];
  for (let h = start; h < end; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (step === 30) {
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  return slots;
}
