"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CURRENT_USER_STORAGE_KEY,
  DENTAL_SESSION_STORAGE_KEY,
  resolveHydratedSession,
  type DentalSession,
} from "@/lib/auth";
import { addDentalLog } from "@/lib/logger";
import {
  PUBLIC_ROUTE_PREFIXES,
  PATIENT_ROUTE_PREFIXES,
  ADMIN_ROUTE_PREFIX,
  DOCTOR_ROUTE_PREFIX,
  ROUTES,
} from "@/lib/routes";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function matchesAnyPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function PatientAppGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  /** undefined — гидратация клиента не завершена; не считаем пользователя разлогиненным до чтения localStorage */
  const [hydratedSession, setHydratedSession] = useState<DentalSession | null | undefined>(undefined);
  const hydrationLogDone = useRef(false);

  useEffect(() => {
    function readSession(): DentalSession | null {
      return resolveHydratedSession();
    }

    setHydratedSession(readSession());

    const onStorage = (e: StorageEvent) => {
      const k = e.key;
      if (k !== null && k !== DENTAL_SESSION_STORAGE_KEY && k !== CURRENT_USER_STORAGE_KEY) return;
      setHydratedSession(readSession());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Лог один раз после первого чтения сессии с клиента */
  useEffect(() => {
    if (hydratedSession === undefined || hydrationLogDone.current) return;
    hydrationLogDone.current = true;
    const pub = isPublicPath(pathname);
    if (!pub && !hydratedSession) {
      addDentalLog(
        "WARN",
        "guest",
        "",
        "session_empty",
        "Сессия отсутствует"
      );
    } else if (hydratedSession) {
      addDentalLog(
        "INFO",
        hydratedSession.role,
        hydratedSession.id,
        "session_initialized",
        "Пользователь восстановлен"
      );
    }
  }, [hydratedSession, pathname]);

  useEffect(() => {
    if (hydratedSession === undefined) return;
    if (isPublicPath(pathname)) return;

    const session = hydratedSession;

    if (pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
      if (!session || session.role !== "admin") router.replace(ROUTES.auth);
      return;
    }

    if (pathname.startsWith(DOCTOR_ROUTE_PREFIX)) {
      if (!session || session.role !== "doctor") router.replace(ROUTES.auth);
      return;
    }

    if (matchesAnyPrefix(pathname, PATIENT_ROUTE_PREFIXES)) {
      if (!session || session.role !== "client") router.replace(ROUTES.auth);
    }
  }, [pathname, router, hydratedSession]);

  if (hydratedSession === undefined && !isPublicPath(pathname)) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F8FAFB] dark:bg-slate-950 text-secondary text-[13px]" aria-busy="true">
        Загрузка кабинета…
      </div>
    );
  }

  return <>{children}</>;
}
