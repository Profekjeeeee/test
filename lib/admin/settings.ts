import { supabase } from "@/lib/supabaseClient";
import type { ClinicPublicSettings } from "@/lib/clinic/types";
import type { ClinicSettingsPatch } from "@/lib/server/clinicSettingsService";

async function adminBearerFetch<T>(
  path: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Нет сессии администратора");

  const method = options?.method ?? (options?.body ? "PATCH" : "GET");
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const json = (await res.json()) as { ok?: boolean; data?: T; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data as T;
}

export function patchClinicSettings(patch: ClinicSettingsPatch): Promise<ClinicPublicSettings> {
  return adminBearerFetch<ClinicPublicSettings>("/api/clinic/settings", {
    method: "PATCH",
    body: patch as Record<string, unknown>,
  });
}
