import { createClient } from "@supabase/supabase-js";

/**
 * Клиент только из NEXT_PUBLIC_* (инлайнятся на клиенте из .env.local при dev/build).
 * Без плейсхолдеров — иначе запросы уходят с неверным ключом и дают 401.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "🚨 КРИТИЧЕСКАЯ ОШИБКА: Ключи Supabase не найдены в .env.local! URL:",
    supabaseUrl,
    "KEY:",
    supabaseAnonKey ? "Загружен" : "ПУСТО"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
