import { supabase } from "@/lib/supabaseClient";
import { SEGMENT_LABELS, fetchCrmSegmentStats } from "@/lib/admin/crm";
import type {
  AnalyticsOverview,
  CrmPatientRow,
  CrmSegmentStat,
  DoctorKpiRow,
  PatientAnalyticsSummary,
  PatientSegmentKey,
} from "@/lib/admin/types";

interface DoctorMetricsDbRow {
  doctor_key: string;
  doctor_id: string | null;
  doctor_name: string;
  specialization: string;
  appointments_month: number;
  appointments_total: number;
  completed_month: number;
  cancelled_month: number;
  unique_patients_month: number;
  revenue_month: number | string;
  revenue_total: number | string;
  completion_rate: number | string;
}

function mapDoctorKpi(row: DoctorMetricsDbRow): DoctorKpiRow {
  return {
    doctorKey: row.doctor_key,
    doctorId: row.doctor_id ?? undefined,
    doctorName: row.doctor_name,
    specialization: row.specialization,
    appointmentsMonth: row.appointments_month,
    appointmentsTotal: row.appointments_total,
    completedMonth: row.completed_month,
    cancelledMonth: row.cancelled_month,
    uniquePatientsMonth: row.unique_patients_month,
    revenueMonth: Number(row.revenue_month),
    revenueTotal: Number(row.revenue_total),
    completionRate: Number(row.completion_rate),
  };
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const end = new Date(y, m + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(end.getDate())}`,
  };
}

export async function refreshDoctorMetrics(): Promise<{ count: number; error?: string }> {
  const { data, error } = await supabase.rpc("refresh_doctor_metrics");
  if (error) return { count: 0, error: error.message };
  return { count: typeof data === "number" ? data : Number(data ?? 0) };
}

export async function refreshAllAnalytics(): Promise<{
  doctorCount: number;
  patientCount: number;
  error?: string;
}> {
  const [docRes, patRes] = await Promise.all([
    supabase.rpc("refresh_doctor_metrics"),
    supabase.rpc("refresh_patient_metrics"),
  ]);
  const error = docRes.error?.message ?? patRes.error?.message;
  return {
    doctorCount: typeof docRes.data === "number" ? docRes.data : Number(docRes.data ?? 0),
    patientCount: typeof patRes.data === "number" ? patRes.data : Number(patRes.data ?? 0),
    error,
  };
}

export async function fetchDoctorKpiList(): Promise<{ data: DoctorKpiRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("doctor_metrics")
    .select("*")
    .order("revenue_month", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as DoctorMetricsDbRow[]).map(mapDoctorKpi) };
}

export async function fetchPatientAnalyticsSummary(): Promise<{
  summary: PatientAnalyticsSummary;
  segments: CrmSegmentStat[];
  error?: string;
}> {
  const { start } = monthBounds();
  const [segRes, metricsRes, newRes] = await Promise.all([
    fetchCrmSegmentStats(),
    supabase.from("patient_metrics").select("total_visits, total_paid, has_telegram"),
    supabase
      .from("dental_clients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${start}T00:00:00`),
  ]);

  const rows = metricsRes.data ?? [];
  let totalVisits = 0;
  let totalPaid = 0;
  let withTelegram = 0;
  for (const row of rows) {
    totalVisits += Number((row as { total_visits: number }).total_visits);
    totalPaid += Number((row as { total_paid: number | string }).total_paid);
    if ((row as { has_telegram: boolean }).has_telegram) withTelegram += 1;
  }

  const totalPatients = segRes.totalPatients;
  const segments = segRes.segments;
  const atRiskCount = segments.find((s) => s.segment === "at_risk")?.count ?? 0;
  const dormantCount = segments.find((s) => s.segment === "dormant")?.count ?? 0;
  const highValueCount = segments.find((s) => s.segment === "high_value")?.count ?? 0;

  return {
    summary: {
      totalPatients,
      newPatientsMonth: newRes.count ?? 0,
      avgVisits: totalPatients > 0 ? Math.round((totalVisits / totalPatients) * 10) / 10 : 0,
      avgLtv: totalPatients > 0 ? Math.round(totalPaid / totalPatients) : 0,
      atRiskCount,
      dormantCount,
      highValueCount,
      withTelegram,
    },
    segments,
    error: segRes.error ?? metricsRes.error?.message ?? newRes.error?.message,
  };
}

export async function fetchTopPatientsByLtv(limit = 20): Promise<{
  data: CrmPatientRow[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from("patient_metrics")
    .select(
      "patient_id, total_visits, last_visit_date, days_since_visit, total_paid, overdue_debt, segment_key, has_telegram, dental_clients(name, phone, first_name, last_name)",
    )
    .order("total_paid", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((row) => {
      const r = row as {
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
      };
      const rel = Array.isArray(r.dental_clients) ? r.dental_clients[0] : r.dental_clients;
      const both = `${rel?.first_name ?? ""} ${rel?.last_name ?? ""}`.trim();
      const name = both || rel?.name?.trim() || rel?.phone?.trim() || "Пациент";
      return {
        patientId: r.patient_id,
        name,
        phone: rel?.phone?.trim() ?? "—",
        segment: r.segment_key as PatientSegmentKey,
        totalVisits: r.total_visits,
        daysSinceVisit: r.days_since_visit,
        totalPaid: Number(r.total_paid),
        overdueDebt: Number(r.overdue_debt),
        hasTelegram: r.has_telegram,
        lastVisitDate: r.last_visit_date ?? undefined,
      };
    }),
  };
}

export async function fetchAnalyticsOverview(): Promise<{
  overview: AnalyticsOverview;
  error?: string;
}> {
  const { start, end } = monthBounds();
  const [docRes, patRes, payRes] = await Promise.all([
    fetchDoctorKpiList(),
    fetchPatientAnalyticsSummary(),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "succeeded")
      .gte("completed_at", `${start}T00:00:00`)
      .lte("completed_at", `${end}T23:59:59`),
  ]);

  const doctors = docRes.data;
  const top = doctors[0];
  let revenueMonth = 0;
  for (const p of payRes.data ?? []) {
    revenueMonth += Number((p as { amount: number | string }).amount);
  }

  let avgCompletionRate = 0;
  if (doctors.length > 0) {
    const sum = doctors.reduce((acc, d) => acc + d.completionRate, 0);
    avgCompletionRate = Math.round((sum / doctors.length) * 10) / 10;
  }

  return {
    overview: {
      totalPatients: patRes.summary.totalPatients,
      newPatientsMonth: patRes.summary.newPatientsMonth,
      avgCompletionRate,
      topDoctorName: top?.doctorName ?? "—",
      topDoctorRevenueMonth: top?.revenueMonth ?? 0,
      atRiskCount: patRes.summary.atRiskCount,
      revenueMonth,
    },
    error: docRes.error ?? patRes.error ?? payRes.error?.message,
  };
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportAnalyticsCsv(
  doctors: DoctorKpiRow[],
  patients: CrmPatientRow[],
  segments: CrmSegmentStat[],
): string {
  const lines: string[] = [
    "=== KPI врачей ===",
    "Врач,Специализация,Записей (мес),Завершено (мес),Отменено (мес),Пациентов (мес),Выручка (мес),Выручка (всего),% завершения",
    ...doctors.map((d) =>
      [
        csvEscape(d.doctorName),
        csvEscape(d.specialization),
        d.appointmentsMonth,
        d.completedMonth,
        d.cancelledMonth,
        d.uniquePatientsMonth,
        d.revenueMonth,
        d.revenueTotal,
        d.completionRate,
      ].join(","),
    ),
    "",
    "=== Сегменты пациентов ===",
    "Сегмент,Кол-во",
    ...segments.map((s) => `${csvEscape(s.label)},${s.count}`),
    "",
    "=== Топ пациентов по LTV ===",
    "Пациент,Сегмент,Визитов,LTV,Долг,Дней без визита",
    ...patients.map((p) =>
      [
        csvEscape(p.name),
        csvEscape(SEGMENT_LABELS[p.segment]),
        p.totalVisits,
        p.totalPaid,
        p.overdueDebt,
        p.daysSinceVisit ?? "",
      ].join(","),
    ),
  ];
  return lines.join("\n");
}

export { SEGMENT_LABELS };
