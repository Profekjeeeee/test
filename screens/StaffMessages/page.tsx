"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHAT_UPDATED_EVENT,
  hydrateDentalMessages,
  subscribeDentalMessagesRealtime,
  getDoctorDialogPreviews,
  getDoctorPatientThreadMessages,
  getStaffBranchMessages,
  getStaffDialogPreviews,
  getSupportAuditLog,
  inferDoctorReplyPreference,
  markStaffConversationRead,
  sendAdminToPatient,
  sendDoctorToPatientPersonal,
  sendStaffToPatientClinic,
  type ChatMessage,
  type StaffDialogPreview,
  type SupportAuditEntry,
} from "@/lib/supportChat";
import { logout, resolveHydratedSession, getDentalSession, type DentalSession } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";

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

type StaffMessagesMode = "admin" | "doctor";

interface Props {
  mode: StaffMessagesMode;
  /** Встроено в кабинет врача: без «Назад», выхода и переключателя темы в шапке списка. */
  embedded?: boolean;
}

export default function StaffMessagesPage({ mode, embedded = false }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<DentalSession | null>(null);
  const [adminSection, setAdminSection] = useState<"clinic" | "support" | "audit">("support");
  const [previews, setPreviews] = useState<StaffDialogPreview[]>([]);
  const [audit, setAudit] = useState<SupportAuditEntry[]>([]);
  const [selected, setSelected] = useState<StaffDialogPreview | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void resolveHydratedSession().then(setSession);
  }, []);

  const channelFilter =
    mode === "doctor"
      ? ("doctor_merge" as const)
      : adminSection === "audit"
        ? null
        : adminSection;

  useEffect(() => {
    setSelected(null);
  }, [channelFilter, adminSection]);

  const refreshList = useCallback(() => {
    if (mode === "doctor") {
      const s = getDentalSession();
      if (!s?.phone) {
        setPreviews([]);
        return;
      }
      setPreviews(getDoctorDialogPreviews(s.phone));
      return;
    }
    if (!channelFilter || channelFilter === "doctor_merge") return;
    setPreviews(getStaffDialogPreviews(channelFilter));
  }, [channelFilter, mode]);

  const refreshAudit = useCallback(() => {
    setAudit([...getSupportAuditLog()].reverse());
  }, []);

  useEffect(() => {
    if (mode === "admin" && adminSection === "audit") {
      refreshAudit();
      const onCustom = () => refreshAudit();
      window.addEventListener(CHAT_UPDATED_EVENT, onCustom);
      return () => {
        window.removeEventListener(CHAT_UPDATED_EVENT, onCustom);
      };
    }
  }, [mode, adminSection, refreshAudit]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    void (async () => {
      await hydrateDentalMessages();
      if (cancelled) return;
      refreshList();
      if (cancelled) return;
      unsub = subscribeDentalMessagesRealtime(refreshList);
      if (cancelled) {
        unsub();
        unsub = undefined;
      }
    })();

    const onCustom = () => refreshList();
    window.addEventListener(CHAT_UPDATED_EVENT, onCustom);
    return () => {
      cancelled = true;
      unsub?.();
      unsub = undefined;
      window.removeEventListener(CHAT_UPDATED_EVENT, onCustom);
    };
  }, [refreshList]);

  const refreshThread = useCallback(() => {
    if (!selected || !session) return;
    if (selected.scope === "doctor_merge") {
      setThread(getDoctorPatientThreadMessages(session.phone, selected.patientId));
      return;
    }
    setThread(getStaffBranchMessages(selected.scope, selected.patientId));
  }, [selected, session]);

  useEffect(() => {
    if (!selected || !session) return;
    if (selected.scope === "doctor_merge") {
      markStaffConversationRead(selected.patientId, "doctor_merge", session.phone);
    } else {
      markStaffConversationRead(selected.patientId, selected.scope);
    }
    refreshThread();
    const onCustom = () => refreshThread();
    window.addEventListener(CHAT_UPDATED_EVENT, onCustom);
    return () => {
      window.removeEventListener(CHAT_UPDATED_EVENT, onCustom);
    };
  }, [selected, refreshThread, session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  const handleSendStaff = async () => {
    if (!selected || !draft.trim()) return;

    setSending(true);
    try {
      if (mode === "admin") {
        if (selected.scope === "clinic") {
          await sendAdminToPatient({ patientId: selected.patientId, chatType: "clinic", body: draft });
        } else {
          await sendAdminToPatient({ patientId: selected.patientId, chatType: "support", body: draft });
        }
      } else if (session) {
        const pref = inferDoctorReplyPreference(thread, session.phone);
        if (pref === "doctor") {
          await sendDoctorToPatientPersonal(session.phone, selected.patientId, draft);
        } else {
          await sendStaffToPatientClinic(selected.patientId, draft);
        }
      }

      setDraft("");
      refreshThread();
      refreshList();
      if (selected.scope === "doctor_merge" && session) {
        markStaffConversationRead(selected.patientId, "doctor_merge", session.phone);
      } else if (selected.scope !== "doctor_merge") {
        markStaffConversationRead(selected.patientId, selected.scope);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Ошибка отправки сообщения: " + message);
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.auth);
  };

  const backHref = mode === "admin" ? ROUTES.adminDashboard : ROUTES.doctorCabinet;

  const title = mode === "admin" ? "Сообщения (админ)" : "Пациенты";

  const unreadTotal = useMemo(
    () => previews.reduce((n, p) => n + (p.unread ? 1 : 0), 0),
    [previews]
  );

  const subtitleForDoctor = selected?.scope === "doctor_merge" && session ? (
    <span className="text-[11px] text-secondary block mt-1">
      Ответ по ветке:{" "}
      <span className="font-semibold text-[#0F172A] dark:text-white">
        {inferDoctorReplyPreference(thread, session.phone) === "doctor" ? "личный чат с врачом" : "чат клиники"}
      </span>{" "}
      (по последнему сообщению пациента)
    </span>
  ) : null;

  const threadSubtitle =
    selected && mode === "admin" ? (
      <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">
        {selected.scope === "clinic" ? "Клиника" : "Техподдержка"}
      </p>
    ) : (
      <>
        <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">Объединённый чат</p>
        {subtitleForDoctor}
      </>
    );

  const rootClass =
    mode === "admin"
      ? "min-h-dvh bg-surface dark:bg-app-canvas pb-[84px]"
      : embedded
        ? "flex flex-col flex-1 min-h-0 bg-surface dark:bg-app-canvas pb-[calc(env(safe-area-inset-bottom)+8px)]"
        : "min-h-dvh bg-surface dark:bg-app-canvas pb-[calc(env(safe-area-inset-bottom)+24px)]";

  const inner = (
    <div className={`max-w-[480px] mx-auto px-5 w-full min-h-0 flex flex-col ${embedded ? "pt-[max(0.25rem,calc(env(safe-area-inset-top,0px)+4px))] flex-1" : "pt-[calc(env(safe-area-inset-top,0px)+3rem)]"}`}>
        {!selected ? (
          <>
            <header className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-start gap-2 min-w-0">
                {!embedded ? (
                  <Link
                    href={backHref}
                    className="interactive-press-sm min-w-[44px] min-h-[44px] w-11 h-11 rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 shadow-raised-surface"
                    aria-label="Назад"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#0F172A] dark:text-white">
                      <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ) : (
                  <span className="w-0 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-secondary mb-1">{title}</p>
                  <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white leading-tight">
                    {mode === "admin" ? "Диалоги" : "Клиника и личные вопросы"}
                  </h1>
                  {unreadTotal > 0 ? (
                    <p className="text-[13px] text-primary mt-1 font-semibold">
                      Непрочитано: {unreadTotal}
                    </p>
                  ) : (
                    <p className="text-[13px] text-secondary mt-1">
                      {mode === "admin"
                        ? "Лог техподдержки и общий чат клиники"
                        : "Общие вопросы клинике и личные сообщения вашим пациентам"}
                    </p>
                  )}
                </div>
              </div>
              {!embedded ? (
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <ThemeToggleButton sizeClass="w-10 h-10" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="interactive-press-sm text-[12px] font-semibold text-secondary underline-offset-2 hover:underline px-1"
                  >
                    Выход
                  </button>
                </div>
              ) : null}
            </header>

            {mode === "admin" ? (
              <div className="flex rounded-[14px] bg-gray-100 dark:bg-slate-800 p-1 gap-1 mb-4">
                {(
                  [
                    { id: "support" as const, label: "Техподдержка" },
                    { id: "clinic" as const, label: "Клиника" },
                    { id: "audit" as const, label: "Журнал ТП" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminSection(t.id)}
                    className={`flex-1 py-2 rounded-[11px] text-[11px] font-semibold transition-all duration-150 ease-out interactive-press-sm border ${
                      adminSection === t.id
                        ? "bg-white dark:bg-slate-900 text-primary shadow-[0_4px_12px_rgba(15,23,42,0.08)] border-slate-200 dark:border-slate-700"
                        : "border-slate-200/85 dark:border-slate-600 text-slate-700 dark:text-slate-400 bg-transparent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-secondary mb-4 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-raised-surface">
                Здесь ветки «клиника» и личный чат с пациентом (к вашему номеру). Ответ автоматически уходит туда же,
                где пациент написал последним.
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
                      className="rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)]"
                    >
                      <div className="flex justify-between gap-2 text-[11px] text-secondary mb-1">
                        <span>{formatMsgTime(new Date(row.at).getTime())}</span>
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
                    <li key={`${p.patientId}_${p.scope}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(p)}
                        className="interactive-press-sm w-full text-left rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex gap-3 items-start shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.28)]"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-[13px] font-bold text-primary shrink-0">
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
                              ? `${
                                  p.lastMessage.senderRole === "client" ? "Пациент: " : ""
                                }${p.lastMessage.text}`
                              : "—"}
                          </p>
                          {p.lastMessage ? (
                            <p className="text-[10px] text-secondary mt-1 tabular-nums">
                              {formatMsgTime(p.lastMessage.timestamp)}
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
            <header className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    refreshList();
                  }}
                  className="interactive-press-sm w-10 h-10 rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 shadow-raised-surface"
                  aria-label="К списку"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#0F172A] dark:text-white">
                    <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  {threadSubtitle}
                  <h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white truncate">
                    {selected.patientName}
                  </h1>
                </div>
              </div>
              {!embedded ? <ThemeToggleButton sizeClass="w-10 h-10" className="mt-0.5" /> : null}
            </header>

            <div className="rounded-[16px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[280px] max-h-[52vh] overflow-y-auto px-3 py-3 space-y-3 mb-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              {thread.map((m) => {
                const isStaffSide = m.senderRole === "admin" || m.senderRole === "doctor";
                return (
                  <div key={m.id} className={`flex w-full ${isStaffSide ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`rounded-[14px] px-3.5 py-2.5 border break-words ${
                        isStaffSide
                          ? "max-w-[78%] bg-primary-light border-primary/25 text-[#0F172A] dark:text-white"
                          : "max-w-[85%] bg-surface dark:bg-app-canvas border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {isStaffSide ? (
                        <p className="text-[10px] font-semibold text-secondary mb-0.5 uppercase tracking-wide">
                          {m.chatType === "support"
                            ? "ТП"
                            : m.chatType === "doctor"
                              ? "Врач (личное)"
                              : "Клиника"}
                        </p>
                      ) : null}
                      {isStaffSide ? (
                        <p className="text-[11px] font-semibold text-primary mb-1">{m.senderName}</p>
                      ) : (
                        <p className="text-[11px] font-semibold text-secondary mb-1">Пациент</p>
                      )}
                      <p className="text-[14px] whitespace-pre-wrap leading-snug text-[#0F172A] dark:text-white">{m.text}</p>
                      <p className="text-[10px] text-secondary mt-1 tabular-nums">{formatMsgTime(m.timestamp)}</p>
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
                className="flex-1 min-h-[44px] max-h-28 resize-none rounded-[12px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-[14px] text-[#0F172A] dark:text-white placeholder:text-secondary shadow-raised-surface focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-slate-500/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendStaff();
                  }
                }}
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => void handleSendStaff()}
                disabled={!draft.trim() || sending}
                className="interactive-press-sm h-11 px-4 rounded-[12px] bg-primary text-white text-[13px] font-semibold shadow-[0_4px_12px_rgba(36,139,207,0.35)] dark:shadow-none border border-primary-dark/20 disabled:opacity-40 disabled:active:scale-100"
              >
                Отправить
              </button>
            </div>
          </>
        )}
      </div>
  );

  return createElement(embedded ? "div" : "main", {
    className: rootClass,
    style: { fontFamily: "Manrope, sans-serif" },
    children: inner,
  });
}
