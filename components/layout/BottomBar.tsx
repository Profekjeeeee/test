"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { BottomTabId } from "@/types";
import { ROUTES } from "@/lib/routes";
import { useUpcomingCount } from "@/hooks/useUpcomingCount";
import { FormulaToothIcon } from "@/components/icons/FormulaToothIcon";

type IconProps = { active: boolean };

const TABS: {
  id: BottomTabId;
  label: string;
  href: string;
  icon: React.FC<IconProps>;
}[] = [
  {
    id: "home",
    label: "Главная",
    href: ROUTES.clientHome,
    icon: ({ active }) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
      </svg>
    ),
  },
  {
    id: "appointments",
    label: "Записи",
    href: "/appointments",
    icon: ({ active }) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="4"
          width="18"
          height="17"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 2V5M16 2V5M3 9H21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {active && (
          <rect x="7" y="13" width="4" height="4" rx="1" fill="currentColor" />
        )}
      </svg>
    ),
  },
  {
    id: "formula",
    label: "Формула",
    href: "/formula",
    icon: ({ active }) => (
      <FormulaToothIcon
        className="w-6 h-6"
        variant={active ? "filled-subtle" : "outline"}
      />
    ),
  },
  {
    id: "bills",
    label: "Счета",
    href: "/bills",
    icon: ({ active }) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 2H18C18.5523 2 19 2.44772 19 3V22L16 20L13 22L10 20L7 22L5 21V3C5 2.44772 5.44772 2 6 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.1 : undefined}
        />
        <path
          d="M9 9H15M9 13H13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "more",
    label: "Ещё",
    href: "/profile",
    icon: ({ active }) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle
          cx="12"
          cy="8"
          r="4"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
        <path
          d="M4 20C4 17 7.58172 14 12 14C16.4183 14 20 17 20 20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function BottomBar() {
  const pathname = usePathname();
  const upcomingCount = useUpcomingCount();

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
      aria-label="Основная навигация"
    >
      <div
        className="pointer-events-auto flex w-full max-w-[390px] rounded-[22px] border border-slate-200 bg-white/85 py-1.5 pl-1 pr-1 shadow-[0_8px_32px_-6px_rgba(15,23,42,0.22)] backdrop-blur-xl backdrop-saturate-150 dark:border-t dark:border-white/8 dark:border-x dark:border-white/6 dark:border-b dark:border-white/5 dark:bg-app-nav/95 dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)]"
      >
        <ul className="flex min-h-[3.25rem] flex-1 items-center justify-around">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            const showBadge = tab.id === "appointments" && upcomingCount > 0;
            return (
              <li key={tab.id} className="flex min-w-0 flex-1 justify-center">
                <Link
                  href={tab.href}
                  className="interactive-press-sm flex w-full max-w-[4.5rem] flex-col items-center justify-center gap-0.5 py-1"
                >
                  <span
                    className={`relative flex items-center justify-center rounded-full px-2 py-1 transition-colors ${
                      active ? "bg-sky-400/15 dark:bg-primary/16" : ""
                    }`}
                  >
                    <span
                      className={
                        active
                          ? "text-[#248bcf] dark:text-primary"
                          : "text-zinc-700 dark:text-slate-400"
                      }
                    >
                      <span className="relative flex items-center justify-center">
                        <Icon active={active} />
                        {showBadge && (
                          <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#248bcf] dark:bg-primary/90 px-1 text-[9px] font-bold leading-none text-white shadow-none dark:shadow-none">
                            {upcomingCount > 99 ? "99+" : upcomingCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`max-w-full truncate text-center text-[10px] font-medium leading-none tracking-tight ${
                      active
                        ? "text-[#248bcf] dark:text-primary"
                        : "text-zinc-600 dark:text-slate-500"
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
