import "server-only";

import {
  loadClient,
  loadEmployee,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";

export async function refreshDentalCaches(ctx: DentalServiceContext) {
  const { adm, gate, actor } = ctx;

  if (!actor?.id?.trim()) {
    const { data, error } = await adm.from("dental_employees").select("*").order("name", { ascending: true });
    if (error) throw error;
    return { dental_clients: [] as unknown[], dental_employees: data ?? [] };
  }

  if (actor.role === "doctor" || actor.role === "admin") {
    await loadEmployee(adm, actor, gate);
    const [clientsRes, empRes] = await Promise.all([
      adm.from("dental_clients").select("*").order("created_at", { ascending: true }),
      adm.from("dental_employees").select("*").order("name", { ascending: true }),
    ]);
    if (clientsRes.error) throw clientsRes.error;
    if (empRes.error) throw empRes.error;
    return { dental_clients: clientsRes.data ?? [], dental_employees: empRes.data ?? [] };
  }

  if (actor.role === "client") {
    await loadClient(adm, actor, gate);
    const { data: me, error } = await adm.from("dental_clients").select("*").eq("id", actor.id).maybeSingle();
    if (error) throw error;
    const { data: empRows, error: ee } = await adm
      .from("dental_employees")
      .select("*")
      .order("name", { ascending: true });
    if (ee) throw ee;

    const clientsArr = me ? [me as Record<string, unknown>] : [];
    return { dental_clients: clientsArr, dental_employees: empRows ?? [] };
  }

  return { dental_clients: [], dental_employees: [] };
}
