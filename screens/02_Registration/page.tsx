"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUser, setCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { FormulaToothIcon } from "@/components/icons/FormulaToothIcon";
import { saveProfile } from "@/lib/userProfile";
import { formatRuPhoneInput, isCompleteRuMobileDigits, normalizePhone } from "@/lib/phone";

const NAME_RE = /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s-]{1,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ключ совпадает с `screens/02_Auth/page.tsx`; хранится до успешной регистрации. */
const AUTH_PHONE_STORAGE_KEY = "auth_phone";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!NAME_RE.test(form.firstName.trim())) errors.firstName = "Только буквы, минимум 2 символа";
  if (!NAME_RE.test(form.lastName.trim())) errors.lastName = "Только буквы, минимум 2 символа";
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Некорректный email";
  return errors;
}

export default function RegistrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get("phone") ?? "";

  /** Номер из query или из `auth_phone` (пока не очищен на шаге успешной регистрации). */
  const [savedPhone, setSavedPhone] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ firstName: "", lastName: "", email: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let stored = "";
    try {
      stored = localStorage.getItem(AUTH_PHONE_STORAGE_KEY) ?? "";
    } catch {
      /* noop */
    }
    const normalized = normalizePhone(phoneParam || stored);
    if (!isCompleteRuMobileDigits(normalized)) {
      router.replace(ROUTES.auth);
      return;
    }
    setSavedPhone(normalized);
  }, [phoneParam, router]);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  const setField = <K extends keyof FormState>(key: K, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const handleSubmit = async () => {
    setTouched({ firstName: true, lastName: true, email: true });
    if (hasErrors) return;
    const phoneForDb = savedPhone ?? "";
    if (!phoneForDb) {
      setTouched({ firstName: true, lastName: true, email: true });
      router.replace(ROUTES.auth);
      return;
    }

    setSaving(true);
    try {
      // insert в dental_clients делает createUser: { phone, name, role: 'client' }
      const user = await createUser(phoneForDb, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      });

      await setCurrentUser(user.id);

      saveProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: phoneForDb,
        email: form.email.trim(),
      });

      router.replace(ROUTES.clientHome);

      try {
        localStorage.removeItem(AUTH_PHONE_STORAGE_KEY);
        console.log("[AUTH] очищен auth_phone после регистрации");
      } catch {
        /* noop */
      }
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : String(err);
      alert(`Ошибка базы данных: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled =
    saving ||
    savedPhone === null ||
    (Object.keys(touched).length === 3 && hasErrors);

  return (
    <main
      className="min-h-dvh bg-surface dark:bg-app-canvas flex flex-col justify-center px-6 pb-8"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="mb-8">
        <div className="flex justify-center mb-6">
          <FormulaToothIcon
            variant="outline"
            className="w-[4.75rem] h-[4.75rem] text-primary shrink-0"
          />
        </div>
        <h1 className="text-[28px] font-bold text-[#0F172A] dark:text-white leading-tight tracking-tight">
          Регистрация
        </h1>
        <p className="text-[15px] text-gray-500 dark:text-slate-500 mt-2 leading-relaxed">
          Вы новый пациент. Заполните данные для создания личного кабинета.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Phone (readonly) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] dark:text-slate-400">
            Телефон
          </label>
          <input
            type="tel"
            value={formatRuPhoneInput(savedPhone ?? "")}
            readOnly
            className="h-12 px-4 text-[15px] font-medium rounded-[8px] border-[1.5px] border-[#E2E8F0] bg-[#F1F5F9] text-[#94A3B8] dark:bg-[#1E293B] dark:border-[#334155] dark:text-slate-500 cursor-not-allowed outline-none"
            style={{ fontFamily: "Manrope, sans-serif" }}
          />
        </div>

        {/* First name */}
        <RegistrationField
          label="Имя"
          value={form.firstName}
          onChange={(v) => setField("firstName", v)}
          error={touched.firstName ? errors.firstName : undefined}
          placeholder="Александр"
        />

        {/* Last name */}
        <RegistrationField
          label="Фамилия"
          value={form.lastName}
          onChange={(v) => setField("lastName", v)}
          error={touched.lastName ? errors.lastName : undefined}
          placeholder="Коновалов"
        />

        {/* Email */}
        <RegistrationField
          label="Email"
          value={form.email}
          onChange={(v) => setField("email", v)}
          error={touched.email ? errors.email : undefined}
          placeholder="example@mail.ru"
          type="email"
          inputMode="email"
        />

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saveDisabled}
          className="mt-2 w-full h-12 rounded-[12px] text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
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
              Создаём профиль...
            </>
          ) : (
            "Создать профиль"
          )}
        </button>

        <button
          type="button"
          onClick={() => router.push(ROUTES.auth)}
          className="mt-4 w-full min-h-[44px] py-3 px-4 flex items-center justify-center text-[15px] font-semibold text-primary active:scale-95 transition-transform rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 hover:bg-primary-light dark:hover:bg-slate-700"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Назад к входу
        </button>
      </div>
    </main>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

function RegistrationField({ label, value, onChange, error, placeholder, type = "text", inputMode }: FieldProps) {
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
            ? "border-[#EF4444] bg-[#FFF5F5] text-[#0F172A] dark:bg-[#3B1212] dark:border-[#EF4444] dark:text-white"
            : "border-[#E2E8F0] bg-[#FAFCFC] text-[#0F172A] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white focus:border-primary dark:focus:border-primary",
        ].join(" ")}
        style={{ fontFamily: "Manrope, sans-serif" }}
      />
      {error && (
        <p className="text-[12px] font-medium text-[#EF4444]">{error}</p>
      )}
    </div>
  );
}
