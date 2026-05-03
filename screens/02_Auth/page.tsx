"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { findUserByPhone, setCurrentUser } from "@/lib/auth";

const TEST_CODE = "1234";

type AuthStep = "phone" | "code";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneSubmit = async () => {
    if (phone.replace(/\D/g, "").length < 11) {
      setError("Введите корректный номер телефона");
      return;
    }
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setStep("code");
  };

  const handleCodeSubmit = async () => {
    if (!code.trim()) {
      setError("Введите код из СМС");
      return;
    }
    if (code !== TEST_CODE) {
      setError(`Неверный код. Подсказка: ${TEST_CODE}`);
      return;
    }
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 500));

    const existingUser = findUserByPhone(phone);
    if (existingUser) {
      setCurrentUser(existingUser.id);
      router.replace("/main");
    } else {
      router.replace(`/registration?phone=${encodeURIComponent(phone)}`);
    }
  };

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
        <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
          {step === "phone"
            ? "Введите номер телефона, указанный при регистрации в клинике"
            : `Отправили 4-значный код на\u00a0${phone}`}
        </p>
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
              setCode(e.target.value);
              setError("");
            }}
            error={error}
          />
          <Button size="full" loading={loading} onClick={handleCodeSubmit}>
            Войти
          </Button>
          <button
            className="text-[13px] text-gray-400 text-center"
            onClick={() => { setStep("phone"); setCode(""); setError(""); }}
          >
            Изменить номер
          </button>
        </div>
      )}
    </main>
  );
}
