import { createClient } from "@supabase/supabase-js";

import {
  getSupabasePublicAnonKey,
  getSupabasePublicUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/publicConfig";

const supabaseUrl = getSupabasePublicUrl();
const supabaseAnonKey = getSupabasePublicAnonKey();

if (!isSupabaseConfigured()) {
  console.warn(
    "[supabase] Укажите NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в переменных окружения (.env.local и т.д.).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
