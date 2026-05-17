"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import BottomBar from "@/components/layout/BottomBar";
import { ROUTES } from "@/lib/routes";
import { getCurrentUserId, resolveHydratedSession, refreshDentalCaches } from "@/lib/auth";
import {
  CHAT_UPDATED_EVENT,
  hydrateDentalMessages,
  subscribeDentalMessagesRealtime,
  getPatientBranchMessages,
  getPatientUnread,
  markPatientConversationRead,
  resolveAttendingDoctor,
  sendPatientMessage,
  type PatientChatTab,
  type ChatMessage,
} from "@/lib/supportChat";

function formatMsgTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export default function PatientSupportChatPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [tab, setTab] = useState<PatientChatTab>("clinic");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      await refreshDentalCaches();
      await resolveHydratedSession();
      setUid(getCurrentUserId());
    })();
  }, []);

  const refresh = useCallback(() => {
    setMessages(getPatientBranchMessages(tab));
  }, [tab]);

  useEffect(() => {
    refresh();
    if (!uid) return;
    markPatientConversationRead(uid, tab);
  }, [uid, tab, refresh]);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    void (async () => {
      await hydrateDentalMessages();
      refresh();
      unsub = subscribeDentalMessagesRealtime(refresh);
    })();

    const onCustom = () => refresh();
    window.addEventListener(CHAT_UPDATED_EVENT, onCustom);
    window.addEventListener("appointmentsUpdated", onCustom);
    return () => {
      unsub?.();
      window.removeEventListener(CHAT_UPDATED_EVENT, onCustom);
      window.removeEventListener("appointmentsUpdated", onCustom);
    };
  }, [refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendPatientMessage(tab, draft);
      setDraft("");
      refresh();
      const u = getCurrentUserId();
      if (u) markPatientConversationRead(u, tab);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Ошибка отправки сообщения: " + message);
    } finally {
      setSending(false);
    }
  };

  const clinicUnread = Boolean(uid && tab !== "clinic" && getPatientUnread(uid, "clinic"));
  const supportUnread = Boolean(uid && tab !== "support" && getPatientUnread(uid, "support"));
  const doctorUnread = Boolean(uid && tab !== "doctor" && getPatientUnread(uid, "doctor"));

  const emptyHint =
    tab === "clinic"
      ? "Задайте вопрос по лечению, записи или состоянию — ответит администратор или ваш врач."
      : tab === "support"
        ? "Опишите проблему с приложением — её увидит технический администратор."
        : "Напишите лечащему врачу — сообщение будет только ему и вам.";

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe flex flex-col">
      <header className="px-5 pt-12 pb-3 border-b border-slate-200 dark:border-white/8 shrink-0 shadow-[0_4px_12px_rgba(15,23,42,0.04)] dark:shadow-none bg-white/80 dark:bg-app-nav/82 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={ROUTES.clientHome}
            className="interactive-press-sm w-10 h-10 rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center text-secondary shadow-raised-surface"
            aria-label="Назад"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#0F172A] dark:text-white">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] dark:text-white leading-tight">
              Поддержка / чат
            </h1>
            <p className="text-[12px] text-secondary mt-0.5">
              Вопросы по лечению или работе приложения
            </p>
          </div>
        </div>

        <div className="flex rounded-[14px] bg-gray-100 dark:bg-slate-800 p-1 gap-1">
          {(
            [
              { id: "clinic" as const, label: "Клиника", hint: clinicUnread },
              { id: "support" as const, label: "Техподдержка", hint: supportUnread },
              { id: "doctor" as const, label: "Мой лечащий врач", hint: doctorUnread },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-2.5 rounded-[11px] text-[11px] font-semibold transition-all duration-150 ease-out interactive-press-sm leading-tight border ${
                tab === t.id
                  ? "bg-white dark:bg-slate-900 text-primary shadow-[0_4px_12px_rgba(15,23,42,0.08)] border-slate-200 dark:border-slate-700"
                  : "border-slate-200/85 dark:border-slate-600 text-slate-700 dark:text-slate-400 bg-white/50 dark:bg-transparent"
              }`}
            >
              {t.label}
              {t.hint ? (
                <span
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary"
                  aria-hidden
                />
              ) : null}
            </button>
          ))}
        </div>

        {tab === "doctor" ? (
          <p className="text-[13px] text-secondary mt-3">
            Чат с врачом:{" "}
            <span className="font-semibold text-[#0F172A] dark:text-white">
              {resolveAttendingDoctor().doctorName}
            </span>
          </p>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-36">
        {!uid ? (
          <p className="text-[14px] text-secondary text-center py-8">
            Войдите как пациент, чтобы пользоваться чатом.
          </p>
        ) : messages.length === 0 ? (
          <div className="rounded-[16px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-6 text-center shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)]">
            <p className="text-[14px] text-[#0F172A] dark:text-white font-medium mb-1">
              Пока нет сообщений
            </p>
            <p className="text-[13px] text-secondary leading-snug">{emptyHint}</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === "client" && m.senderId === uid;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 border ${
                    mine
                      ? "bg-primary-light border-primary/25 text-[#0F172A] dark:text-white"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-white shadow-raised-surface"
                  }`}
                >
                  {!mine ? (
                    <p className="text-[11px] font-semibold text-primary mb-1">{m.senderName}</p>
                  ) : null}
                  <p className="text-[14px] whitespace-pre-wrap leading-snug">{m.text}</p>
                  <p className="text-[10px] text-secondary mt-1.5 tabular-nums">{formatMsgTime(m.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="shrink-0 border-t border-slate-200 dark:border-white/8 bg-white dark:bg-app-nav px-4 py-3 fixed left-1/2 -translate-x-1/2 w-full max-w-[390px] z-40 shadow-[0_-6px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_-8px_28px_rgba(0,0,0,0.45)]"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex gap-2 items-end max-w-[390px] mx-auto">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Сообщение…"
            rows={1}
            className="flex-1 min-h-[44px] max-h-28 resize-none rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-[14px] text-[#0F172A] dark:text-white placeholder:text-secondary shadow-raised-surface focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-slate-500/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!uid || sending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!uid || !draft.trim() || sending}
            className="interactive-press-sm h-11 px-4 rounded-[12px] bg-primary text-white text-[13px] font-semibold shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/20 disabled:opacity-40 disabled:active:scale-100"
          >
            Отпр.
          </button>
        </div>
      </div>

      <BottomBar />
    </div>
  );
}
