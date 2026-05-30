"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, MonitorDot, PlusCircle } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const NAV = [
  { href: ROUTES.platformDashboard, label: "Обзор", icon: LayoutDashboard },
  { href: ROUTES.platformClinics, label: "Клиники", icon: Building2 },
  { href: ROUTES.platformOnboarding, label: "Онбординг", icon: PlusCircle },
  { href: ROUTES.platformMonitoring, label: "Мониторинг", icon: MonitorDot },
] as const;

export default function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex gap-1 overflow-x-auto px-4 py-2 no-scrollbar">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`interactive-press-sm flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium ${
                active
                  ? "bg-primary text-white"
                  : "text-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
