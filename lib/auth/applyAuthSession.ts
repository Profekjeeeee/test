import { setDentalSession, refreshDentalCaches, type DentalSession } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export type ClientAuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  auth_user_id: string;
  role: "client" | "doctor" | "admin";
  dental_id: string;
  full_name: string;
  phone: string;
  specialization?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  has_pin: boolean;
};

export async function applySupabaseAuthTokens(
  access_token: string,
  refresh_token: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return { error: error.message };
  return {};
}

export function payloadToDentalSession(p: ClientAuthSessionPayload): DentalSession {
  return {
    id: p.dental_id,
    role: p.role,
    fullName: p.full_name,
    phone: p.phone,
    specialization: p.specialization,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
  };
}

export async function applyAuthSessionPayload(p: ClientAuthSessionPayload): Promise<{ error?: string }> {
  const tok = await applySupabaseAuthTokens(p.access_token, p.refresh_token);
  if (tok.error) return tok;
  setDentalSession(payloadToDentalSession(p));
  try {
    await refreshDentalCaches();
  } catch {
    /* кэш не критичен для входа */
  }
  return {};
}

export function redirectForRole(role: ClientAuthSessionPayload["role"]): string {
  if (role === "admin") return "/screens/admin/dashboard";
  if (role === "doctor") return "/screens/doctor/cabinet";
  return "/screens/03_Main";
}
