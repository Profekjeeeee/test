"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDentalSession } from "@/lib/auth";
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

  useEffect(() => {
    if (isPublicPath(pathname)) return;

    const session = getDentalSession();

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
  }, [pathname, router]);

  return <>{children}</>;
}
