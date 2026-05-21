import "server-only";

import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

/** Гарантирует строку profiles для shadow-auth пользователя (сервер, до выдачи JWT). */
export async function ensureProfileRowExists(authUserId: string): Promise<void> {
  const admin = getSupabaseServiceRole();
  const { data, error: selErr } = await admin
    .from("profiles")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();
  if (selErr && selErr.code !== "42P01" && !String(selErr.message).includes("profiles")) {
    throw new Error(selErr.message);
  }
  if (data) return;

  const { error: insErr } = await admin.from("profiles").insert({ id: authUserId });
  if (insErr && insErr.code !== "23505") {
    throw new Error(insErr.message);
  }
}

export async function profileHasPinHash(authUserId: string): Promise<boolean> {
  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("profiles")
    .select("pin_hash")
    .eq("id", authUserId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || String(error.message).includes("profiles")) {
      return false;
    }
    throw new Error(error.message);
  }
  const hash = (data as { pin_hash?: string | null } | null)?.pin_hash;
  return hash != null && hash !== "";
}
