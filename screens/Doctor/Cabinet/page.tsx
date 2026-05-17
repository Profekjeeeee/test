"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  logout,
  resolveHydratedSession,
  type DentalSession,
  getDentalClients,
  refreshDentalCaches,
  resolveDentalClientFromCacheSync,
} from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  getAllClinicAppointments,
  refreshAppointmentsCache,
  cancelAppointment,
  rescheduleAppointment,
  CLINIC_TIME_SLOTS,
  RU_MONTHS_SHORT,
  type ClinicAppointment,
} from "@/lib/appointments";
import {
  notifyPatientScheduleCancelledAsync,
  notifyPatientScheduleRescheduledAsync,
} from "@/lib/tgNotifications";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import {
  filterAppointmentsByDoctor,
  isSameCalendarDay,
  sortAppointmentsByTimeAsc,
  appointmentStatusLabelRu,
  formatScheduleHeaderDateStable,
} from "@/lib/doctorSchedule";
import DoctorMonthCalendar from "@/screens/Doctor/Cabinet/DoctorMonthCalendar";
import DoctorOrdinatorskayaChat from "@/screens/Doctor/Cabinet/DoctorOrdinatorskayaChat";
import PatientMedicalSheet from "@/screens/Doctor/Cabinet/PatientMedicalSheet";
import { useClientNow } from "@/hooks/useClientNow";
import { DOCTOR_OPEN_PATIENT_MEDICAL_SHEET_EVENT } from "@/lib/doctorMedicalSheetEvents";

type DoctorCabinetTab = "calendar" | "chats";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function patientShortName(patientId?: string): string {
  if (!patientId) return "Без привязки к карте";
  const c =
    resolveDentalClientFromCacheSync(patientId) ??
    getDentalClients().find((x) => x.id === patientId);
  if (!c) return patientId;
  const ini = c.firstName.trim().charAt(0);
  return `${c.lastName} ${ini ? `${ini}.` : ""}`.trim();
}

function DoctorCabinetSkeleton() {
  return (
    <main
      className="min-h-dvh bg-surface dark:bg-app-canvas pb-[calc(env(safe-area-inset-bottom)+24px)]"
      aria-busy="true"
    >
      <div className="max-w-[480px] mx-auto px-5 pt-12 space-y-4">
        <div className="h-24 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse" />
        <div className="h-[360px] rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse" />
      </div>
    </main>
  );
}

export default function DoctorCabinetPage() {
  const anchor = useClientNow();
  if (!anchor) return <DoctorCabinetSkeleton />;
  return <DoctorCabinetInner anchor={anchor} />;
}

function isAppointmentDoctorEditable(status: ClinicAppointment["status"]): boolean {
  return status === "scheduled" || status === "pending" || status === "rescheduled";
}

function DoctorCabinetInner({ anchor }: { anchor: Date }) {
  const router = useRouter();
  const { toastMessage, toastVisible, showToast } = useToast();
  const [session, setSession] = useState<DentalSession | null>(null);
  const [dataRev, setDataRev] = useState(0);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(anchor));
  const [selectedDate, setSelectedDate] = useState(() => anchor);
  const [sheetOpen, setSheetOpen] = useState<{
    patientId: string;
    appointment?: ClinicAppointment;
  } | null>(null);
  const [agendaActionId, setAgendaActionId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<ClinicAppointment | null>(null);
  const [rescheduleIso, setRescheduleIso] = useState("");
  const [rescheduleTimePick, setRescheduleTimePick] = useState("");
  const [cabinetTab, setCabinetTab] = useState<DoctorCabinetTab>("calendar");

  useEffect(() => {
    void (async () => {
      await refreshDentalCaches();
      await refreshAppointmentsCache();
      setSession(await resolveHydratedSession());
    })();
  }, []);

  useEffect(() => {
    const bump = () => setDataRev((x) => x + 1);
    window.addEventListener("appointmentsUpdated", bump);
    window.addEventListener("dentalClientsUpdated", bump);
    return () => {
      window.removeEventListener("appointmentsUpdated", bump);
      window.removeEventListener("dentalClientsUpdated", bump);
    };
  }, []);

  useEffect(() => {
    const openSheet = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string" && id.trim()) {
        setSheetOpen({ patientId: id.trim() });
      }
    };
    window.addEventListener(DOCTOR_OPEN_PATIENT_MEDICAL_SHEET_EVENT, openSheet);
    return () => window.removeEventListener(DOCTOR_OPEN_PATIENT_MEDICAL_SHEET_EVENT, openSheet);
  }, []);

  const doctorName = session?.fullName?.trim() ?? "";

  const doctorAppointments = useMemo(() => {
    const clinic = getAllClinicAppointments();
    if (!doctorName) return [];
    return filterAppointmentsByDoctor(clinic, doctorName);
  }, [doctorName, dataRev]);

  const daysWithDots = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const set = new Set<number>();
    doctorAppointments.forEach((a) => {
      if (a.year === y && a.monthNum === m + 1) set.add(a.day);
    });
    return set;
  }, [doctorAppointments, viewMonth]);

  const dayAgenda = useMemo(() => {
    return doctorAppointments
      .filter((a) => isSameCalendarDay(a, selectedDate))
      .sort(sortAppointmentsByTimeAsc);
  }, [doctorAppointments, selectedDate]);

  const handleSelectCalendarDay = useCallback(
    (day: number) => {
      setSelectedDate(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    },
    [viewMonth]
  );

  const goPrevMonth = useCallback(() => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goNextMonth = useCallback(() => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.auth);
  };

  const openRescheduleModal = useCallback((a: ClinicAppointment) => {
    setRescheduleTarget(a);
    const iso = `${a.year}-${String(a.monthNum).padStart(2, "0")}-${String(a.day).padStart(2, "0")}`;
    setRescheduleIso(iso);
    setRescheduleTimePick(a.time);
  }, []);

  const closeRescheduleModal = useCallback(() => {
    setRescheduleTarget(null);
  }, []);

  const confirmReschedule = useCallback(async () => {
    if (!rescheduleTarget) return;
    const a = rescheduleTarget;
    const parts = rescheduleIso.split("-").map((x) => parseInt(x, 10));
    const year = parts[0];
    const monthNum = parts[1];
    const day = parts[2];
    if (!year || !monthNum || !day || Number.isNaN(year) || Number.isNaN(monthNum) || Number.isNaN(day)) {
      showToast("Выберите корректную дату");
      return;
    }
    setAgendaActionId(a.id);
    try {
      await rescheduleAppointment(a.id, {
        day,
        monthNum,
        month: RU_MONTHS_SHORT[monthNum - 1] ?? "",
        year,
        time: rescheduleTimePick,
      });
      closeRescheduleModal();
      showToast("Время приёма обновлено");
      const fresh = getAllClinicAppointments().find((x) => x.id === a.id);
      if (fresh && a.patientId) {
        notifyPatientScheduleRescheduledAsync({
          patientClientId: a.patientId,
          doctorName: doctorName || a.doctor,
          appointment: fresh,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      alert(msg);
    } finally {
      setAgendaActionId(null);
    }
  }, [
    rescheduleTarget,
    rescheduleIso,
    rescheduleTimePick,
    closeRescheduleModal,
    showToast,
    doctorName,
  ]);

  const handleDoctorCancel = useCallback(
    async (a: ClinicAppointment) => {
      if (!a.patientId) {
        showToast("Нет привязки к карте пациента");
        return;
      }
      if (!window.confirm("Отменить этот приём? Пациент получит уведомление в Telegram (если есть telegram_id).")) {
        return;
      }
      setAgendaActionId(a.id);
      try {
        await cancelAppointment(a.id);
        showToast("Запись отменена");
        notifyPatientScheduleCancelledAsync({
          patientClientId: a.patientId,
          doctorName: doctorName || a.doctor,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка";
        alert(msg);
      } finally {
        setAgendaActionId(null);
      }
    },
    [doctorName, showToast]
  );

  const todayStr = formatScheduleHeaderDateStable(anchor);
  const selectedStr = formatScheduleHeaderDateStable(selectedDate);

  return (
    <main
      className="min-h-dvh bg-surface dark:bg-app-canvas pb-[calc(env(safe-area-inset-bottom)+24px)] flex flex-col"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="max-w-[480px] mx-auto px-5 pt-12 w-full flex flex-col flex-1 min-h-0">
        <header className="flex items-start justify-between gap-3 mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-secondary mb-1">
              Личный кабинет врача
            </p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white leading-tight">
              {session?.fullName ?? "Врач"}
            </h1>
            {session?.specialization ? (
              <p className="text-[14px] text-secondary mt-1">{session.specialization}</p>
            ) : null}
            <p className="text-[13px] text-secondary mt-3 leading-snug">{todayStr}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={ROUTES.doctorMessages}
              className="interactive-press-sm w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-primary flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
              title="Сообщения пациентов"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 14V18L8 14H18C18.5523 14 19 13.5523 19 13V7C19 6.44772 18.5523 6 18 6H6C5.44772 6 5 6.44772 5 7V14H4Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M8 10H14M8 12.5H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="interactive-press-sm w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-secondary flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
            title="Выйти"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M16 17L21 12M21 12L16 7M21 12H9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="Разделы кабинета"
          className="flex rounded-2xl p-1 mb-5 bg-primary-light/90 dark:bg-slate-800/90 border border-primary/20 dark:border-primary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-none"
        >
          <button
            type="button"
            role="tab"
            aria-selected={cabinetTab === "calendar"}
            id="doctor-tab-calendar"
            onClick={() => setCabinetTab("calendar")}
            className={`flex-1 h-10 rounded-xl text-[14px] font-semibold transition-colors ${
              cabinetTab === "calendar"
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(36,139,207,0.35)]"
                : "text-secondary dark:text-slate-400 bg-transparent"
            }`}
          >
            Календарь
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cabinetTab === "chats"}
            id="doctor-tab-chats"
            onClick={() => setCabinetTab("chats")}
            className={`flex-1 h-10 rounded-xl text-[14px] font-semibold transition-colors ${
              cabinetTab === "chats"
                ? "bg-primary text-white shadow-[0_4px_12px_rgba(36,139,207,0.35)]"
                : "text-secondary dark:text-slate-400 bg-transparent"
            }`}
          >
            Чаты
          </button>
        </div>

        {cabinetTab === "calendar" ? (
          <>
            <DoctorMonthCalendar
              viewMonth={viewMonth}
              selectedDate={selectedDate}
              clientNow={anchor}
              daysWithAppointments={daysWithDots}
              onSelectDay={handleSelectCalendarDay}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
            />

            <div className="mt-6 mb-4 flex items-baseline justify-between gap-2">
              <h2 className="text-[16px] font-bold text-[#0F172A] dark:text-white">План на день</h2>
              <p className="text-[12px] text-secondary text-right leading-tight">{selectedStr}</p>
            </div>

            <div className="flex flex-col gap-2 pb-8">
              {dayAgenda.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-slate-700 px-4 py-8 text-center">
                  <p className="text-[14px] text-secondary">На выбранную дату нет записей к этому врачу.</p>
                  <p className="text-[12px] text-secondary mt-2 opacity-80">
                    Новые приёмы синхронизируются через Supabase — видны и в браузере, и в Telegram Mini App.
                  </p>
                </div>
              ) : (
                dayAgenda.map((a: ClinicAppointment) => {
                  const disabled = !a.patientId;
                  const busy = agendaActionId === a.id;
                  const canEdit = Boolean(a.patientId && isAppointmentDoctorEditable(a.status));
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)]"
                    >
                      <button
                        type="button"
                        disabled={disabled || busy}
                        onClick={() => a.patientId && setSheetOpen({ patientId: a.patientId, appointment: a })}
                        className={`text-left w-full transition-all duration-150 ease-out ${
                          disabled ? "opacity-60 cursor-not-allowed" : "active:scale-[0.99]"
                        }`}
                      >
                        <div className="flex justify-between gap-2 items-start">
                          <span className="text-[18px] font-bold text-primary tabular-nums shrink-0">{a.time}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-[#F1F5F9] dark:bg-slate-800 text-secondary shrink-0">
                            {appointmentStatusLabelRu(a.status)}
                          </span>
                        </div>
                        <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white mt-1">
                          {patientShortName(a.patientId)}
                        </p>
                        <p className="text-[13px] text-secondary mt-1 leading-snug">{a.service}</p>
                        {!a.patientId && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                            Запись без patientId — карта недоступна. Новые записи из ЛК пациента содержат ID.
                          </p>
                        )}
                      </button>
                      {busy && (
                        <p className="text-[11px] font-semibold text-primary mt-2">Отправка в базу…</p>
                      )}
                      {canEdit && !busy && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => openRescheduleModal(a)}
                            className="flex-1 h-9 rounded-[10px] text-[12px] font-semibold border border-primary/30 bg-primary-light text-primary active:scale-[0.98]"
                          >
                            Перенести
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDoctorCancel(a)}
                            className="flex-1 h-9 rounded-[10px] text-[12px] font-semibold border border-slate-200 dark:border-slate-600 text-secondary active:scale-[0.98]"
                          >
                            Отменить
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 pb-8">
            <DoctorOrdinatorskayaChat session={session} showToast={showToast} />
          </div>
        )}
      </div>

      {sheetOpen && (
        <PatientMedicalSheet
          key={sheetOpen.patientId}
          patientId={sheetOpen.patientId}
          contextAppointment={sheetOpen.appointment ?? null}
          onClose={() => setSheetOpen(null)}
        />
      )}

      {rescheduleTarget && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-4 bg-black/45 backdrop-blur-[2px]">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0"
            aria-label="Закрыть"
            onClick={closeRescheduleModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-[1] w-full max-w-[400px] rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Перенос приёма</p>
            <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white mb-4">
              {patientShortName(rescheduleTarget.patientId)} · {rescheduleTarget.service}
            </p>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-secondary mb-1.5">Дата</label>
            <input
              type="date"
              value={rescheduleIso}
              onChange={(e) => setRescheduleIso(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[14px] mb-4"
            />
            <label className="block text-[11px] font-bold uppercase tracking-wider text-secondary mb-1.5">Время</label>
            <select
              value={rescheduleTimePick}
              onChange={(e) => setRescheduleTimePick(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-[14px] mb-5"
            >
              {CLINIC_TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeRescheduleModal}
                className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-[14px] font-semibold text-secondary"
              >
                Закрыть
              </button>
              <button
                type="button"
                disabled={!!agendaActionId}
                onClick={() => void confirmReschedule()}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-[14px] font-semibold shadow-[0_4px_14px_rgba(36,139,207,0.35)] disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} visible={toastVisible} />
    </main>
  );
}
