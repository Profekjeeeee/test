"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  fetchEmployeeByPhoneForAuth,
  fetchClientByPhoneForAuth,
  setCurrentUser,
  setDentalSession,
  normalizePhone,
} from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { addDentalLog } from "@/lib/logger";

/** Сквозной демо-код: только цифры; ввод нормализуется через replace(/\D/g). */
const MASTER_SMS_CODE = "1234";

function normalizeSmsCodeInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

type AuthStep = "phone" | "code";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  /** Номер, зафиксированный на шаге 1 (тот же запрос к Supabase на шаге 2). */
  const [authCleanPhone, setAuthCleanPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneSubmit = async () => {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 11) {
      setError("Введите корректный номер телефона");
      addDentalLog(
        "WARN",
        "guest",
        "",
        "validation_phone",
        `Номер телефона слишком короткий | raw=${phone} | cleanPhone=${cleanPhone}`
      );
      return;
    }
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 500));
    setAuthCleanPhone(cleanPhone);
    setLoading(false);
    setStep("code");
  };

  const handleCodeSubmit = async () => {
    const digitsCode = normalizeSmsCodeInput(code);
    if (!digitsCode) {
      setError("Введите код из СМС");
      addDentalLog("WARN", "guest", "", "validation_code_empty", "Пустой код подтверждения");
      return;
    }

    if (digitsCode !== MASTER_SMS_CODE) {
      setError(`Неверный код. Демо-код: ${MASTER_SMS_CODE}`);
      addDentalLog(
        "WARN",
        "guest",
        "",
        "validation_code_invalid",
        `Неверный код | raw_len=${code.length} digits=${digitsCode}`
      );
      return;
    }

    const cleanPhone = authCleanPhone;
    if (!cleanPhone || cleanPhone.length < 11) {
      setError("Вернитесь и введите номер телефона");
      addDentalLog(
        "WARN",
        "guest",
        "",
        "auth_master_missing_phone",
        `authCleanPhone пуст или короткий | authCleanPhone=${authCleanPhone || "(пусто)"}`
      );
      setStep("phone");
      return;
    }

    setLoading(true);
    setError("");

    addDentalLog(
      "INFO",
      "guest",
      "",
      "auth_master_code_flow",
      `master ${MASTER_SMS_CODE} | cleanPhone=${cleanPhone}`
    );

    const empLookup = await fetchEmployeeByPhoneForAuth(cleanPhone);
    if (empLookup.supabaseError) {
      addDentalLog(
        "ERROR",
        "guest",
        "",
        "auth_step_a_dental_employees",
        `Supabase | cleanPhone=${empLookup.cleanPhone} | ${empLookup.supabaseError}`
      );
      setError("Не удалось проверить номер. Попробуйте позже.");
      setLoading(false);
      return;
    }

    if (empLookup.employee) {
      const employee = empLookup.employee;
      setDentalSession({
        id: employee.id,
        role: employee.role,
        fullName: employee.fullName,
        phone: employee.phone,
        specialization: employee.specialization,
      });
      addDentalLog(
        "INFO",
        employee.role,
        cleanPhone,
        "auth_success_master_code",
        `id=${employee.id} | ${employee.fullName}`
      );
      setLoading(false);
      router.replace(
        employee.role === "admin" ? ROUTES.adminDashboard : ROUTES.doctorCabinet
      );
      return;
    }

    addDentalLog(
      "INFO",
      "guest",
      "",
      "auth_step_a_miss",
      `dental_employees нет строки | cleanPhone=${empLookup.cleanPhone}`
    );

    const clientLookup = await fetchClientByPhoneForAuth(empLookup.cleanPhone);
    if (clientLookup.supabaseError) {
      addDentalLog(
        "ERROR",
        "guest",
        "",
        "auth_step_b_dental_clients",
        `Supabase | cleanPhone=${empLookup.cleanPhone} | ${clientLookup.supabaseError}`
      );
      setError("Не удалось проверить номер. Попробуйте позже.");
      setLoading(false);
      return;
    }

    if (clientLookup.client) {
      const client = clientLookup.client;
      await setCurrentUser(client.id);
      addDentalLog("INFO", "client", cleanPhone, "auth_success_master_code", `id=${client.id}`);
      setLoading(false);
      router.replace(ROUTES.clientHome);
      return;
    }

    addDentalLog(
      "INFO",
      "guest",
      "",
      "auth_step_b_miss",
      `Новый пациент | cleanPhone=${empLookup.cleanPhone} → регистрация`
    );

    setLoading(false);
    router.replace(`${ROUTES.registration}?phone=${encodeURIComponent(empLookup.cleanPhone)}`);
  };

  const normalizedDigits = normalizePhone(phone);
  const digitLen = normalizedDigits.length;

  return (
    <main className="min-h-dvh bg-surface dark:bg-slate-950 flex flex-col justify-center px-6 pb-8">
      <div className="mb-10">
        <div className="w-12 h-12 rounded-[12px] bg-primary flex items-center justify-center mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3C9.5 3 7 5 7 8C7 10 8 11.5 8.5 13C9 14.5 9 16 8.5 18C8 20 9 21 10 21C11 21 11.5 20 12 18.5C12.5 20 13 21 14 21C15 21 16 20 15.5 18C15 16 15 14.5 15.5 13C16 11.5 17 10 17 8C17 5 14.5 3 12 3Z"
              fill="white"
            />
          </svg>
        </div>
        <h1 className="text-[28px] font-bold text-[#0F172A] dark:text-white leading-tight tracking-tight">
          {step === "phone" ? "Вход в кабинет" : "Код из СМС"}
        </h1>
        <p className="text-[15px] text-secondary mt-2 leading-relaxed">
          {step === "phone"
            ? "Один номер для пациентов и сотрудников клиники — после СМС вы попадёте в нужный раздел."
            : `Отправили 4-значный код на\u00a0${phone}`}
        </p>
        {step === "phone" && (
          <div className="flex flex-wrap gap-2 mt-4">
            {(["Пациент", "Врач", "Админ"] as const).map((label) => (
              <span
                key={label}
                className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-secondary"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {step === "phone" ? (
        <div className="flex flex-col gap-5">
          <Input
            label="Телефон"
            type="tel"
            placeholder="+7 (___) ___-__-__"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
            error={error}
            inputMode="tel"
          />
          <p className="text-[12px] text-secondary -mt-2">
            Демо: код{" "}
            <span className="font-mono text-[#0F172A] dark:text-white">{MASTER_SMS_CODE}</span>
            {digitLen >= 11 ? (
              <>
                {" · "}
                Нормализовано:{" "}
                <span className="font-mono text-[#0F172A] dark:text-white">{normalizedDigits}</span>
              </>
            ) : null}
          </p>
          <Button size="full" loading={loading} onClick={handlePhoneSubmit}>
            Получить код
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Input
            label="Код подтверждения"
            type="text"
            inputMode="numeric"
            placeholder="• • • •"
            maxLength={4}
            value={code}
            onChange={(e) => {
              setCode(normalizeSmsCodeInput(e.target.value));
              setError("");
            }}
            error={error}
          />
          <Button size="full" loading={loading} onClick={handleCodeSubmit}>
            Войти
          </Button>
          <button
            className="text-[13px] text-gray-400 text-center active:scale-95 transition-transform"
            type="button"
            onClick={() => {
              setStep("phone");
              setAuthCleanPhone("");
              setCode("");
              setError("");
            }}
          >
            Изменить номер
          </button>
        </div>
      )}
    </main>
  );
}
