"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { ClientAuthSessionPayload } from "@/lib/auth/applyAuthSession";
import { ROUTES } from "@/lib/routes";
import { FormulaToothIcon } from "@/components/icons/FormulaToothIcon";
import { saveProfile } from "@/lib/userProfile";
import { formatRuPhoneInput, isCompleteRuMobileDigits, normalizePhone } from "@/lib/phone";
import { getTelegramInitData } from "@/lib/telegramWebApp";

const NAME_RE = /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s-]{1,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!NAME_RE.test(form.firstName.trim())) errors.firstName = "Только буквы, минимум 2 символа";
  if (!NAME_RE.test(form.lastName.trim())) errors.lastName = "Только буквы, минимум 2 символа";
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Некорректный email";
  const digits = normalizePhone(form.phone);
  if (!isCompleteRuMobileDigits(digits)) errors.phone = "Введите корректный номер";
  return errors;
}

function RegistrationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeRegistration } = useAuth();
  const phoneParam = searchParams.get("phone") ?? "";

  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: phoneParam ? formatRuPhoneInput(normalizePhone(phoneParam)) : "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (phoneParam) {
      setForm((f) => ({ ...f, phone: formatRuPhoneInput(normalizePhone(phoneParam)) }));
    }
  }, [phoneParam]);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  const setField = <K extends keyof FormState>(key: K, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const handleSubmit = async () => {
    setTouched({ firstName: true, lastName: true, email: true, phone: true });
    if (hasErrors) return;

    const cleanPhone = normalizePhone(form.phone);
    setSaving(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          initData: getTelegramInitData() ?? "",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        session?: ClientAuthSessionPayload;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.session) {
        setSubmitError(json.error ?? "Ошибка регистрации");
        return;
      }

      saveProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: cleanPhone,
        email: form.email.trim(),
      });

      const { error, redirectTo } = await completeRegistration(json.session);
      if (error) {
        setSubmitError(error);
        return;
      }
      router.replace(redirectTo ?? ROUTES.auth);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setSubmitError(`Ошибка: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = saving || (Object.keys(touched).length === 4 && hasErrors);

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
          Заполните данные. После регистрации задайте PIN для входа.
        </p>
      </div>

      {submitError ? (
        <p className="text-[13px] font-medium text-[#EF4444] mb-2" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <RegistrationField
          label="Телефон"
          value={form.phone}
          onChange={(v) => setField("phone", formatRuPhoneInput(v))}
          error={touched.phone ? errors.phone : undefined}
          placeholder="+7 (___) ___-__-__"
          type="tel"
          inputMode="tel"
        />

        <RegistrationField
          label="Имя"
          value={form.firstName}
          onChange={(v) => setField("firstName", v)}
          error={touched.firstName ? errors.firstName : undefined}
          placeholder="Александр"
        />

        <RegistrationField
          label="Фамилия"
          value={form.lastName}
          onChange={(v) => setField("lastName", v)}
          error={touched.lastName ? errors.lastName : undefined}
          placeholder="Коновалов"
        />

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
          {saving ? "Создаём профиль…" : "Создать профиль"}
        </button>

        <button
          type="button"
          onClick={() => router.push(ROUTES.auth)}
          className="mt-4 w-full min-h-[44px] py-3 px-4 flex items-center justify-center text-[15px] font-semibold text-primary active:scale-95 transition-transform rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Назад к входу
        </button>
      </div>
    </main>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh flex items-center justify-center text-secondary text-[15px]">
          Загрузка…
        </main>
      }
    >
      <RegistrationPageInner />
    </Suspense>
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

function RegistrationField({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  inputMode,
}: FieldProps) {
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
      {error && <p className="text-[12px] font-medium text-[#EF4444]">{error}</p>}
    </div>
  );
}
