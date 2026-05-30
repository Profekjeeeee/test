import type { ClinicPublicSettings } from "@/lib/clinic/types";

/** Fallback, если API настроек недоступен (офлайн / до миграции 010). */
export const DEFAULT_CLINIC_SETTINGS: ClinicPublicSettings = {
  clinicId: "c0000000-0000-4000-8000-000000000001",
  slug: "default",
  name: "DentalCare Demo",
  displayName: "Стоматология DentalCare",
  tagline: "Личный кабинет пациента",
  logoUrl: "",
  primaryColor: "#2563EB",
  accentColor: "#1D4ED8",
  addressLine1: "ул. Ленина, 42, офис 301",
  addressLine2: "Новосибирск, 630099",
  city: "Новосибирск",
  postalCode: "630099",
  metroHint: "Метро «Площадь Ленина», 5 мин пешком",
  phone: "+73833000000",
  whatsapp: "73833000000",
  email: "info@dentalcare.demo",
  mapEmbedUrl: "",
  workingHours: [
    { day: "Пн — Пт", hours: "09:00 — 20:00" },
    { day: "Суббота", hours: "10:00 — 17:00" },
    { day: "Воскресенье", hours: "Выходной" },
  ],
  bookingSlots: { startHour: 9, endHour: 17, stepMinutes: 30 },
  timezone: "Asia/Novosibirsk",
  tzOffset: "+07:00",
  botUsername: "",
  miniAppUrl: "",
  locale: "ru",
};

export const DEFAULT_CLINIC_SLUG =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CLINIC_SLUG?.trim()) || "default";
