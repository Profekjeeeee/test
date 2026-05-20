"use client";

type Props = {
  open: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function MenuIconEdit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-secondary" aria-hidden>
      <path
        d="M4 20H8L18.5 9.5L14.5 5.5L4 16V20Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5L17.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuIconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
      <path
        d="M5 7H19M9 7V5H15V7M8 7L9 19H15L16 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatMessageContextMenu({
  open,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  if (!open || (!canEdit && !canDelete)) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[1px]"
        aria-label="Закрыть меню"
        onClick={onClose}
      />
      <div
        role="menu"
        className="fixed left-1/2 top-[42%] z-[90] w-[min(280px,calc(100vw-2.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
      >
        {canEdit ? (
          <button
            type="button"
            role="menuitem"
            className="interactive-press-sm flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-[#0F172A] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/90"
            onClick={() => {
              onEdit();
              onClose();
            }}
          >
            <MenuIconEdit />
            Изменить
          </button>
        ) : null}
        {canEdit && canDelete ? (
          <div className="h-px bg-slate-200 dark:bg-slate-700" role="separator" />
        ) : null}
        {canDelete ? (
          <button
            type="button"
            role="menuitem"
            className="interactive-press-sm flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <MenuIconTrash />
            Удалить
          </button>
        ) : null}
      </div>
    </>
  );
}
