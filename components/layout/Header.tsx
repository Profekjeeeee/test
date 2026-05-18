"use client";

import { useRouter } from "next/navigation";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

export default function Header({ title, showBack, backHref, onBack, rightSlot }: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-app-nav/92 backdrop-blur-sm border-b border-slate-200 dark:border-white/8 shadow-[0_4px_16px_rgba(15,23,42,0.04)] dark:shadow-none pt-[max(12px,env(safe-area-inset-top,0px))]">
      <div className="flex items-center min-h-14 h-14 px-6 gap-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 shrink-0 -ml-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-raised-surface"
            aria-label="Назад"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#0F172A] dark:text-white">
              <path
                d="M12.5 5L7.5 10L12.5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <h1 className="flex-1 text-[17px] font-semibold text-[#0F172A] dark:text-white tracking-tight truncate">
          {title}
        </h1>
        {rightSlot && <div className="flex items-center">{rightSlot}</div>}
      </div>
    </header>
  );
}
