"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { formatRuPhoneInput, isCompleteRuMobileDigits } from "@/lib/phone";
import { ROUTES } from "@/lib/routes";
import { log } from "@/lib/logger";
import { isSupabaseConfigured, supabaseNetworkErrorHint } from "@/lib/supabase/publicConfig";
import { isTelegramMiniApp } from "@/lib/telegramWebApp";
import { FormulaToothIcon } from "@/components/icons/FormulaToothIcon";

type StaffLoginMode = "admin" | "doctor" | null;

export default function AuthPage() {
  const router = useRouter();
  const { status, signInWithTelegram, signInEmployeeByPhone } = useAuth();
  const [staffMode, setStaffMode] = useState<StaffLoginMode>(null);
  const [staffPhone, setStaffPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTelegramSignIn = async () => {
    if (!isSupabaseConfigured()) {
      setError(supabaseNetworkErrorHint());
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: err, redirectTo, needsRegistration } = await signInWithTelegram();
      if (err) {
        setError(err);
        log("ERROR", "auth_telegram_failed", { role: "guest", userId: "", details: err });
        return;
      }
      if (needsRegistration) {
        router.replace(ROUTES.registration);
        return;
      }
      if (redirectTo) router.push(redirectTo);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!staffMode) return;
    if (!isSupabaseConfigured()) {
      setError(supabaseNetworkErrorHint());
      return;
    }
    const digits = staffPhone.replace(/\D/g, "");
    if (!isCompleteRuMobileDigits(digits.startsWith("7") ? digits : `7${digits}`)) {
      setError(staffMode === "admin" ? "Введите корректный номер администратора" : "Введите корректный номер врача");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: err, redirectTo } = await signInEmployeeByPhone(staffPhone, staffMode);
      if (err) {
        setError(err);
        return;
      }
      if (redirectTo) router.push(redirectTo);
    } finally {
      setLoading(false);
    }
  };

  const toggleStaffMode = (mode: StaffLoginMode) => {
    setStaffMode((prev) => (prev === mode ? null : mode));
    setError("");
  };

  if (status === "loading") {
    return (
      <main className="min-h-dvh bg-surface dark:bg-app-canvas flex items-center justify-center px-6">
        <p className="text-[15px] text-secondary">Проверяем сессию…</p>
      </main>
    );
  }

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
          Вход в кабинет
        </h1>
        <p className="text-[15px] text-secondary mt-2 leading-relaxed">
          {isTelegramMiniApp()
            ? "Войдите через Telegram — профиль подтянется из Mini App автоматически."
            : "Войдите через Telegram OAuth. Роль (пациент, врач, админ) определяется по записи в базе клиники."}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <Button type="button" size="full" loading={loading} onClick={() => void handleTelegramSignIn()}>
          Войти через Telegram
        </Button>

        {error && !staffMode ? (
          <p className="text-[13px] text-red-600 dark:text-red-400 text-center" role="alert">
            {error}
          </p>
        ) : null}

        <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-4">
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 text-[12px] font-medium px-2 py-2 rounded-xl transition-colors ${
                staffMode === "admin"
                  ? "text-primary bg-primary/10"
                  : "text-secondary hover:text-primary"
              }`}
              onClick={() => toggleStaffMode("admin")}
            >
              {staffMode === "admin" ? "Скрыть" : "Резервный вход администратора"}
            </button>
            <button
              type="button"
              className={`flex-1 text-[12px] font-medium px-2 py-2 rounded-xl transition-colors ${
                staffMode === "doctor"
                  ? "text-primary bg-primary/10"
                  : "text-secondary hover:text-primary"
              }`}
              onClick={() => toggleStaffMode("doctor")}
            >
              {staffMode === "doctor" ? "Скрыть" : "Вход для врача"}
            </button>
          </div>

          {staffMode ? (
            <form className="flex flex-col gap-4 mt-4" onSubmit={handleStaffLogin} noValidate>
              <Input
                label={staffMode === "admin" ? "Телефон администратора" : "Телефон врача"}
                type="tel"
                placeholder="+7 (___) ___-__-__"
                value={staffPhone}
                onChange={(e) => {
                  setStaffPhone(formatRuPhoneInput(e.target.value));
                  setError("");
                }}
                error={error && staffMode ? error : undefined}
                inputMode="tel"
              />
              <p className="text-[12px] text-secondary -mt-2">
                {staffMode === "admin"
                  ? "Только для сотрудников с ролью admin в dental_employees."
                  : "Только для сотрудников с ролью doctor в dental_employees."}
              </p>
              <Button type="submit" variant="secondary" size="full" loading={loading}>
                Войти по номеру
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
