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
import { getProfile, saveProfile } from "@/lib/userProfile";
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
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
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
                className="interactive-press-sm w-full h-11 rounded-[10px] text-[14px] font-bold text-[#0D2347] shadow-[0_4px_14px_rgba(62,207,255,0.45)] border border-sky-300/40 dark:shadow-[0_6px_20px_rgba(0,0,0,0.35)] dark:border-sky-400/20 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
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
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
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
              <div className="w-5 h-5 rounded-full bg-sky-400/15 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-primary">
                  <path
                    d="M2.5 6L5 8.5L9.5 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[13px] text-primary font-medium">Нет задолженностей</p>
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
            className={`interactive-press-sm flex-1 h-9 rounded-[8px] text-[13px] font-semibold transition-all duration-150 border ${
              filter === t
                ? "bg-primary text-white border-primary shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-400 shadow-raised-surface"
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-primary">
              <circle cx="8" cy="8" r="7.5" className="fill-primary-light" />
              <path
                d="M5 8L7 10L11 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span
            className={`text-[12px] font-semibold ${
              isPending ? "text-red-500" : "text-primary"
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
            className="interactive-press-sm h-9 px-4 rounded-[8px] bg-primary text-white text-[13px] font-semibold shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/25 disabled:opacity-60 disabled:active:scale-100 flex items-center gap-1.5"
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

type TaxModalView = "confirm" | "enter_email" | "success";

function TaxDeductionCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [view, setView] = useState<TaxModalView>("confirm");
  const [userEmail, setUserEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);

  const openModal = () => {
    const email = getProfile().email.trim();
    setUserEmail(email);
    setView(email ? "confirm" : "enter_email");
    setEmailInput("");
    setEmailError("");
    setSending(false);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const id = requestAnimationFrame(() => setModalVisible(true));
    return () => cancelAnimationFrame(id);
  }, [modalOpen]);

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setModalOpen(false), 300);
  };

  const handleSend = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setView("success");
    setTimeout(() => closeModal(), 2200);
  };

  const handleSubmitEmail = async () => {
    const trimmed = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Введите корректный email-адрес");
      return;
    }
    setSending(true);
    const profile = getProfile();
    saveProfile({ ...profile, email: trimmed });
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setUserEmail(trimmed);
    setView("success");
    setTimeout(() => closeModal(), 2200);
  };

  return (
    <>
      <Card radius="lg" className="!p-0 overflow-hidden mt-1">
        {/* Illustration */}
        <div
          className="w-full h-[130px] relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #e8f4fc 0%, #bfdbfe 100%)" }}
        >
          <svg
            viewBox="0 0 360 130"
            fill="none"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect x="0" y="0" width="360" height="102" fill="#dbeafe" />
            <rect x="0" y="102" width="360" height="28" fill="#93c5fd" />
            <line x1="0" y1="102" x2="360" y2="102" stroke="#60a5fa" strokeWidth="1.5" />
            <rect x="18" y="14" width="56" height="52" rx="3" fill="#7dd3fc" />
            <rect x="18" y="14" width="56" height="52" rx="3" stroke="#3b82f6" strokeWidth="1.5" />
            <line x1="46" y1="14" x2="46" y2="66" stroke="#3b82f6" strokeWidth="1" />
            <line x1="18" y1="40" x2="74" y2="40" stroke="#3b82f6" strokeWidth="1" />
            <rect x="22" y="18" width="10" height="18" rx="2" fill="white" opacity="0.3" />
            <rect x="98" y="22" width="18" height="5" rx="2.5" fill="currentColor" opacity="0.3" />
            <rect x="104" y="16" width="5" height="18" rx="2.5" fill="currentColor" opacity="0.3" />
            <rect x="145" y="90" width="80" height="12" rx="4" fill="#93c5fd" />
            <rect x="140" y="64" width="90" height="32" rx="10" fill="#FFFFFF" />
            <rect x="140" y="64" width="90" height="32" rx="10" stroke="#93c5fd" strokeWidth="1.5" />
            <rect x="188" y="44" width="34" height="26" rx="8" fill="#FFFFFF" />
            <rect x="188" y="44" width="34" height="26" rx="8" stroke="#93c5fd" strokeWidth="1.5" />
            <rect x="203" y="62" width="5" height="26" rx="2.5" fill="#93c5fd" />
            <rect x="245" y="18" width="5" height="84" rx="2.5" fill="#7dd3fc" />
            <rect x="228" y="18" width="22" height="4" rx="2" fill="#7dd3fc" />
            <ellipse cx="224" cy="20" rx="10" ry="9" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1.5" />
            <ellipse cx="224" cy="20" rx="5" ry="4.5" fill="#FDE68A" opacity="0.7" />
            <rect x="246" y="52" width="30" height="5" rx="2.5" fill="#7dd3fc" />
            <rect x="244" y="56" width="34" height="8" rx="3" fill="#dbeafe" stroke="#7dd3fc" strokeWidth="1" />
            <rect x="298" y="80" width="26" height="22" rx="4" fill="#60a5fa" />
            <rect x="301" y="78" width="20" height="4" rx="2" fill="#3b82f6" />
            <ellipse cx="311" cy="60" rx="16" ry="22" fill="#2563eb" />
            <ellipse cx="296" cy="56" rx="12" ry="16" fill="#1d4ed8" />
            <ellipse cx="326" cy="58" rx="11" ry="15" fill="#1d4ed8" />
            <rect x="309" y="68" width="4" height="14" rx="2" fill="#1e40af" />
            <rect x="280" y="38" width="18" height="60" rx="3" fill="#dbeafe" stroke="#7dd3fc" strokeWidth="1" />
            <circle cx="285" cy="68" r="2" fill="#7dd3fc" />
          </svg>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-primary">
                <path d="M1.5 6.5L4 9L10.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[15px] font-bold text-[#0F172A] dark:text-white">Налоговый вычет</p>
          </div>

          <p className="text-[13px] text-gray-500 dark:text-slate-400 leading-relaxed mb-3">
            Мы подготовим все необходимые документы для получения налогового вычета{" "}
            <span className="font-bold text-primary">13%</span> за ваше лечение.
          </p>

          <button
            onClick={openModal}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-primary active:opacity-70 active:scale-95 transition-all"
          >
            Заказать справку
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary">
              <path d="M2.5 7H11.5M8.5 3.5L11.5 7L8.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </Card>

      {/* ── Modal (плавающая карточка над таббаром) ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[9999]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tax-cert-modal-title"
        >
          <button
            type="button"
            className={`fixed inset-0 cursor-default border-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out outline-none ${
              modalVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={closeModal}
            aria-label="Закрыть"
          />
          <div
            className={`fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+5.25rem))] left-1/2 z-[1] w-[calc(100%-32px)] max-w-md origin-bottom -translate-x-1/2 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out dark:border-slate-600 dark:bg-[#1E293B] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] max-h-[min(78vh,calc(100dvh-6rem-env(safe-area-inset-bottom,0px)))] overflow-y-auto ${
              modalVisible ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── View: confirm email ── */}
            {view === "confirm" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary">
                      <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M2 7L9 11L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p
                      id="tax-cert-modal-title"
                      className="text-[16px] font-bold text-[#0F172A] dark:text-white"
                    >
                      Заказать справку
                    </p>
                    <p className="text-[12px] text-gray-400">для налогового вычета 13%</p>
                  </div>
                </div>

                <div className="rounded-[12px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 mb-4 shadow-raised-surface">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                    Отправим на почту
                  </p>
                  <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">
                    {userEmail}
                  </p>
                </div>

                <p className="text-[12px] text-gray-400 leading-relaxed mb-5">
                  Справка об оплаченных медицинских услугах будет сформирована и отправлена на указанный адрес в течение одного рабочего дня.
                </p>

                <div className="flex gap-2.5">
                  <button
                    onClick={closeModal}
                    className="interactive-press-sm flex-1 h-11 rounded-[10px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[14px] font-semibold text-gray-500 dark:text-slate-400 shadow-raised-surface"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="interactive-press-sm flex-1 h-11 rounded-[10px] bg-primary text-white text-[14px] font-semibold shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/25 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Отправка...
                      </>
                    ) : (
                      "Отправить"
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ── View: enter email ── */}
            {view === "enter_email" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary">
                      <path d="M9 3V10M9 13V14" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p id="tax-cert-modal-title" className="text-[16px] font-bold text-[#0F172A] dark:text-white">
                      Укажите email
                    </p>
                    <p className="text-[12px] text-gray-400">для получения справки</p>
                  </div>
                </div>

                <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                  В вашем профиле не указана электронная почта. Введите адрес — справка будет отправлена на него, а адрес сохранится в профиле.
                </p>

                <div className="mb-1">
                  <input
                    type="email"
                    placeholder="example@mail.ru"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError("");
                    }}
                    className={`w-full h-11 rounded-[10px] border px-4 text-[14px] outline-none transition-colors bg-white dark:bg-slate-800 dark:text-white ${
                      emailError
                        ? "border-red-400 focus:border-red-400"
                        : "border-gray-200 dark:border-slate-600 focus:border-primary"
                    }`}
                  />
                  {emailError && (
                    <p className="text-[12px] text-red-500 mt-1 px-1">{emailError}</p>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 mb-5 px-1">
                  Адрес будет сохранён в вашем профиле
                </p>

                <div className="flex gap-2.5">
                  <button
                    onClick={closeModal}
                    className="interactive-press-sm flex-1 h-11 rounded-[10px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[14px] font-semibold text-gray-500 dark:text-slate-400 shadow-raised-surface"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSubmitEmail}
                    disabled={sending}
                    className="interactive-press-sm flex-1 h-11 rounded-[10px] bg-primary text-white text-[14px] font-semibold shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/25 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Отправка...
                      </>
                    ) : (
                      "Отправить"
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ── View: success ── */}
            {view === "success" && (
              <div className="py-4 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" className="text-primary">
                    <path d="M5 13L10.5 18.5L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p id="tax-cert-modal-title" className="text-[17px] font-bold text-[#0F172A] dark:text-white mb-2">
                  Справка отправлена
                </p>
                <p className="text-[13px] text-gray-500 leading-relaxed">
                  Документы отправлены на{" "}
                  <span className="font-semibold text-[#0F172A] dark:text-white">{userEmail}</span>
                  .{" "}Ожидайте письмо в течение рабочего дня.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
