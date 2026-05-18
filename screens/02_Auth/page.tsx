"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  applyLoggedInClientFromSupabaseRow,
  refreshDentalCaches,
  setDentalSession,
  syncTelegramIdToSupabaseIfNeeded,
} from "@/lib/auth";
import {
  formatRuPhoneInput,
  isCompleteRuMobileDigits,
  normalizePhone,
  phoneDigitsSuffixPattern,
} from "@/lib/phone";
import { supabase } from "@/lib/supabaseClient";
import { ROUTES } from "@/lib/routes";
import { addDentalLog } from "@/lib/logger";
import { FormulaToothIcon } from "@/components/icons/FormulaToothIcon";

/** Длина поля OTP в UI (maxLength инпута). */
const OTP_INPUT_MAX_LENGTH = 6;

/** Сквозные демо-коды: 4 или 6 цифр под длину поля. */
const MASTER_SMS_CODES = new Set(["1234", "123456"]);

function isMasterSmsCode(digits: string): boolean {
  return MASTER_SMS_CODES.has(digits);
}

/** Номер между шагами авторизации (только цифры; без запросов к БД на шаге 1). */
const AUTH_PHONE_STORAGE_KEY = "auth_phone";

/** Нормализация живого инпута OTP (до String() в verify). */
function normalizeSmsCodeInput(raw: string): string {
  return raw.normalize("NFC").replace(/\D/g, "").slice(0, OTP_INPUT_MAX_LENGTH);
}

function persistAuthPhone(cleanPhone: string): void {
  try {
    localStorage.setItem(AUTH_PHONE_STORAGE_KEY, cleanPhone);
    console.log("[AUTH] записан auth_phone:", cleanPhone);
  } catch (err) {
    console.warn("[AUTH] persistAuthPhone ошибка доступа:", err);
  }
}

function readAuthPhone(): string {
  try {
    return localStorage.getItem(AUTH_PHONE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function clearAuthPhone(): void {
  try {
    localStorage.removeItem(AUTH_PHONE_STORAGE_KEY);
    console.log("[AUTH] очищен auth_phone");
  } catch (err) {
    console.warn("[AUTH] clearAuthPhone ошибка:", err);
  }
}

/** После навигации: `storage` и смена step не должны мешать редиректу Next.js. */
function scheduleClearAuthPhone(): void {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    clearAuthPhone();
  }, 0);
}

/** Строки из dental_employees — поле имени как в lib/auth.ts (`name`). */
function sessionFromEmployeeRow(row: Record<string, unknown>): {
  id: string;
  role: "admin" | "doctor";
  fullName: string;
  phone: string;
  specialization?: string;
} {
  return {
    id: String(row.id),
    phone: String(row.phone),
    role: row.role as "admin" | "doctor",
    fullName: String(row.name ?? ""),
    specialization:
      row.specialization === null || row.specialization === undefined
        ? undefined
        : String(row.specialization),
  };
}

type AuthStep = "phone" | "code";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  /** Номер после шага 1 (синхронизируется с localStorage). */
  const [authCleanPhone, setAuthCleanPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoBypassNotice, setDemoBypassNotice] = useState(false);
  const bypassInFlightRef = useRef(false);
  /** Синхронный якорь номера между шагами (переживает async-gap и частичные потери setState при ремоунте). */
  const authPhoneRef = useRef("");

  /** Восстановление после ремоунта Strict Mode и т.п. */
  useEffect(() => {
    if (step !== "code") return;
    const pinned = readAuthPhone();
    if (isCompleteRuMobileDigits(authCleanPhone)) return;
    if (isCompleteRuMobileDigits(pinned)) {
      console.log("[AUTH] восстановлен телефон из localStorage для шага кода:", pinned);
      authPhoneRef.current = pinned;
      setAuthCleanPhone(pinned);
    }
  }, [step, authCleanPhone]);

  const handlePhoneSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(phone);
    if (!isCompleteRuMobileDigits(cleanPhone)) {
      setError("Введите корректный номер телефона");
      addDentalLog(
        "WARN",
        "guest",
        "",
        "validation_phone",
        `Номер телефона не РФ 11 цифр | raw=${phone} | cleanPhone=${cleanPhone}`
      );
      return;
    }
    setError("");

    persistAuthPhone(cleanPhone);
    authPhoneRef.current = cleanPhone;
    setAuthCleanPhone(cleanPhone);
    setStep("code");

    addDentalLog(
      "INFO",
      "guest",
      "",
      "auth_phone_step_ok",
      `cleanPhone=${cleanPhone}`
    );
  };

  const resolveCleanPhoneForMaster = (): string | null => {
    const fromLs = readAuthPhone();
    const activePhone = fromLs || authPhoneRef.current || authCleanPhone;
    if (!activePhone) {
      console.error("Телефон потерян! Невозможно проверить роль.");
      alert("Ошибка сессии. Пожалуйста, вернитесь на шаг назад и введите телефон заново.");
      addDentalLog(
        "ERROR",
        "guest",
        "",
        "auth_master_phone_lost",
        "auth_phone (localStorage) и стейт пусты"
      );
      return null;
    }
    const cleanDbPhone = normalizePhone(activePhone);
    if (!isCompleteRuMobileDigits(cleanDbPhone)) {
      setError("Введите номер телефона на прошлом шаге ещё раз.");
      addDentalLog("WARN", "guest", "", "auth_master_phone_short", cleanDbPhone);
      return null;
    }
    return cleanDbPhone;
  };

  /** Общая логика мастер-кода (Supabase + редирект), без управления loading/ref. */
  const executeMasterAuth = async (cleanDbPhone: string): Promise<void> => {
    const phoneRaw = readAuthPhone();
    console.log("[AUTH MASTER] Телефон из localStorage auth_phone:", phoneRaw || "(пусто)");

    const empPattern = phoneDigitsSuffixPattern(cleanDbPhone);

    let employee: Record<string, unknown> | null = null;
    try {
      console.log("[AUTH MASTER] Ищем сотрудника dental_employees ilike:", empPattern);
      const { data, error: empErr } = await supabase
        .from("dental_employees")
        .select("*")
        .ilike("phone", empPattern)
        .limit(1)
        .maybeSingle();

      console.log("[AUTH MASTER] Ответ dental_employees:", {
        employee: data ?? null,
        empErr: empErr
          ? { message: empErr.message, code: empErr.code, details: empErr.details }
          : null,
      });

      if (empErr) {
        console.error(
          "[AUTH MASTER] Supabase dental_employees:",
          empErr.message,
          "| details:",
          empErr.details ?? "(нет)",
          "| code:",
          empErr.code ?? "(нет)",
          "| hint:",
          empErr.hint ?? "(нет)"
        );
        setError("Не удалось проверить номер. Попробуйте позже.");
        addDentalLog(
          "ERROR",
          "guest",
          "",
          "auth_master_emp_failed",
          `${empErr.message} [${empErr.code}] ${empErr.details ?? ""}`
        );
        return;
      }
      employee = (data as Record<string, unknown>) ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const details =
        err && typeof err === "object" && "details" in err
          ? String((err as { details?: unknown }).details ?? "")
          : "";
      console.error("[AUTH MASTER] Исключение dental_employees:", msg, "| details:", details || "(нет)", err);
      addDentalLog("ERROR", "guest", "", "auth_master_emp_exception", `${msg} ${details}`);
      setError("Ошибка при входе. Попробуйте позже.");
      return;
    }

    if (employee) {
      console.log("[AUTH MASTER] Сотрудник найден:", employee);
      const s = sessionFromEmployeeRow(employee);
      /** Шаг A: `dental_session` + `dental_user_session` { id, name, role, phone } — см. setDentalSession в lib/auth. */
      setDentalSession({
        id: s.id,
        role: s.role,
        fullName: s.fullName,
        phone: s.phone,
        specialization: s.specialization,
      });
      await syncTelegramIdToSupabaseIfNeeded();
      /** Шаг Б: AuthContext в проекте нет — PatientAppGate подписан на `dental_session_changed`. */
      addDentalLog(
        "INFO",
        s.role,
        cleanDbPhone,
        "auth_success_master_direct",
        `id=${s.id} | ${s.fullName}`
      );
      router.push(s.role === "admin" ? ROUTES.adminDashboard : ROUTES.doctorCabinet);
      scheduleClearAuthPhone();
      return;
    }

    console.log("[AUTH MASTER] Сотрудник не найден. Ищем клиента в БД...");

    let client: Record<string, unknown> | null = null;
    try {
      const { data, error: cliErr } = await supabase
        .from("dental_clients")
        .select("*")
        .ilike("phone", empPattern)
        .limit(1)
        .maybeSingle();

      console.log("[AUTH MASTER] Ответ dental_clients:", {
        client: data ?? null,
        cliErr: cliErr
          ? { message: cliErr.message, code: cliErr.code, details: cliErr.details }
          : null,
      });

      if (cliErr) {
        console.error(
          "[AUTH MASTER] Supabase dental_clients:",
          cliErr.message,
          "| details:",
          cliErr.details ?? "(нет)",
          "| code:",
          cliErr.code ?? "(нет)",
          "| hint:",
          cliErr.hint ?? "(нет)"
        );
        setError("Не удалось проверить номер. Попробуйте позже.");
        addDentalLog(
          "ERROR",
          "guest",
          "",
          "auth_master_client_failed",
          `${cliErr.message} [${cliErr.code}] ${cliErr.details ?? ""}`
        );
        return;
      }
      client = (data as Record<string, unknown>) ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const details =
        err && typeof err === "object" && "details" in err
          ? String((err as { details?: unknown }).details ?? "")
          : "";
      console.error("[AUTH MASTER] Исключение dental_clients:", msg, "| details:", details || "(нет)", err);
      addDentalLog("ERROR", "guest", "", "auth_master_client_exception", `${msg} ${details}`);
      setError("Ошибка при входе. Попробуйте позже.");
      return;
    }

    if (client) {
      console.log("[AUTH MASTER] Клиент найден:", client);
      const cid = String(client.id ?? "");
      if (!cid) {
        console.error("[AUTH MASTER] В ответе нет client.id:", client);
        setError("Некорректные данные клиента.");
        return;
      }
      applyLoggedInClientFromSupabaseRow(client);
      await refreshDentalCaches();
      await syncTelegramIdToSupabaseIfNeeded();
      addDentalLog("INFO", "client", cleanDbPhone, "auth_success_master_direct", `id=${cid}`);
      router.push(ROUTES.clientHome);
      scheduleClearAuthPhone();
      return;
    }

    console.log("[AUTH MASTER] Номер не найден. Переход к регистрации.");
    addDentalLog(
      "INFO",
      "guest",
      "",
      "auth_master_new_client_redirect",
      `cleanPhone=${cleanDbPhone}`
    );
    /** Не очищаем auth_phone здесь — номер нужен до завершения регистрации (см. screens/02_Registration). */
    router.replace(`${ROUTES.registration}?phone=${encodeURIComponent(cleanDbPhone)}`);
  };

  const runMasterAuthSession = async (options: { instantUi: boolean }): Promise<void> => {
    if (bypassInFlightRef.current) return;
    const cleanDbPhone = resolveCleanPhoneForMaster();
    if (!cleanDbPhone) return;

    bypassInFlightRef.current = true;
    if (options.instantUi) {
      console.log("🔥 INSTANT BYPASS TRIGGERED 🔥");
      setDemoBypassNotice(true);
    }
    setLoading(true);
    setError("");

    try {
      await executeMasterAuth(cleanDbPhone);
    } finally {
      setLoading(false);
      bypassInFlightRef.current = false;
      setDemoBypassNotice(false);
    }
  };

  /** Проверка кода: мастер-код — тот же пайплайн, что и мгновенный onChange (кнопка необязательна). */
  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const enteredCode: unknown = code;
    const normalizedCode = String(enteredCode)
      .replace(/\D/g, "")
      .slice(0, OTP_INPUT_MAX_LENGTH);

    console.log("=== AUTH DEBUG ===");
    console.log("Введенный код (сырой):", enteredCode);
    console.log("Код (нормализованный):", normalizedCode);
    console.log(
      "Телефон (стейт / ref / LS auth_phone):",
      authCleanPhone,
      authPhoneRef.current,
      readAuthPhone()
    );

    if (isMasterSmsCode(normalizedCode)) {
      await runMasterAuthSession({ instantUi: false });
      return;
    }

    if (!normalizedCode) {
      setError("Введите код из СМС");
      addDentalLog(
        "WARN",
        "guest",
        "",
        "validation_code_empty",
        `raw_type=${typeof enteredCode}`
      );
      return;
    }

    setError("Неверный код. Демо: 1234 или 123456");
    addDentalLog(
      "WARN",
      "guest",
      "",
      "validation_code_invalid",
      `digits=${normalizedCode} len_raw_state=${typeof code}`
    );
  };

  const digitsNormalized = normalizePhone(phone);
  const digitLen = digitsNormalized.length;
  /** Номер для подписи на шаге OTP (стейт мог обнулиться при ремоунте — читаем LS). */
  const otpScreenPhone = authCleanPhone || readAuthPhone() || authPhoneRef.current || phone;

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas flex flex-col justify-center px-6 pb-8">
      <div className="mb-10">
        <div className="flex justify-center mb-6">
          <FormulaToothIcon
            variant="outline"
            className="w-[4.75rem] h-[4.75rem] text-primary shrink-0"
          />
        </div>
        <h1 className="text-[28px] font-bold text-[#0F172A] dark:text-white leading-tight tracking-tight">
          {step === "phone" ? "Вход в кабинет" : "Код из СМС"}
        </h1>
        <p className="text-[15px] text-secondary mt-2 leading-relaxed">
          {step === "phone"
            ? "Один номер для пациентов и сотрудников клиники — после СМС вы попадёте в нужный раздел."
            : `Код отправлен на\u00a0${formatRuPhoneInput(otpScreenPhone || "") || "…"} (демо: до 6 цифр)`}
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
        <form className="flex flex-col gap-5" onSubmit={handlePhoneSubmit} noValidate>
          <Input
            label="Телефон"
            type="tel"
            placeholder="+7 (___) ___-__-__"
            value={phone}
            onChange={(e) => {
              setPhone(formatRuPhoneInput(e.target.value));
              setError("");
            }}
            error={error}
            inputMode="tel"
          />
          <p className="text-[12px] text-secondary -mt-2">
            Демо:{" "}
            <span className="font-mono text-[#0F172A] dark:text-white">1234</span>
            {" или "}
            <span className="font-mono text-[#0F172A] dark:text-white">123456</span>
            {digitLen >= 11 ? (
              <>
                {" · "}
                В БД сохранится:{" "}
                <span className="font-mono text-[#0F172A] dark:text-white">{digitsNormalized}</span>
              </>
            ) : null}
          </p>
          <Button type="submit" size="full" loading={loading}>
            Далее
          </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={handleVerify}>
          {demoBypassNotice ? (
            <p className="text-[13px] font-semibold text-primary text-center animate-pulse">
              Вход по демо-коду...
            </p>
          ) : null}
          <Input
            label="Код подтверждения"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={Array.from({ length: OTP_INPUT_MAX_LENGTH }, () => "•").join(" ")}
            maxLength={OTP_INPUT_MAX_LENGTH}
            value={code}
            onChange={(e) => {
              const next = normalizeSmsCodeInput(e.target.value);
              setCode(next);
              setError("");
              if (isMasterSmsCode(next)) {
                void runMasterAuthSession({ instantUi: true });
              }
            }}
            error={error}
          />
          <Button type="submit" size="full" loading={loading}>
            Войти
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full !h-auto min-h-[44px] py-3 text-[15px] font-medium border-slate-200 dark:border-slate-700"
            onClick={() => {
              bypassInFlightRef.current = false;
              authPhoneRef.current = "";
              setDemoBypassNotice(false);
              setStep("phone");
              clearAuthPhone();
              setAuthCleanPhone("");
              setCode("");
              setError("");
            }}
          >
            Изменить номер
          </Button>
        </form>
      )}
    </main>
  );
}
