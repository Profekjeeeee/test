"use client";

import { usePathname } from "next/navigation";
import type { BottomTabId } from "@/types";
import { ROUTES } from "@/lib/routes";

export function useActiveTab(): BottomTabId | null {
  const pathname = usePathname();

  if (pathname.startsWith(ROUTES.clientHome) || pathname.startsWith("/main")) return "home";
  if (pathname.startsWith("/appointments") || pathname.startsWith("/booking"))
    return "appointments";
  if (pathname.startsWith("/formula") || pathname.startsWith("/tooth"))
    return "formula";
  if (pathname.startsWith("/bills")) return "bills";
  if (
    pathname.startsWith("/profile") ||
    pathname.startsWith("/prevention") ||
    pathname.startsWith("/contacts")
  )
    return "more";

  return null;
}
