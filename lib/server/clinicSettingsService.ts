import "server-only";

import type { BookingSlotsConfig, ClinicPublicSettings, WorkingHoursRow } from "@/lib/clinic/types";
import { DEFAULT_CLINIC_SETTINGS } from "@/lib/clinic/defaults";
import { ApiError } from "@/lib/server/api/apiError";
import { loadClinicPublicSettings, resolveClinicSlug } from "@/lib/server/clinicService";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import { createClient } from "@supabase/supabase-js";

export type ClinicSettingsPatch = Partial<{
  displayName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  metroHint: string;
  phone: string;
  whatsapp: string;
  email: string;
  mapEmbedUrl: string;
  workingHours: WorkingHoursRow[];
  bookingSlots: BookingSlotsConfig;
  timezone: string;
  tzOffset: string;
  botUsername: string;
  miniAppUrl: string;
  locale: string;
}>;

async function getAdminClinicId(token: string): Promise<string> {
  const { getSupabasePublicAnonKey, getSupabasePublicUrl } = await import("@/lib/supabase/publicConfig");
  const url = getSupabasePublicUrl();
  const anon = getSupabasePublicAnonKey();
  if (!url || !anon) throw new ApiError(503, "Supabase не настроен");

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user?.id) throw new ApiError(401, "Недействительная сессия");

  const adm = getSupabaseServiceRole();
  const { data: emp, error: empErr } = await adm
    .from("dental_employees")
    .select("clinic_id, role")
    .eq("auth_user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (empErr) throw new ApiError(500, empErr.message);
  if (!emp?.clinic_id) throw new ApiError(403, "Доступ только для администратора клиники");

  return String(emp.clinic_id);
}

function toDbPatch(patch: ClinicSettingsPatch): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (patch.displayName !== undefined) map.display_name = patch.displayName;
  if (patch.tagline !== undefined) map.tagline = patch.tagline;
  if (patch.logoUrl !== undefined) map.logo_url = patch.logoUrl;
  if (patch.primaryColor !== undefined) map.primary_color = patch.primaryColor;
  if (patch.accentColor !== undefined) map.accent_color = patch.accentColor;
  if (patch.addressLine1 !== undefined) map.address_line1 = patch.addressLine1;
  if (patch.addressLine2 !== undefined) map.address_line2 = patch.addressLine2;
  if (patch.city !== undefined) map.city = patch.city;
  if (patch.postalCode !== undefined) map.postal_code = patch.postalCode;
  if (patch.metroHint !== undefined) map.metro_hint = patch.metroHint;
  if (patch.phone !== undefined) map.phone = patch.phone;
  if (patch.whatsapp !== undefined) map.whatsapp = patch.whatsapp;
  if (patch.email !== undefined) map.email = patch.email;
  if (patch.mapEmbedUrl !== undefined) map.map_embed_url = patch.mapEmbedUrl;
  if (patch.workingHours !== undefined) map.working_hours = patch.workingHours;
  if (patch.bookingSlots !== undefined) map.booking_slots = patch.bookingSlots;
  if (patch.timezone !== undefined) map.timezone = patch.timezone;
  if (patch.tzOffset !== undefined) map.tz_offset = patch.tzOffset;
  if (patch.botUsername !== undefined) map.telegram_bot_username = patch.botUsername;
  if (patch.miniAppUrl !== undefined) map.telegram_mini_app_url = patch.miniAppUrl;
  if (patch.locale !== undefined) map.locale = patch.locale;
  map.updated_at = new Date().toISOString();
  return map;
}

/** PATCH настроек клиники — только admin своей клиники (service role + проверка). */
export async function updateClinicSettingsFromRequest(
  request: Request,
  patch: ClinicSettingsPatch,
): Promise<ClinicPublicSettings> {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(401, "Требуется Authorization: Bearer");
  }
  const token = auth.slice(7).trim();
  if (!token) throw new ApiError(401, "Пустой токен");

  const clinicId = await getAdminClinicId(token);
  const dbPatch = toDbPatch(patch);
  if (Object.keys(dbPatch).length <= 1) {
    throw new ApiError(400, "Нет полей для обновления.");
  }

  const adm = getSupabaseServiceRole();
  const { error } = await adm.from("clinic_settings").update(dbPatch).eq("clinic_id", clinicId);
  if (error) throw new ApiError(500, error.message);

  const slug = resolveClinicSlug();
  return loadClinicPublicSettings(slug);
}

export { DEFAULT_CLINIC_SETTINGS };
