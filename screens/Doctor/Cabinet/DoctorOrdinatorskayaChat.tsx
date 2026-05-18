"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ToothStatus } from "@/types";
import type { ToastTone } from "@/components/ui/Toast";
import type { DentalEmployeeRecord, DentalSession } from "@/lib/auth";
import { getDentalEmployees, refreshDentalCaches } from "@/lib/auth";
import {
  fetchDoctorRoomMessages,
  ensureGeneralDoctorRoom,
  fetchMyDirectRoomPeerMap,
  findOrCreatePrivateDoctorRoom,
  sendDoctorRoomMessage,
  subscribeAllDoctorMessageInserts,
  type DoctorOrdinatorskayaMessage,
} from "@/lib/doctorOrdinatorskayaChat";
import ConsiliumFormulaPreview from "@/screens/Doctor/Cabinet/ConsiliumFormulaPreview";

function formatBubbleTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function mergeIncoming(prev: DoctorOrdinatorskayaMessage[], next: DoctorOrdinatorskayaMessage) {
  if (prev.some((m) => m.id === next.id)) return prev;
  return [...prev, next].sort((a, b) => a.createdAt - b.createdAt);
}

type ChatSurface = { kind: "general" } | { kind: "dm"; peer: DentalEmployeeRecord };

const GENERAL_CHAT_FALLBACK_NAME = "Ординаторская";

export default function DoctorOrdinatorskayaChat({
  session,
  showToast,
}: {
  session: DentalSession | null;
  showToast: (message: string, tone?: ToastTone) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [surface, setSurface] = useState<ChatSurface>({ kind: "general" });
  const [generalRoomId, setGeneralRoomId] = useState<string | null>(null);
  const [generalRoomName, setGeneralRoomName] = useState(GENERAL_CHAT_FALLBACK_NAME);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [peerToRoomId, setPeerToRoomId] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<DoctorOrdinatorskayaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [consiliumPreview, setConsiliumPreview] = useState<{
    patientId: string;
    patientName: string;
    formulaTeeth: ToothStatus[];
  } | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const myIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    myIdRef.current = session?.id ?? null;
  }, [session?.id]);

  const otherDoctors = useMemo(() => {
    const me = session?.id;
    return getDentalEmployees()
      .filter((e) => e.role === "doctor" && (!me || e.id !== me))
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
  }, [session?.id, loading]);

  /** Первичная загрузка: кэш сотрудников, общая комната, карта ЛС. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!session?.id || session.role !== "doctor") {
        setLoading(false);
        return;
      }
      setLoading(true);
      await refreshDentalCaches();
      const gen = await ensureGeneralDoctorRoom();
      if (cancelled) return;
      if (!gen) {
        setGeneralRoomId(null);
        setGeneralRoomName(GENERAL_CHAT_FALLBACK_NAME);
        setActiveRoomId(null);
        setMessages([]);
        showToast(
          "Не удалось открыть общий чат. Проверьте соединение или настройку Supabase.",
          "error"
        );
        setLoading(false);
        return;
      }
      setGeneralRoomId(gen.id);
      setGeneralRoomName(gen.name);

      const map = await fetchMyDirectRoomPeerMap(session.id);
      if (cancelled) return;
      setPeerToRoomId(map);
      setSurface({ kind: "general" });
      setActiveRoomId(gen.id);
      setUnreadByRoom((u) => ({ ...u, [gen.id]: 0 }));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.role, showToast]);

  /** Подгрузка сообщений при смене активной комнаты. */
  useEffect(() => {
    if (!activeRoomId || loading) return;
    let cancelled = false;
    void (async () => {
      setRoomLoading(true);
      const initial = await fetchDoctorRoomMessages(activeRoomId, 50);
      if (cancelled) return;
      setMessages(initial);
      setRoomLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRoomId, loading]);

  /** Глобальный Realtime: одна подписка, разводка по активной комнате и непрочитанным. */
  useEffect(() => {
    if (!session?.id || session.role !== "doctor") return;
    const off = subscribeAllDoctorMessageInserts((msg) => {
      if (msg.roomId === activeRoomIdRef.current) {
        setMessages((prev) => mergeIncoming(prev, msg));
        return;
      }
      if (msg.senderId !== myIdRef.current) {
        setUnreadByRoom((prev) => ({
          ...prev,
          [msg.roomId]: (prev[msg.roomId] ?? 0) + 1,
        }));
      }
    });
    return off;
  }, [session?.id, session?.role]);

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading, roomLoading]);

  const openGeneral = useCallback(() => {
    if (!generalRoomId) return;
    setSurface({ kind: "general" });
    setActiveRoomId(generalRoomId);
    setUnreadByRoom((u) => ({ ...u, [generalRoomId]: 0 }));
    setDrawerOpen(false);
  }, [generalRoomId]);

  const openDoctorDm = useCallback(
    async (peer: DentalEmployeeRecord) => {
      if (!session?.id || session.role !== "doctor") return;
      setDrawerOpen(false);
      const { roomId, error } = await findOrCreatePrivateDoctorRoom(session.id, peer.id);
      if (error || !roomId) {
        showToast(error ?? "Не удалось открыть чат", "error");
        return;
      }
      setPeerToRoomId((m) => ({ ...m, [peer.id]: roomId }));
      setSurface({ kind: "dm", peer });
      setActiveRoomId(roomId);
      setUnreadByRoom((u) => ({ ...u, [roomId]: 0 }));
    },
    [session, showToast]
  );

  const handleSend = useCallback(async () => {
    if (!activeRoomId || !session?.id || session.role !== "doctor") {
      showToast("Нет данных врача для отправки", "error");
      return;
    }
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const { message, error } = await sendDoctorRoomMessage({
        roomId: activeRoomId,
        senderId: session.id,
        senderName: session.fullName ?? "",
        body: text,
      });
      if (error) {
        showToast(error, "error");
        return;
      }
      if (message) {
        setMessages((prev) => mergeIncoming(prev, message));
      }
      setDraft("");
    } finally {
      setSending(false);
    }
  }, [draft, activeRoomId, sending, session, showToast]);

  const headerTitle =
    surface.kind === "general"
      ? generalRoomName.trim() || GENERAL_CHAT_FALLBACK_NAME
      : surface.peer.fullName.trim() || "Коллега";

  const headerSubtitle =
    surface.kind === "general" ? "Общий чат клиники" : "Личные сообщения";

  const drawerUnreadGeneral = generalRoomId ? unreadByRoom[generalRoomId] ?? 0 : 0;
  const totalMenuUnread = Object.values(unreadByRoom).reduce((a, n) => a + n, 0);

  if (!session || session.role !== "doctor") {
    return (
      <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-slate-600 px-4 py-12 text-center">
        <p className="text-[14px] text-secondary">Вход доступен только для врачей.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 mt-1 relative">
      {/* Шапка чата */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="interactive-press-sm relative h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-primary flex items-center justify-center shadow-[0_2px_8px_rgba(15,23,42,0.06)] shrink-0"
          aria-label="Список чатов"
          aria-expanded={drawerOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 7H19M5 12H19M5 17H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {totalMenuUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">
              {totalMenuUnread > 99 ? "99+" : totalMenuUnread}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[15px] font-bold text-[#0F172A] dark:text-white leading-snug truncate">
            {headerTitle}
          </p>
          <p className="text-[12px] text-secondary truncate">{headerSubtitle}</p>
        </div>
      </div>

      {/* Шторка списка чатов */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] border-0 cursor-default"
            aria-label="Закрыть список"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="relative z-[1] w-[min(100%,320px)] max-w-[92vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-[8px_0_32px_rgba(15,23,42,0.12)] flex flex-col"
            role="navigation"
            aria-label="Чаты врачей"
          >
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Сообщения</p>
              <p className="text-[13px] text-secondary mt-0.5">Клиника и коллеги</p>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain py-2 px-2">
              <button
                type="button"
                onClick={() => void openGeneral()}
                className={`w-full text-left rounded-xl px-3 py-3 mb-1 flex items-center gap-3 transition-colors ${
                  surface.kind === "general"
                    ? "bg-primary-light dark:bg-primary/15 border border-primary/25"
                    : "border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80"
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 text-[18px] font-bold">
                  О
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">
                    Общий чат
                  </p>
                  <p className="text-[12px] text-secondary truncate">
                    {generalRoomName.trim() || GENERAL_CHAT_FALLBACK_NAME}
                  </p>
                </div>
                {drawerUnreadGeneral > 0 && (
                  <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                    {drawerUnreadGeneral > 99 ? "99+" : drawerUnreadGeneral}
                  </span>
                )}
              </button>

              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary px-3 mt-3 mb-2">
                Врачи
              </p>
              {otherDoctors.length === 0 ? (
                <p className="text-[13px] text-secondary px-3 py-2">Нет других врачей в списке.</p>
              ) : (
                otherDoctors.map((doc) => {
                  const rid = peerToRoomId[doc.id];
                  const unread = rid ? unreadByRoom[rid] ?? 0 : 0;
                  const active =
                    surface.kind === "dm" && surface.peer.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => void openDoctorDm(doc)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 mb-0.5 flex items-center gap-3 transition-colors ${
                        active
                          ? "bg-primary-light dark:bg-primary/15 border border-primary/25"
                          : "border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-slate-200/90 dark:bg-slate-700 text-primary flex items-center justify-center shrink-0 text-[13px] font-bold">
                        {doc.fullName.trim().charAt(0) || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white truncate">
                          {doc.fullName}
                        </p>
                        {doc.specialization ? (
                          <p className="text-[11px] text-secondary truncate">{doc.specialization}</p>
                        ) : (
                          <p className="text-[11px] text-secondary">Личный чат</p>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 min-h-[min(380px,50dvh)] max-h-[min(520px,58dvh)] overflow-y-auto overscroll-contain px-3 py-2 space-y-2 rounded-2xl bg-[#EEF2F7]/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {(loading || roomLoading) && (
          <p className="text-center text-[13px] text-secondary py-8">Загрузка…</p>
        )}
        {!loading && !roomLoading && !!activeRoomId && messages.length === 0 && (
          <p className="text-center text-[13px] text-secondary py-8">Пока нет сообщений — напишите первым.</p>
        )}
        {!loading && !roomLoading && messages.length > 0 &&
          messages.map((m) => {
            const mine = m.senderId === session.id;
            const consilium = m.metadata?.type === "consilium" ? m.metadata : null;
            return (
              <div key={m.id} className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-[18px] px-2.5 py-2 shadow-sm ${
                    mine
                      ? "max-w-[78%] bg-primary text-white rounded-br-md"
                      : "max-w-[85%] bg-white dark:bg-slate-800 text-[#0F172A] dark:text-white border border-slate-200/90 dark:border-slate-700 rounded-bl-md"
                  }`}
                >
                  {!mine && (
                    <p className="text-[11px] font-semibold text-primary dark:text-primary/90 mb-1 truncate px-1">
                      {m.senderName || "Коллега"}
                    </p>
                  )}
                  {consilium ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setConsiliumPreview({
                            patientId: consilium.patientId,
                            patientName: consilium.patientName?.trim() || "Пациент",
                            formulaTeeth: consilium.formulaTeeth,
                          })
                        }
                        className={`w-full text-left rounded-2xl border-2 px-3 py-2.5 transition-transform active:scale-[0.99] interactive-press-sm ${
                          mine
                            ? "border-white/55 bg-white text-[#0F172A] shadow-[0_4px_14px_rgba(0,0,0,0.12)]"
                            : "border-primary/35 bg-primary-light/70 dark:bg-primary/20 dark:border-primary/40"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center ${
                              mine ? "bg-primary/12 text-primary" : "bg-primary/20 text-primary"
                            }`}
                            aria-hidden
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M9 14L4 9M4 9L9 4M4 9H14.5C17.5376 9 20 11.4624 20 14.5V16"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Консилиум</p>
                            <p className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100 leading-snug truncate">
                              {consilium.patientName?.trim() || "Пациент"}
                            </p>
                            <p className="text-[12px] text-secondary dark:text-slate-300 leading-snug line-clamp-2 mt-0.5">
                              {m.body}
                            </p>
                            <p className="text-[11px] font-semibold text-primary mt-1.5">Открыть формулу</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <p
                      className={`text-[15px] leading-snug whitespace-pre-wrap break-words px-1 ${
                        mine ? "" : ""
                      }`}
                    >
                      {m.body}
                    </p>
                  )}
                  <p
                    className={`text-[10px] mt-1 tabular-nums px-1 ${
                      mine ? "text-white/75 text-right" : "text-secondary text-right"
                    }`}
                  >
                    {formatBubbleTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        <div ref={endRef} className="h-1 shrink-0" />
      </div>

      <div className="flex gap-2 mt-3 shrink-0 pt-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Сообщение…"
          disabled={!activeRoomId || sending}
          className="flex-1 min-w-0 h-11 rounded-[14px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 text-[15px] text-[#0F172A] dark:text-white placeholder:text-secondary/70"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!activeRoomId || sending || !draft.trim()}
          className="h-11 px-4 rounded-[14px] bg-primary text-white text-[14px] font-semibold shadow-[0_4px_14px_rgba(36,139,207,0.35)] disabled:opacity-45 active:scale-[0.98] shrink-0"
        >
          {sending ? "…" : "→"}
        </button>
      </div>

      <ConsiliumFormulaPreview
        open={consiliumPreview != null}
        onClose={() => setConsiliumPreview(null)}
        patientId={consiliumPreview?.patientId ?? ""}
        patientName={consiliumPreview?.patientName ?? ""}
        formulaTeeth={consiliumPreview?.formulaTeeth ?? []}
      />
    </div>
  );
}
