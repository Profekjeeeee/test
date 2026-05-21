"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PinDots } from "@/components/auth/PinDots";
import { PinKeypad } from "@/components/auth/PinKeypad";
import {
  PIN_AUTO_SUBMIT_LEN,
  PIN_MAX_LEN,
  PIN_MIN_LEN,
  type VerifyPinResult,
} from "@/lib/auth/pinApi";

export type PinScreenMode = "verify" | "create" | "confirm";

type PinScreenProps = {
  mode: PinScreenMode;
  title: string;
  subtitle?: string;
  loading?: boolean;
  errorMessage?: string;
  lockedUntil?: string | null;
  remainingAttempts?: number;
  onComplete: (pin: string) => void | Promise<void>;
  onCancel?: () => void;
};

function formatLockCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PinScreen({
  mode,
  title,
  subtitle,
  loading,
  errorMessage,
  lockedUntil,
  remainingAttempts,
  onComplete,
  onCancel,
}: PinScreenProps) {
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [lockLabel, setLockLabel] = useState("");
  const submitRef = useRef(false);

  const targetLen = mode === "verify" ? PIN_AUTO_SUBMIT_LEN : PIN_MIN_LEN;
  const maxLen = mode === "verify" ? PIN_AUTO_SUBMIT_LEN : PIN_MAX_LEN;
  const locked = Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());

  useEffect(() => {
    if (!lockedUntil || !locked) {
      setLockLabel("");
      return;
    }
    const tick = () => setLockLabel(formatLockCountdown(lockedUntil));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil, locked]);

  const resetEntry = useCallback(() => {
    setPin("");
    submitRef.current = false;
  }, []);

  const submitPin = useCallback(
    async (value: string) => {
      if (submitRef.current || loading || locked) return;
      submitRef.current = true;
      try {
        await onComplete(value);
      } finally {
        submitRef.current = false;
      }
    },
    [loading, locked, onComplete],
  );

  const handleFilled = useCallback(
    async (value: string) => {
      if (mode === "create" || mode === "confirm") {
        if (!firstPin) {
          if (value.length < PIN_MIN_LEN) return;
          setFirstPin(value);
          setPin("");
          setLocalError("");
          return;
        }
        if (value !== firstPin) {
          setLocalError("PIN не совпадает. Повторите.");
          setFirstPin(null);
          setPin("");
          return;
        }
        await submitPin(value);
        return;
      }
      await submitPin(value);
    },
    [mode, firstPin, submitPin],
  );

  useEffect(() => {
    if (pin.length < targetLen) return;
    if (pin.length === targetLen || (mode !== "verify" && pin.length === maxLen)) {
      void handleFilled(pin);
    }
  }, [pin, targetLen, maxLen, mode, handleFilled]);

  const pushDigit = (d: string) => {
    if (loading || locked) return;
    setLocalError("");
    setPin((p) => (p.length >= maxLen ? p : p + d));
  };

  const displayError =
    localError ||
    errorMessage ||
    (locked && lockLabel ? `Заблокировано. Повторите через ${lockLabel}` : "") ||
    (remainingAttempts !== undefined && remainingAttempts < 5 && !locked
      ? `Неверный PIN. Осталось попыток: ${remainingAttempts}`
      : "");

  const screenTitle =
    mode === "confirm" ? "Повторите PIN" : mode === "create" && firstPin ? "Повторите PIN" : title;

  const screenSubtitle =
    mode === "confirm" || (mode === "create" && firstPin)
      ? "Введите тот же код ещё раз"
      : subtitle;

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas flex flex-col justify-center px-6 pb-10">
      <div className="text-center mb-2">
        <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">{screenTitle}</h1>
        {screenSubtitle ? (
          <p className="text-[14px] text-secondary mt-2">{screenSubtitle}</p>
        ) : null}
      </div>

      <PinDots length={maxLen} filled={pin.length} error={Boolean(displayError)} />

      {displayError ? (
        <p className="text-center text-[13px] text-red-600 dark:text-red-400 mb-4" role="alert">
          {displayError}
        </p>
      ) : (
        <div className="mb-4 h-5" />
      )}

      <PinKeypad
        disabled={loading || locked}
        onDigit={pushDigit}
        onBackspace={() => {
          if (loading || locked) return;
          setPin((p) => p.slice(0, -1));
          setLocalError("");
        }}
      />

      {onCancel ? (
        <button
          type="button"
          className="mt-8 w-full text-[14px] font-medium text-secondary hover:text-primary"
          onClick={() => {
            resetEntry();
            setFirstPin(null);
            onCancel();
          }}
        >
          Отмена
        </button>
      ) : null}
    </main>
  );
}

export function verifyResultToUi(
  result: VerifyPinResult,
): { message: string; lockedUntil?: string; remaining?: number } {
  if (result.ok) return { message: "" };
  if (result.error === "locked") {
    return {
      message: "Слишком много попыток",
      lockedUntil: result.lockedUntil,
      remaining: 0,
    };
  }
  if (result.error === "wrong_pin") {
    return {
      message: "Неверный PIN",
      remaining: result.remaining,
    };
  }
  return { message: "Не удалось проверить PIN" };
}
