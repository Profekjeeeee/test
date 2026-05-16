"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDarkMode } from "@/hooks/useDarkMode";

const LIGHT_ACTIVE = "#4E8D8F";
const DARK_ACTIVE  = "#A1D6D7";
const LIGHT_FILL   = "#D4ECED";
const DARK_FILL    = "#1A3D3F";
const INACTIVE     = "#9CA3AF";

type IconProps = { active: boolean; activeStroke: string; activeFill: string };

const ADMIN_TABS: { id: string; label: string; href: string; icon: React.FC<IconProps> }[] = [
  {
    id: "dashboard",
    label: "Дашборд",
    href: "/admin",
    icon: ({ active, activeStroke, activeFill }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
        <rect x="13" y="3" width="8" height="8" rx="2"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
        <rect x="3" y="13" width="8" height="8" rx="2"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
        <rect x="13" y="13" width="8" height="8" rx="2"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
      </svg>
    ),
  },
  {
    id: "feed",
    label: "Лента",
    href: "/admin/feed",
    icon: ({ active, activeStroke, activeFill }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="4" rx="2"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
        <rect x="3" y="10" width="18" height="4" rx="2"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
        <rect x="3" y="17" width="11" height="4" rx="2"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
      </svg>
    ),
  },
  {
    id: "doctors",
    label: "Врачи",
    href: "/admin/doctors",
    icon: ({ active, activeStroke, activeFill }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5"
          fill={active ? activeFill : "none"} />
        <path d="M4 20C4 17 7.58172 14 12 14C16.4183 14 20 17 20 20"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 11V15M15 13H19"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "price",
    label: "Прайс",
    href: "/admin/price",
    icon: ({ active, activeStroke, activeFill }) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2H18C18.5523 2 19 2.44772 19 3V22L16 20L13 22L10 20L7 22L5 21V3C5 2.44772 5.44772 2 6 2Z"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5" strokeLinejoin="round"
          fill={active ? activeFill : "none"} />
        <path d="M9 9H15M9 13H13"
          stroke={active ? activeStroke : INACTIVE} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function AdminBottomBar() {
  const pathname = usePathname();
  const isDark = useDarkMode();

  const activeStroke = isDark ? DARK_ACTIVE : LIGHT_ACTIVE;
  const activeFill   = isDark ? DARK_FILL   : LIGHT_FILL;

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white dark:bg-[#1E293B] border-t border-gray-100 dark:border-[#334155] z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-center justify-around h-[60px]">
        {ADMIN_TABS.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={tab.href}
                className="flex flex-col items-center justify-center gap-0.5 h-full w-full min-h-[44px]"
              >
                <Icon active={active} activeStroke={activeStroke} activeFill={activeFill} />
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
