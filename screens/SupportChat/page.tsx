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
    let cancelled = false;
    let unsub: (() => void) | undefined;

    void (async () => {
      await hydrateDentalMessages();
      if (cancelled) return;
      refresh();
      if (cancelled) return;
      unsub = subscribeDentalMessagesRealtime(refresh);
      if (cancelled) {
        unsub();
        unsub = undefined;
      }
    })();

    const onCustom = () => refresh();
    window.addEventListener(CHAT_UPDATED_EVENT, onCustom);
    window.addEventListener("appointmentsUpdated", onCustom);
    return () => {
      cancelled = true;
      unsub?.();
      unsub = undefined;
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
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-surface dark:bg-app-canvas pb-safe">
      <header className="shrink-0 border-b border-slate-200 bg-white/80 px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+3rem)] shadow-[0_4px_12px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-white/8 dark:bg-app-nav/82 dark:shadow-none">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={ROUTES.clientHome}
            className="interactive-press-sm min-w-[44px] min-h-[44px] w-11 h-11 rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center text-secondary shadow-raised-surface"
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
              { id: "doctor" as const, label: "Мой лечащий врач", hint: doctorUnread },
              { id: "support" as const, label: "Техподдержка", hint: supportUnread },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-2.5 rounded-[11px] text-[11px] font-semibold transition-all duration-150 ease-out interactive-press-sm leading-snug border ${
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

      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div
            className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain p-4 space-y-3"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!uid ? (
              <p className="text-[14px] text-secondary text-center py-8 px-1">
                Войдите как пациент, чтобы пользоваться чатом.
              </p>
            ) : messages.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[14px] text-[#0F172A] dark:text-white font-medium mb-1">
                  Пока нет сообщений
                </p>
                <p className="text-[13px] text-secondary leading-snug">{emptyHint}</p>
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.senderRole === "client" && m.senderId === uid;
                return (
                  <div
                    key={m.id}
                    className={`flex w-full shrink-0 ${mine ? "justify-end items-end pl-10" : "justify-start items-end pr-10"}`}
                  >
                    <div
                      className={`max-w-[80%] break-words px-4 py-2 shadow-sm rounded-2xl ${
                        mine
                          ? "mr-2 ml-0 rounded-tr-none bg-primary text-white border border-primary-dark/30 dark:border-primary-dark/40 dark:text-white"
                          : "ml-1 mr-0 rounded-tl-none border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-100"
                      }`}
                    >
                      {!mine ? (
                        <p className="text-[11px] font-semibold text-primary mb-1 dark:text-[#94c4ee]">{m.senderName}</p>
                      ) : null}
                      <p
                        className={`text-[14px] whitespace-pre-wrap leading-snug [overflow-wrap:anywhere] ${mine ? "text-white" : ""}`}
                      >
                        {m.text}
                      </p>
                      <p
                        className={`text-[10px] mt-1.5 tabular-nums ${mine ? "text-right text-white/75" : "text-left text-slate-500 dark:text-secondary"}`}
                      >
                        {formatMsgTime(m.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex w-full max-w-[390px] items-center gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Сообщение…"
              rows={1}
              className="min-h-[44px] max-h-28 flex-1 resize-none rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-[14px] leading-snug text-slate-800 shadow-sm placeholder:text-secondary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-primary/40 dark:focus:ring-primary/30"
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
              aria-label="Отправить"
              title="Отправить"
              className="interactive-press-sm flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary-dark/25 bg-primary text-white shadow-sm disabled:pointer-events-none disabled:opacity-40 dark:border-primary-dark/40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <BottomBar />
    </div>
  );
}
