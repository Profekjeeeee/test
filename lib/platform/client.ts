import { supabase } from "@/lib/supabaseClient";
import type {
  CreateClinicInput,
  PlatformClinicRow,
  PlatformMonitoringRow,
  PlatformStats,
  SubscriptionPlan,
} from "@/lib/platform/types";

async function platformFetch<T>(
  path: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Нет сессии — войдите как Super Admin");

  const method = options?.method ?? (options?.body ? "POST" : "GET");
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

export async function fetchPlatformMe(): Promise<{ isPlatformAdmin: boolean; email: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { isPlatformAdmin: false, email: "" };

  const res = await fetch("/api/platform/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as { ok?: boolean; data?: { isPlatformAdmin: boolean; email: string } };
  if (!res.ok || !json.ok || !json.data) return { isPlatformAdmin: false, email: "" };
  return json.data;
}

export function fetchPlatformStats(): Promise<PlatformStats> {
  return platformFetch<PlatformStats>("/api/platform/stats");
}

export function fetchPlatformClinics(): Promise<PlatformClinicRow[]> {
  return platformFetch<PlatformClinicRow[]>("/api/platform/clinics");
}

export function fetchPlatformClinic(id: string): Promise<PlatformClinicRow> {
  return platformFetch<PlatformClinicRow>(`/api/platform/clinics/${id}`);
}

export function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return platformFetch<SubscriptionPlan[]>("/api/platform/plans");
}

export function createPlatformClinic(input: CreateClinicInput): Promise<PlatformClinicRow> {
  return platformFetch<PlatformClinicRow>("/api/platform/clinics", { method: "POST", body: input as unknown as Record<string, unknown> });
}

export function updatePlatformClinic(
  id: string,
  patch: Record<string, unknown>,
): Promise<PlatformClinicRow> {
  return platformFetch<PlatformClinicRow>(`/api/platform/clinics/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

export function fetchPlatformMonitoring(): Promise<PlatformMonitoringRow[]> {
  return platformFetch<PlatformMonitoringRow[]>("/api/platform/monitoring");
}
