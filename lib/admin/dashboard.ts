import { supabase } from "@/lib/supabaseClient";
import type {
  DashboardAppointmentRow,
  DashboardChartPoint,
  DashboardStats,
} from "@/lib/admin/types";

interface AppointmentServiceRow {
  name: string | null;
  price: number | string | null;
}

interface AppointmentDbRow {
  id: string | number;
  created_at: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  doctor_name: string | null;
  patient_name: string | null;
  service_id: string | null;
  services: AppointmentServiceRow | AppointmentServiceRow[] | null;
}

function monthBounds(): { start: string; end: string; today: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${y}-${pad(m + 1)}-${pad(now.getDate())}`;
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(end.getDate())}`,
    today,
  };
}

function parsePrice(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isRevenueStatus(status: string): boolean {
  return status === "completed" || status === "done";
}

function isUnprocessedStatus(status: string): boolean {
  return status === "pending" || status === "scheduled" || status === "rescheduled";
}

function resolveService(row: AppointmentDbRow): AppointmentServiceRow | null {
  const s = row.services;
  if (!s) return null;
  return Array.isArray(s) ? (s[0] ?? null) : s;
}

function displayPatient(row: AppointmentDbRow): string {
  if (row.patient_name?.trim()) return row.patient_name.trim();
  return "Пациент";
}

function scheduleUiStatus(status: string, dateIso: string, time: string): string {
  const { today } = monthBounds();
  if (status === "completed" || status === "done") return "done";
  if (dateIso === today) {
    const now = new Date();
    const [hh, mm] = time.split(":").map((x) => parseInt(x, 10));
    const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 0, mm || 0);
    const diff = slot.getTime() - now.getTime();
    if (diff >= -30 * 60 * 1000 && diff <= 60 * 60 * 1000) return "current";
  }
  return "upcoming";
}

export async function fetchDashboardStats(): Promise<{
  stats: DashboardStats;
  chart: DashboardChartPoint[];
  today: DashboardAppointmentRow[];
  error: string | null;
}> {
  const { start, end, today } = monthBounds();

  const [apptRes, doctorsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, created_at, appointment_date, appointment_time, status, doctor_name, patient_name, service_id, services(name, price)"
      )
      .gte("appointment_date", start)
      .lte("appointment_date", end)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true }),
    supabase.from("doctors").select("id, is_active"),
  ]);

  if (apptRes.error) {
    return {
      stats: {
        revenueMonth: 0,
        newAppointmentsMonth: 0,
        unprocessedCount: 0,
        appointmentsToday: 0,
        activeDoctors: 0,
        totalDoctors: 0,
      },
      chart: [],
      today: [],
      error: apptRes.error.message,
    };
  }

  const rows = (apptRes.data ?? []) as AppointmentDbRow[];
  const doctors = doctorsRes.data ?? [];

  const monthStartTs = new Date(start).getTime();

  let revenueMonth = 0;
  let newAppointmentsMonth = 0;
  let unprocessedCount = 0;
  let appointmentsToday = 0;

  const byDay = new Map<string, { revenue: number; appointments: number }>();

  for (const row of rows) {
    const price = parsePrice(resolveService(row)?.price);
    if (isRevenueStatus(row.status)) revenueMonth += price;
    if (isUnprocessedStatus(row.status)) unprocessedCount += 1;
    if (row.appointment_date === today) appointmentsToday += 1;

    const createdTs = new Date(row.created_at).getTime();
    if (createdTs >= monthStartTs) newAppointmentsMonth += 1;

    const dayKey = row.appointment_date;
    const bucket = byDay.get(dayKey) ?? { revenue: 0, appointments: 0 };
    bucket.appointments += 1;
    if (isRevenueStatus(row.status)) bucket.revenue += price;
    byDay.set(dayKey, bucket);
  }

  const chart: DashboardChartPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => {
      const d = parseInt(day.split("-")[2] ?? "0", 10);
      return {
        day,
        label: String(d),
        revenue: v.revenue,
        appointments: v.appointments,
      };
    });

  const todayRows: DashboardAppointmentRow[] = rows
    .filter((r) => r.appointment_date === today)
    .map((r) => {
      const service = resolveService(r);
      return {
        id: String(r.id),
        time: r.appointment_time,
        patient: displayPatient(r),
        doctor: r.doctor_name?.trim() || "Врач",
        procedure: service?.name?.trim() || "Приём",
        status: scheduleUiStatus(r.status, r.appointment_date, r.appointment_time),
      };
    });

  const activeDoctors = doctors.filter((d) => d.is_active === true).length;
  const totalDoctors = doctors.length;

  return {
    stats: {
      revenueMonth,
      newAppointmentsMonth,
      unprocessedCount,
      appointmentsToday,
      activeDoctors,
      totalDoctors,
    },
    chart,
    today: todayRows,
    error: doctorsRes.error?.message ?? null,
  };
}

export type DashboardStatsResult = Awaited<ReturnType<typeof fetchDashboardStats>>;

const DASHBOARD_CACHE_TTL_MS = 60_000;
let dashboardCache: DashboardStatsResult | null = null;
let dashboardCacheAt = 0;

/** In-memory TTL cache — повторный mount дашборда в течение 1 мин не бьёт в Supabase. */
export async function getDashboardStats(): Promise<DashboardStatsResult> {
  const now = Date.now();
  if (dashboardCache && now - dashboardCacheAt < DASHBOARD_CACHE_TTL_MS) {
    return dashboardCache;
  }

  const res = await fetchDashboardStats();
  if (!res.error) {
    dashboardCache = res;
    dashboardCacheAt = now;
  }
  return res;
}

export function invalidateDashboardCache(): void {
  dashboardCache = null;
  dashboardCacheAt = 0;
}
