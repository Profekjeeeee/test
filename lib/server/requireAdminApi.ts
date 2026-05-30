import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export class AdminApiAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiAuthError";
    this.status = status;
  }
}

/** Bearer JWT сотрудника-админа из Supabase Auth. */
export async function requireAdminFromRequest(request: Request): Promise<void> {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    throw new AdminApiAuthError("Требуется Authorization: Bearer", 401);
  }
  const token = auth.slice(7).trim();
  if (!token) throw new AdminApiAuthError("Пустой токен", 401);

  const { getSupabasePublicAnonKey, getSupabasePublicUrl } = await import("@/lib/supabase/publicConfig");
  const url = getSupabasePublicUrl();
  const anon = getSupabasePublicAnonKey();
  if (!url || !anon) throw new AdminApiAuthError("Supabase не настроен", 503);

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user?.id) {
    throw new AdminApiAuthError("Недействительная сессия", 401);
  }

  const adm = getSupabaseServiceRole();
  const { data: emp, error: empErr } = await adm
    .from("dental_employees")
    .select("id, role")
    .eq("auth_user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (empErr) throw new AdminApiAuthError(empErr.message, 500);
  if (!emp) throw new AdminApiAuthError("Доступ только для администратора", 403);
}
