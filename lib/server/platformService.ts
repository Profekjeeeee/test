import "server-only";

import type {
  ClinicSubscription,
  CreateClinicInput,
  OnboardingStatus,
  PlatformClinicRow,
  PlatformMonitoringRow,
  PlatformStats,
  SubscriptionPlan,
} from "@/lib/platform/types";
import { FALLBACK_PLANS, parsePlanLimits } from "@/lib/platform/plans";
import { ApiError } from "@/lib/server/api/apiError";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function mapPlan(row: Record<string, unknown>): SubscriptionPlan {
  const features = Array.isArray(row.features)
    ? row.features.filter((f): f is string => typeof f === "string")
    : [];
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ""),
    priceMonthly: Number(row.price_monthly ?? 0),
    currency: String(row.currency ?? "RUB"),
    limits: parsePlanLimits(row.limits),
    features,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapSubscription(
  sub: Record<string, unknown> | null,
  plan: Record<string, unknown> | null,
): ClinicSubscription | null {
  if (!sub || !plan) return null;
  return {
    planId: String(sub.plan_id ?? plan.id),
    planCode: String(plan.code),
    planName: String(plan.name),
    status: sub.status as ClinicSubscription["status"],
    trialEndsAt: sub.trial_ends_at ? String(sub.trial_ends_at) : null,
    currentPeriodEnd: sub.current_period_end ? String(sub.current_period_end) : null,
    priceMonthly: Number(plan.price_monthly ?? 0),
    limits: parsePlanLimits(plan.limits),
  };
}

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const adm = getSupabaseServiceRole();
  const { data, error } = await adm
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return FALLBACK_PLANS;
  if (!data?.length) return FALLBACK_PLANS;
  return data.map((r) => mapPlan(r as Record<string, unknown>));
}

async function clinicStats(clinicId: string) {
  const adm = getSupabaseServiceRole();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [patients, doctors, appointments] = await Promise.all([
    adm.from("dental_clients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    adm.from("dental_employees").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("role", "doctor"),
    adm
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart.toISOString()),
  ]);

  return {
    patients: patients.count ?? 0,
    doctors: doctors.count ?? 0,
    appointmentsMonth: appointments.count ?? 0,
  };
}

export async function listPlatformClinics(): Promise<PlatformClinicRow[]> {
  const adm = getSupabaseServiceRole();
  const { data: clinics, error } = await adm
    .from("clinics")
    .select(`
      id, slug, name, is_active, onboarding_status, onboarded_at, created_at,
      clinic_settings(display_name),
      clinic_subscriptions(status, plan_id, trial_ends_at, current_period_end, subscription_plans(code, name, price_monthly, limits))
    `)
    .order("created_at", { ascending: false });

  if (error) throw new ApiError(500, error.message);
  if (!clinics?.length) return [];

  const rows: PlatformClinicRow[] = [];
  for (const c of clinics) {
    const cr = c as Record<string, unknown>;
    const settings = cr.clinic_settings as { display_name?: string } | null;
    const subRaw = cr.clinic_subscriptions as Record<string, unknown> | null;
    const planRaw = subRaw?.subscription_plans as Record<string, unknown> | null;
    const stats = await clinicStats(String(cr.id));

    rows.push({
      id: String(cr.id),
      slug: String(cr.slug),
      name: String(cr.name),
      isActive: Boolean(cr.is_active),
      onboardingStatus: String(cr.onboarding_status ?? "completed") as OnboardingStatus,
      onboardedAt: cr.onboarded_at ? String(cr.onboarded_at) : null,
      createdAt: String(cr.created_at),
      displayName: settings?.display_name ?? String(cr.name),
      subscription: mapSubscription(subRaw, planRaw),
      stats,
    });
  }
  return rows;
}

export async function getPlatformClinic(clinicId: string): Promise<PlatformClinicRow | null> {
  const rows = await listPlatformClinics();
  return rows.find((r) => r.id === clinicId) ?? null;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const adm = getSupabaseServiceRole();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const clinics = await listPlatformClinics();
  const activeClinics = clinics.filter((c) => c.isActive);
  const trialClinics = clinics.filter((c) => c.subscription?.status === "trial");

  let mrrRub = 0;
  const planCounts = new Map<string, { code: string; name: string; count: number }>();
  for (const c of activeClinics) {
    const sub = c.subscription;
    if (!sub || !["active", "trial"].includes(sub.status)) continue;
    if (sub.status === "active") mrrRub += sub.priceMonthly;
    const key = sub.planCode;
    const prev = planCounts.get(key);
    if (prev) prev.count += 1;
    else planCounts.set(key, { code: sub.planCode, name: sub.planName, count: 1 });
  }

  const [appts, errors] = await Promise.all([
    adm.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    adm.from("app_logs").select("id", { count: "exact", head: true }).eq("level", "ERROR").gte("created_at", since24h),
  ]);

  return {
    totalClinics: clinics.length,
    activeClinics: activeClinics.length,
    trialClinics: trialClinics.length,
    mrrRub,
    appointments24h: appts.count ?? 0,
    errors24h: errors.count ?? 0,
    planBreakdown: [...planCounts.values()],
  };
}

export async function getPlatformMonitoring(): Promise<PlatformMonitoringRow[]> {
  const adm = getSupabaseServiceRole();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const clinics = await listPlatformClinics();

  const rows: PlatformMonitoringRow[] = [];
  for (const c of clinics) {
    const [errors, warnings, lastErr] = await Promise.all([
      adm
        .from("app_logs")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", c.id)
        .eq("level", "ERROR")
        .gte("created_at", since24h),
      adm
        .from("app_logs")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", c.id)
        .eq("level", "WARN")
        .gte("created_at", since24h),
      adm
        .from("app_logs")
        .select("created_at")
        .eq("clinic_id", c.id)
        .eq("level", "ERROR")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    rows.push({
      clinicId: c.id,
      slug: c.slug,
      displayName: c.displayName,
      isActive: c.isActive,
      planCode: c.subscription?.planCode ?? "—",
      errors24h: errors.count ?? 0,
      warnings24h: warnings.count ?? 0,
      lastErrorAt: lastErr.data?.created_at ? String(lastErr.data.created_at) : null,
    });
  }
  return rows;
}

export async function createPlatformClinic(input: CreateClinicInput): Promise<PlatformClinicRow> {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new ApiError(400, "Slug: только a-z, 0-9 и дефис (3–64 символа).");
  }
  if (slug === "default") {
    throw new ApiError(400, "Slug «default» зарезервирован.");
  }

  const plans = await listSubscriptionPlans();
  const plan = plans.find((p) => p.code === input.planCode);
  if (!plan) throw new ApiError(400, "Неизвестный тарифный план.");

  const adm = getSupabaseServiceRole();

  const { data: existing } = await adm.from("clinics").select("id").eq("slug", slug).maybeSingle();
  if (existing) throw new ApiError(409, "Клиника с таким slug уже существует.");

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);

  const { data: clinic, error: cErr } = await adm
    .from("clinics")
    .insert({
      slug,
      name: input.name.trim(),
      is_active: true,
      onboarding_status: "completed",
      onboarded_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (cErr || !clinic) throw new ApiError(500, cErr?.message ?? "Не удалось создать клинику.");

  const clinicId = clinic.id as string;

  const { error: sErr } = await adm.from("clinic_settings").insert({
    clinic_id: clinicId,
    display_name: input.displayName.trim() || input.name.trim(),
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    city: input.city?.trim() ?? "",
    primary_color: input.primaryColor?.trim() || "#248bcf",
    accent_color: "#1D4ED8",
  });
  if (sErr) throw new ApiError(500, sErr.message);

  const { error: subErr } = await adm.from("clinic_subscriptions").insert({
    clinic_id: clinicId,
    plan_id: plan.id,
    status: "trial",
    trial_ends_at: trialEnds.toISOString(),
    current_period_end: trialEnds.toISOString(),
  });
  if (subErr) throw new ApiError(500, subErr.message);

  const adminPhone = input.adminPhone.trim();
  if (adminPhone) {
    await adm.from("dental_employees").insert({
      clinic_id: clinicId,
      phone: adminPhone,
      name: input.adminName.trim() || "Администратор",
      role: "admin",
    });
  }

  const row = await getPlatformClinic(clinicId);
  if (!row) throw new ApiError(500, "Клиника создана, но не найдена.");
  return row;
}

export async function updatePlatformClinic(
  clinicId: string,
  patch: {
    isActive?: boolean;
    planCode?: string;
    subscriptionStatus?: ClinicSubscription["status"];
    onboardingStatus?: OnboardingStatus;
  },
): Promise<PlatformClinicRow> {
  const adm = getSupabaseServiceRole();

  const clinicPatch: Record<string, unknown> = {};
  if (patch.isActive !== undefined) clinicPatch.is_active = patch.isActive;
  if (patch.onboardingStatus) clinicPatch.onboarding_status = patch.onboardingStatus;

  if (Object.keys(clinicPatch).length) {
    const { error } = await adm.from("clinics").update(clinicPatch).eq("id", clinicId);
    if (error) throw new ApiError(500, error.message);
  }

  if (patch.planCode || patch.subscriptionStatus) {
    const subPatch: Record<string, unknown> = {};
    if (patch.subscriptionStatus) subPatch.status = patch.subscriptionStatus;
    if (patch.planCode) {
      const plans = await listSubscriptionPlans();
      const plan = plans.find((p) => p.code === patch.planCode);
      if (!plan) throw new ApiError(400, "Неизвестный тариф.");
      subPatch.plan_id = plan.id;
    }
    subPatch.updated_at = new Date().toISOString();
    const { error } = await adm.from("clinic_subscriptions").update(subPatch).eq("clinic_id", clinicId);
    if (error) throw new ApiError(500, error.message);
  }

  const row = await getPlatformClinic(clinicId);
  if (!row) throw new ApiError(404, "Клиника не найдена.");
  return row;
}
