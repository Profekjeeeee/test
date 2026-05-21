import "server-only";

import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

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
  return typeof hash === "string" && hash.length > 0;
}
