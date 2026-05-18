"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";
import { RU_MONTHS_SHORT } from "@/lib/appointments";

function BookingSuccessContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const kind = sp.get("kind") ?? "new";
  const day = sp.get("day");
  const monthStr = sp.get("month");
  const time = sp.get("time");

  const monthNumRaw = monthStr ? parseInt(monthStr, 10) : NaN;
  const monthNum = Number.isFinite(monthNumRaw)
    ? Math.max(1, Math.min(12, monthNumRaw))
    : 1;
  const monthLabel = RU_MONTHS_SHORT[monthNum - 1] ?? "";
  const dateLine = day && time ? `${day} ${monthLabel} в ${time}` : null;

  const title = kind === "reschedule" ? "Запись перенесена" : "Запись создана";

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe flex flex-col">
      <Header title="Готово" showBack backHref={ROUTES.clientHome} />
      <main className="px-5 py-8 flex flex-col items-center text-center flex-1 gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 28 28"
            fill="none"
            className="text-primary"
            aria-hidden
          >
            <path
              d="M6 14l5.5 5.5L22 8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] dark:text-white">
            {title}
          </h1>
          {dateLine && (
            <p className="text-[14px] text-gray-500 dark:text-slate-400 mt-2">{dateLine}</p>
          )}
          {kind === "new" && (
            <p className="text-[13px] text-primary font-semibold mt-2">
              Напоминание — ближе к дате приёма
            </p>
          )}
        </div>
        <div className="w-full max-w-sm mt-auto pt-6 flex flex-col gap-3">
          <Button size="full" onClick={() => router.push(ROUTES.clientHome)}>
            На главную
          </Button>
          <Button variant="ghost" size="full" onClick={() => router.push("/appointments")}>
            К моим записям
          </Button>
        </div>
      </main>
      <BottomBar />
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense
      fallback={<div className="min-h-dvh bg-surface dark:bg-app-canvas" />}
    >
      <BookingSuccessContent />
    </Suspense>
  );
}
