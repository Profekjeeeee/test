"use client";

import { usePathname } from "next/navigation";
import type { BottomTabId } from "@/types";

export function useActiveTab(): BottomTabId | null {
  const pathname = usePathname();

  if (pathname.startsWith("/main")) return "home";
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
