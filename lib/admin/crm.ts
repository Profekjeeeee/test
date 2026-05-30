import { supabase } from "@/lib/supabaseClient";
import type {
  CampaignDeliveryRow,
  CrmPatientRow,
  CrmSegmentStat,
  MarketingCampaignRow,
  PatientSegmentKey,
} from "@/lib/admin/types";

export const SEGMENT_LABELS: Record<PatientSegmentKey, string> = {
  new: "Новые",
  active: "Активные",
  at_risk: "Риск ухода",
  dormant: "Спящие",
  high_value: "VIP",
  debtor: "Должники",
};

const SEGMENT_ORDER: PatientSegmentKey[] = [
  "new",
  "active",
  "at_risk",
  "dormant",
  "high_value",
  "debtor",
];

interface MetricsDbRow {
  patient_id: string;
  total_visits: number;
  last_visit_date: string | null;
  days_since_visit: number | null;
  total_paid: number | string;
  overdue_debt: number | string;
  segment_key: string;
  has_telegram: boolean;
  dental_clients:
    | { name?: string | null; phone?: string | null; first_name?: string | null; last_name?: string | null }
    | Array<{
        name?: string | null;
        phone?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }>
    | null;
}

interface CampaignDbRow {
  id: string;
  name: string;
  segment_key: string | null;
  message_template: string;
  trigger_type: string;
  min_days_since_visit: number | null;
  max_sends_per_run: number;
  status: string;
  last_run_at: string | null;
  created_at: string;
}

function resolveClientName(
  rel: MetricsDbRow["dental_clients"],
): string {
  const c = Array.isArray(rel) ? rel[0] : rel;
  const both = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim();
  if (both) return both;
  if (c?.name?.trim()) return c.name.trim();
  if (c?.phone?.trim()) return c.phone.trim();
  return "Пациент";
}

function mapPatient(row: MetricsDbRow): CrmPatientRow {
  const rel = Array.isArray(row.dental_clients) ? row.dental_clients[0] : row.dental_clients;
  return {
    patientId: row.patient_id,
    name: resolveClientName(row.dental_clients),
    phone: rel?.phone?.trim() ?? "—",
    segment: row.segment_key as PatientSegmentKey,
    totalVisits: row.total_visits,
    daysSinceVisit: row.days_since_visit,
    totalPaid: Number(row.total_paid),
    overdueDebt: Number(row.overdue_debt),
    hasTelegram: row.has_telegram,
    lastVisitDate: row.last_visit_date ?? undefined,
  };
}

function mapCampaign(row: CampaignDbRow): MarketingCampaignRow {
  return {
    id: row.id,
    name: row.name,
    segmentKey: (row.segment_key as PatientSegmentKey | null) ?? null,
    messageTemplate: row.message_template,
    triggerType: row.trigger_type as "manual" | "reactivation_auto",
    minDaysSinceVisit: row.min_days_since_visit,
    maxSendsPerRun: row.max_sends_per_run,
    status: row.status as MarketingCampaignRow["status"],
    lastRunAt: row.last_run_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function refreshCrmMetrics(): Promise<{ count: number; error?: string }> {
  const { data, error } = await supabase.rpc("refresh_patient_metrics");
  if (error) return { count: 0, error: error.message };
  return { count: typeof data === "number" ? data : Number(data ?? 0) };
}

export async function fetchCrmSegmentStats(): Promise<{
  segments: CrmSegmentStat[];
  totalPatients: number;
  withTelegram: number;
  error?: string;
}> {
  const { data, error } = await supabase.from("patient_metrics").select("segment_key, has_telegram");
  if (error) {
    return { segments: [], totalPatients: 0, withTelegram: 0, error: error.message };
  }

  const counts = new Map<PatientSegmentKey, number>();
  let withTelegram = 0;
  for (const key of SEGMENT_ORDER) counts.set(key, 0);

  for (const row of data ?? []) {
    const seg = String((row as { segment_key: string }).segment_key) as PatientSegmentKey;
    if (counts.has(seg)) counts.set(seg, (counts.get(seg) ?? 0) + 1);
    if ((row as { has_telegram: boolean }).has_telegram) withTelegram += 1;
  }

  const segments: CrmSegmentStat[] = SEGMENT_ORDER.map((segment) => ({
    segment,
    label: SEGMENT_LABELS[segment],
    count: counts.get(segment) ?? 0,
  }));

  return {
    segments,
    totalPatients: data?.length ?? 0,
    withTelegram,
  };
}

export async function fetchCrmPatients(segment?: PatientSegmentKey): Promise<{
  data: CrmPatientRow[];
  error?: string;
}> {
  let q = supabase
    .from("patient_metrics")
    .select(
      "patient_id, total_visits, last_visit_date, days_since_visit, total_paid, overdue_debt, segment_key, has_telegram, dental_clients(name, phone, first_name, last_name)",
    )
    .order("days_since_visit", { ascending: false, nullsFirst: true })
    .limit(80);

  if (segment) q = q.eq("segment_key", segment);

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data as MetricsDbRow[]).map(mapPatient) };
}

export async function fetchMarketingCampaigns(): Promise<{
  data: MarketingCampaignRow[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as CampaignDbRow[]).map(mapCampaign) };
}

export async function updateCampaignStatus(
  id: string,
  status: MarketingCampaignRow["status"],
): Promise<{ error?: string }> {
  const { error } = await supabase.from("marketing_campaigns").update({ status }).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function createMarketingCampaign(payload: {
  name: string;
  segmentKey: PatientSegmentKey | null;
  messageTemplate: string;
  triggerType: "manual" | "reactivation_auto";
  minDaysSinceVisit?: number;
}): Promise<{ data?: MarketingCampaignRow; error?: string }> {
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      name: payload.name.trim(),
      segment_key: payload.segmentKey,
      message_template: payload.messageTemplate.trim(),
      trigger_type: payload.triggerType,
      min_days_since_visit: payload.minDaysSinceVisit ?? null,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { data: mapCampaign(data as CampaignDbRow) };
}

export async function fetchCampaignDeliveries(campaignId: string): Promise<{
  data: CampaignDeliveryRow[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("campaign_deliveries")
    .select(
      "id, campaign_id, status, sent_at, error_message, dental_clients(name, phone, first_name, last_name)",
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => {
      const r = row as {
        id: string;
        campaign_id: string;
        status: string;
        sent_at: string | null;
        error_message: string | null;
        dental_clients: MetricsDbRow["dental_clients"];
      };
      return {
        id: r.id,
        campaignId: r.campaign_id,
        patientName: resolveClientName(r.dental_clients),
        status: r.status,
        sentAt: r.sent_at ?? undefined,
        errorMessage: r.error_message ?? undefined,
      };
    }),
  };
}

export async function runCampaignFromAdmin(campaignId: string): Promise<{
  sent?: number;
  failed?: number;
  skipped?: number;
  error?: string;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: "Нет сессии администратора" };

  const res = await fetch("/api/crm/campaigns/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ campaignId }),
  });

  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    sent?: number;
    failed?: number;
    skipped?: number;
    error?: string;
  } | null;

  if (!res.ok) return { error: json?.error ?? `HTTP ${res.status}` };
  return {
    sent: json?.sent,
    failed: json?.failed,
    skipped: json?.skipped,
  };
}
