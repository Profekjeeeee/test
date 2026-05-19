import { supabase } from "@/lib/supabaseClient";
import type { AdminDoctor, AdminDoctorEditPayload } from "@/lib/admin/types";

function mapDoctorRow(row: Record<string, unknown>): AdminDoctor {
  return {
    id: String(row.id),
    created_at: String(row.created_at ?? ""),
    name: String(row.name ?? ""),
    specialization: String(row.specialization ?? ""),
    photo_url: String(row.photo_url ?? ""),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export async function getDoctors(): Promise<{ data: AdminDoctor[]; error: string | null }> {
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((r) => mapDoctorRow(r as Record<string, unknown>)), error: null };
}

export async function updateDoctorStatus(
  id: string,
  is_active: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("doctors").update({ is_active }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function editDoctor(
  id: string,
  payload: AdminDoctorEditPayload
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = payload.name.trim();
  if (payload.specialization !== undefined) patch.specialization = payload.specialization.trim();
  if (payload.photo_url !== undefined) patch.photo_url = payload.photo_url.trim();
  if (payload.sort_order !== undefined) patch.sort_order = payload.sort_order;

  const { error } = await supabase.from("doctors").update(patch).eq("id", id);
  return { error: error?.message ?? null };
}
