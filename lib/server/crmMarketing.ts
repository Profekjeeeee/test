import "server-only";

import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import {
  escapeHtmlTg,
  formatDateRuFromIso,
} from "@/lib/server/appointmentTelegram";
import {
  reactivationKeyboard,
  sendTelegramMessage,
} from "@/lib/server/telegramBot";

const REACTIVATION_COOLDOWN_DAYS = 30;

export type PatientSegmentKey =
  | "new"
  | "active"
  | "at_risk"
  | "dormant"
  | "high_value"
  | "debtor";

export const SEGMENT_LABELS: Record<PatientSegmentKey, string> = {
  new: "Новые",
  active: "Активные",
  at_risk: "Риск ухода",
  dormant: "Спящие",
  high_value: "VIP",
  debtor: "Должники",
};

interface CampaignRow {
  id: string;
  name: string;
  segment_key: string | null;
  message_template: string;
  trigger_type: string;
  min_days_since_visit: number | null;
  max_sends_per_run: number;
  status: string;
}

interface MetricPatientRow {
  patient_id: string;
  days_since_visit: number | null;
  segment_key: string;
  has_telegram: boolean;
  last_reactivation_at: string | null;
}

interface ClientRow {
  id: string;
  telegram_id: number | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
}

function clientDisplayName(c: ClientRow): string {
  const both = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  if (both) return both;
  if (c.name?.trim()) return c.name.trim();
  return "Пациент";
}

export function renderCampaignMessage(template: string, params: {
  name: string;
  days?: number | null;
  lastVisit?: string | null;
}): string {
  let text = template;
  text = text.replace(/\{\{name\}\}/g, escapeHtmlTg(params.name));
  const daysStr =
    params.days != null && params.days >= 0 ? String(params.days) : "давно";
  text = text.replace(/\{\{days\}\}/g, daysStr);
  if (params.lastVisit) {
    text = text.replace(/\{\{last_visit\}\}/g, formatDateRuFromIso(params.lastVisit));
  } else {
    text = text.replace(/\{\{last_visit\}\}/g, "—");
  }
  return text;
}

export async function refreshPatientMetrics(): Promise<number> {
  const adm = getSupabaseServiceRole();
  const { data, error } = await adm.rpc("refresh_patient_metrics");
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : Number(data ?? 0);
}

async function loadCampaign(campaignId: string): Promise<CampaignRow> {
  const adm = getSupabaseServiceRole();
  const { data, error } = await adm
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Кампания не найдена");
  return data as CampaignRow;
}

async function alreadySentPatientIds(campaignId: string): Promise<Set<string>> {
  const adm = getSupabaseServiceRole();
  const { data, error } = await adm
    .from("campaign_deliveries")
    .select("patient_id")
    .eq("campaign_id", campaignId)
    .in("status", ["sent", "skipped"]);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => String((r as { patient_id: string }).patient_id)));
}

function withinReactivationCooldown(lastAt: string | null, now = new Date()): boolean {
  if (!lastAt) return false;
  const ms = now.getTime() - new Date(lastAt).getTime();
  return ms < REACTIVATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

export async function runMarketingCampaign(campaignId: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const campaign = await loadCampaign(campaignId);
  if (campaign.status !== "active" && campaign.status !== "draft") {
    throw new Error("Кампания не активна");
  }

  const adm = getSupabaseServiceRole();
  const sentBefore = await alreadySentPatientIds(campaignId);

  let query = adm
    .from("patient_metrics")
    .select("patient_id, days_since_visit, segment_key, has_telegram, last_reactivation_at")
    .eq("has_telegram", true)
    .limit(campaign.max_sends_per_run);

  if (campaign.segment_key) {
    query = query.eq("segment_key", campaign.segment_key);
  }

  const { data: metrics, error: mErr } = await query;
  if (mErr) throw new Error(mErr.message);

  const rows = (metrics ?? []) as MetricPatientRow[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const m of rows) {
    const pid = String(m.patient_id);
    if (sentBefore.has(pid)) {
      skipped += 1;
      continue;
    }
    if (withinReactivationCooldown(m.last_reactivation_at)) {
      skipped += 1;
      await adm.from("campaign_deliveries").upsert(
        {
          campaign_id: campaignId,
          patient_id: pid,
          status: "skipped",
          error_message: "cooldown",
        },
        { onConflict: "campaign_id,patient_id" },
      );
      continue;
    }
    if (
      campaign.min_days_since_visit != null &&
      (m.days_since_visit == null || m.days_since_visit < campaign.min_days_since_visit)
    ) {
      skipped += 1;
      continue;
    }

    const { data: client, error: cErr } = await adm
      .from("dental_clients")
      .select("id, telegram_id, first_name, last_name, name")
      .eq("id", pid)
      .maybeSingle();
    if (cErr || !client?.telegram_id) {
      skipped += 1;
      continue;
    }

    const c = client as ClientRow;
    const text = renderCampaignMessage(campaign.message_template, {
      name: clientDisplayName(c),
      days: m.days_since_visit,
    });

    try {
      const { messageId } = await sendTelegramMessage({
        chatId: c.telegram_id!,
        text,
        replyMarkup: reactivationKeyboard(),
      });

      await adm.from("campaign_deliveries").upsert(
        {
          campaign_id: campaignId,
          patient_id: pid,
          status: "sent",
          telegram_message_id: messageId,
          sent_at: new Date().toISOString(),
          error_message: null,
        },
        { onConflict: "campaign_id,patient_id" },
      );

      await adm
        .from("patient_metrics")
        .update({ last_reactivation_at: new Date().toISOString() })
        .eq("patient_id", pid);

      sent += 1;
      sentBefore.add(pid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send failed";
      failed += 1;
      await adm.from("campaign_deliveries").upsert(
        {
          campaign_id: campaignId,
          patient_id: pid,
          status: "failed",
          error_message: msg.slice(0, 500),
        },
        { onConflict: "campaign_id,patient_id" },
      );
    }
  }

  await adm
    .from("marketing_campaigns")
    .update({
      last_run_at: new Date().toISOString(),
      status: campaign.trigger_type === "manual" ? campaign.status : "active",
    })
    .eq("id", campaignId);

  return { sent, failed, skipped };
}

export async function processCrmCron(): Promise<{
  metricsRefreshed: number;
  campaigns: Array<{ campaignId: string; name: string; sent: number; failed: number; skipped: number }>;
}> {
  const metricsRefreshed = await refreshPatientMetrics();

  const adm = getSupabaseServiceRole();
  const { data: campaigns, error } = await adm
    .from("marketing_campaigns")
    .select("id, name")
    .eq("status", "active")
    .eq("trigger_type", "reactivation_auto");

  if (error) throw new Error(error.message);

  const results: Array<{
    campaignId: string;
    name: string;
    sent: number;
    failed: number;
    skipped: number;
  }> = [];

  for (const c of campaigns ?? []) {
    const row = c as { id: string; name: string };
    try {
      const r = await runMarketingCampaign(row.id);
      results.push({ campaignId: row.id, name: row.name, ...r });
    } catch (e) {
      console.error("[crm-campaigns]", row.id, e);
    }
  }

  return { metricsRefreshed, campaigns: results };
}
