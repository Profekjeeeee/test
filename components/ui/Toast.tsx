"use client";

interface ToastProps {
  message: string;
  visible: boolean;
  /** Доп. классы Tailwind: z-index, позиция для экранов поверх sheet */
  className?: string;
}

export function Toast({ message, visible, className = "" }: ToastProps) {
  return (
    <div
      className={`
        fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[60]
        px-5 py-3 rounded-[10px]
        bg-[#0F172A]/90 backdrop-blur-sm
        text-white text-[13px] font-medium whitespace-nowrap
        pointer-events-none select-none
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
        ${className}
      `}
    >
      {message}
    </div>
  );
}
