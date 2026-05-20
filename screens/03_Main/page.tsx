"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import { getNextAppointment, getUpcomingCount, type Appointment } from "@/lib/appointments";
import { initBills, getBills, getTotalPending } from "@/lib/bills";
import { type TreatmentPlanStats } from "@/lib/treatmentPlan";
import { initPlanSources, getMergedPlanStats } from "@/lib/planUtils";
import { getProfile } from "@/lib/userProfile";
import { DENTAL_SESSION_CHANGED_EVENT } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { FormulaToothIcon } from "@/components/icons/FormulaToothIcon";
import { usePatientUnreadCount } from "@/hooks/usePatientUnreadCount";

const DAILY_TIPS = [
  "Использование ирригатора снижает риск воспаления дёсен на 40%.",
  "Меняйте зубную щётку каждые 3 месяца, чтобы избежать скопления бактерий.",
  "Чистка языка помогает убрать до 80% бактерий в полости рта.",
  "Флосс — единственный способ эффективно очистить межзубные промежутки.",
  "После кислых фруктов прополощите рот водой, но не чистите зубы 30 минут.",
  "Правильная техника чистки зубов — круговые движения по 2 минуты дважды в день.",
  "Профилактический осмотр каждые 6 месяцев предотвращает 90% серьёзных проблем.",
];

function formatCurrentDate(): string {
  const now = new Date();
  const weekday = now.toLocaleString("ru-RU", { weekday: "long" });
  const day = now.getDate();
  const month = now.toLocaleString("ru-RU", { month: "long" });
  return `${weekday}, ${day} ${month}`;
}

export default function MainPage() {
  const router = useRouter();
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [nextApt, setNextApt] = useState<Appointment | null>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [planStats, setPlanStats] = useState<TreatmentPlanStats>({
    completed: 0, inProgress: 0, pending: 0,
    total: 0, paidAmount: 0, totalAmount: 0, progressPercent: 0,
  });
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const [firstName, setFirstName] = useState("Иван");
  const chatUnreadCount = usePatientUnreadCount();

  useEffect(() => {
    setCurrentDateStr(formatCurrentDate());
    void initPlanSources().then(() => {
      setNextApt(getNextAppointment());
      setUpcomingCount(getUpcomingCount());
      setPlanStats(getMergedPlanStats());
    });

    initBills();
    setPendingAmount(getTotalPending(getBills()));

    const syncHelloName = (): void => {
      const profile = getProfile();
      const n = profile.firstName.trim();
      setFirstName((prev) => n || prev);
    };

    syncHelloName();

    const updateAppointments = () => {
      setNextApt(getNextAppointment());
      setUpcomingCount(getUpcomingCount());
    };

    const updateBills = () => {
      setPendingAmount(getTotalPending(getBills()));
    };

    const updatePlan = () => {
      setPlanStats(getMergedPlanStats());
    };

    const onStorage = () => {
      updateAppointments();
      updateBills();
      updatePlan();
      syncHelloName();
    };

    window.addEventListener("appointmentsUpdated", updateAppointments);
    window.addEventListener("billsUpdated", updateBills);
    window.addEventListener("treatmentPlanUpdated", updatePlan);
    window.addEventListener("profileUpdated", syncHelloName);
    window.addEventListener(DENTAL_SESSION_CHANGED_EVENT, syncHelloName);
    window.addEventListener("storage", onStorage);

    const tipInterval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % DAILY_TIPS.length);
        setTipVisible(true);
      }, 350);
    }, 30000);

    return () => {
      window.removeEventListener("appointmentsUpdated", updateAppointments);
      window.removeEventListener("billsUpdated", updateBills);
      window.removeEventListener("treatmentPlanUpdated", updatePlan);
      window.removeEventListener("profileUpdated", syncHelloName);
      window.removeEventListener(DENTAL_SESSION_CHANGED_EVENT, syncHelloName);
      window.removeEventListener("storage", onStorage);
      clearInterval(tipInterval);
    };
  }, []);

  const handleReschedule = () => {
    if (nextApt) {
      router.push(`/booking?appointmentId=${nextApt.id}&isRescheduling=true`);
    }
  };

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      {/* Header */}
      <header className="px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-2">
        <p
          className="text-[13px] font-medium uppercase tracking-wider"
          style={{ color: "#9ab0c5" }}
        >
          {currentDateStr}
        </p>
        <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white mt-0.5">
          Добрый день, {firstName}
        </h1>
      </header>

      <main className="px-6 py-4 flex flex-col gap-4">
        {/* Ближайшая запись */}
        <Card>
          {nextApt ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    {upcomingCount > 1 ? `Ближайшая из ${upcomingCount} записей` : "Ближайшая запись"}
                  </p>
                  <p className="text-[17px] font-semibold text-[#0F172A] dark:text-white">
                    {nextApt.specialty}
                  </p>
                  <p className="text-[14px] text-gray-500 dark:text-slate-400 mt-0.5">
                    {nextApt.doctor}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[17px] font-bold text-primary">
                    {nextApt.day} {nextApt.month}
                  </p>
                  <p className="text-[14px] text-gray-500 dark:text-slate-400">{nextApt.time}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href="/appointments"
                  className="interactive-press-sm flex-1 h-11 flex items-center justify-center rounded-[4px] bg-primary text-white text-[13px] font-semibold"
                >
                  Подробнее
                </Link>
                <button
                  type="button"
                  className="interactive-press-sm flex-1 h-11 flex items-center justify-center rounded-[4px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[13px] font-medium text-primary shadow-raised-surface active:opacity-90"
                  onClick={handleReschedule}
                >
                  Перенести
                </button>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Ближайшая запись
              </p>
              <p className="text-[15px] text-gray-400">Нет предстоящих записей</p>
              <Link
                href="/booking"
                className="interactive-press-sm mt-3 inline-flex items-center justify-center h-9 px-4 rounded-[4px] bg-primary text-white text-[13px] font-semibold"
              >
                Записаться
              </Link>
            </div>
          )}
        </Card>

        {/* Быстрые действия */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/booking" className="interactive-press block">
            <Card padding="sm" className="text-center py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-primary-light flex items-center justify-center mx-auto mb-2">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-primary">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-[11px] font-semibold text-[#0F172A] dark:text-white leading-tight">
                Записаться
              </p>
            </Card>
          </Link>
          <Link href="/formula" className="interactive-press block">
            <Card padding="sm" className="text-center py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-primary-light flex items-center justify-center mx-auto mb-2">
                <FormulaToothIcon
                  variant="outline"
                  className="w-5 h-5 text-primary shrink-0"
                />
              </div>
              <p className="text-[11px] font-semibold text-[#0F172A] dark:text-white leading-tight">
                Формула
              </p>
            </Card>
          </Link>
          <Link href="/price-list" className="interactive-press block">
            <Card padding="sm" className="text-center py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-primary-light flex items-center justify-center mx-auto mb-2">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-primary">
                  <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 7H13M7 10.5H11M7 14H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-[11px] font-semibold text-[#0F172A] dark:text-white leading-tight">
                Прайс-лист
              </p>
            </Card>
          </Link>
          <Link href={ROUTES.patientSupportChat} className="interactive-press block">
            <Card padding="sm" className="text-center py-3.5">
              <div className="relative w-9 h-9 rounded-[10px] bg-primary-light flex items-center justify-center mx-auto mb-2">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-primary">
                  <path d="M4 14V17L8 14H15C15.5523 14 16 13.5523 16 13V6C16 5.44772 15.5523 5 15 5H5C4.44772 5 4 5.44772 4 6V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M7 9H13M7 11H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {chatUnreadCount > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#248bcf] dark:bg-primary/90 px-1 text-[9px] font-bold leading-none text-white"
                    aria-label={`Непрочитанных сообщений: ${chatUnreadCount}`}
                  >
                    {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-[#0F172A] dark:text-white leading-tight">
                Поддержка
              </p>
            </Card>
          </Link>
        </div>

        {/* Финансы */}
        <Card>
          <p className="text-[12px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            Финансы
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-gray-500 dark:text-slate-400">К оплате</p>
              <p className="text-[22px] font-bold text-[#0F172A] dark:text-white tabular-nums">
                {pendingAmount > 0
                  ? `${pendingAmount.toLocaleString("ru-RU")} ₽`
                  : "Всё оплачено"}
              </p>
            </div>
            <Link
              href="/bills"
              className="interactive-press-sm h-9 px-4 flex items-center rounded-[4px] bg-primary text-white text-[13px] font-semibold"
            >
              {pendingAmount > 0 ? "Оплатить" : "Счета"}
            </Link>
          </div>
        </Card>

        {/* План лечения */}
        <Card>
          <p className="text-[12px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            План лечения
          </p>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${planStats.progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-3">
            {planStats.progressPercent}% выполнено · {planStats.total} услуг
          </p>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Выполнено", value: planStats.completed, barColor: "bg-primary", textColor: "text-primary" },
              { label: "В процессе", value: planStats.inProgress, barColor: "bg-amber-400", textColor: "text-amber-600" },
              { label: "Ожидает", value: planStats.pending, barColor: "bg-gray-200 dark:bg-slate-600", textColor: "text-gray-500 dark:text-slate-400" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className={`${item.barColor} rounded-[3px] h-1 w-full mb-1.5`} />
                <p className={`text-[20px] font-bold tabular-nums ${item.textColor}`}>
                  {item.value}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          <Link
            href="/treatment-plan"
            className="interactive-press block text-center text-[13px] font-semibold text-primary py-1 border-t border-slate-200 dark:border-slate-700 pt-2.5"
          >
            Открыть план →
          </Link>
        </Card>

        {/* ── Совет дня ── */}
        <div className="relative rounded-[16px] overflow-hidden px-5 py-4 bg-gradient-to-br from-[#e8f4fc] via-[#e3f2fa] to-[#cfe8fc] dark:from-slate-800 dark:via-slate-800/95 dark:to-slate-900">
          {/* Декоративная иконка зуба — фоновый акцент (та же форма, что в таббаре) */}
          <FormulaToothIcon
            variant="solid"
            className="absolute -right-2 -top-2 w-28 h-28 text-primary opacity-[0.08] pointer-events-none"
          />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 2V7M6 9.5V10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-900 dark:text-sky-100">
              Совет дня
            </p>
          </div>

          {/* Текст совета с fade-анимацией */}
          <p
            className="text-[14px] font-medium leading-snug pr-10 text-[#0F172A] dark:text-slate-100 transition-opacity duration-300"
            style={{ opacity: tipVisible ? 1 : 0 }}
          >
            {DAILY_TIPS[tipIndex]}
          </p>

          {/* Ссылка */}
          <Link
            href="/prevention"
            className="interactive-press mt-3 inline-flex items-center gap-1 text-[12px] font-semibold transition-opacity duration-300"
            style={{ color: "var(--color-primary)", opacity: tipVisible ? 1 : 0 }}
          >
            Узнайте больше в разделе рекомендаций
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6H9.5M6.5 3.5L9.5 6L6.5 8.5" stroke="var(--color-primary)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

      </main>

      <BottomBar />
    </div>
  );
}
