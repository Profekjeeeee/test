"use client";

type Props = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export default function DownloadLogsButton({ onClick, disabled, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Скачать логи"
      className={`interactive-press-sm inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/25 bg-primary-light dark:bg-slate-900 text-[12px] font-semibold text-primary dark:text-blue-300 shadow-raised-surface disabled:opacity-45 disabled:pointer-events-none ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3V14M12 14L8 10M12 14L16 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="hidden min-[360px]:inline">Скачать логи</span>
    </button>
  );
}
