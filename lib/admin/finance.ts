import { supabase } from "@/lib/supabaseClient";
import type {
  AdminBillRow,
  AdminPaymentRow,
  FinanceChartPoint,
  FinanceStats,
} from "@/lib/admin/types";

interface BillDbRow {
  id: string;
  patient_id: string;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  description: string;
  bill_number: string;
  due_date: string | null;
  created_at: string;
  dental_clients: { name?: string | null; phone?: string | null } | { name?: string | null; phone?: string | null }[] | null;
}

interface PaymentDbRow {
  id: string;
  bill_id: string;
  amount: number | string;
  method: string;
  status: string;
  provider: string;
  completed_at: string | null;
  created_at: string;
  bills: { bill_number?: string | null } | { bill_number?: string | null }[] | null;
  dental_clients: { name?: string | null; phone?: string | null } | { name?: string | null; phone?: string | null }[] | null;
}

function monthBounds(offsetMonths = 0): { start: string; end: string; startTs: number; endTs: number } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offsetMonths;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    startTs: start.getTime(),
    endTs: end.getTime(),
  };
}

function resolveClientName(
  rel: BillDbRow["dental_clients"] | PaymentDbRow["dental_clients"]
): string {
  const c = Array.isArray(rel) ? rel[0] : rel;
  if (c?.name?.trim()) return c.name.trim();
  if (c?.phone?.trim()) return c.phone.trim();
  return "Пациент";
}

function resolveBillNumber(rel: PaymentDbRow["bills"]): string {
  const b = Array.isArray(rel) ? rel[0] : rel;
  return b?.bill_number?.trim() || "—";
}

function mapBillRow(row: BillDbRow): AdminBillRow {
  return {
    id: row.id,
    number: row.bill_number || `№ ${row.id.slice(0, 8)}`,
    patientId: row.patient_id,
    patientName: resolveClientName(row.dental_clients),
    totalAmount: Number(row.amount),
    paidAmount: Number(row.paid_amount),
    status: row.status,
    issuedAt: row.created_at.split("T")[0],
    dueDate: row.due_date ?? undefined,
    description: row.description,
  };
}

function mapPaymentRow(row: PaymentDbRow): AdminPaymentRow {
  return {
    id: row.id,
    billId: row.bill_id,
    billNumber: resolveBillNumber(row.bills),
    patientName: resolveClientName(row.dental_clients),
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    provider: row.provider,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchFinanceStats(): Promise<{ stats: FinanceStats; error: string | null }> {
  const current = monthBounds(0);
  const prev = monthBounds(-1);

  const [paymentsRes, billsRes, prevPaymentsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, status, completed_at")
      .eq("status", "succeeded")
      .gte("completed_at", `${current.start}T00:00:00`)
      .lte("completed_at", `${current.end}T23:59:59`),
    supabase.from("bills").select("amount, paid_amount, status"),
    supabase
      .from("payments")
      .select("amount, status, completed_at")
      .eq("status", "succeeded")
      .gte("completed_at", `${prev.start}T00:00:00`)
      .lte("completed_at", `${prev.end}T23:59:59`),
  ]);

  if (paymentsRes.error) {
    return {
      stats: emptyFinanceStats(),
      error: paymentsRes.error.message,
    };
  }

  const payments = paymentsRes.data ?? [];
  const prevPayments = prevPaymentsRes.data ?? [];
  const bills = billsRes.data ?? [];

  let revenueMonth = 0;
  for (const p of payments) {
    revenueMonth += Number(p.amount);
  }

  let revenuePrevMonth = 0;
  for (const p of prevPayments) {
    revenuePrevMonth += Number(p.amount);
  }

  let pendingDebt = 0;
  let overdueDebt = 0;
  let billsPendingCount = 0;
  let billsPaidMonth = 0;

  for (const b of bills) {
    const total = Number(b.amount);
    const paid = Number(b.paid_amount);
    const remaining = total - paid;
    if (b.status === "pending" || b.status === "partial" || b.status === "overdue") {
      billsPendingCount += 1;
      pendingDebt += remaining;
      if (b.status === "overdue") overdueDebt += remaining;
    }
    if (b.status === "paid") billsPaidMonth += 1;
  }

  const avgPaymentAmount =
    payments.length > 0 ? Math.round(revenueMonth / payments.length) : 0;

  return {
    stats: {
      revenueMonth,
      revenuePrevMonth,
      pendingDebt,
      overdueDebt,
      paymentsCountMonth: payments.length,
      billsPaidMonth,
      billsPendingCount,
      avgPaymentAmount,
    },
    error: billsRes.error?.message ?? null,
  };
}

function emptyFinanceStats(): FinanceStats {
  return {
    revenueMonth: 0,
    revenuePrevMonth: 0,
    pendingDebt: 0,
    overdueDebt: 0,
    paymentsCountMonth: 0,
    billsPaidMonth: 0,
    billsPendingCount: 0,
    avgPaymentAmount: 0,
  };
}

export async function fetchFinanceChart(): Promise<{
  chart: FinanceChartPoint[];
  error: string | null;
}> {
  const { start, end } = monthBounds(0);

  const { data, error } = await supabase
    .from("payments")
    .select("amount, completed_at")
    .eq("status", "succeeded")
    .gte("completed_at", `${start}T00:00:00`)
    .lte("completed_at", `${end}T23:59:59`);

  if (error) return { chart: [], error: error.message };

  const byDay = new Map<string, { revenue: number; payments: number }>();
  for (const row of data ?? []) {
    const day = (row.completed_at as string).split("T")[0];
    const bucket = byDay.get(day) ?? { revenue: 0, payments: 0 };
    bucket.revenue += Number(row.amount);
    bucket.payments += 1;
    byDay.set(day, bucket);
  }

  const chart: FinanceChartPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day,
      label: String(parseInt(day.split("-")[2] ?? "0", 10)),
      revenue: v.revenue,
      payments: v.payments,
    }));

  return { chart, error: null };
}

export async function fetchAdminBills(statusFilter?: string): Promise<{
  data: AdminBillRow[];
  error: string | null;
}> {
  let query = supabase
    .from("bills")
    .select(
      "id, patient_id, amount, paid_amount, status, description, bill_number, due_date, created_at, dental_clients(name, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as BillDbRow[]).map(mapBillRow), error: null };
}

export async function fetchAdminPayments(): Promise<{
  data: AdminPaymentRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, bill_id, amount, method, status, provider, completed_at, created_at, bills(bill_number), dental_clients(name, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as PaymentDbRow[]).map(mapPaymentRow), error: null };
}

export function exportFinanceCsv(
  bills: AdminBillRow[],
  payments: AdminPaymentRow[]
): string {
  const lines: string[] = [
    "Тип,ID,Номер,Пациент,Сумма,Статус,Дата",
    ...bills.map(
      (b) =>
        `Счёт,${b.id},${b.number},${b.patientName},${b.totalAmount},${b.status},${b.issuedAt}`
    ),
    ...payments.map(
      (p) =>
        `Платёж,${p.id},${p.billNumber},${p.patientName},${p.amount},${p.status},${p.completedAt ?? p.createdAt}`
    ),
  ];
  return lines.join("\n");
}
