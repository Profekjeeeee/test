"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUser, setCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { saveProfile } from "@/lib/userProfile";

const NAME_RE = /^[а-яёА-ЯЁa-zA-Z][а-яёА-ЯЁa-zA-Z\s-]{1,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const phone = searchParams.get("phone") ?? "";

  const [form, setForm] = useState<FormState>({ firstName: "", lastName: "", email: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!phone) router.replace("/auth");
  }, [phone, router]);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  const setField = <K extends keyof FormState>(key: K, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const handleSubmit = async () => {
    setTouched({ firstName: true, lastName: true, email: true });
    if (hasErrors) return;

    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));

    const user = await createUser(phone, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
    });

    await setCurrentUser(user.id);

    saveProfile({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone,
      email: form.email.trim(),
    });

    router.replace(ROUTES.clientHome);
  };

  const saveDisabled = saving || (Object.keys(touched).length === 3 && hasErrors);

  return (
    <main
      className="min-h-dvh bg-surface dark:bg-slate-950 flex flex-col justify-center px-6 pb-8"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="mb-8">
        <div className="w-12 h-12 rounded-[12px] bg-primary flex items-center justify-center mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3C9.5 3 7 5 7 8C7 10 8 11.5 8.5 13C9 14.5 9 16 8.5 18C8 20 9 21 10 21C11 21 11.5 20 12 18.5C12.5 20 13 21 14 21C15 21 16 20 15.5 18C15 16 15 14.5 15.5 13C16 11.5 17 10 17 8C17 5 14.5 3 12 3Z"
              fill="white"
            />
          </svg>
        </div>
        <h1 className="text-[28px] font-bold text-[#0F172A] dark:text-white leading-tight tracking-tight">
          Регистрация
        </h1>
        <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
          Вы новый пациент. Заполните данные для создания личного кабинета.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Phone (readonly) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8]">
            Телефон
          </label>
          <input
            type="tel"
            value={phone}
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
          onClick={handleSubmit}
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
            "Готово"
          )}
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
            : "border-[#E2E8F0] bg-[#FAFCFC] text-[#0F172A] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white focus:border-primary dark:focus:border-[#A1D6D7]",
        ].join(" ")}
        style={{ fontFamily: "Manrope, sans-serif" }}
      />
      {error && (
        <p className="text-[12px] font-medium text-[#EF4444]">{error}</p>
      )}
    </div>
  );
}
