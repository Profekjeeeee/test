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
} from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  getAllClinicAppointments,
  refreshAppointmentsCache,
  type ClinicAppointment,
} from "@/lib/appointments";
import {
  filterAppointmentsByDoctor,
  isSameCalendarDay,
  sortAppointmentsByTimeAsc,
  appointmentStatusLabelRu,
  formatScheduleHeaderDate,
} from "@/lib/doctorSchedule";
import DoctorMonthCalendar from "@/screens/Doctor/Cabinet/DoctorMonthCalendar";
import PatientMedicalSheet from "@/screens/Doctor/Cabinet/PatientMedicalSheet";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function patientShortName(patientId?: string): string {
  if (!patientId) return "Без привязки к карте";
  const c = getDentalClients().find((x) => x.id === patientId);
  if (!c) return patientId;
  const ini = c.firstName.trim().charAt(0);
  return `${c.lastName} ${ini ? `${ini}.` : ""}`.trim();
}

export default function DoctorCabinetPage() {
  const router = useRouter();
  const [session, setSession] = useState<DentalSession | null>(null);
  const [dataRev, setDataRev] = useState(0);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [sheetPatientId, setSheetPatientId] = useState<string | null>(null);

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

  const todayStr = formatScheduleHeaderDate(new Date());
  const selectedStr = formatScheduleHeaderDate(selectedDate);

  return (
    <main
      className="min-h-dvh bg-[#F8FAFB] dark:bg-slate-950 pb-[calc(env(safe-area-inset-bottom)+24px)]"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="max-w-[480px] mx-auto px-5 pt-12">
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
              className="w-10 h-10 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 text-primary flex items-center justify-center active:scale-95 transition-transform"
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
            className="w-10 h-10 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 text-secondary flex items-center justify-center active:scale-95 transition-transform shrink-0"
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

        <DoctorMonthCalendar
          viewMonth={viewMonth}
          selectedDate={selectedDate}
          daysWithAppointments={daysWithDots}
          onSelectDay={handleSelectCalendarDay}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
        />

        <div className="mt-5 mb-3 flex items-baseline justify-between gap-2">
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
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => a.patientId && setSheetPatientId(a.patientId)}
                  className={`text-left rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 transition-transform active:scale-[0.98] ${
                    disabled ? "opacity-60 cursor-not-allowed" : "active:scale-95"
                  }`}
                >
                  <div className="flex justify-between gap-2 items-start">
                    <span className="text-[18px] font-bold text-[#A1D6D7] tabular-nums shrink-0">{a.time}</span>
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
              );
            })
          )}
        </div>
      </div>

      {sheetPatientId && (
        <PatientMedicalSheet patientId={sheetPatientId} onClose={() => setSheetPatientId(null)} />
      )}
    </main>
  );
}
