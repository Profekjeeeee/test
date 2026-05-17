"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout, getDentalSession, getCurrentUserId, updateClientPersonalProfile } from "@/lib/auth";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";
import { Toast } from "@/components/ui/Toast";
import {
  getProfile,
  saveProfile,
  getNotifications,
  saveNotifications,
  type UserProfile,
  type UserNotifications,
} from "@/lib/userProfile";
import { getNextAppointment, type Appointment } from "@/lib/appointments";
import { ROUTES } from "@/lib/routes";

// ─── Phone formatting ──────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);
  const d = digits.slice(1);
  let result = "+7";
  if (d.length >= 1) result += ` (${d.slice(0, 3)}`;
  if (d.length >= 4) result += `) ${d.slice(3, 6)}`;
  if (d.length >= 7) result += `-${d.slice(6, 8)}`;
  if (d.length >= 9) result += `-${d.slice(8, 10)}`;
  return result;
}

function phoneDigitCount(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

// ─── Validation ────────────────────────────────────────────────────────────────

interface FormErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

const NAME_RE = /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s-]{1,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: UserProfile): FormErrors {
  const errors: FormErrors = {};
  if (!NAME_RE.test(form.firstName.trim())) errors.firstName = "Только буквы, минимум 2 символа";
  if (!NAME_RE.test(form.lastName.trim())) errors.lastName = "Только буквы, минимум 2 символа";
  if (phoneDigitCount(form.phone) !== 11) errors.phone = "Введите номер полностью";
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Некорректный email";
  return errors;
}

// ─── Initials ─────────────────────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string): string {
  return ((firstName.trim()[0] ?? "") + (lastName.trim()[0] ?? "")).toUpperCase() || "?";
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
// Uses div (not button) to avoid Safari's position:absolute-inside-button bug

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex-shrink-0 cursor-pointer"
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        position: "relative",
        backgroundColor: on ? "var(--color-primary)" : "#CBD5E1",
        transition: "background-color 220ms ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
          transform: on ? "translateX(20px)" : "translateX(0px)",
          transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}

function Field({ label, value, onChange, error, type = "text", inputMode, placeholder }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] dark:text-slate-500">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "h-12 px-4 text-[15px] font-medium outline-none transition-all rounded-[8px] border-[1.5px]",
          "placeholder:text-gray-400 dark:placeholder:text-slate-600",
          error
            ? "border-[#EF4444] bg-[#FFF5F5] shadow-[0_0_0_3px_rgba(239,68,68,0.08)] text-[#0F172A] dark:bg-[#3B1212] dark:border-[#EF4444] dark:text-white"
            : "border-[#E2E8F0] bg-[#FAFCFC] text-[#0F172A] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white focus:border-primary dark:focus:border-primary",
        ].join(" ")}
        style={{ fontFamily: "Manrope, sans-serif" }}
      />
      {error && (
        <p className="text-[12px] font-medium text-[#EF4444]" style={{ fontFamily: "Manrope, sans-serif" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Clinic links ─────────────────────────────────────────────────────────────

const CLINIC_LINKS = [
  {
    href: ROUTES.patientSupportChat,
    label: "Поддержка / чат",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary">
        <path d="M4 13V15L7 13H13C13.5523 13 14 12.5523 14 12V6C14 5.44772 13.5523 5 13 5H5C4.44772 5 4 5.44772 4 6V13Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M6 8H12M6 10H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/price-list",
    label: "Прайс-лист",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary">
        <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 6H12M6 9H10M6 12H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/contacts",
    label: "Контакты и адрес",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary">
        <path d="M9 2C6.23858 2 4 4.23858 4 7C4 10.5 9 16 9 16C9 16 14 10.5 14 7C14 4.23858 11.7614 2 9 2Z" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="9" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: "/prevention",
    label: "Рекомендации",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary">
        <path d="M9 2L10.8 6.5L16 7.3L12.5 10.7L13.5 16L9 13.5L4.5 16L5.5 10.7L2 7.3L7.2 6.5L9 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/doctors",
    label: "Наши врачи",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-primary">
        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 16C3 13.2386 5.68629 11 9 11C12.3137 11 15 13.2386 15 16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M12 4H16M14 2V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

// ─── Notification items ────────────────────────────────────────────────────────

const NOTIF_ITEMS: { key: keyof UserNotifications; label: string; sub: string }[] = [
  { key: "push", label: "Push-уведомления", sub: "Записи, напоминания, новости" },
  { key: "sms", label: "СМС-напоминания", sub: "За 24 часа до приёма" },
];

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<UserProfile>({ firstName: "", lastName: "", phone: "", email: "" });
  const [notifs, setNotifs] = useState<UserNotifications>({ push: true, sms: false });
  const [darkTheme, setDarkTheme] = useState(false);

  useEffect(() => {
    try {
      setDarkTheme(localStorage.getItem("theme") === "dark");
    } catch {}
  }, []);
  const [touched, setTouched] = useState<Partial<Record<keyof UserProfile, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [nextApt, setNextApt] = useState<Appointment | null>(null);

  useEffect(() => {
    const profile = getProfile();
    const n = getNotifications();
    setForm(profile);
    setNotifs(n);
    setNextApt(getNextAppointment());
  }, []);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;
  const allTouched = Object.keys(touched).length === 4;

  const setField = useCallback(<K extends keyof UserProfile>(key: K, val: UserProfile[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched((t) => ({ ...t, [key]: true }));
  }, []);

  const handlePhoneChange = useCallback((raw: string) => {
    setField("phone", formatPhone(raw));
  }, [setField]);

  const handleSave = async () => {
    setTouched({ firstName: true, lastName: true, phone: true, email: true });
    if (hasErrors) return;
    const uid = getCurrentUserId();
    const sess = getDentalSession();
    if (!(sess?.role === "client" && uid && sess.id === uid)) return;

    setSaving(true);
    try {
      await updateClientPersonalProfile({
        clientId: uid,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneDigits: form.phone,
      });
      saveProfile(form);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
    } catch (err) {
      console.error("[Profile] сохранение в Supabase:", err);
      const msg =
        err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Не удалось сохранить. Проверьте связь.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif = (key: keyof UserNotifications) => {
    setNotifs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      saveNotifications(updated);
      return updated;
    });
  };

  const handleLogout = () => {
    logout();
    router.replace("/auth");
  };

  const initials = getInitials(form.firstName, form.lastName);
  const saveDisabled = saving || (allTouched && hasErrors);

  return (
    <div className="min-h-dvh bg-surface dark:bg-[#0F172A] pb-safe" style={{ fontFamily: "Manrope, sans-serif" }}>
      <Header title="Профиль" />

      <main className="px-4 py-4 flex flex-col gap-4 pb-28">

        {/* ── Avatar + name ── */}
        <div className="flex items-center gap-4 px-2 py-2">
          <div
            className="w-[68px] h-[68px] rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#e3f2fa] to-[#c7e2f9] dark:from-[#163554] dark:to-[#1e3a5f]"
          >
            <span className="text-[22px] font-bold text-primary">{initials}</span>
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#0F172A] dark:text-white">
              {[form.firstName, form.lastName].filter(Boolean).join(" ") || "Ваш профиль"}
            </p>
            <p className="text-[13px] mt-0.5 text-[#94A3B8]">Пациент с 2023 года</p>
          </div>
        </div>

        {/* ── Personal data ── */}
        <div className="bg-white dark:bg-[#1E293B] rounded-[16px] border border-[#E2E8F0] dark:border-[#334155] px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-4 text-[#94A3B8] dark:text-slate-500">
            Личные данные
          </p>
          <div className="flex flex-col gap-4">
            <Field
              label="Имя"
              value={form.firstName}
              onChange={(v) => setField("firstName", v)}
              error={touched.firstName ? errors.firstName : undefined}
              placeholder="Александр"
            />
            <Field
              label="Фамилия"
              value={form.lastName}
              onChange={(v) => setField("lastName", v)}
              error={touched.lastName ? errors.lastName : undefined}
              placeholder="Коновалов"
            />
            <Field
              label="Телефон"
              value={form.phone}
              onChange={handlePhoneChange}
              error={touched.phone ? errors.phone : undefined}
              type="tel"
              inputMode="tel"
              placeholder="+7 (XXX) XXX-XX-XX"
            />
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => setField("email", v)}
              error={touched.email ? errors.email : undefined}
              type="email"
              inputMode="email"
              placeholder="example@mail.ru"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="mt-5 w-full h-12 rounded-[12px] text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            style={{
              backgroundColor: saveDisabled ? "#E2E8F0" : "var(--color-primary)",
              color: saveDisabled ? "#94A3B8" : "#FFFFFF",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            {saving ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                  <path d="M12 3C12 3 16.5 3 19.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Сохранение...
              </>
            ) : (
              "Сохранить изменения"
            )}
          </button>
        </div>

        {/* ── Doctor ── */}
        <div className="bg-white dark:bg-[#1E293B] rounded-[16px] border border-[#E2E8F0] dark:border-[#334155] px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3 text-[#94A3B8] dark:text-slate-500">
            Лечащий врач
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#e3f2fa] to-[#c7e2f9] dark:from-[#163554] dark:to-[#1e3a5f]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary/80">
                <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3.5 17.5C3.5 14.5 6.5 12 10 12C13.5 12 16.5 14.5 16.5 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#94A3B8] dark:text-slate-400">
                Врач не назначен
              </p>
              <p className="text-[12px] mt-0.5 text-[#CBD5E1] dark:text-slate-600">
                Будет указан после первого приёма
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-[10px] bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] shadow-raised-surface">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="#94A3B8" strokeWidth="1.3" />
              <path d="M5 2V4M11 2V4" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M2 7H14" stroke="#94A3B8" strokeWidth="1.3" />
            </svg>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400">
              {nextApt
                ? <>Следующий приём: <span className="font-semibold text-[#0F172A] dark:text-white">{nextApt.day} {nextApt.month}, {nextApt.time}</span></>
                : <span className="text-gray-400">Нет предстоящих записей</span>
              }
            </p>
          </div>
        </div>

        {/* ── Notifications ── */}
        <div className="bg-white dark:bg-[#1E293B] rounded-[16px] border border-[#E2E8F0] dark:border-[#334155] px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3 text-[#94A3B8] dark:text-slate-500">
            Уведомления
          </p>
          <div className="flex flex-col">
            {NOTIF_ITEMS.map((item, idx) => (
              <div
                key={item.key}
                className={`flex items-center justify-between py-3 ${idx < NOTIF_ITEMS.length - 1 ? "border-b border-[#F1F5F9] dark:border-[#334155]" : ""}`}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[15px] font-medium text-[#0F172A] dark:text-white">{item.label}</p>
                  <p className="text-[12px] mt-0.5 text-[#94A3B8]">{item.sub}</p>
                </div>
                <Toggle on={notifs[item.key]} onToggle={() => toggleNotif(item.key)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Interface ── */}
        <div className="bg-white dark:bg-[#1E293B] rounded-[16px] border border-[#E2E8F0] dark:border-[#334155] px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9ab0c5" }}>
            Интерфейс
          </p>
          <div className="flex items-center justify-between py-3">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[15px] font-medium text-[#0F172A] dark:text-white">Темная тема</p>
              <p className="text-[12px] mt-0.5 text-[#94A3B8]">Снижает нагрузку на глаза в вечернее время</p>
            </div>
            <Toggle on={darkTheme} onToggle={() => {
              const next = !darkTheme;
              setDarkTheme(next);
              window.dispatchEvent(new CustomEvent("themeChange", { detail: { dark: next } }));
            }} />
          </div>
        </div>

        {/* ── Clinic ── */}
        <div className="bg-white dark:bg-[#1E293B] rounded-[16px] border border-[#E2E8F0] dark:border-[#334155] px-4 py-2">
          <p className="text-[11px] font-bold uppercase tracking-widest pt-3 pb-2 text-[#94A3B8] dark:text-slate-500">
            Клиника
          </p>
          {CLINIC_LINKS.map((item, idx) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 py-3 active:opacity-70 transition-opacity ${idx < CLINIC_LINKS.length - 1 ? "border-b border-[#F1F5F9] dark:border-[#334155]" : ""}`}
            >
              <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 bg-primary-light dark:bg-[#163554]">
                {item.icon}
              </div>
              <span className="flex-1 text-[15px] font-medium text-[#0F172A] dark:text-white">{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="text-[14px] font-semibold text-center py-2 text-[#EF4444] active:opacity-50 transition-opacity"
        >
          Выйти из аккаунта
        </button>

      </main>

      <BottomBar />
      <Toast message="✓ Данные успешно обновлены" visible={toastVisible} />
    </div>
  );
}
