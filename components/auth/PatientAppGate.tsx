"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CURRENT_USER_STORAGE_KEY,
  DENTAL_SESSION_CHANGED_EVENT,
  DENTAL_SESSION_STORAGE_KEY,
  DENTAL_USER_SESSION_STORAGE_KEY,
  USER_SESSION_STORAGE_KEY,
  normalizePhone,
  refreshDentalCaches,
  refreshDentalSessionFromSupabase,
  getDentalSession,
  resolveHydratedSession,
  type DentalSession,
} from "@/lib/auth";
import { refreshAppointmentsCache } from "@/lib/appointments";
import { log } from "@/lib/logger";
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

const SESSION_SYNC_STORAGE_KEYS = new Set([
  USER_SESSION_STORAGE_KEY,
  DENTAL_SESSION_STORAGE_KEY,
  CURRENT_USER_STORAGE_KEY,
  DENTAL_USER_SESSION_STORAGE_KEY,
]);

export default function PatientAppGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  /** undefined — гидратация клиента не завершена; не считаем пользователя разлогиненным до чтения localStorage */
  const [hydratedSession, setHydratedSession] = useState<DentalSession | null | undefined>(undefined);
  const hydrationLogDone = useRef(false);

  /** Мгновенно поднимаем сессию из LS (до сетевых запросов), затем синхронизируем Supabase по телефону. */
  useLayoutEffect(() => {
    try {
      setHydratedSession(getDentalSession() ?? null);
    } catch {
      setHydratedSession(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await refreshDentalCaches();
      await refreshAppointmentsCache();

      let session = getDentalSession() ?? (await resolveHydratedSession());

      try {
        if (session?.phone && normalizePhone(session.phone).length >= 10) {
          session = await refreshDentalSessionFromSupabase(session);
        }
      } catch {
        /** остаёмся на кэше из LS */
      }

      const finalSession = session ?? getDentalSession();

      if (!cancelled) setHydratedSession(finalSession ?? null);
    })();

    const onStorage = (e: StorageEvent) => {
      const k = e.key;
      if (k !== null && !SESSION_SYNC_STORAGE_KEYS.has(k)) return;
      void (async () => {
        let session = getDentalSession() ?? (await resolveHydratedSession());
        try {
          if (session?.phone && normalizePhone(session.phone).length >= 10) {
            session = await refreshDentalSessionFromSupabase(session);
          }
        } catch {}
        if (!cancelled) setHydratedSession(session ?? null);
      })();
    };

    const onDentalSessionChanged = (): void => {
      setHydratedSession(getDentalSession());
      void (async () => {
        let session = getDentalSession() ?? (await resolveHydratedSession());
        try {
          if (session?.phone && normalizePhone(session.phone).length >= 10) {
            session = await refreshDentalSessionFromSupabase(session);
          }
        } catch {}
        if (!cancelled) setHydratedSession(session ?? null);
      })();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(DENTAL_SESSION_CHANGED_EVENT, onDentalSessionChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DENTAL_SESSION_CHANGED_EVENT, onDentalSessionChanged);
    };
  }, []);

  /** После навигации в той же вкладке: мгновенно перечитать LS (Supabase уже трогает onDentalSessionChanged / mount-effect). */
  useEffect(() => {
    try {
      setHydratedSession(getDentalSession() ?? null);
    } catch {
      setHydratedSession(null);
    }
  }, [pathname]);

  /** Лог один раз после первого чтения сессии с клиента */
  useEffect(() => {
    if (hydratedSession === undefined || hydrationLogDone.current) return;
    hydrationLogDone.current = true;
    const pub = isPublicPath(pathname);
    if (!pub && !hydratedSession) {
      log("WARN", "session_empty", {
        role: "guest",
        userId: "",
        details: "Сессия отсутствует",
      });
    } else if (hydratedSession) {
      log("INFO", "session_initialized", {
        role: hydratedSession.role,
        userId: hydratedSession.id,
        details: "Пользователь восстановлен",
      });
    }
  }, [hydratedSession, pathname]);

  useEffect(() => {
    if (hydratedSession === undefined) return;
    if (isPublicPath(pathname)) return;

    const session = hydratedSession;

    if (pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
      const adminOk =
        session?.role === "admin" ||
        (typeof window !== "undefined" && localStorage.getItem("isAdmin") === "true");
      if (!adminOk) router.replace(ROUTES.auth);
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
      <div className="min-h-dvh flex items-center justify-center bg-surface dark:bg-app-canvas text-secondary text-[13px]" aria-busy="true">
        Загрузка кабинета…
      </div>
    );
  }

  return <>{children}</>;
}
