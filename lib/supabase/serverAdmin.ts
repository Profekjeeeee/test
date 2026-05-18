import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Сервер только: ключ service_role ни в коем случае не импортировать из клиента.
 */
export function getSupabaseServiceRole(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) {
    throw new Error(
      "[supabase] Для серверных маршрутов задайте NEXT_PUBLIC_SUPABASE_URL и секретную SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}
