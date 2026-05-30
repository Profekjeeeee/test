import "server-only";

import { ApiError } from "@/lib/server/api/apiError";
import { parsePlanLimits } from "@/lib/platform/plans";
import type { PlanLimits } from "@/lib/platform/types";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import { resolveClinicSlug } from "@/lib/server/clinicService";

export async function loadClinicPlanLimits(clinicId?: string): Promise<PlanLimits> {
  const adm = getSupabaseServiceRole();

  let cid = clinicId;
  if (!cid) {
    const slug = resolveClinicSlug();
    const { data: clinic } = await adm
      .from("clinics")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    cid = clinic?.id;
  }
  if (!cid) return {};

  const { data, error } = await adm
    .from("clinic_subscriptions")
    .select("status, subscription_plans(limits)")
    .eq("clinic_id", cid)
    .in("status", ["trial", "active"])
    .maybeSingle();

  if (error || !data) return {};

  const plan = data.subscription_plans as { limits?: unknown } | null;
  return parsePlanLimits(plan?.limits);
}

export async function assertClinicFeature(
  feature: keyof PlanLimits,
  clinicId?: string,
): Promise<void> {
  const limits = await loadClinicPlanLimits(clinicId);
  if (limits[feature] === false) {
    throw new ApiError(403, "Функция недоступна на текущем тарифном плане.", "PLAN_LIMIT");
  }
}

export async function assertAiEnabled(clinicId?: string): Promise<void> {
  await assertClinicFeature("ai_enabled", clinicId);
}

export async function assertVideoEnabled(clinicId?: string): Promise<void> {
  await assertClinicFeature("video_enabled", clinicId);
}
