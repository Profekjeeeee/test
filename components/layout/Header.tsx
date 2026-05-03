"use client";

import Link from "next/link";
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
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#1E293B]/95 backdrop-blur-sm border-b border-gray-100 dark:border-[#334155]">
      <div className="flex items-center h-14 px-6 gap-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-9 h-9 -ml-1.5 rounded-full hover:bg-gray-50 transition-colors"
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
