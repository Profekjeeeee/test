import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export class PlatformApiAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlatformApiAuthError";
    this.status = status;
  }
}

function parseEnvList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function isPlatformAdminUser(user: User): Promise<boolean> {
  const adm = getSupabaseServiceRole();
  const { data, error } = await adm
    .from("platform_admins")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw new PlatformApiAuthError(error.message, 500);
  if (data) return true;

  const envEmails = parseEnvList(process.env.PLATFORM_ADMIN_EMAILS);
  const envPhones = parseEnvList(process.env.PLATFORM_ADMIN_PHONES);
  if (!envEmails.length && !envPhones.length) return false;

  const email = user.email?.toLowerCase() ?? "";
  if (email && envEmails.includes(email)) return true;

  if (envPhones.length) {
    const { data: emp } = await adm
      .from("dental_employees")
      .select("phone")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const phone = emp?.phone?.replace(/\D/g, "") ?? "";
    if (phone && envPhones.some((p) => phone.endsWith(p.replace(/\D/g, "")))) {
      return true;
    }
  }

  return false;
}

export type PlatformAdminContext = {
  userId: string;
  email: string;
};

/** Bearer JWT + platform_admins или PLATFORM_ADMIN_EMAILS/PHONES. */
export async function requirePlatformAdminFromRequest(
  request: Request,
): Promise<PlatformAdminContext> {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    throw new PlatformApiAuthError("Требуется Authorization: Bearer", 401);
  }
  const token = auth.slice(7).trim();
  if (!token) throw new PlatformApiAuthError("Пустой токен", 401);

  const { getSupabasePublicAnonKey, getSupabasePublicUrl } = await import("@/lib/supabase/publicConfig");
  const url = getSupabasePublicUrl();
  const anon = getSupabasePublicAnonKey();
  if (!url || !anon) throw new PlatformApiAuthError("Supabase не настроен", 503);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user?.id) {
    throw new PlatformApiAuthError("Недействительная сессия", 401);
  }

  const ok = await isPlatformAdminUser(userData.user);
  if (!ok) throw new PlatformApiAuthError("Доступ только для Super Admin платформы", 403);

  return {
    userId: userData.user.id,
    email: userData.user.email ?? "",
  };
}

/** Проверка без throw — для GET /api/platform/me. */
export async function checkPlatformAdminFromRequest(
  request: Request,
): Promise<PlatformAdminContext | null> {
  try {
    return await requirePlatformAdminFromRequest(request);
  } catch {
    return null;
  }
}
