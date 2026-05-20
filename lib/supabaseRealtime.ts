import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Уникальное имя Realtime-канала — без коллизий при Strict Mode и быстром remount. */
export function uniqueRealtimeChannelName(base: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return `${base}:${suffix}`;
}

/** Гарантированная отписка: removeChannel закрывает WebSocket-подписку канала. */
export function removeSupabaseChannel(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel);
}
