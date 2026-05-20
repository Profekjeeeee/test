"use client";

import { messageWasEdited } from "@/lib/chatMessageMeta";

export type ChatMessageMetaVariant =
  | "patient-outgoing"
  | "patient-incoming"
  | "staff-outgoing"
  | "staff-incoming"
  | "doctor-outgoing"
  | "doctor-incoming";

const VARIANT_CLASS: Record<ChatMessageMetaVariant, string> = {
  "patient-outgoing": "text-white/75",
  "patient-incoming": "text-slate-500 dark:text-secondary",
  "staff-outgoing": "text-secondary",
  "staff-incoming": "text-secondary",
  "doctor-outgoing": "text-white/75",
  "doctor-incoming": "text-secondary",
};

type Props = {
  timestamp: number;
  editedAt?: number | null;
  align?: "left" | "right";
  variant: ChatMessageMetaVariant;
  formatTime: (ts: number) => string;
};

/** Нижняя строка пузыря: «изменено» + время (как в Telegram). */
export function ChatMessageMetaRow({ timestamp, editedAt, align = "left", variant, formatTime }: Props) {
  const edited = messageWasEdited(timestamp, editedAt);
  const tone = VARIANT_CLASS[variant];

  return (
    <p
      className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] tabular-nums leading-none ${tone} ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      {edited ? <span className="font-medium">изменено</span> : null}
      <span>{formatTime(timestamp)}</span>
    </p>
  );
}
