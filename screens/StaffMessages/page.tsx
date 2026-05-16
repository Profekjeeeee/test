"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHAT_UPDATED_EVENT,
  SUPPORT_CHAT_POLL_MS,
  type SupportChatChannel,
  type StaffDialogPreview,
  type SupportChatMessage,
  getStaffDialogPreviews,
  getSupportAuditLog,
  getSupportMessages,
  markStaffConversationRead,
  sendStaffMessage,
  type SupportAuditEntry,
} from "@/lib/supportChat";
import {
  getDentalSession,
  logout,
  type DentalSession,
} from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type StaffMessagesMode = "admin" | "doctor";

interface Props {
  mode: StaffMessagesMode;
}

export default function StaffMessagesPage({ mode }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<DentalSession | null>(null);
  const [adminSection, setAdminSection] = useState<"clinic" | "support" | "audit">("clinic");
  const [doctorChannel] = useState<SupportChatChannel>("clinic");
  const [previews, setPreviews] = useState<StaffDialogPreview[]>([]);
  const [audit, setAudit] = useState<SupportAuditEntry[]>([]);
  const [selected, setSelected] = useState<StaffDialogPreview | null>(null);
  const [thread, setThread] = useState<SupportChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSession(getDentalSession());
  }, []);

  const channelFilter: SupportChatChannel | null =
    mode === "doctor" ? doctorChannel : adminSection === "audit" ? null : adminSection;

  useEffect(() => {
    setSelected(null);
  }, [channelFilter, adminSection]);

  const refreshList = useCallback(() => {
    if (!channelFilter) return;
    setPreviews(getStaffDialogPreviews(channelFilter));
  }, [channelFilter]);

  const refreshAudit = useCallback(() => {
    setAudit([...getSupportAuditLog()].reverse());
  }, []);

  useEffect(() => {
    if (mode === "admin" && adminSection === "audit") {
      refreshAudit();
      const onEvt = () => refreshAudit();
      window.addEventListener(CHAT_UPDATED_EVENT, onEvt);
      const id = window.setInterval(refreshAudit, SUPPORT_CHAT_POLL_MS);
      return () => {
        window.removeEventListener(CHAT_UPDATED_EVENT, onEvt);
        window.clearInterval(id);
      };
    }
  }, [mode, adminSection, refreshAudit]);

  useEffect(() => {
    refreshList();
    const onEvt = () => refreshList();
    window.addEventListener(CHAT_UPDATED_EVENT, onEvt);
    window.addEventListener("storage", onEvt);
    const id = window.setInterval(refreshList, SUPPORT_CHAT_POLL_MS);
    return () => {
      window.removeEventListener(CHAT_UPDATED_EVENT, onEvt);
      window.removeEventListener("storage", onEvt);
      window.clearInterval(id);
    };
  }, [refreshList]);

  const refreshThread = useCallback(() => {
    if (!selected) return;
    setThread(getSupportMessages(selected.patientId, selected.channel));
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    markStaffConversationRead(selected.patientId, selected.channel);
    refreshThread();
    const onEvt = () => refreshThread();
    window.addEventListener(CHAT_UPDATED_EVENT, onEvt);
    window.addEventListener("storage", onEvt);
    const id = window.setInterval(refreshThread, SUPPORT_CHAT_POLL_MS);
    return () => {
      window.removeEventListener(CHAT_UPDATED_EVENT, onEvt);
      window.removeEventListener("storage", onEvt);
      window.clearInterval(id);
    };
  }, [selected, refreshThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  const staffLabel = session?.fullName?.trim() || "Сотрудник";

  const handleSendStaff = () => {
    if (!selected || !draft.trim()) return;
    sendStaffMessage(selected.patientId, selected.channel, draft, staffLabel);
    setDraft("");
    refreshThread();
    refreshList();
    markStaffConversationRead(selected.patientId, selected.channel);
  };

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.auth);
  };

  const backHref = mode === "admin" ? ROUTES.adminDashboard : ROUTES.doctorCabinet;

  const title = mode === "admin" ? "Сообщения (админ)" : "Сообщения пациентов";

  const unreadTotal = useMemo(
    () => previews.reduce((n, p) => n + (p.unread ? 1 : 0), 0),
    [previews]
  );

  return (
    <main
      className={`min-h-dvh bg-[#F8FAFB] dark:bg-slate-950 ${
        mode === "admin" ? "pb-[84px]" : "pb-[calc(env(safe-area-inset-bottom)+24px)]"
      }`}
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="max-w-[480px] mx-auto px-5 pt-12">
        {!selected ? (
          <>
            <header className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-start gap-2">
                <Link
                  href={backHref}
                  className="w-10 h-10 rounded-[12px] border border-gray-200 dark:border-slate-600 flex items-center justify-center shrink-0 mt-0.5 active:scale-95 transition-transform"
                  aria-label="Назад"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#0F172A] dark:text-white">
                    <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-secondary mb-1">{title}</p>
                  <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white leading-tight">
                    Диалоги
                  </h1>
                  {unreadTotal > 0 ? (
                    <p className="text-[13px] text-primary mt-1 font-semibold">
                      Непрочитано: {unreadTotal}
                    </p>
                  ) : (
                    <p className="text-[13px] text-secondary mt-1">Активные переписки с пациентами</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[12px] font-semibold text-secondary underline-offset-2 hover:underline active:scale-95"
              >
                Выход
              </button>
            </header>

            {mode === "admin" ? (
              <div className="flex rounded-[14px] bg-gray-100 dark:bg-slate-800 p-1 gap-1 mb-4">
                {(
                  [
                    { id: "clinic" as const, label: "Клиника" },
                    { id: "support" as const, label: "Техподдержка" },
                    { id: "audit" as const, label: "Журнал ТП" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminSection(t.id)}
                    className={`flex-1 py-2 rounded-[11px] text-[12px] font-semibold transition-all active:scale-95 ${
                      adminSection === t.id
                        ? "bg-white dark:bg-slate-900 text-primary shadow-sm border border-gray-100 dark:border-slate-700"
                        : "text-secondary"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-secondary mb-4 rounded-[14px] border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                Канал «Клиника»: вопросы по лечению и записи. Канал техподдержки доступен в админ-панели.
              </p>
            )}

            {mode === "admin" && adminSection === "audit" ? (
              <ul className="space-y-2">
                {audit.length === 0 ? (
                  <li className="text-[14px] text-secondary py-10 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-[14px]">
                    Журнал пуст — сообщения техподдержки появятся здесь.
                  </li>
                ) : (
                  audit.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-[14px] border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                    >
                      <div className="flex justify-between gap-2 text-[11px] text-secondary mb-1">
                        <span>{formatMsgTime(row.at)}</span>
                        <span className="font-mono text-[10px] opacity-80">{row.patientId}</span>
                      </div>
                      <p className="text-[11px] font-bold text-primary mb-0.5">
                        {row.sender === "patient" ? "Пациент →" : "Сотрудник →"}
                      </p>
                      <p className="text-[13px] text-[#0F172A] dark:text-white leading-snug">{row.preview}</p>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <ul className="space-y-2">
                {previews.length === 0 ? (
                  <li className="text-[14px] text-secondary py-12 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-[14px]">
                    Нет активных диалогов в этом канале.
                  </li>
                ) : (
                  previews.map((p) => (
                    <li key={`${p.patientId}_${p.channel}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(p)}
                        className="w-full text-left rounded-[14px] border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex gap-3 items-start active:scale-[0.99] transition-transform"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-light dark:bg-[#1A3D3F] flex items-center justify-center text-[13px] font-bold text-primary shrink-0">
                          {p.patientName.trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">
                              {p.patientName}
                            </p>
                            {p.unread ? (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Непрочитано" />
                            ) : null}
                          </div>
                          <p className="text-[12px] text-secondary truncate mt-0.5">
                            {p.lastMessage
                              ? `${p.lastMessage.sender === "patient" ? "Пациент: " : ""}${p.lastMessage.body}`
                              : "—"}
                          </p>
                          {p.lastMessage ? (
                            <p className="text-[10px] text-secondary mt-1 tabular-nums">
                              {formatMsgTime(p.lastMessage.createdAt)}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        ) : (
          <>
            <header className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  refreshList();
                }}
                className="w-10 h-10 rounded-[12px] border border-gray-200 dark:border-slate-600 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                aria-label="К списку"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#0F172A] dark:text-white">
                  <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                  {selected.channel === "clinic" ? "Клиника" : "Техподдержка"}
                </p>
                <h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white truncate">
                  {selected.patientName}
                </h1>
              </div>
            </header>

            <div className="rounded-[16px] border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[280px] max-h-[52vh] overflow-y-auto px-3 py-3 space-y-3 mb-3">
              {thread.map((m) => {
                const staffSide = m.sender === "staff";
                return (
                  <div key={m.id} className={`flex ${staffSide ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-[14px] px-3.5 py-2.5 border ${
                        staffSide
                          ? "bg-primary-light dark:bg-[#1A3D3F] border-primary/25 text-[#0F172A] dark:text-white"
                          : "bg-[#F8FAFB] dark:bg-slate-950 border-[#E2E8F0] dark:border-slate-700"
                      }`}
                    >
                      {staffSide ? (
                        <p className="text-[11px] font-semibold text-primary mb-1">{m.staffLabel ?? "Сотрудник"}</p>
                      ) : (
                        <p className="text-[11px] font-semibold text-secondary mb-1">Пациент</p>
                      )}
                      <p className="text-[14px] whitespace-pre-wrap leading-snug text-[#0F172A] dark:text-white">{m.body}</p>
                      <p className="text-[10px] text-secondary mt-1 tabular-nums">{formatMsgTime(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 items-end">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ответ пациенту…"
                rows={1}
                className="flex-1 min-h-[44px] max-h-28 resize-none rounded-[12px] border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-[14px] text-[#0F172A] dark:text-white placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendStaff();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSendStaff}
                disabled={!draft.trim()}
                className="h-11 px-4 rounded-[12px] bg-primary text-white text-[13px] font-semibold disabled:opacity-40 active:scale-95 transition-transform"
              >
                Отправить
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
