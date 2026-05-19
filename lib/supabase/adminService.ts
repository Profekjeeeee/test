import { supabase } from "@/lib/supabaseClient";
import type { AdminDoctor, AdminService } from "@/lib/admin/types";

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

function mapServiceRow(row: Record<string, unknown>): AdminService {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    price: Number(row.price ?? 0),
    category: String(row.category ?? "Прочее"),
    is_visible: Boolean(row.is_visible),
  };
}

/** Список врачей, отсортированный по sort_order. */
export async function fetchDoctors(): Promise<{ data: AdminDoctor[]; error: string | null }> {
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((r) => mapDoctorRow(r as Record<string, unknown>)), error: null };
}

/** Переключение активности врача. */
export async function toggleDoctorActive(
  id: string,
  is_active: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("doctors").update({ is_active }).eq("id", id);
  return { error: error?.message ?? null };
}

/** Редактирование ФИО и специализации. */
export async function updateDoctorData(
  id: string,
  name: string,
  specialization: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("doctors")
    .update({
      name: name.trim(),
      specialization: specialization.trim(),
    })
    .eq("id", id);

  return { error: error?.message ?? null };
}

/** Прайс-лист услуг. */
export async function fetchServices(): Promise<{ data: AdminService[]; error: string | null }> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((r) => mapServiceRow(r as Record<string, unknown>)), error: null };
}

/** Обновление цены услуги. */
export async function updateServicePrice(
  id: string,
  new_price: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("services").update({ price: new_price }).eq("id", id);
  return { error: error?.message ?? null };
}

/** Скрыть несколько услуг (массовое действие в админке). */
export async function bulkHideServices(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase.from("services").update({ is_visible: false }).in("id", ids);
  return { error: error?.message ?? null };
}

export interface AdminCatalogMetrics {
  totalDoctors: number;
  activeServices: number;
}

/** Метрики каталога для дашборда: врачи и видимые услуги. */
export async function fetchAdminCatalogMetrics(): Promise<{
  metrics: AdminCatalogMetrics;
  error: string | null;
}> {
  const [doctorsRes, servicesRes] = await Promise.all([
    supabase.from("doctors").select("id", { count: "exact", head: true }),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_visible", true),
  ]);

  if (doctorsRes.error) {
    return {
      metrics: { totalDoctors: 0, activeServices: 0 },
      error: doctorsRes.error.message,
    };
  }
  if (servicesRes.error) {
    return {
      metrics: { totalDoctors: doctorsRes.count ?? 0, activeServices: 0 },
      error: servicesRes.error.message,
    };
  }

  return {
    metrics: {
      totalDoctors: doctorsRes.count ?? 0,
      activeServices: servicesRes.count ?? 0,
    },
    error: null,
  };
}
