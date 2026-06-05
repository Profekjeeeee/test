"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import { getProfile } from "@/lib/userProfile";
import {
  loadPatientCabinetCore,
  formatPaymentLabel,
  type PatientCabinetSummary,
} from "@/lib/patientCabinet";
import { getPatientPayments } from "@/lib/payments";
import {
  formatVisitDate,
  formatVisitPrice,
} from "@/lib/patientVisits";
import { formatBillDate } from "@/lib/bills";
import { formatFileDate } from "@/lib/patientFiles";
import { formatRuNumericLongDateStable } from "@/lib/doctorSchedule";

const PatientAiAssistant = dynamic(
  () => import("@/components/ai/PatientAiAssistant"),
  { ssr: false, loading: () => null },
);

function SectionLink({
  href,
  title,
  subtitle,
  badge,
  icon,
}: {
  href: string;
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="interactive-press block">
      <Card padding="sm" className="border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-light dark:bg-primary/15 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white">{title}</p>
            {subtitle && (
              <p className="text-[12px] text-secondary mt-0.5 leading-snug truncate">{subtitle}</p>
            )}
          </div>
          {badge && (
            <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {badge}
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <path d="M6 4L10 8L6 12" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </Card>
    </Link>
  );
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2.5 text-center">
      <p className={`text-[18px] font-bold tabular-nums leading-none ${accent ? "text-primary" : "text-[#0F172A] dark:text-white"}`}>
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary mt-1.5">{label}</p>
    </div>
  );
}

function SectionSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-20 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse"
        />
      ))}
    </div>
  );
}

export default function PatientCabinetPage() {
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [summary, setSummary] = useState<PatientCabinetSummary | null>(null);

  const refresh = useCallback(async () => {
    setPaymentsLoading(true);
    const data = await loadPatientCabinetCore();
    setSummary(data);
    setLoading(false);
    const payments = await getPatientPayments();
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            finances: { ...prev.finances, recentPayments: payments.slice(0, 5) },
          }
        : prev,
    );
    setPaymentsLoading(false);
  }, []);

  useEffect(() => {
    const profile = getProfile();
    setFirstName(profile.firstName.trim());
    setLastName(profile.lastName.trim());
    void refresh();

    const events = [
      "patientVisitsUpdated",
      "medicalRecordsUpdated",
      "patientFilesUpdated",
      "billsUpdated",
      "treatmentPlanUpdated",
      "appointmentsUpdated",
    ] as const;

    const onUpdate = () => void refresh();
    events.forEach((e) => window.addEventListener(e, onUpdate));
    return () => events.forEach((e) => window.removeEventListener(e, onUpdate));
  }, [refresh]);

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Пациент";
  const stats = summary?.planStats;
  const finances = summary?.finances;
  const prevention = summary?.prevention;

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title="Мой кабинет" />

      <main className="px-5 pt-2 pb-28 flex flex-col gap-4 max-w-[480px] mx-auto">
        {/* Hero */}
        <div
          className="rounded-[20px] px-5 py-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0D2347 0%, #1A3A6B 60%, #1E4580 100%)",
          }}
        >
          <div
            className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #3ECFFF 0%, transparent 70%)" }}
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300/70">
            Цифровой кабинет
          </p>
          <p className="text-[22px] font-bold text-white mt-1 leading-tight">{fullName}</p>
          <p className="text-[13px] text-blue-200/70 mt-1">
            Вся история лечения, документы и финансы в одном месте
          </p>
        </div>

        {loading || !summary ? (
          <SectionSkeleton count={3} />
        ) : (
          <>
            <PatientAiAssistant />

            {/* Quick stats */}
            <div className="flex gap-2">
              <StatPill
                label="Прогресс"
                value={`${stats?.progressPercent ?? 0}%`}
                accent
              />
              <StatPill
                label="Визиты"
                value={String(summary.visitCount)}
              />
              <StatPill
                label="Документы"
                value={String(summary.filesSummary.total)}
              />
              <StatPill
                label="К оплате"
                value={
                  (finances?.pendingAmount ?? 0) > 0
                    ? `${Math.round((finances?.pendingAmount ?? 0) / 1000)}k`
                    : "0"
                }
                accent={(finances?.pendingAmount ?? 0) > 0}
              />
            </div>

            {/* Treatment progress widget */}
            <Card className="border border-primary/15">
              <div className="flex items-end justify-between gap-2 mb-2">
                <p className="text-[12px] font-bold uppercase tracking-widest text-secondary">
                  Прогресс лечения
                </p>
                <Link href="/treatment-plan" className="text-[12px] font-semibold text-primary">
                  Подробнее →
                </Link>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${stats?.progressPercent ?? 0}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[18px] font-bold text-primary tabular-nums">{stats?.completed ?? 0}</p>
                  <p className="text-[10px] text-secondary">Выполнено</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-amber-500 tabular-nums">{stats?.inProgress ?? 0}</p>
                  <p className="text-[10px] text-secondary">В процессе</p>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-secondary tabular-nums">{stats?.pending ?? 0}</p>
                  <p className="text-[10px] text-secondary">Ожидает</p>
                </div>
              </div>
            </Card>

            {/* Recent visits preview */}
            {summary.recentVisits.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-2 px-0.5">
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary">
                    История лечения
                  </h2>
                  <Link href="/treatment-history" className="text-[12px] font-semibold text-primary">
                    Все визиты →
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {summary.recentVisits.map((v) => (
                    <Card key={v.id} padding="sm" className="border border-slate-200/80 dark:border-slate-800">
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-secondary">{formatVisitDate(v.visitDate)}</p>
                          <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white mt-0.5 truncate">
                            {v.procedureTitle}
                          </p>
                          {v.doctorName && (
                            <p className="text-[12px] text-secondary mt-0.5">{v.doctorName}</p>
                          )}
                        </div>
                        <p className="text-[13px] font-bold text-primary shrink-0 tabular-nums">
                          {formatVisitPrice(v.price)}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Doctor recommendations */}
            {summary.recommendations.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-2 px-0.5">
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary">
                    Рекомендации врача
                  </h2>
                  <Link href="/prevention" className="text-[12px] font-semibold text-primary">
                    Профилактика →
                  </Link>
                </div>
                <Card padding="sm" className="border border-primary/15">
                  <div className="flex flex-col gap-2.5">
                    {summary.recommendations.slice(0, 3).map((rec, i) => (
                      <div
                        key={rec.id}
                        className={`flex gap-2.5 ${i > 0 ? "pt-2.5 border-t border-slate-100 dark:border-slate-700" : ""}`}
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-primary">
                            <path d="M6 2L7.2 5.5L11 6.3L8.5 8.7L9 12.5L6 10.8L3 12.5L3.5 8.7L1 6.3L4.8 5.5L6 2Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#0F172A] dark:text-white leading-snug">
                            {rec.text}
                          </p>
                          {rec.procedureTitle && (
                            <p className="text-[11px] text-secondary mt-0.5">
                              {rec.procedureTitle}
                              {rec.visitDate ? ` · ${formatVisitDate(rec.visitDate)}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            )}

            {/* Medical archive */}
            {summary.medicalRecords.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-2 px-0.5">
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary">
                    Медицинский архив
                  </h2>
                  <Link href="/treatment-history" className="text-[12px] font-semibold text-primary">
                    Открыть →
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {summary.medicalRecords.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-primary/20 bg-primary-light/40 dark:bg-primary/10 px-3 py-2.5"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {r.recordType === "allergy" ? "Аллергия" :
                         r.recordType === "chronic" ? "Хроническое" :
                         r.recordType === "medication" ? "Препарат" :
                         r.recordType === "contraindication" ? "Противопоказание" : "Общее"}
                      </p>
                      <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white mt-0.5">{r.title}</p>
                      {r.description && (
                        <p className="text-[12px] text-secondary mt-0.5 leading-snug">{r.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Prevention schedule */}
            {prevention && (
              <Card padding="sm" className="border border-slate-200/80 dark:border-slate-800">
                <p className="text-[12px] font-bold uppercase tracking-widest text-secondary mb-2">
                  Следующий осмотр
                </p>
                <div className="flex justify-between items-end mb-2">
                  <p className="text-[24px] font-bold text-[#0F172A] dark:text-white tabular-nums">
                    {prevention.daysUntilNextVisit}{" "}
                    <span className="text-[14px] font-medium text-secondary">дней</span>
                  </p>
                  <p className="text-[13px] text-secondary">
                    {formatRuNumericLongDateStable(prevention.nextVisitDate)}
                  </p>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${prevention.progressPercent}%` }}
                  />
                </div>
              </Card>
            )}

            {/* Navigation sections */}
            <div className="flex flex-col gap-2.5">
              <SectionLink
                href="/treatment-history"
                title="История лечения"
                subtitle={
                  summary.visitCount > 0
                    ? `${summary.visitCount} ${summary.visitCount === 1 ? "визит" : summary.visitCount < 5 ? "визита" : "визитов"}`
                    : "Пока нет записей"
                }
                icon={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary">
                    <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M7 7H13M7 10H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                }
              />
              <SectionLink
                href="/documents"
                title="Документы и снимки"
                subtitle={
                  summary.filesSummary.total > 0
                    ? `${summary.filesSummary.xrays} снимков · ${summary.filesSummary.docs} документов`
                    : "Архив пуст"
                }
                badge={summary.filesSummary.total > 0 ? String(summary.filesSummary.total) : undefined}
                icon={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary">
                    <path d="M4 3H12L16 7V17H4V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M12 3V7H16" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                }
              />
              <SectionLink
                href="/bills"
                title="Счета и оплаты"
                subtitle={
                  (finances?.pendingAmount ?? 0) > 0
                    ? `К оплате ${finances!.pendingAmount.toLocaleString("ru-RU")} ₽`
                    : `${finances?.paidCount ?? 0} оплаченных счетов`
                }
                badge={(finances?.pendingCount ?? 0) > 0 ? String(finances!.pendingCount) : undefined}
                icon={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary">
                    <path d="M5 2H15C15.5523 2 16 2.44772 16 3V18L13 16L10 18L7 16L5 17V3C5 2.44772 5.44772 2 5 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                }
              />
              <SectionLink
                href="/formula"
                title="Зубная формула"
                subtitle="Состояние зубов и история по зубам"
                icon={
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary">
                    <path d="M10 3C7 3 5 5.5 5 8.5C5 11 6 13 7 15C7.5 16 8.5 16 9 15C9.5 14 10.5 14 11 15C11.5 16 12.5 16 13 15C14 13 15 11 15 8.5C15 5.5 13 3 10 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                }
              />
            </div>

            {/* Recent payments */}
            {paymentsLoading ? (
              <SectionSkeleton count={1} />
            ) : (
              finances &&
              finances.recentPayments.length > 0 && (
                <section>
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary mb-2 px-0.5">
                    Последние оплаты
                  </h2>
                  <Card padding="sm" className="border border-slate-200/80 dark:border-slate-800">
                    <div className="flex flex-col gap-2">
                      {finances.recentPayments.map((p, i) => (
                        <div
                          key={p.id}
                          className={`flex justify-between gap-2 ${i > 0 ? "pt-2 border-t border-slate-100 dark:border-slate-700" : ""}`}
                        >
                          <p className="text-[13px] font-medium text-[#0F172A] dark:text-white">
                            {formatPaymentLabel(p)}
                          </p>
                          <p className="text-[12px] text-secondary shrink-0">
                            {p.completedAt ? formatBillDate(p.completedAt) : formatBillDate(p.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </section>
              )
            )}

            {/* Recent files preview */}
            {summary.recentFiles.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-2 px-0.5">
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary">
                    Последние файлы
                  </h2>
                  <Link href="/documents" className="text-[12px] font-semibold text-primary">
                    Архив →
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {summary.recentFiles.map((f) => (
                    <Card key={f.id} padding="sm" className="border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">
                        {f.fileName}
                      </p>
                      <p className="text-[12px] text-secondary mt-0.5">{formatFileDate(f.createdAt)}</p>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Profile link */}
            <Link
              href="/profile"
              className="interactive-press-sm flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[14px] font-semibold text-primary shadow-raised-surface"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M3 14C3 11.5 5.2 9.5 8 9.5C10.8 9.5 13 11.5 13 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Настройки профиля
            </Link>
          </>
        )}
      </main>

      <BottomBar />
    </div>
  );
}
