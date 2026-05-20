export function getSupabasePublicUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
}

export function getSupabasePublicAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabasePublicUrl();
  const key = getSupabasePublicAnonKey();
  if (!url || !key) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function isFailedToFetchMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed");
}

/** Сообщение для UI при сетевой ошибке Supabase в браузере. */
export function supabaseNetworkErrorHint(): string {
  if (!isSupabaseConfigured()) {
    return "Supabase не настроен: проверьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local и перезапустите npm run dev.";
  }
  return "Нет связи с Supabase. Проверьте интернет, перезапустите dev-сервер, отключите блокировщик для localhost. В Telegram Mini App иногда помогает открыть в обычном браузере.";
}
