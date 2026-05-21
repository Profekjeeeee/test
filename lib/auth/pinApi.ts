import { supabase } from "@/lib/supabaseClient";

export const PIN_MIN_LEN = 4;
export const PIN_MAX_LEN = 6;
export const PIN_AUTO_SUBMIT_LEN = 4;

export async function getAuthUserIdOrError(): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { error: error.message };
  const userId = data.user?.id;
  if (!userId) return { error: "Нет активной сессии Auth." };
  return { userId };
}

/** RPC ensure_profile_row(p_user_id) — только для auth.uid() из текущей сессии. */
export async function rpcEnsureProfileRow(userId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("ensure_profile_row", {
    p_user_id: userId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function ensureProfileForAuthUser(): Promise<{ error?: string }> {
  const auth = await getAuthUserIdOrError();
  if ("error" in auth) return { error: auth.error };
  return rpcEnsureProfileRow(auth.userId);
}

export type VerifyPinResult =
  | { ok: true }
  | {
      ok: false;
      error: "wrong_pin" | "locked" | "no_pin" | "invalid_format" | "unknown";
      remaining?: number;
      lockedUntil?: string;
    };

function parseVerifyPayload(raw: unknown): VerifyPinResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "unknown" };
  }
  const o = raw as Record<string, unknown>;
  if (o.ok === true) return { ok: true };
  const err = typeof o.error === "string" ? o.error : "unknown";
  const remaining = typeof o.remaining === "number" ? o.remaining : undefined;
  const lockedUntil =
    typeof o.locked_until === "string"
      ? o.locked_until
      : typeof o.lockedUntil === "string"
        ? o.lockedUntil
        : undefined;
  if (err === "wrong_pin" || err === "locked" || err === "no_pin" || err === "invalid_format") {
    return { ok: false, error: err, remaining, lockedUntil };
  }
  return { ok: false, error: "unknown", remaining, lockedUntil };
}

export async function rpcSetUserPin(pin: string): Promise<{ error?: string }> {
  const auth = await getAuthUserIdOrError();
  if ("error" in auth) return { error: auth.error };

  const ensured = await rpcEnsureProfileRow(auth.userId);
  if (ensured.error) return ensured;

  const { error } = await supabase.rpc("set_user_pin", {
    p_user_id: auth.userId,
    p_pin: pin,
  });
  if (error) return { error: error.message };
  return {};
}

export async function rpcVerifyUserPin(pin: string): Promise<VerifyPinResult> {
  const auth = await getAuthUserIdOrError();
  if ("error" in auth) return { ok: false, error: "unknown" };

  const { data, error } = await supabase.rpc("verify_user_pin", {
    p_user_id: auth.userId,
    p_pin: pin,
  });
  if (error) {
    console.warn("[pin] verify_user_pin:", error.message, error.code);
    return { ok: false, error: "unknown" };
  }
  return parseVerifyPayload(data);
}

export async function fetchProfileHasPin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("pin_hash")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return false;
    throw error;
  }
  const hash = (data as { pin_hash?: string | null } | null)?.pin_hash;
  return hash != null && hash !== "";
}
