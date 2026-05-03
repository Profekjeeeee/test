"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { BottomTabId } from "@/types";
import { useUpcomingCount } from "@/hooks/useUpcomingCount";

const TABS: { id: BottomTabId; label: string; href: string; icon: React.FC<{ active: boolean }> }[] = [
  {
    id: "home",
    label: "Главная",
    href: "/main",
    icon: ({ active }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9.5Z"
          stroke={active ? "#00665E" : "#9CA3AF"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={active ? "#E6F2F1" : "none"}
        />
      </svg>
    ),
  },
  {
    id: "appointments",
    label: "Записи",
    href: "/appointments",
    icon: ({ active }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="4"
          width="18"
          height="17"
          rx="2"
          stroke={active ? "#00665E" : "#9CA3AF"}
          strokeWidth="1.5"
        />
        <path
          d="M8 2V5M16 2V5M3 9H21"
          stroke={active ? "#00665E" : "#9CA3AF"}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {active && (
          <rect x="7" y="13" width="4" height="4" rx="1" fill="#00665E" />
        )}
      </svg>
    ),
  },
  {
    id: "formula",
    label: "Формула",
    href: "/formula",
    icon: ({ active }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6.5 3C4.5 3 3 4.5 3 7C3 9.5 4.5 11 5.5 12C5.5 12 5 15 5 18C5 20.5 6 21.5 7.5 21.5C9 21.5 10 20.5 10.5 18.5C11 16.5 11.5 13 12 13C12.5 13 13 16.5 13.5 18.5C14 20.5 15 21.5 16.5 21.5C18 21.5 19 20.5 19 18C19 15 18.5 12 18.5 12C19.5 11 21 9.5 21 7C21 4.5 19.5 3 17.5 3C15.5 3 14 4.5 12 4.5C10 4.5 8.5 3 6.5 3Z"
          fill={active ? "#E6F2F1" : "none"}
          stroke={active ? "#00665E" : "#9CA3AF"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "bills",
    label: "Счета",
    href: "/bills",
    icon: ({ active }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 2H18C18.5523 2 19 2.44772 19 3V22L16 20L13 22L10 20L7 22L5 21V3C5 2.44772 5.44772 2 6 2Z"
          stroke={active ? "#00665E" : "#9CA3AF"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={active ? "#E6F2F1" : "none"}
        />
        <path
          d="M9 9H15M9 13H13"
          stroke={active ? "#00665E" : "#9CA3AF"}
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="8"
          r="4"
          stroke={active ? "#00665E" : "#9CA3AF"}
          strokeWidth="1.5"
          fill={active ? "#E6F2F1" : "none"}
        />
        <path
          d="M4 20C4 17 7.58172 14 12 14C16.4183 14 20 17 20 20"
          stroke={active ? "#00665E" : "#9CA3AF"}
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
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white dark:bg-[#1E293B] border-t border-gray-100 dark:border-[#334155] z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-center justify-around h-[60px]">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          const showBadge = tab.id === "appointments" && upcomingCount > 0;
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={tab.href}
                className="flex flex-col items-center justify-center gap-0.5 h-full w-full min-h-[44px] group"
              >
                <div className="relative">
                  <Icon active={active} />
                  {showBadge && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-[4px] rounded-full bg-[#00665E] flex items-center justify-center"
                      style={{ fontFamily: "Manrope, sans-serif" }}
                    >
                      <span className="text-[9px] font-bold text-white leading-none">
                        {upcomingCount > 99 ? "99+" : upcomingCount}
                      </span>
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium leading-none tracking-tight transition-colors ${
                    active ? "text-primary" : "text-gray-400 dark:text-slate-500"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
