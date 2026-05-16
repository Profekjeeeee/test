import { createClient } from "@supabase/supabase-js";

/**
 * На билде / SSR переменные могут быть пустыми — подставляем заглушки, чтобы не падала статическая генерация.
 * В рантайме должны быть заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.local";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.build-placeholder.invalid";

export const supabase = createClient(url, key);
