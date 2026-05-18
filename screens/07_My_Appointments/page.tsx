"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";
import {
  initAppointments,
  getAppointments,
  cancelAppointment,
  type Appointment,
} from "@/lib/appointments";
import { getBills, removeBillByAppointmentId, type Bill } from "@/lib/bills";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

// ─── Fallback price lookup for legacy appointments without price ───────────────

const PRICES_MOCK: Record<string, number> = {
  // Терапия
  "лечение кариеса": 7950,
  "пломбирование канала": 5500,
  "консультация терапевта": 1500,
  "эндодонтическое лечение": 12000,
  // Хирургия
  "удаление зуба": 3500,
  "резекция верхушки корня": 8500,
  "удаление ретинированного зуба": 6500,
  "вскрытие абсцесса": 4000,
  // Профилактика
  "профессиональная гигиена": 4500,
  "снятие зубного камня": 3000,
  "профессиональное отбеливание": 12000,
  "фторирование зубов": 2000,
  // Ортодонтия
  "установка брекет-системы": 45000,
  "консультация ортодонта": 2000,
  "коррекция брекет-системы": 2500,
  "изготовление ретейнера": 8000,
  // Имплантация
  "установка импланта": 50000,
  "консультация имплантолога": 2000,
  "установка коронки на имплант": 25000,
  "костная пластика": 35000,
  // Legacy mock services
  "терапия. лечение кариеса": 7950,
  "профилактика. чистка": 4500,
};

function resolvePrice(apt: Appointment): number | null {
  if (apt.price != null && apt.price > 0) return apt.price;
  const key = apt.service.toLowerCase();
  // Точное совпадение
  if (PRICES_MOCK[key] != null) return PRICES_MOCK[key];
  // Частичное совпадение — ищем по подстроке
  for (const [fragment, price] of Object.entries(PRICES_MOCK)) {
    if (key.includes(fragment)) return price;
  }
  return null;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU") + " ₽";
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: {
    label: "Ожидает подтверждения",
    color:
      "text-amber-800 bg-amber-50 border border-amber-200/50 dark:text-amber-400/90 dark:bg-amber-500/10 dark:border-amber-500/12",
  },
  scheduled: {
    label: "Запланирована",
    color:
      "text-primary bg-primary-light border border-primary/12 dark:text-primary dark:bg-primary/10 dark:border-white/10",
  },
  completed: {
    label: "Завершена",
    color:
      "text-gray-500 bg-gray-100 border border-gray-100 dark:text-slate-400 dark:bg-white/[0.06] dark:border-white/8",
  },
  cancelled: {
    label: "Отменена",
    color:
      "text-red-600 bg-red-50 border border-red-100 dark:text-red-400/95 dark:bg-red-500/10 dark:border-red-500/12",
  },
  rescheduled: {
    label: "Перенесена",
    color:
      "text-amber-700 bg-amber-50 border border-amber-200/50 dark:text-amber-400/85 dark:bg-amber-500/10 dark:border-amber-500/12",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const { toastMessage, toastVisible, toastTone, showToast } = useToast();

  useEffect(() => {
    void initAppointments().then(() => {
      setAppointments(getAppointments());
      setBills(getBills());
    });
  }, []);

  const handleCancel = async (id: string) => {
    await cancelAppointment(id);
    const billRemoved = removeBillByAppointmentId(id);
    setAppointments(getAppointments());
    setBills(getBills());
    showToast(billRemoved ? "Запись отменена, счёт отозван" : "Запись отменена");
  };

  const handleReschedule = (apt: Appointment) => {
    router.push(`/booking?appointmentId=${apt.id}&isRescheduling=true`);
  };

  const filtered = appointments.filter((a) =>
    tab === "upcoming"
      ? a.status === "scheduled" || a.status === "rescheduled" || a.status === "pending"
      : a.status === "completed" || a.status === "cancelled"
  );

  // Build a set of paid appointmentIds for quick lookup
  const paidAppointmentIds = new Set(
    bills
      .filter((b) => b.status === "paid" && b.appointmentId)
      .map((b) => b.appointmentId as string)
  );

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-app-canvas pb-safe transition-colors duration-150">
      <Header title="Мои записи" />

      {/* Tabs */}
      <div className="flex px-5 pt-4 gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex flex-1 min-h-[44px] items-center justify-center rounded-[8px] text-[13px] font-semibold border transition-all duration-150 ease-out active:scale-[0.98] ${
              tab === t
                ? "bg-primary text-white border-primary shadow-[0_2px_10px_rgba(36,139,207,0.28)] dark:shadow-none"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 shadow-raised-surface"
            }`}
          >
            {t === "upcoming" ? "Предстоящие" : "Прошедшие"}
          </button>
        ))}
      </div>

      <main className="px-5 py-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-[15px]">
              {tab === "upcoming"
                ? "У вас пока нет предстоящих записей"
                : "Нет прошедших записей"}
            </p>
          </div>
        ) : (
          filtered.map((apt) => {
            const st =
              STATUS_LABELS[apt.status] ?? {
                label: String(apt.status),
                color: "text-gray-600 bg-gray-100 dark:bg-white/[0.06] dark:text-slate-400 border border-transparent dark:border-white/8",
              };
            const price = resolvePrice(apt);
            const isPast = tab === "past";
            const isPaid = paidAppointmentIds.has(apt.id);
            const isCancelled = apt.status === "cancelled";

            return (
              <Card
                key={apt.id}
                className="bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:bg-slate-900/80 dark:shadow-[0_4px_18px_rgba(0,0,0,0.22)]"
              >
                {/* Row 1: service title + status badge */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white flex-1 leading-snug">
                    {apt.service}
                  </p>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${st.color}`}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Row 2: doctor */}
                <p className="text-[13px] text-gray-500 dark:text-slate-400 mb-2">{apt.doctor}</p>

                {/* Row 3: date + price */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-medium text-primary">
                    {apt.day} {apt.month} {apt.year}, {apt.time}
                  </p>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Paid badge for completed appointments */}
                    {isPast && isPaid && !isCancelled && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-light text-primary dark:bg-primary/12 dark:border dark:border-white/10 dark:text-primary">
                        Оплачено
                      </span>
                    )}
                    {price != null && (
                      <p
                        className={`text-[14px] font-bold ${
                          isPast || isCancelled
                            ? "text-gray-400"
                            : "text-primary"
                        }`}
                      >
                        {formatPrice(price)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons for scheduled */}
                {(apt.status === "scheduled" ||
                  apt.status === "pending" ||
                  apt.status === "rescheduled") && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleReschedule(apt)}
                      className="flex-1 h-9 rounded-[8px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 text-[13px] font-semibold text-primary shadow-raised-surface transition-all duration-150 ease-out active:scale-[0.98]"
                    >
                      Перенести
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(apt.id)}
                      className="flex-1 h-9 rounded-[8px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 text-[13px] font-semibold text-red-500 shadow-raised-surface transition-all duration-150 ease-out active:scale-[0.98]"
                    >
                      Отменить
                    </button>
                  </div>
                )}
              </Card>
            );
          })
        )}

        <button
          type="button"
          onClick={() => router.push("/booking")}
          className="mt-2 w-full h-12 rounded-[12px] bg-primary text-white text-[15px] font-semibold shadow-[0_4px_14px_rgba(36,139,207,0.35)] border border-primary-dark/20 dark:shadow-none transition-all duration-150 ease-out active:scale-[0.98] active:bg-primary-dark"
        >
          + Записаться на приём
        </button>
      </main>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        variant="patientWithTabBar"
        tone={toastTone}
      />
      <BottomBar />
    </div>
  );
}
