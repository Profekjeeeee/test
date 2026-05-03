"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import {
  initBills,
  saveBills,
  payBillById,
  payAllPendingBills,
  getTotalPending,
  formatBillDate,
} from "@/lib/bills";
import type { Bill } from "@/types";

type FilterTab = "all" | "pending" | "paid";

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);

  useEffect(() => {
    setBills(initBills());
  }, []);

  const totalPending = getTotalPending(bills);

  const handlePayOne = (id: string) => {
    setPayingId(id);
    setTimeout(() => {
      const updated = payBillById(bills, id);
      saveBills(updated);
      setBills(updated);
      setPayingId(null);
    }, 700);
  };

  const handlePayAll = () => {
    if (totalPending === 0) return;
    setPayingAll(true);
    setTimeout(() => {
      const updated = payAllPendingBills(bills);
      saveBills(updated);
      setBills(updated);
      setPayingAll(false);
    }, 800);
  };

  const filtered = bills.filter((b) => {
    if (filter === "pending") return b.status === "pending" || b.status === "overdue";
    if (filter === "paid") return b.status === "paid";
    return true;
  });

  const pendingBills = filtered.filter(
    (b) => b.status === "pending" || b.status === "overdue"
  );
  const paidBills = filtered.filter((b) => b.status === "paid");

  return (
    <div className="min-h-dvh bg-[#F8FAFB] dark:bg-slate-950 pb-[88px]">
      <Header title="Мои счета" />

      {/* ── Balance hero block ─────────────────────────────────── */}
      <div className="px-5 pt-4">
        <div
          className="rounded-[20px] px-5 pt-5 pb-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0D2347 0%, #1A3A6B 60%, #1E4580 100%)",
          }}
        >
          {/* Background decorative circles */}
          <div
            className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #3ECFFF 0%, transparent 70%)" }}
          />
          <div
            className="absolute -left-4 -bottom-6 w-32 h-32 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #3ECFFF 0%, transparent 70%)" }}
          />

          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300/70 mb-1.5">
            Текущий баланс к оплате
          </p>

          <p className="text-[38px] font-bold text-white leading-none mb-1 tabular-nums">
            {totalPending > 0
              ? `${totalPending.toLocaleString("ru-RU")} ₽`
              : "0 ₽"}
          </p>

          {totalPending > 0 ? (
            <>
              <p className="text-[12px] text-blue-300/60 mb-4">
                По {bills.filter((b) => b.status === "pending" || b.status === "overdue").length} счёт
                {bills.filter((b) => b.status === "pending" || b.status === "overdue").length === 1
                  ? "у"
                  : "ам"}
              </p>
              <button
                onClick={handlePayAll}
                disabled={payingAll}
                className="w-full h-11 rounded-[10px] text-[14px] font-bold text-[#0D2347] active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ background: "#3ECFFF" }}
              >
                {payingAll ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Оплата...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="4" width="14" height="10" rx="2" stroke="#0D2347" strokeWidth="1.5" />
                      <path d="M1 7H15" stroke="#0D2347" strokeWidth="1.5" />
                      <rect x="3.5" y="9.5" width="4" height="2" rx="1" fill="#0D2347" />
                    </svg>
                    Оплатить онлайн
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-5 h-5 rounded-full bg-green-400/20 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 4"
                    stroke="#4ADE80"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[13px] text-green-300 font-medium">Нет задолженностей</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────── */}
      <div className="flex px-5 pt-4 gap-2">
        {(["all", "pending", "paid"] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`flex-1 h-9 rounded-[8px] text-[13px] font-semibold transition-colors active:scale-95 ${
              filter === t
                ? "bg-primary text-white shadow-sm"
                : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400"
            }`}
          >
            {t === "all" ? "Все" : t === "pending" ? "Ожидают" : "Оплаченные"}
          </button>
        ))}
      </div>

      {/* ── Bills list ──────────────────────────────────────────── */}
      <main className="px-5 pt-4 flex flex-col gap-4">
        {/* Pending section */}
        {pendingBills.length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-2.5 px-0.5">
              Ожидают оплаты
            </p>
            <div className="flex flex-col gap-3">
              {pendingBills.map((bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  onPay={handlePayOne}
                  paying={payingId === bill.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Paid section */}
        {paidBills.length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-2.5 px-0.5">
              Оплаченные
            </p>
            <div className="flex flex-col gap-3">
              {paidBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-[15px]">Счета не найдены</p>
          </div>
        )}

        {/* Tax deduction card */}
        <TaxDeductionCard />
      </main>

      <BottomBar />
    </div>
  );
}

// ── BillCard ────────────────────────────────────────────────────────────────

function BillCard({
  bill,
  onPay,
  paying,
}: {
  bill: Bill;
  onPay?: (id: string) => void;
  paying?: boolean;
}) {
  const isPending = bill.status === "pending" || bill.status === "overdue";
  const primaryService = bill.items[0]?.service ?? "Медицинская услуга";

  return (
    <Card>
      {/* Top row: service + status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white leading-tight">
            {primaryService}
          </p>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {bill.number}&nbsp;&nbsp;·&nbsp;&nbsp;{formatBillDate(bill.issuedAt)}
          </p>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {isPending ? (
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <circle cx="8" cy="8" r="7.5" fill="#DCFCE7" />
              <path
                d="M5 8L7 10L11 6"
                stroke="#16A34A"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span
            className={`text-[12px] font-semibold ${
              isPending ? "text-red-500" : "text-green-600"
            }`}
          >
            {isPending ? "Ожидает" : "Оплачено"}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 dark:bg-slate-700 mb-3" />

      {/* Bottom row: amount + pay button */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[24px] font-bold text-[#0F172A] dark:text-white tabular-nums">
          {bill.totalAmount.toLocaleString("ru-RU")} ₽
        </p>
        {isPending && onPay && (
          <button
            onClick={() => onPay(bill.id)}
            disabled={paying}
            className="h-9 px-4 rounded-[8px] bg-primary text-white text-[13px] font-semibold active:scale-95 transition-transform disabled:opacity-60 flex items-center gap-1.5"
          >
            {paying ? (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {paying ? "Оплата..." : "Оплатить"}
          </button>
        )}
        {!isPending && bill.paidAt && (
          <p className="text-[12px] text-gray-400">
            {formatBillDate(bill.paidAt)}
          </p>
        )}
      </div>
    </Card>
  );
}

// ── TaxDeductionCard ────────────────────────────────────────────────────────

function TaxDeductionCard() {
  return (
    <Card radius="lg" className="!p-0 overflow-hidden mt-1">
      {/* Illustration */}
      <div
        className="w-full h-[130px] relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #E8F5F3 0%, #C5E3DF 100%)" }}
      >
        <svg
          viewBox="0 0 360 130"
          fill="none"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Wall */}
          <rect x="0" y="0" width="360" height="102" fill="#D9EFEC" />
          {/* Floor */}
          <rect x="0" y="102" width="360" height="28" fill="#B8DAD6" />
          {/* Floor line */}
          <line x1="0" y1="102" x2="360" y2="102" stroke="#A4CCC8" strokeWidth="1.5" />

          {/* Window left */}
          <rect x="18" y="14" width="56" height="52" rx="3" fill="#A8D4CF" />
          <rect x="18" y="14" width="56" height="52" rx="3" stroke="#82BCB7" strokeWidth="1.5" />
          <line x1="46" y1="14" x2="46" y2="66" stroke="#82BCB7" strokeWidth="1" />
          <line x1="18" y1="40" x2="74" y2="40" stroke="#82BCB7" strokeWidth="1" />
          {/* Window reflection */}
          <rect x="22" y="18" width="10" height="18" rx="2" fill="white" opacity="0.3" />

          {/* Medical cross on wall */}
          <rect x="98" y="22" width="18" height="5" rx="2.5" fill="#00665E" opacity="0.3" />
          <rect x="104" y="16" width="5" height="18" rx="2.5" fill="#00665E" opacity="0.3" />

          {/* Dental chair base */}
          <rect x="145" y="90" width="80" height="12" rx="4" fill="#B0CCC8" />
          {/* Chair seat */}
          <rect x="140" y="64" width="90" height="32" rx="10" fill="#FFFFFF" />
          <rect x="140" y="64" width="90" height="32" rx="10" stroke="#C0DDD9" strokeWidth="1.5" />
          {/* Chair headrest */}
          <rect x="188" y="44" width="34" height="26" rx="8" fill="#FFFFFF" />
          <rect x="188" y="44" width="34" height="26" rx="8" stroke="#C0DDD9" strokeWidth="1.5" />
          {/* Chair arm */}
          <rect x="203" y="62" width="5" height="26" rx="2.5" fill="#C0DDD9" />

          {/* Equipment stand */}
          <rect x="245" y="18" width="5" height="84" rx="2.5" fill="#A4C8C4" />
          {/* Arm */}
          <rect x="228" y="18" width="22" height="4" rx="2" fill="#A4C8C4" />
          {/* Lamp */}
          <ellipse cx="224" cy="20" rx="10" ry="9" fill="#E2F2F0" stroke="#A4C8C4" strokeWidth="1.5" />
          <ellipse cx="224" cy="20" rx="5" ry="4.5" fill="#FDE68A" opacity="0.7" />
          {/* Tray */}
          <rect x="246" y="52" width="30" height="5" rx="2.5" fill="#A4C8C4" />
          <rect x="244" y="56" width="34" height="8" rx="3" fill="#D9EFEC" stroke="#A4C8C4" strokeWidth="1" />

          {/* Plant pot */}
          <rect x="298" y="80" width="26" height="22" rx="4" fill="#82BCAC" />
          <rect x="301" y="78" width="20" height="4" rx="2" fill="#6BAA9A" />
          {/* Plant leaves */}
          <ellipse cx="311" cy="60" rx="16" ry="22" fill="#4DA090" />
          <ellipse cx="296" cy="56" rx="12" ry="16" fill="#3A9080" />
          <ellipse cx="326" cy="58" rx="11" ry="15" fill="#3A9080" />
          {/* Stem */}
          <rect x="309" y="68" width="4" height="14" rx="2" fill="#2E7A6C" />

          {/* Cabinet in background */}
          <rect x="280" y="38" width="18" height="60" rx="3" fill="#C5E0DC" stroke="#A4C8C4" strokeWidth="1" />
          <circle cx="285" cy="68" r="2" fill="#A4C8C4" />
        </svg>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1.5 6.5L4 9L10.5 3"
                stroke="#00665E"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[15px] font-bold text-[#0F172A] dark:text-white">Налоговый вычет</p>
        </div>

        <p className="text-[13px] text-gray-500 dark:text-slate-400 leading-relaxed mb-3">
          Мы подготовим все необходимые документы для получения налогового вычета{" "}
          <span className="font-bold text-primary">13%</span> за ваше лечение.
        </p>

        <button className="flex items-center gap-1.5 text-[13px] font-semibold text-primary active:opacity-70 transition-opacity">
          Заказать справку
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 7H11.5M8.5 3.5L11.5 7L8.5 10.5"
              stroke="#00665E"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </Card>
  );
}
