"use client";

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Над нижним таббаром пациента или у нижнего края (стафф). */
  placement?: "patientWithTabBar" | "staffPlain";
}

interface ConfirmDialogViewProps extends ConfirmDialogOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const PLACEMENT_BOTTOM: Record<NonNullable<ConfirmDialogOptions["placement"]>, string> = {
  patientWithTabBar:
    "bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+5.25rem))]",
  staffPlain: "bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+1rem))]",
};

export function ConfirmDialogView({
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  destructive = false,
  placement = "staffPlain",
  visible,
  onConfirm,
  onCancel,
}: ConfirmDialogViewProps) {
  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <button
        type="button"
        className={`fixed inset-0 cursor-default border-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out outline-none ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onCancel}
        aria-label="Закрыть"
      />
      <div
        className={`fixed left-1/2 z-[1] w-[calc(100%-32px)] max-w-md origin-bottom -translate-x-1/2 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out dark:border-slate-600 dark:bg-[#1E293B] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] ${PLACEMENT_BOTTOM[placement]} ${
          visible ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <p
            id="confirm-dialog-title"
            className="text-[16px] font-bold text-[#0F172A] dark:text-white mb-2"
          >
            {title}
          </p>
        ) : (
          <p id="confirm-dialog-title" className="sr-only">
            Подтверждение
          </p>
        )}
        <p id="confirm-dialog-desc" className="text-[14px] text-secondary leading-relaxed mb-5">
          {message}
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="interactive-press-sm flex-1 h-11 rounded-[10px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[14px] font-semibold text-gray-500 dark:text-slate-400 shadow-raised-surface"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`interactive-press-sm flex-1 h-11 rounded-[10px] text-[14px] font-semibold text-white border shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none disabled:opacity-60 ${
              destructive
                ? "bg-destructive border-white/15 shadow-[0_4px_12px_rgba(186,26,26,0.35)]"
                : "bg-primary border-primary-dark/25"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
