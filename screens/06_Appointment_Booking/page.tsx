"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import {
  getAppointments,
  addAppointment,
  rescheduleAppointment,
  refreshAppointmentsCache,
  resolveClientPhoneForAppointment,
  type Appointment,
} from "@/lib/appointments";
import {
  notifyDoctorNewBookingAsync,
  resolveCurrentClientDisplayName,
} from "@/lib/tgNotifications";
import { addBillForAppointment } from "@/lib/bills";
import { ROUTES } from "@/lib/routes";
import { useClientNow } from "@/hooks/useClientNow";
import { formatRuMonthYearTitleFromDate } from "@/lib/doctorSchedule";
import { tgHapticSelection } from "@/lib/telegramHaptic";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStep = "category" | "doctor" | "service" | "date" | "confirm";

export type ServiceCategory =
  | "Терапия"
  | "Хирургия"
  | "Профилактика"
  | "Ортодонтия"
  | "Имплантация";

export interface DoctorMock {
  id: string;
  name: string;
  speciality: string;
  category: ServiceCategory;
  experience: string;
}

export interface ServiceMock {
  id: string;
  title: string;
  category: ServiceCategory;
  price: number;
  durationMin: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CATEGORIES: ServiceCategory[] = [
  "Терапия",
  "Хирургия",
  "Профилактика",
  "Ортодонтия",
  "Имплантация",
];

const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  Терапия: "🦷",
  Хирургия: "🔬",
  Профилактика: "✨",
  Ортодонтия: "😁",
  Имплантация: "🔩",
};

const DOCTORS_MOCK: DoctorMock[] = [
  // Терапия
  {
    id: "d1",
    name: "Михайлова А.В.",
    speciality: "Терапевт",
    category: "Терапия",
    experience: "12 лет",
  },
  {
    id: "d2",
    name: "Соколов Д.И.",
    speciality: "Терапевт",
    category: "Терапия",
    experience: "8 лет",
  },
  // Хирургия
  {
    id: "d3",
    name: "Петрова Н.К.",
    speciality: "Хирург",
    category: "Хирургия",
    experience: "15 лет",
  },
  {
    id: "d4",
    name: "Зайцев В.А.",
    speciality: "Хирург",
    category: "Хирургия",
    experience: "9 лет",
  },
  // Профилактика
  {
    id: "d5",
    name: "Иванов С.П.",
    speciality: "Гигиенист",
    category: "Профилактика",
    experience: "6 лет",
  },
  {
    id: "d6",
    name: "Орлова Е.М.",
    speciality: "Гигиенист",
    category: "Профилактика",
    experience: "10 лет",
  },
  // Ортодонтия
  {
    id: "d7",
    name: "Борисов К.Л.",
    speciality: "Ортодонт",
    category: "Ортодонтия",
    experience: "11 лет",
  },
  {
    id: "d8",
    name: "Сидорова Ю.В.",
    speciality: "Ортодонт",
    category: "Ортодонтия",
    experience: "7 лет",
  },
  // Имплантация
  {
    id: "d9",
    name: "Громов А.Н.",
    speciality: "Имплантолог",
    category: "Имплантация",
    experience: "14 лет",
  },
  {
    id: "d10",
    name: "Власова Т.С.",
    speciality: "Имплантолог",
    category: "Имплантация",
    experience: "5 лет",
  },
];

const SERVICES_MOCK: ServiceMock[] = [
  // Терапия
  {
    id: "s1",
    title: "Лечение кариеса",
    category: "Терапия",
    price: 7950,
    durationMin: 60,
  },
  {
    id: "s2",
    title: "Пломбирование канала",
    category: "Терапия",
    price: 5500,
    durationMin: 60,
  },
  {
    id: "s3",
    title: "Консультация терапевта",
    category: "Терапия",
    price: 1500,
    durationMin: 30,
  },
  {
    id: "s4",
    title: "Эндодонтическое лечение",
    category: "Терапия",
    price: 12000,
    durationMin: 90,
  },
  // Хирургия
  {
    id: "s5",
    title: "Удаление зуба",
    category: "Хирургия",
    price: 3500,
    durationMin: 30,
  },
  {
    id: "s6",
    title: "Резекция верхушки корня",
    category: "Хирургия",
    price: 8500,
    durationMin: 60,
  },
  {
    id: "s7",
    title: "Удаление ретинированного зуба",
    category: "Хирургия",
    price: 6500,
    durationMin: 60,
  },
  {
    id: "s8",
    title: "Вскрытие абсцесса",
    category: "Хирургия",
    price: 4000,
    durationMin: 30,
  },
  // Профилактика
  {
    id: "s9",
    title: "Профессиональная гигиена",
    category: "Профилактика",
    price: 4500,
    durationMin: 60,
  },
  {
    id: "s10",
    title: "Снятие зубного камня",
    category: "Профилактика",
    price: 3000,
    durationMin: 45,
  },
  {
    id: "s11",
    title: "Профессиональное отбеливание",
    category: "Профилактика",
    price: 12000,
    durationMin: 90,
  },
  {
    id: "s12",
    title: "Фторирование зубов",
    category: "Профилактика",
    price: 2000,
    durationMin: 30,
  },
  // Ортодонтия
  {
    id: "s13",
    title: "Установка брекет-системы",
    category: "Ортодонтия",
    price: 45000,
    durationMin: 120,
  },
  {
    id: "s14",
    title: "Консультация ортодонта",
    category: "Ортодонтия",
    price: 2000,
    durationMin: 30,
  },
  {
    id: "s15",
    title: "Коррекция брекет-системы",
    category: "Ортодонтия",
    price: 2500,
    durationMin: 30,
  },
  {
    id: "s16",
    title: "Изготовление ретейнера",
    category: "Ортодонтия",
    price: 8000,
    durationMin: 60,
  },
  // Имплантация
  {
    id: "s17",
    title: "Установка импланта",
    category: "Имплантация",
    price: 50000,
    durationMin: 120,
  },
  {
    id: "s18",
    title: "Консультация имплантолога",
    category: "Имплантация",
    price: 2000,
    durationMin: 30,
  },
  {
    id: "s19",
    title: "Установка коронки на имплант",
    category: "Имплантация",
    price: 25000,
    durationMin: 90,
  },
  {
    id: "s20",
    title: "Костная пластика",
    category: "Имплантация",
    price: 35000,
    durationMin: 120,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEPS: { id: BookingStep; label: string }[] = [
  { id: "category", label: "Категория" },
  { id: "doctor", label: "Врач" },
  { id: "service", label: "Услуга" },
  { id: "date", label: "Дата" },
  { id: "confirm", label: "Итог" },
];

const BUSY_SLOTS = new Set(["09:30", "11:00", "14:30"]);

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

function formatPrice(price: number): string {
  const n = Math.max(0, Math.round(price));
  const raw = String(n);
  const parts: string[] = [];
  let i = raw.length;
  while (i > 0) {
    const start = Math.max(0, i - 3);
    parts.unshift(raw.slice(start, i));
    i = start;
  }
  return `${parts.join(" ")} ₽`;
}

const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type PickedDate = { year: number; month: number; day: number };

function monthMatrix(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  const mondayOffset = (dow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isSamePickedDate(a: PickedDate | null, year: number, month: number, day: number): boolean {
  return a?.year === year && a?.month === month && a?.day === day;
}

function isPastCalendarDay(year: number, month: number, day: number, now: Date): boolean {
  const cell = new Date(year, month, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return cell < today;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ currentIdx }: { currentIdx: number }) {
  return (
    <div className="px-5 pt-4 pb-1">
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-200 ${
                  i < currentIdx
                    ? "bg-primary text-white"
                    : i === currentIdx
                    ? "bg-primary text-white ring-2 ring-primary/20"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500"
                }`}
              >
                {i < currentIdx ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-primary">
                    <path
                      d="M2 5l2.5 2.5L8 3"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <p
                className={`text-[9px] font-medium leading-none whitespace-nowrap ${
                  i === currentIdx ? "text-primary" : "text-gray-400"
                }`}
              >
                {s.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-[1.5px] mx-1.5 mb-3.5 rounded transition-colors duration-300 ${
                  i < currentIdx ? "bg-primary" : "bg-gray-200 dark:bg-slate-600"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Animated Step Wrapper ────────────────────────────────────────────────────

function StepPane({
  children,
  stepKey,
}: {
  children: React.ReactNode;
  stepKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateX(18px)";
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.22s ease, transform 0.22s ease";
      el.style.opacity = "1";
      el.style.transform = "translateX(0)";
    });
  }, [stepKey]);

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {children}
    </div>
  );
}

// ─── Default reschedule appointment ──────────────────────────────────────────

const MONTHS_GENITIVE = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря",
];

function formatSuccessSubtitle(day: number, monthNum: number, time: string): string {
  const month = MONTHS_GENITIVE[monthNum - 1] ?? "";
  return `${day} ${month} в ${time}`;
}

/** Демо-слот без `new Date()`: SSR и браузер отдают одну и ту же разметку. */
function makeDefaultCurrent(): Appointment {
  const monthIdx = 4;
  return {
    id: "1",
    day: 9,
    monthNum: monthIdx + 1,
    month: MONTHS_GENITIVE[monthIdx] ?? "",
    year: 2026,
    time: "10:30",
    doctor: "Михайлова А.В.",
    specialty: "Терапевт",
    service: "Терапия. Лечение кариеса",
    cabinet: "№ 5",
    status: "scheduled",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-surface dark:bg-app-canvas" />}>
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const isRescheduling = searchParams.get("isRescheduling") === "true";
  const appointmentId = searchParams.get("appointmentId");

  const [step, setStep] = useState<BookingStep>(
    isRescheduling ? "date" : "category"
  );
  const [currentAppointment, setCurrentAppointment] =
    useState<Appointment>(makeDefaultCurrent);

  const [selectedCategory, setSelectedCategory] =
    useState<ServiceCategory | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<PickedDate | null>(null);
  const [viewMonth, setViewMonth] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    kind: "new" | "reschedule";
    subtitle: string;
  } | null>(null);
  const [successModalEntered, setSuccessModalEntered] = useState(false);
  const { toastMessage, toastVisible, toastTone, showToast } = useToast();

  const clientClock = useClientNow();

  const currentIdx = STEPS.findIndex((s) => s.id === step);
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  const filteredDoctors = useMemo(
    () =>
      selectedCategory
        ? DOCTORS_MOCK.filter((d) => d.category === selectedCategory)
        : [],
    [selectedCategory]
  );

  const filteredServices = useMemo(
    () =>
      selectedCategory
        ? SERVICES_MOCK.filter((s) => s.category === selectedCategory)
        : [],
    [selectedCategory]
  );

  const selectedDoctor = DOCTORS_MOCK.find((d) => d.id === selectedDoctorId);
  const selectedService = SERVICES_MOCK.find((s) => s.id === selectedServiceId);

  // Load rescheduling appointment
  useEffect(() => {
    if (isRescheduling && appointmentId) {
      void refreshAppointmentsCache().then(() => {
        const all = getAppointments();
        const found = all.find((a) => a.id === appointmentId);
        if (found) {
          setCurrentAppointment(found);
          setSelectedDate({
            year: found.year,
            month: found.monthNum - 1,
            day: found.day,
          });
          setViewMonth(new Date(found.year, found.monthNum - 1, 1));
        }
      });
    }
  }, [isRescheduling, appointmentId]);

  useEffect(() => {
    if (clientClock && viewMonth === null) {
      setViewMonth(new Date(clientClock.getFullYear(), clientClock.getMonth(), 1));
    }
  }, [clientClock, viewMonth]);

  useEffect(() => {
    if (!successModal) {
      setSuccessModalEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setSuccessModalEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [successModal]);

  const handleBack = () => {
    if (isRescheduling || currentIdx === 0) {
      router.back();
      return;
    }
    setStep(STEPS[currentIdx - 1].id);
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    setLoading(true);

    const clientPhone = resolveClientPhoneForAppointment();
    if (!clientPhone) {
      setLoading(false);
      showToast(
        "Не удалось определить аккаунт. Пожалуйста, перезайдите в приложение.",
        "error"
      );
      return;
    }

    const monthNum = selectedDate.month + 1;
    const monthName = MONTHS_SHORT[selectedDate.month];
    const year = selectedDate.year;

    const daySnap = selectedDate.day;
    const timeSnap = selectedTime;

    try {
      if (isRescheduling && appointmentId) {
        await rescheduleAppointment(appointmentId, {
          day: daySnap,
          monthNum,
          month: monthName,
          year,
          time: timeSnap,
        });
        await refreshAppointmentsCache();
        const all = getAppointments();
        const updated = all.find((a) => a.id === appointmentId);
        if (updated) setCurrentAppointment(updated);
        setSelectedDate(null);
        setSelectedTime(null);
        setStep("date");
      } else {
        const serviceTitle = selectedService
          ? selectedService.title
          : `${selectedCategory ?? "Консультация"}`;
        const price = selectedService?.price ?? 0;

        const newApt = await addAppointment({
          day: daySnap,
          monthNum,
          year,
          time: timeSnap,
          doctorName: selectedDoctor?.name ?? "Врач не выбран",
          clientPhone,
        });

        addBillForAppointment(newApt.id, serviceTitle, price);

        notifyDoctorNewBookingAsync({
          bookingDoctorId: selectedDoctorId,
          clientName: resolveCurrentClientDisplayName(),
          appointment: newApt,
        });

        setSelectedCategory(null);
        setSelectedDoctorId(null);
        setSelectedServiceId(null);
        setSelectedDate(null);
        setSelectedTime(null);
        setStep("category");
      }

      setSuccessModal({
        kind: isRescheduling ? "reschedule" : "new",
        subtitle: formatSuccessSubtitle(daySnap, monthNum, timeSnap),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast("Ошибка записи: " + message, "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmDate =
    selectedDate && selectedTime
      ? `${selectedDate.day} ${MONTHS_SHORT[selectedDate.month]} ${selectedDate.year}, ${selectedTime}`
      : selectedDate
      ? `${selectedDate.day} ${MONTHS_SHORT[selectedDate.month]} — выберите время`
      : "Не выбрано";

  const canGoPrevMonth =
    viewMonth &&
    clientClock &&
    (viewMonth.getFullYear() > clientClock.getFullYear() ||
      (viewMonth.getFullYear() === clientClock.getFullYear() &&
        viewMonth.getMonth() > clientClock.getMonth()));

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-app-canvas pb-safe transition-colors duration-150">
      <Header
        title={isRescheduling ? "Перенос записи" : "Запись на приём"}
        showBack
        onBack={handleBack}
      />

      {/* Reschedule banner */}
      {isRescheduling && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-[12px] bg-primary-light border border-primary/20 flex items-center gap-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            className="flex-shrink-0"
          >
            <path
              d="M9 3V9L12.5 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-primary">
              Перенос записи
            </p>
            <p className="text-[12px] text-primary/70">
              {currentAppointment.specialty} — {currentAppointment.doctor} ·{" "}
              {currentAppointment.day} {currentAppointment.month},{" "}
              {currentAppointment.time}
            </p>
          </div>
        </div>
      )}

      {/* Stepper (skip for reschedule) */}
      {!isRescheduling && <Stepper currentIdx={currentIdx} />}

      <main className="px-5 py-4">
        {/* STEP 1 — Category */}
        {step === "category" && (
          <StepPane stepKey="category">
            <p className="text-[17px] font-semibold text-[#0F172A] dark:text-white">
              Выберите направление
            </p>
            {CATEGORIES.map((cat) => (
              <Card
                key={cat}
                bordered
                className={`cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)] transition-all duration-150 ease-out active:scale-[0.98] ${
                  selectedCategory === cat
                    ? "border-primary bg-primary-light"
                    : ""
                }`}
                onClick={() => {
                  setSelectedCategory(cat);
                  // Reset downstream selections on category change
                  setSelectedDoctorId(null);
                  setSelectedServiceId(null);
                  setSelectedDate(null);
                  setSelectedTime(null);
                  setTimeout(() => setStep("doctor"), 120);
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CATEGORY_ICONS[cat]}</span>
                  <p className="text-[15px] font-medium text-[#0F172A] dark:text-white">
                    {cat}
                  </p>
                </div>
              </Card>
            ))}
          </StepPane>
        )}

        {/* STEP 2 — Doctor */}
        {step === "doctor" && (
          <StepPane stepKey="doctor">
            <div>
              <p className="text-[17px] font-semibold text-[#0F172A] dark:text-white">
                Выберите врача
              </p>
              {selectedCategory && (
                <p className="text-[13px] text-gray-400 mt-0.5">
                  {CATEGORY_ICONS[selectedCategory]} {selectedCategory}
                </p>
              )}
            </div>
            {filteredDoctors.map((doc) => (
              <Card
                key={doc.id}
                bordered
                className={`cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)] transition-all duration-150 ease-out active:scale-[0.98] ${
                  selectedDoctorId === doc.id
                    ? "border-primary bg-primary-light"
                    : ""
                }`}
                onClick={() => {
                  setSelectedDoctorId(doc.id);
                  setTimeout(() => setStep("service"), 120);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-light to-primary/20 flex-shrink-0 flex items-center justify-center">
                    <span className="text-[17px] font-bold text-primary">
                      {doc.name[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white truncate">
                      {doc.name}
                    </p>
                    <p className="text-[12px] text-gray-400">
                      {doc.speciality} · {doc.experience} опыта
                    </p>
                  </div>
                  {selectedDoctorId === doc.id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-primary">
                        <path
                          d="M2 5l2.5 2.5L8 3"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </StepPane>
        )}

        {/* STEP 3 — Service */}
        {step === "service" && (
          <StepPane stepKey="service">
            <div>
              <p className="text-[17px] font-semibold text-[#0F172A] dark:text-white">
                Выберите услугу
              </p>
              {selectedDoctor && (
                <p className="text-[13px] text-gray-400 mt-0.5">
                  {selectedDoctor.name}
                </p>
              )}
            </div>
            {filteredServices.map((svc) => (
              <Card
                key={svc.id}
                bordered
                className={`cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)] transition-all duration-150 ease-out active:scale-[0.98] ${
                  selectedServiceId === svc.id
                    ? "border-primary bg-primary-light"
                    : ""
                }`}
                onClick={() => {
                  setSelectedServiceId(svc.id);
                  setTimeout(() => setStep("date"), 120);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white">
                      {svc.title}
                    </p>
                    <p className="text-[12px] text-gray-400 mt-0.5">
                      {svc.durationMin} мин
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[15px] font-bold text-primary">
                      {formatPrice(svc.price)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </StepPane>
        )}

        {/* STEP 4 — Date & Time */}
        {step === "date" && (
          <StepPane stepKey="date">
            <div>
              <p className="text-[17px] font-semibold text-[#0F172A] dark:text-white">
                Дата и время
              </p>
              {!isRescheduling && selectedService && (
                <p className="text-[13px] text-gray-400 mt-0.5">
                  {selectedService.title} · {formatPrice(selectedService.price)}
                </p>
              )}
            </div>

            <Card className="shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)]">
              {clientClock && viewMonth ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      disabled={!canGoPrevMonth}
                      onClick={() =>
                        setViewMonth(
                          new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
                        )
                      }
                      className="interactive-press-sm min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-secondary flex items-center justify-center shadow-raised-surface disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      aria-label="Предыдущий месяц"
                    >
                      ‹
                    </button>
                    <p className="text-[15px] font-semibold dark:text-white">
                      {formatRuMonthYearTitleFromDate(viewMonth)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setViewMonth(
                          new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
                        )
                      }
                      className="interactive-press-sm min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-secondary flex items-center justify-center shadow-raised-surface"
                      aria-label="Следующий месяц"
                    >
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400 mb-2">
                    {WEEKDAYS.map((d) => (
                      <span key={d} className="py-1 font-semibold uppercase tracking-wide">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthMatrix(viewMonth.getFullYear(), viewMonth.getMonth()).map(
                      (day, idx) => {
                        if (day === null) {
                          return <div key={`empty-${idx}`} className="min-h-[44px]" aria-hidden />;
                        }

                        const y = viewMonth.getFullYear();
                        const m = viewMonth.getMonth();
                        const isPast = isPastCalendarDay(y, m, day, clientClock);
                        const isSelected = isSamePickedDate(selectedDate, y, m, day);
                        const isToday =
                          clientClock.getFullYear() === y &&
                          clientClock.getMonth() === m &&
                          clientClock.getDate() === day;

                        return (
                          <button
                            key={`${y}-${m}-${day}`}
                            type="button"
                            disabled={isPast}
                            className={`min-h-[44px] w-full rounded-[4px] text-[13px] font-medium border transition-all duration-150 ease-out disabled:active:scale-100 touch-manipulation ${
                              isSelected
                                ? "bg-primary text-white border-primary shadow-[0_2px_8px_rgba(36,139,207,0.25)] dark:shadow-none active:scale-[0.98]"
                                : isPast
                                  ? "text-gray-300 dark:text-slate-600 cursor-not-allowed border-slate-200/60 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40"
                                  : isToday
                                    ? "border-primary/70 bg-primary-light/50 dark:bg-primary/10 text-[#0F172A] dark:text-slate-200 shadow-raised-surface active:scale-[0.98]"
                                    : "border-slate-200 dark:border-slate-600 hover:bg-primary-light dark:hover:bg-primary/20 text-[#0F172A] dark:text-slate-200 bg-white dark:bg-slate-800 shadow-raised-surface active:scale-[0.98]"
                            }`}
                            onClick={() => {
                              setSelectedDate({ year: y, month: m, day });
                              setSelectedTime(null);
                            }}
                          >
                            {day}
                          </button>
                        );
                      }
                    )}
                  </div>
                </>
              ) : (
                <div className="min-h-[216px] flex items-center justify-center text-[13px] text-secondary" aria-busy>
                  Загрузка календаря…
                </div>
              )}
            </Card>

            {selectedDate !== null && clientClock && (
              <Card className="shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)]">
                <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white mb-3">
                  Доступное время · {selectedDate.day}{" "}
                  {MONTHS_SHORT[selectedDate.month]}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((slot) => {
                    const isBusy = BUSY_SLOTS.has(slot);
                    const isCurrent =
                      isRescheduling &&
                      selectedDate.year === currentAppointment.year &&
                      selectedDate.month === currentAppointment.monthNum - 1 &&
                      selectedDate.day === currentAppointment.day &&
                      slot === currentAppointment.time;
                    const isSelected = selectedTime === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBusy || isCurrent}
                        onClick={() => {
                          tgHapticSelection();
                          setSelectedTime(slot);
                          setTimeout(() => setStep("confirm"), 120);
                        }}
                        className={`
                          min-h-[44px] rounded-[4px] text-[13px] font-semibold border transition-all duration-150 ease-out disabled:active:scale-100 touch-manipulation
                          ${
                            isBusy
                              ? "border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-300 dark:text-slate-600 cursor-not-allowed line-through"
                              : isCurrent
                              ? "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500/80 cursor-not-allowed"
                              : isSelected
                              ? "border-primary bg-primary text-white shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none active:scale-[0.98]"
                              : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-white hover:border-primary hover:text-primary shadow-raised-surface active:scale-[0.98]"
                          }
                        `}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-x-4 gap-y-1.5">
                  {[
                    { cls: "bg-primary", label: "Выбрано" },
                    { cls: "bg-gray-100 dark:bg-slate-600", label: "Занято" },
                    ...(isRescheduling
                      ? [
                          {
                            cls: "bg-amber-50 border border-amber-200",
                            label: "Текущее время",
                          },
                        ]
                      : []),
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded-[2px] ${item.cls}`} />
                      <span className="text-[11px] text-gray-400">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </StepPane>
        )}

        {/* STEP 5 — Confirm */}
        {step === "confirm" && (
          <StepPane stepKey="confirm">
            <p className="text-[17px] font-semibold text-[#0F172A] dark:text-white">
              Подтверждение
            </p>

            <Card className="shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)]">
              <div className="flex flex-col gap-4">
                {isRescheduling ? (
                  <>
                    <ConfirmRow
                      label="Услуга"
                      value={currentAppointment.service}
                    />
                    <ConfirmRow
                      label="Врач"
                      value={currentAppointment.doctor}
                    />
                    <ConfirmRow label="Дата" value={confirmDate} accent />
                    <ConfirmRow
                      label="Кабинет"
                      value={currentAppointment.cabinet}
                    />
                  </>
                ) : (
                  <>
                    <ConfirmRow
                      label="Направление"
                      value={selectedCategory ?? "—"}
                    />
                    <ConfirmRow
                      label="Врач"
                      value={selectedDoctor?.name ?? "—"}
                    />
                    <ConfirmRow
                      label="Услуга"
                      value={selectedService?.title ?? "—"}
                    />
                    <ConfirmRow label="Дата" value={confirmDate} accent />
                    <ConfirmRow label="Кабинет" value="№ 5" />
                    {selectedService && (
                      <>
                        <div className="h-px bg-gray-100 dark:bg-slate-700" />
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-gray-400">
                            К оплате
                          </span>
                          <span className="text-[18px] font-bold text-primary">
                            {formatPrice(selectedService.price)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </Card>

            <button
              className="text-[13px] text-primary font-medium text-center py-1 active:opacity-70 transition-opacity"
              onClick={() => setStep("date")}
            >
              ← Изменить дату и время
            </button>

            <Button
              size="full"
              className="!active:scale-[0.98]"
              disabled={!selectedDate || !selectedTime}
              loading={loading}
              onClick={handleConfirm}
            >
              {loading ? "Сохраняем..." : "Подтвердить запись"}
            </Button>
          </StepPane>
        )}
      </main>

      <BottomBar />

      {successModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center px-4 pt-10 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-success-title"
          aria-describedby="booking-success-desc"
        >
          <button
            type="button"
            className={`absolute inset-0 z-0 border-0 bg-black/45 backdrop-blur-[6px] transition-opacity duration-300 ${
              successModalEntered ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Закрыть"
            onClick={() => {
              setSuccessModal(null);
              router.push(ROUTES.clientHome);
            }}
          />
          <div
            className={`relative z-10 w-full max-w-[390px] rounded-t-[1.75rem] rounded-b-2xl bg-white p-8 pb-7 text-center shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.2)] transition-all duration-300 ease-out ${
              successModalEntered
                ? "translate-y-0 opacity-100"
                : "translate-y-full opacity-0"
            }`}
          >
            <div
              className="mx-auto mb-5 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-primary-light"
              aria-hidden
            >
              <svg
                className="h-9 w-9 text-[#2d6a5d]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M6.5 12.5L10.2 16.5 18 8.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2
              id="booking-success-title"
              className="text-xl font-bold leading-snug text-[#1e293b]"
            >
              {successModal.kind === "reschedule"
                ? "Запись перенесена!"
                : "Запись оформлена!"}
            </h2>
            <p
              id="booking-success-desc"
              className="mt-2 text-base font-normal text-[#64748b]"
            >
              {successModal.subtitle}
            </p>
            <button
              type="button"
              className="mt-8 w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/25 transition-all duration-150 ease-out active:scale-[0.98] active:bg-primary-dark"
              onClick={() => {
                setSuccessModal(null);
                router.push(ROUTES.clientHome);
              }}
            >
              На главную
            </button>
          </div>
        </div>
      )}

      <Toast
        message={toastMessage}
        visible={toastVisible}
        tone={toastTone}
        variant="patientWithTabBar"
      />
    </div>
  );
}

// ─── ConfirmRow helper ────────────────────────────────────────────────────────

function ConfirmRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-[13px] text-gray-400 flex-shrink-0">{label}</span>
      <span
        className={`text-[14px] font-semibold text-right ${
          accent ? "text-primary" : "text-[#0F172A] dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
