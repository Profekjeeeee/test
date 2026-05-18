"use client";

export type ToastPlacementVariant = "patientWithTabBar" | "staffPlain";
export type ToastTone = "success" | "error";

interface ToastProps {
  message: string;
  visible: boolean;
  /** Позиция над нижним таббаром (пациент) или без таббара (стафф / врач). */
  variant?: ToastPlacementVariant;
  tone?: ToastTone;
  /** Доп. классы: z-index, тень над sheet и т.д. */
  className?: string;
}

const VARIANT_BOTTOM: Record<ToastPlacementVariant, string> = {
  patientWithTabBar:
    "bottom-[calc(72px+env(safe-area-inset-bottom,16px))]",
  staffPlain: "bottom-[calc(16px+env(safe-area-inset-bottom,16px))]",
};

export function Toast({
  message,
  visible,
  variant = "patientWithTabBar",
  tone = "success",
  className = "",
}: ToastProps) {
  const toneSurface =
    tone === "success"
      ? "bg-primary text-white border border-white/15 shadow-[0_8px_28px_rgba(36,139,207,0.38)]"
      : "bg-destructive text-white border border-white/15 shadow-[0_8px_28px_rgba(186,26,26,0.38)]";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed left-4 right-4 z-[60] max-w-none
        px-4 py-3 rounded-[14px]
        flex items-start gap-2.5
        pointer-events-none select-none font-semibold text-[13px]
        whitespace-normal break-words
        backdrop-blur-[2px]
        transition-all duration-300
        ${VARIANT_BOTTOM[variant]}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"}
        ${toneSurface}
        ${className}
      `.trim()}
    >
      {tone === "success" ? (
        <span
          className="flex-shrink-0 mt-0.5 w-[22px] h-[22px] rounded-full bg-white/22 flex items-center justify-center shadow-inner ring-1 ring-white/35"
          aria-hidden
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
          >
            <path
              d="M10 3.25 4.75 8.25 2 5.541"
              stroke="currentColor"
              strokeWidth="1.85"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : (
        <span
          className="flex-shrink-0 mt-0.5 w-[22px] h-[22px] rounded-full bg-white/22 flex items-center justify-center shadow-inner ring-1 ring-white/35"
          aria-hidden
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
          >
            <path d="M3 9 9 3M9 9 3 3" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <span className="flex-1 min-w-0 leading-snug pt-[1px]">{message}</span>
    </div>
  );
}
