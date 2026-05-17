"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = { active: boolean };

const ADMIN_TABS: { id: string; label: string; href: string; icon: React.FC<IconProps> }[] = [
  {
    id: "dashboard",
    label: "Дашборд",
    href: "/screens/admin/dashboard",
    icon: ({ active }) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="3"
          width="8"
          height="8"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
        <rect
          x="13"
          y="3"
          width="8"
          height="8"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
        <rect
          x="3"
          y="13"
          width="8"
          height="8"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
        <rect
          x="13"
          y="13"
          width="8"
          height="8"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
      </svg>
    ),
  },
  {
    id: "messages",
    label: "Чаты",
    href: "/screens/admin/messages",
    icon: ({ active }) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 14V18L8 14H18C18.5523 14 19 13.5523 19 13V7C19 6.44772 18.5523 6 18 6H6C5.44772 6 5 6.44772 5 7V14H4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.1 : undefined}
        />
        <path
          d="M8 10H16M8 12.5H13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "feed",
    label: "Лента",
    href: "/screens/admin/feed",
    icon: ({ active }) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="3"
          width="18"
          height="4"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
        <rect
          x="3"
          y="10"
          width="18"
          height="4"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
        <rect
          x="3"
          y="17"
          width="11"
          height="4"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.12 : undefined}
        />
      </svg>
    ),
  },
  {
    id: "doctors",
    label: "Врачи",
    href: "/screens/admin/doctors",
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
        <path
          d="M17 11V15M15 13H19"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "price",
    label: "Прайс",
    href: "/screens/admin/price",
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
];

export default function AdminBottomBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/screens/admin/dashboard"
      ? pathname === "/screens/admin/dashboard"
      : href === "/screens/admin/messages"
        ? pathname.startsWith("/screens/admin/messages")
        : pathname.startsWith(href);

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
      aria-label="Навигация админки"
    >
      <div
        className="pointer-events-auto flex w-full max-w-[390px] rounded-[22px] border border-slate-200 bg-white/85 py-1.5 pl-1 pr-1 shadow-[0_8px_32px_-6px_rgba(15,23,42,0.22)] backdrop-blur-xl backdrop-saturate-150 dark:border-t dark:border-white/8 dark:border-x dark:border-white/6 dark:border-b dark:border-white/5 dark:bg-app-nav/95 dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)]"
      >
        <ul className="flex min-h-[3.25rem] flex-1 items-center justify-around">
          {ADMIN_TABS.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.id} className="flex min-w-0 flex-1 justify-center">
                <Link
                  href={tab.href}
                  className="interactive-press-sm flex w-full max-w-[4.25rem] flex-col items-center justify-center gap-0.5 py-1"
                >
                  <span
                    className={`flex items-center justify-center rounded-full px-1.5 py-1 transition-colors border ${
                      active
                        ? "bg-sky-400/15 dark:bg-primary/16 border-transparent"
                        : "border-slate-200/90 dark:border-white/8"
                    }`}
                  >
                    <span
                      className={
                        active
                          ? "text-[#248bcf] dark:text-primary"
                          : "text-zinc-700 dark:text-slate-400"
                      }
                    >
                      <Icon active={active} />
                    </span>
                  </span>
                  <span
                    className={`max-w-full truncate text-center text-[9px] font-medium leading-none tracking-tight sm:text-[10px] ${
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
