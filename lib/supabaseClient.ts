import { createClient } from "@supabase/supabase-js";

/**
 * Env с билда (Vercel и т.д.) или захардкоженный fallback для прод-сборки без NEXT_PUBLIC_*.
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qjmevvoainaaosqnenlw.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_tOyX7JwoZeEd0UagKD_fYQ_-jj9FzLF";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
