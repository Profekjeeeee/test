import "server-only";

import type { BookingSlotsConfig, ClinicPublicSettings, WorkingHoursRow } from "@/lib/clinic/types";
import { DEFAULT_CLINIC_SETTINGS } from "@/lib/clinic/defaults";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

function parseWorkingHours(raw: unknown): WorkingHoursRow[] {
  if (!Array.isArray(raw)) return DEFAULT_CLINIC_SETTINGS.workingHours;
  const rows: WorkingHoursRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day = typeof o.day === "string" ? o.day : "";
    const hours = typeof o.hours === "string" ? o.hours : "";
    if (day) rows.push({ day, hours });
  }
  return rows.length ? rows : DEFAULT_CLINIC_SETTINGS.workingHours;
}

function parseBookingSlots(raw: unknown): BookingSlotsConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CLINIC_SETTINGS.bookingSlots;
  const o = raw as Record<string, unknown>;
  const startHour = typeof o.startHour === "number" ? o.startHour : 9;
  const endHour = typeof o.endHour === "number" ? o.endHour : 17;
  const stepMinutes = o.stepMinutes === 30 ? 30 : 60;
  return { startHour, endHour, stepMinutes };
}

function mapRow(
  clinic: Record<string, unknown>,
  settings: Record<string, unknown> | null,
): ClinicPublicSettings {
  const s = settings ?? {};
  return {
    clinicId: String(clinic.id ?? DEFAULT_CLINIC_SETTINGS.clinicId),
    slug: String(clinic.slug ?? "default"),
    name: String(clinic.name ?? ""),
    displayName: String(s.display_name ?? clinic.name ?? ""),
    tagline: String(s.tagline ?? ""),
    logoUrl: String(s.logo_url ?? ""),
    primaryColor: String(s.primary_color ?? "#2563EB"),
    accentColor: String(s.accent_color ?? "#1D4ED8"),
    addressLine1: String(s.address_line1 ?? ""),
    addressLine2: String(s.address_line2 ?? ""),
    city: String(s.city ?? ""),
    postalCode: String(s.postal_code ?? ""),
    metroHint: String(s.metro_hint ?? ""),
    phone: String(s.phone ?? ""),
    whatsapp: String(s.whatsapp ?? ""),
    email: String(s.email ?? ""),
    mapEmbedUrl: String(s.map_embed_url ?? ""),
    workingHours: parseWorkingHours(s.working_hours),
    bookingSlots: parseBookingSlots(s.booking_slots),
    timezone: String(s.timezone ?? "Europe/Moscow"),
    tzOffset: String(s.tz_offset ?? "+03:00"),
    botUsername: String(s.telegram_bot_username ?? ""),
    miniAppUrl: String(s.telegram_mini_app_url ?? ""),
    locale: String(s.locale ?? "ru"),
  };
}

export function resolveClinicSlug(): string {
  return (
    process.env.CLINIC_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_CLINIC_SLUG?.trim() ||
    "default"
  );
}

/** Публичные настройки клиники по slug (service role, без сессии). */
export async function loadClinicPublicSettings(
  slug = resolveClinicSlug(),
): Promise<ClinicPublicSettings> {
  const adm = getSupabaseServiceRole();
  const { data: clinic, error: cErr } = await adm
    .from("clinics")
    .select("id, slug, name, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (cErr || !clinic) {
    if (slug !== "default") {
      return loadClinicPublicSettings("default");
    }
    return DEFAULT_CLINIC_SETTINGS;
  }

  const { data: settings, error: sErr } = await adm
    .from("clinic_settings")
    .select("*")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (sErr) return mapRow(clinic as Record<string, unknown>, null);
  return mapRow(clinic as Record<string, unknown>, (settings as Record<string, unknown>) ?? null);
}

export const DEFAULT_CLINIC_ID = DEFAULT_CLINIC_SETTINGS.clinicId;
