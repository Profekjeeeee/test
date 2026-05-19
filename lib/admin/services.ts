import { supabase } from "@/lib/supabaseClient";
import type { AdminService, AdminServiceCreatePayload } from "@/lib/admin/types";

function mapServiceRow(row: Record<string, unknown>): AdminService {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    price: Number(row.price ?? 0),
    category: String(row.category ?? "Прочее"),
    is_visible: Boolean(row.is_visible),
  };
}

export async function getServices(): Promise<{ data: AdminService[]; error: string | null }> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((r) => mapServiceRow(r as Record<string, unknown>)), error: null };
}

export async function updateServicePrice(
  id: string,
  new_price: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("services").update({ price: new_price }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function bulkHideServices(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from("services").update({ is_visible: false }).in("id", ids);
  return { error: error?.message ?? null };
}

export async function setServiceVisibility(
  id: string,
  is_visible: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("services").update({ is_visible }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function createService(
  payload: AdminServiceCreatePayload
): Promise<{ data: AdminService | null; error: string | null }> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      name: payload.name.trim(),
      price: payload.price,
      category: payload.category.trim() || "Прочее",
      is_visible: payload.is_visible ?? true,
    })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapServiceRow(data as Record<string, unknown>), error: null };
}

export async function deleteService(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function bulkDeleteServices(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from("services").delete().in("id", ids);
  return { error: error?.message ?? null };
}
