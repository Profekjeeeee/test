"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { setCurrentUser, setDentalSession, normalizePhone } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { ROUTES } from "@/lib/routes";
import { addDentalLog } from "@/lib/logger";

/** Сквозной демо-код. */
const MASTER_SMS_CODE = "1234";

/** Бэкап нормализованного номера между шагами (переживает ремоунт). */
const TEMP_AUTH_PHONE_KEY = "temp_auth_phone";

/** PostgREST при `.single()`: строка не найдена или не одна. */
const SUPABASE_EXPECT_ONE_ROW_ERRORS = new Set(["PGRST116", "PGRST117"]);

/** Нормализация живого инпута OTP (до String() в verify). */
function normalizeSmsCodeInput(raw: string): string {
  return raw.normalize("NFC").replace(/\D/g, "").slice(0, 12);
}

function persistTempAuthPhone(cleanPhone: string): void {
  try {
    localStorage.setItem(TEMP_AUTH_PHONE_KEY, cleanPhone);
    console.log("[AUTH] записан temp_auth_phone:", cleanPhone);
  } catch (err) {
    console.warn("[AUTH] persistTempAuthPhone ошибка доступа:", err);
  }
}

function readTempAuthPhone(): string {
  try {
    return localStorage.getItem(TEMP_AUTH_PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}

function clearTempAuthPhone(): void {
  try {
    localStorage.removeItem(TEMP_AUTH_PHONE_KEY);
    console.log("[AUTH] очищен temp_auth_phone");
  } catch (err) {
    console.warn("[AUTH] clearTempAuthPhone ошибка:", err);
  }
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

  /** Восстановление после ремоунта Strict Mode и т.п. */
  useEffect(() => {
    if (step !== "code") return;
    if (authCleanPhone.length >= 11) return;
    const pinned = readTempAuthPhone();
    if (pinned.length >= 11) {
      console.log("[AUTH] восстановлен телефон из localStorage для шага кода:", pinned);
      setAuthCleanPhone(pinned);
    }
  }, [step, authCleanPhone]);

  const handlePhoneSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    try {
      await new Promise((r) => setTimeout(r, 500));
      persistTempAuthPhone(cleanPhone);
      setAuthCleanPhone(cleanPhone);
      setStep("code");
      addDentalLog(
        "INFO",
        "guest",
        "",
        "auth_phone_step_ok",
        `cleanPhone=${cleanPhone}`
      );
    } finally {
      setLoading(false);
    }
  };

  /** Проверка кода: блокировка submit + «бронебойный» мастер-байпас. */
  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const enteredCode: unknown = code;
    const normalizedCode = String(enteredCode).replace(/\D/g, "");

    const statePhone = authCleanPhone;

    console.log("=== AUTH DEBUG ===");
    console.log("Введенный код (сырой):", enteredCode);
    console.log("Код (нормализованный):", normalizedCode);
    console.log("Телефон из стейта:", statePhone);

    let lsPhone = "";
    try {
      lsPhone = localStorage.getItem(TEMP_AUTH_PHONE_KEY) ?? "";
    } catch (storageErr) {
      console.error("[AUTH] chrome localStorage недоступен:", storageErr);
    }

    let activePhone = statePhone || lsPhone;

    console.log("Активный телефон для БД:", activePhone || "(пусто)");
    console.log("[AUTH][DEBUG] temp_auth_phone только из LS:", lsPhone || "(нет)");
    console.log("[AUTH][DEBUG] typeof code из React state:", typeof code);

    /* Жесткий Bypass — до любых «неверный код». */
    if (normalizedCode === MASTER_SMS_CODE) {
      e.preventDefault();

      activePhone = statePhone || (typeof window !== "undefined" ? lsPhone || readTempAuthPhone() : "");

      console.log("[AUTH MASTER] финальный активный номер перед БД:", activePhone || "(пусто)");

      if (!activePhone) {
        console.error("Телефон потерян! Невозможно проверить роль.");
        alert("Ошибка сессии. Пожалуйста, вернитесь на шаг назад и введите телефон заново.");
        addDentalLog("ERROR", "guest", "", "auth_master_phone_lost", "temp_auth_phone и стейт пусты");
        return;
      }

      const cleanDbPhone = normalizePhone(activePhone);

      console.log("[AUTH MASTER] после normalizePhone:", cleanDbPhone);

      setLoading(true);
      setError("");

      try {
        console.log("[AUTH MASTER] Ищем сотрудника в БД...", { cleanDbPhone });

        const { data: employee, error: empErr } = await supabase
          .from("dental_employees")
          .select("*")
          .eq("phone", cleanDbPhone)
          .single();

        console.log("[AUTH MASTER] Ответ dental_employees:", {
          employee: employee ?? null,
          empErr: empErr
            ? { message: empErr.message, code: empErr.code, details: empErr.details }
            : null,
        });

        if (
          empErr &&
          !SUPABASE_EXPECT_ONE_ROW_ERRORS.has(empErr.code ?? "")
        ) {
          console.error("[AUTH MASTER] Ошибка Supabase dental_employees (не «нет строки»):", empErr);
          setError("Не удалось проверить номер. Попробуйте позже.");
          addDentalLog(
            "ERROR",
            "guest",
            "",
            "auth_master_emp_failed",
            `${empErr.message} [${empErr.code}]`
          );
          return;
        }

        if (employee) {
          console.log("[AUTH MASTER] Сотрудник найден:", employee);
          const s = sessionFromEmployeeRow(employee as Record<string, unknown>);
          setDentalSession({
            id: s.id,
            role: s.role,
            fullName: s.fullName,
            phone: s.phone,
            specialization: s.specialization,
          });
          addDentalLog(
            "INFO",
            s.role,
            cleanDbPhone,
            "auth_success_master_direct",
            `id=${s.id} | ${s.fullName}`
          );
          clearTempAuthPhone();
          router.replace(s.role === "admin" ? ROUTES.adminDashboard : ROUTES.doctorCabinet);
          return;
        }

        console.log("[AUTH MASTER] Сотрудник не найден. Ищем клиента в БД...");

        const { data: client, error: cliErr } = await supabase
          .from("dental_clients")
          .select("*")
          .eq("phone", cleanDbPhone)
          .single();

        console.log("[AUTH MASTER] Ответ dental_clients:", {
          client: client ?? null,
          cliErr: cliErr
            ? { message: cliErr.message, code: cliErr.code, details: cliErr.details }
            : null,
        });

        if (
          cliErr &&
          !SUPABASE_EXPECT_ONE_ROW_ERRORS.has(cliErr.code ?? "")
        ) {
          console.error("[AUTH MASTER] Ошибка Supabase dental_clients (не «нет строки»):", cliErr);
          setError("Не удалось проверить номер. Попробуйте позже.");
          addDentalLog(
            "ERROR",
            "guest",
            "",
            "auth_master_client_failed",
            `${cliErr.message} [${cliErr.code}]`
          );
          return;
        }

        if (client) {
          console.log("[AUTH MASTER] Клиент найден:", client);
          const cid = String((client as { id?: unknown }).id ?? "");
          if (!cid) {
            console.error("[AUTH MASTER] В ответе нет client.id:", client);
            setError("Некорректные данные клиента.");
            return;
          }
          await setCurrentUser(cid);
          addDentalLog("INFO", "client", cleanDbPhone, "auth_success_master_direct", `id=${cid}`);
          clearTempAuthPhone();
          router.replace(ROUTES.clientHome);
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
        clearTempAuthPhone();
        router.replace(`${ROUTES.registration}?phone=${encodeURIComponent(cleanDbPhone)}`);
        return;
      } catch (err) {
        console.error("Критическая ошибка при обращении к Supabase:", err);
        addDentalLog(
          "ERROR",
          "guest",
          "",
          "auth_master_exception",
          err instanceof Error ? err.message : String(err)
        );
        setError("Ошибка при входе. Попробуйте позже.");
      } finally {
        setLoading(false);
      }
      /* Гарантируем, что обычная валидация кода не выполняется после мастер-байпаса */
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

    setError(`Неверный код. Демо-код: ${MASTER_SMS_CODE}`);
    addDentalLog(
      "WARN",
      "guest",
      "",
      "validation_code_invalid",
      `digits=${normalizedCode} len_raw_state=${typeof code}`
    );
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
        <form className="flex flex-col gap-5" onSubmit={handlePhoneSubmit} noValidate>
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
          <Button type="submit" size="full" loading={loading}>
            Получить код
          </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={handleVerify}>
          <Input
            label="Код подтверждения"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="• • • •"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(normalizeSmsCodeInput(e.target.value));
              setError("");
            }}
            error={error}
          />
          <Button type="submit" size="full" loading={loading}>
            Войти
          </Button>
          <button
            className="text-[13px] text-gray-400 text-center active:scale-95 transition-transform"
            type="button"
            onClick={() => {
              setStep("phone");
              clearTempAuthPhone();
              setAuthCleanPhone("");
              setCode("");
              setError("");
            }}
          >
            Изменить номер
          </button>
        </form>
      )}
    </main>
  );
}
