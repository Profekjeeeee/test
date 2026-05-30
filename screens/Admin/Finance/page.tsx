"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import {
  exportFinanceCsv,
  fetchAdminBills,
  fetchAdminPayments,
  fetchFinanceChart,
  fetchFinanceStats,
} from "@/lib/admin/finance";
import type { AdminBillRow, AdminPaymentRow, FinanceStats } from "@/lib/admin/types";
import { recordManualPayment, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payments";
import { tgHapticSuccess } from "@/lib/telegramHaptic";

function ChartSkeleton() {
  return <div className="h-[180px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
}

const FinanceRevenueChart = dynamic(
  () => import("@/components/admin/FinanceRevenueChart"),
  { ssr: false, loading: ChartSkeleton }
);

type Tab = "overview" | "bills" | "payments";
type BillFilter = "all" | "pending" | "partial" | "overdue" | "paid";

const BILL_STATUS_LABELS: Record<string, string> = {
  pending: "К оплате",
  partial: "Частично",
  overdue: "Просрочен",
  paid: "Оплачен",
};

const BILL_STATUS_CLS: Record<string, string> = {
  pending: "bg-primary/10 text-primary",
  partial: "bg-sky-100 dark:bg-primary/15 text-primary",
  overdue: "bg-slate-200 dark:bg-slate-700 text-[#0F172A] dark:text-white",
  paid: "bg-primary-light text-primary",
};

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

function pctChange(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? "+100%" : "0%";
  const diff = ((current - prev) / prev) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${Math.round(diff)}%`;
}

export default function AdminFinancePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [chart, setChart] = useState<{ day: string; label: string; revenue: number; payments: number }[]>([]);
  const [bills, setBills] = useState<AdminBillRow[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [billFilter, setBillFilter] = useState<BillFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualBillId, setManualBillId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, chartRes, billsRes, paymentsRes] = await Promise.all([
      fetchFinanceStats(),
      fetchFinanceChart(),
      fetchAdminBills(billFilter === "all" ? undefined : billFilter),
      fetchAdminPayments(),
    ]);
    setStats(statsRes.stats);
    setChart(chartRes.chart);
    setBills(billsRes.data);
    setPayments(paymentsRes.data);
    setError(statsRes.error ?? chartRes.error ?? billsRes.error ?? paymentsRes.error ?? "");
    setLoading(false);
  }, [billFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: "Выручка",
        value: `${formatRub(stats.revenueMonth)} ₽`,
        sub: `${pctChange(stats.revenueMonth, stats.revenuePrevMonth)} к прошлому месяцу`,
      },
      {
        label: "Дебиторка",
        value: `${formatRub(stats.pendingDebt)} ₽`,
        sub: `${stats.billsPendingCount} неоплаченных счетов`,
      },
      {
        label: "Просрочено",
        value: `${formatRub(stats.overdueDebt)} ₽`,
        sub: "требует внимания",
      },
      {
        label: "Оплат",
        value: String(stats.paymentsCountMonth),
        sub: `средний чек ${formatRub(stats.avgPaymentAmount)} ₽`,
      },
    ];
  }, [stats]);

  const handleExport = () => {
    const csv = exportFinanceCsv(bills, payments);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    tgHapticSuccess();
  };

  const handleManualPay = async (bill: AdminBillRow) => {
    const remaining = bill.totalAmount - bill.paidAmount;
    if (remaining <= 0) return;
    setManualBillId(bill.id);
    const result = await recordManualPayment(bill.id, bill.patientId, remaining, "cash");
    setManualBillId(null);
    if (result) {
      tgHapticSuccess();
      void load();
    }
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">
              Финансовый модуль
            </p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">Финансы</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="interactive-press-sm rounded-xl border border-primary/30 bg-primary-light px-3 py-2 text-[12px] font-semibold text-primary"
            >
              CSV
            </button>
            <ThemeToggleButton sizeClass="w-9 h-9" />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["overview", "Обзор"],
              ["bills", "Счета"],
              ["payments", "Платежи"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`interactive-press-sm shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${
                tab === id
                  ? "bg-primary text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="px-5 text-[13px] text-red-600 dark:text-red-400 mb-2">{error}</p>
      ) : null}

      {tab === "overview" && (
        <>
          <div className="px-5 grid grid-cols-2 gap-3 mb-4">
            {loading || !stats
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-4 h-[88px] bg-slate-100 dark:bg-slate-800 animate-pulse"
                  />
                ))
              : statCards.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.07)]"
                  >
                    <p className="text-[22px] font-bold text-primary leading-none tabular-nums">{s.value}</p>
                    <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white mt-1">{s.label}</p>
                    <p className="text-[11px] text-secondary mt-0.5">{s.sub}</p>
                  </div>
                ))}
          </div>

          <div className="px-5 mb-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white mb-2">
                Поступления по дням
              </p>
              {loading ? <ChartSkeleton /> : <FinanceRevenueChart data={chart} />}
            </div>
          </div>

          <div className="px-5 mb-4">
            <div className="rounded-2xl border border-primary/20 bg-primary-light/50 dark:bg-primary/10 p-4">
              <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white mb-1">
                Эквайринг
              </p>
              <p className="text-[12px] text-secondary leading-relaxed">
                Сейчас активен mock-провайдер. Для YooKassa задайте{" "}
                <code className="text-primary">ACQUIRING_PROVIDER=yookassa</code>, ключи в env и
                webhook на <code className="text-primary">/api/payments/webhook</code>.
              </p>
            </div>
          </div>
        </>
      )}

      {tab === "bills" && (
        <div className="px-5 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["all", "Все"],
                ["pending", "К оплате"],
                ["partial", "Частично"],
                ["overdue", "Просрочено"],
                ["paid", "Оплачено"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBillFilter(id)}
                className={`interactive-press-sm shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  billFilter === id
                    ? "bg-primary text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-[13px] text-secondary py-8 text-center">Загрузка…</p>
          ) : bills.length === 0 ? (
            <p className="text-[13px] text-secondary py-8 text-center">Счетов нет</p>
          ) : (
            bills.map((b) => {
              const remaining = b.totalAmount - b.paidAmount;
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">
                        {b.patientName}
                      </p>
                      <p className="text-[12px] text-secondary">{b.number}</p>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-1 rounded-lg shrink-0 ${
                        BILL_STATUS_CLS[b.status] ?? BILL_STATUS_CLS.pending
                      }`}
                    >
                      {BILL_STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="text-[13px] text-secondary mb-2 truncate">{b.description}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[18px] font-bold text-primary tabular-nums">
                        {formatRub(b.totalAmount)} ₽
                      </p>
                      {b.paidAmount > 0 && (
                        <p className="text-[11px] text-secondary">
                          оплачено {formatRub(b.paidAmount)} ₽
                        </p>
                      )}
                    </div>
                    {remaining > 0 && (
                      <button
                        type="button"
                        disabled={manualBillId === b.id}
                        onClick={() => void handleManualPay(b)}
                        className="interactive-press-sm rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                      >
                        {manualBillId === b.id ? "…" : "Касса"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="px-5 space-y-3">
          {loading ? (
            <p className="text-[13px] text-secondary py-8 text-center">Загрузка…</p>
          ) : payments.length === 0 ? (
            <p className="text-[13px] text-secondary py-8 text-center">Платежей пока нет</p>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white">
                      {formatRub(p.amount)} ₽
                    </p>
                    <p className="text-[12px] text-secondary">
                      {p.patientName} · {p.billNumber}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-1 rounded-lg bg-primary/10 text-primary">
                    {PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS] ?? p.status}
                  </span>
                </div>
                <p className="text-[11px] text-secondary mt-2">
                  {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}{" "}
                  · {p.provider} ·{" "}
                  {(p.completedAt ?? p.createdAt).split("T")[0]}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="px-5 pt-4 pb-2">
        <Link
          href="/screens/admin/dashboard"
          className="text-[13px] font-medium text-primary"
        >
          ← Дашборд
        </Link>
      </div>
    </main>
  );
}
