import { dentalApiFetch } from "@/lib/api/fetchApi";
import {
  getCurrentUserId,
  getDentalClients,
  getDentalEmployees,
  getDentalSession,
} from "@/lib/auth";
import { log } from "@/lib/logger";
import { getAppointments, getNextAppointment } from "@/lib/appointments";
import type { ChatMessage } from "@/types";
import type { Appointment } from "@/lib/appointments";
import { removeSupabaseChannel, uniqueRealtimeChannelName } from "@/lib/supabaseRealtime";
import { supabase } from "@/lib/supabaseClient";

export type { ChatMessage };

export type PatientChatTab = "clinic" | "support" | "doctor";

/** @deprecated alias — используйте PatientChatTab */
export type SupportChatChannel = "clinic" | "support";

export const DENTAL_CHAT_UPDATED_EVENT = "dental_chat_updated";
export const CHAT_UPDATED_EVENT = DENTAL_CHAT_UPDATED_EVENT;

const PATIENT_READS_KEY = "dental_chat_patient_read_v2";
const STAFF_READS_KEY = "dental_chat_staff_read_v2";
const SUPPORT_AUDIT_KEY = "dental_chat_support_audit";

const DEFAULT_ATTENDING_DOCTOR_PHONE = "79991112233";

function isSupportInboxRecipient(id: string): boolean {
  return id === "support" || id === "admin";
}

interface DbMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  chat_type: string;
  sender_role: string;
  sender_name: string;
  created_at: string;
  updated_at?: string | null;
}

let messagesCache: ChatMessage[] = [];

function dbRowToChatMessage(row: DbMessageRow): ChatMessage {
  const timestamp = new Date(row.created_at).getTime();
  const editedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
  return {
    id: row.id,
    senderId: row.sender_id,
    senderRole: row.sender_role as ChatMessage["senderRole"],
    senderName: row.sender_name,
    recipientId: row.recipient_id,
    text: row.text,
    timestamp,
    editedAt,
    chatType: row.chat_type as ChatMessage["chatType"],
  };
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DENTAL_CHAT_UPDATED_EVENT));
}

/** Загрузить все сообщения из API (`chat_messages`) в память. */
export async function hydrateDentalMessages(): Promise<void> {
  try {
    const result = await dentalApiFetch<{ rows: DbMessageRow[] }>("/api/chat/messages", {
      method: "GET",
    });
    messagesCache = (result.rows ?? []).map(dbRowToChatMessage);
    return;
  } catch (e) {
    console.warn("[supportChat] API hydrate fallback:", e);
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[supportChat]", error);
    return;
  }
  messagesCache = ((data ?? []) as DbMessageRow[]).map(dbRowToChatMessage);
}

/**
 * Подписка на новые/изменённые строки в `chat_messages` (Supabase Realtime).
 * После подключения вызывайте `hydrateDentalMessages()`.
 *
 * У каждого вызова своё имя канала: иначе при повторном mount / гонке async-эффекта
 * клиент может переиспользовать уже подписанный канал и упасть с
 * «cannot add postgres_changes callbacks after subscribe».
 */
export function subscribeDentalMessagesRealtime(onReloaded: () => void): () => void {
  const channel = supabase.channel(uniqueRealtimeChannelName("chat_messages_changes"));

  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "chat_messages" },
    (payload: { new?: unknown }) => {
      const row = payload.new as DbMessageRow | undefined;
      if (
        row &&
        typeof row.id === "string" &&
        typeof row.text === "string" &&
        typeof row.sender_id === "string"
      ) {
        const msg = dbRowToChatMessage(row);
        const without = messagesCache.filter((m) => m.id !== msg.id);
        messagesCache = [...without, msg].sort((a, b) => a.timestamp - b.timestamp);
        emitUpdated();
        onReloaded();
        return;
      }
      void hydrateDentalMessages().then(() => {
        emitUpdated();
        onReloaded();
      });
    }
  );

  channel.on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "chat_messages" },
    () => {
      void hydrateDentalMessages().then(() => {
        emitUpdated();
        onReloaded();
      });
    }
  );

  channel.on(
    "postgres_changes",
    { event: "DELETE", schema: "public", table: "chat_messages" },
    () => {
      void hydrateDentalMessages().then(() => {
        emitUpdated();
        onReloaded();
      });
    }
  );

  channel.subscribe();

  return () => {
    removeSupabaseChannel(channel);
  };
}

let sharedDentalRealtimeUnsub: (() => void) | null = null;
const dentalRealtimeListeners = new Set<() => void>();

function notifyDentalRealtimeListeners(): void {
  for (const fn of dentalRealtimeListeners) {
    try {
      fn();
    } catch {
      /* слушатель мог быть снят при unmount */
    }
  }
}

/**
 * Ref-counted подписка на chat_messages: один WebSocket-канал на все экраны чата.
 * При размонтировании последнего потребителя вызывается removeChannel.
 */
export function acquireDentalMessagesRealtime(onReloaded: () => void): () => void {
  dentalRealtimeListeners.add(onReloaded);
  if (!sharedDentalRealtimeUnsub) {
    sharedDentalRealtimeUnsub = subscribeDentalMessagesRealtime(notifyDentalRealtimeListeners);
  }

  return () => {
    dentalRealtimeListeners.delete(onReloaded);
    if (dentalRealtimeListeners.size === 0 && sharedDentalRealtimeUnsub) {
      sharedDentalRealtimeUnsub();
      sharedDentalRealtimeUnsub = null;
    }
  };
}

export function getAllMessages(): ChatMessage[] {
  return messagesCache;
}

export function patientReadKey(tab: PatientChatTab, doctorPeerKey?: string): string {
  if (tab === "doctor" && doctorPeerKey) return `${tab}|${doctorPeerKey}`;
  return tab;
}

function normalizeDoctorPhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length > 0 && !d.startsWith("7")) d = "7" + d;
  return d;
}

/** Сообщения doctor-ветки: peer может быть `dental_employees.id` (новый формат) или нормализованный телефон (legacy). */
function doctorPeerMatches(doctorEmployeeId: string, doctorPhoneNorm: string, peerId: string): boolean {
  const p = peerId.trim();
  if (!p) return false;
  if (doctorEmployeeId !== "" && p === doctorEmployeeId) return true;
  return normalizeDoctorPhone(p) === doctorPhoneNorm;
}

export function resolveAttendingDoctor(): {
  doctorId: string;
  doctorPhone: string;
  doctorName: string;
} {
  const employees = getDentalEmployees().filter((e) => e.role === "doctor");
  const fallback =
    employees.find((e) => e.phone === DEFAULT_ATTENDING_DOCTOR_PHONE) ?? employees[0];

  const byName = (doctorField: string): (typeof employees)[number] | null => {
    const needle = doctorField.trim().toLowerCase();
    if (!needle) return null;
    for (const e of employees) {
      const n = e.fullName.trim().toLowerCase();
      if (n.includes(needle.slice(0, 5)) || needle.includes(n.split(/\s+/)[0] ?? "")) {
        return e;
      }
    }
    return null;
  };

  const next = getNextAppointment();
  if (next) {
    const emp = byName(next.doctor);
    if (emp) return { doctorId: emp.id, doctorPhone: emp.phone, doctorName: emp.fullName };
  }

  const all = getAppointments().filter((a) => a.status !== "cancelled");
  const score = (a: Appointment): number => new Date(a.year, a.monthNum - 1, a.day).getTime();

  const sorted = [...all].sort((a, b) => score(b) - score(a));
  for (const a of sorted) {
    const emp = byName(a.doctor);
    if (emp) return { doctorId: emp.id, doctorPhone: emp.phone, doctorName: emp.fullName };
  }

  if (fallback) {
    return { doctorId: fallback.id, doctorPhone: fallback.phone, doctorName: fallback.fullName };
  }
  const orphan = getDentalEmployees().find(
    (e) => e.role === "doctor" && normalizeDoctorPhone(e.phone) === normalizeDoctorPhone(DEFAULT_ATTENDING_DOCTOR_PHONE)
  );
  return {
    doctorId: orphan?.id ?? "",
    doctorPhone: DEFAULT_ATTENDING_DOCTOR_PHONE,
    doctorName: "Врач",
  };
}

function filterPatientBranchMessages(
  all: ChatMessage[],
  uid: string,
  tab: PatientChatTab
): ChatMessage[] {
  const doc = resolveAttendingDoctor();
  const dPhone = normalizeDoctorPhone(doc.doctorPhone);
  const doctorId = doc.doctorId;

  return all.filter((m) => {
    if (tab === "clinic") {
      return (
        m.chatType === "clinic" &&
        ((m.senderId === uid && m.recipientId === "clinic") ||
          (m.recipientId === uid && (m.senderRole === "admin" || m.senderRole === "doctor")))
      );
    }
    if (tab === "support") {
      return (
        m.chatType === "support" &&
        ((m.senderId === uid && isSupportInboxRecipient(m.recipientId)) ||
          (m.senderRole === "admin" && m.recipientId === uid))
      );
    }
    return (
      m.chatType === "doctor" &&
      ((m.senderId === uid && doctorPeerMatches(doctorId, dPhone, m.recipientId)) ||
        (doctorPeerMatches(doctorId, dPhone, m.senderId) && m.recipientId === uid))
    );
  });
}

export function getPatientBranchMessages(tab: PatientChatTab): ChatMessage[] {
  const uid = getCurrentUserId();
  if (!uid) return [];
  return filterPatientBranchMessages(getAllMessages(), uid, tab);
}

export interface SupportAuditEntry {
  id: string;
  at: string;
  patientId: string;
  channel: "support";
  sender: "patient" | "staff";
  preview: string;
}

function appendSupportAudit(entry: Omit<SupportAuditEntry, "id">): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SUPPORT_AUDIT_KEY);
    const list = raw ? (JSON.parse(raw) as SupportAuditEntry[]) : [];
    const full: SupportAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    list.push(full);
    localStorage.setItem(SUPPORT_AUDIT_KEY, JSON.stringify(list.slice(-500)));
  } catch {
    /* ignore */
  }
}

export function getSupportAuditLog(): SupportAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUPPORT_AUDIT_KEY);
    return raw ? (JSON.parse(raw) as SupportAuditEntry[]) : [];
  } catch {
    return [];
  }
}

function getPatientReadMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PATIENT_READS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function setPatientReadMap(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PATIENT_READS_KEY, JSON.stringify(map));
}

function getStaffReadMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STAFF_READS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function setStaffReadMap(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STAFF_READS_KEY, JSON.stringify(map));
}

function lastUnreadFromPeer(
  messages: ChatMessage[],
  uid: string,
  peerIsClientViewer: boolean
): number {
  let max = 0;
  for (const m of messages) {
    const fromStaff = m.senderRole === "admin" || m.senderRole === "doctor";
    if (peerIsClientViewer && fromStaff && m.recipientId === uid) {
      max = Math.max(max, m.timestamp);
    }
    if (!peerIsClientViewer && m.senderRole === "client" && m.senderId === uid) {
      max = Math.max(max, m.timestamp);
    }
  }
  return max;
}

function countUnreadFromPeer(
  messages: ChatMessage[],
  uid: string,
  lastRead: number,
  peerIsClientViewer: boolean
): number {
  let count = 0;
  for (const m of messages) {
    const fromStaff = m.senderRole === "admin" || m.senderRole === "doctor";
    if (peerIsClientViewer && fromStaff && m.recipientId === uid && m.timestamp > lastRead) {
      count++;
    }
    if (
      !peerIsClientViewer &&
      m.senderRole === "client" &&
      m.senderId === uid &&
      m.timestamp > lastRead
    ) {
      count++;
    }
  }
  return count;
}

function patientTabReadKey(tab: PatientChatTab): string {
  const doc = resolveAttendingDoctor();
  const dPhone = normalizeDoctorPhone(doc.doctorPhone);
  const doctorId = doc.doctorId;
  return patientReadKey(tab, tab === "doctor" ? doctorId || dPhone : undefined);
}

export function getPatientUnreadCount(uid: string, tab: PatientChatTab): number {
  const msgs = filterPatientBranchMessages(getAllMessages(), uid, tab);
  const lastRead = getPatientReadMap()[patientTabReadKey(tab)] ?? 0;
  return countUnreadFromPeer(msgs, uid, lastRead, true);
}

/** Сумма непрочитанных входящих по всем вкладкам чата пациента. */
export function getPatientTotalUnreadCount(uid: string): number {
  const tabs: PatientChatTab[] = ["clinic", "support", "doctor"];
  return tabs.reduce((sum, tab) => sum + getPatientUnreadCount(uid, tab), 0);
}

export function getPatientUnread(uid: string, tab: PatientChatTab): boolean {
  return getPatientUnreadCount(uid, tab) > 0;
}

export function markPatientConversationRead(uid: string, tab: PatientChatTab): void {
  if (typeof window === "undefined") return;
  const msgs = filterPatientBranchMessages(getAllMessages(), uid, tab);
  const map = getPatientReadMap();
  const key = patientTabReadKey(tab);
  let watermark = Date.now();
  for (const m of msgs) {
    watermark = Math.max(watermark, m.timestamp);
  }
  map[key] = watermark;
  setPatientReadMap(map);
  emitUpdated();
}

function staffConvKey(patientId: string, scope: "clinic" | "support" | `doctor:${string}`): string {
  return `${patientId}|${scope}`;
}

export function getStaffUnread(
  patientId: string,
  scope: "clinic" | "support" | "doctor_merge",
  doctorPhone?: string
): boolean {
  const messages =
    scope === "doctor_merge"
      ? getDoctorPatientThreadMessages(doctorPhone ?? "", patientId)
      : getStaffBranchMessages(scope, patientId);
  const readMap = getStaffReadMap();
  const ck =
    scope === "doctor_merge"
      ? staffConvKey(patientId, `doctor:${doctorPhone ?? ""}`)
      : staffConvKey(patientId, scope);
  const lastRead = readMap[ck] ?? 0;
  return lastUnreadFromPeer(messages, patientId, false) > lastRead;
}

export function markStaffConversationRead(
  patientId: string,
  scope: "clinic" | "support" | "doctor_merge",
  doctorPhone?: string
): void {
  if (typeof window === "undefined") return;
  const map = getStaffReadMap();
  const ck =
    scope === "doctor_merge"
      ? staffConvKey(patientId, `doctor:${doctorPhone ?? ""}`)
      : staffConvKey(patientId, scope);
  map[ck] = Date.now();
  setStaffReadMap(map);
  emitUpdated();
}

export async function appendChatMessage(
  msg: Omit<ChatMessage, "id" | "timestamp">
): Promise<ChatMessage> {
  try {
    const { row } = await dentalApiFetch<{ row: DbMessageRow }>("/api/chat/messages", {
      method: "POST",
      body: {
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        text: msg.text,
        senderRole: msg.senderRole,
        chatType: msg.chatType,
        senderName: msg.senderName,
      },
    });
    const full = dbRowToChatMessage(row);
    await hydrateDentalMessages();
    if (full.chatType === "support") {
      appendSupportAudit({
        at: new Date(full.timestamp).toISOString(),
        patientId: full.senderRole === "client" ? full.senderId : full.recipientId,
        channel: "support",
        sender: full.senderRole === "client" ? "patient" : "staff",
        preview: full.text.slice(0, 280),
      });
    }
    return full;
  } catch (apiErr) {
    console.warn("[supportChat] API insert fallback:", apiErr);
  }

  const { data: row, error } = await supabase
    .from("chat_messages")
    .insert({
      sender_id: msg.senderId,
      recipient_id: msg.recipientId,
      text: msg.text,
      sender_role: msg.senderRole,
      chat_type: msg.chatType,
      sender_name: msg.senderName,
    })
    .select("*")
    .single();

  if (error || !row) {
    console.error("[supportChat insert]", error);
    throw new Error(error?.message ?? "Не удалось сохранить сообщение");
  }

  const full = dbRowToChatMessage(row as DbMessageRow);

  await hydrateDentalMessages();

  if (full.chatType === "support") {
    appendSupportAudit({
      at: new Date(full.timestamp).toISOString(),
      patientId: full.senderRole === "client" ? full.senderId : full.recipientId,
      channel: "support",
      sender: full.senderRole === "client" ? "patient" : "staff",
      preview: full.text.slice(0, 280),
    });
  }

  {
    const r = full.senderRole;
    const role: "client" | "doctor" | "admin" =
      r === "doctor" ? "doctor" : r === "admin" ? "admin" : "client";
    log("INFO", "chat_message_sent", {
      role,
      userId: full.senderId,
      details: JSON.stringify({
        chatType: full.chatType,
        recipientId: full.recipientId,
        preview: full.text.slice(0, 120),
      }),
    });
  }

  emitUpdated();
  return full;
}

export async function updateChatMessageText(messageId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Текст сообщения не может быть пустым");

  try {
    await dentalApiFetch("/api/chat/messages", {
      method: "PATCH",
      body: { messageId, text: trimmed },
    });
  } catch (apiErr) {
    const { error } = await supabase
      .from("chat_messages")
      .update({ text: trimmed, updated_at: new Date().toISOString() })
      .eq("id", messageId);

    if (error) {
      console.error("[supportChat update]", error);
      throw apiErr instanceof Error ? apiErr : new Error(error.message ?? "Не удалось изменить сообщение");
    }
  }

  await hydrateDentalMessages();
  emitUpdated();
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  try {
    await dentalApiFetch(`/api/chat/messages?messageId=${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    });
  } catch (apiErr) {
    const { error } = await supabase.from("chat_messages").delete().eq("id", messageId);
    if (error) {
      console.error("[supportChat delete]", error);
      throw apiErr instanceof Error ? apiErr : new Error(error.message ?? "Не удалось удалить сообщение");
    }
  }

  await hydrateDentalMessages();
  emitUpdated();
}

function clientSenderName(uid: string): string {
  const c = getDentalClients().find((x) => x.id === uid);
  if (!c) return "Пациент";
  return `${c.lastName} ${c.firstName}`.trim() || c.phone;
}

export async function sendPatientMessage(
  tab: PatientChatTab,
  body: string
): Promise<ChatMessage | null> {
  const uid = getCurrentUserId();
  if (!uid || typeof window === "undefined") return null;
  const text = body.trim();
  if (!text) return null;

  const name = clientSenderName(uid);

  if (tab === "clinic") {
    return appendChatMessage({
      senderId: uid,
      senderRole: "client",
      senderName: name,
      recipientId: "clinic",
      text,
      chatType: "clinic",
    });
  }
  if (tab === "support") {
    return appendChatMessage({
      senderId: uid,
      senderRole: "client",
      senderName: name,
      recipientId: "support",
      text,
      chatType: "support",
    });
  }

  const { doctorPhone, doctorId } = resolveAttendingDoctor();
  const doctorRecipient = doctorId || normalizeDoctorPhone(doctorPhone);
  return appendChatMessage({
    senderId: uid,
    senderRole: "client",
    senderName: name,
    recipientId: doctorRecipient,
    text,
    chatType: "doctor",
  });
}

export async function sendAdminToPatient(params: {
  patientId: string;
  chatType: "support" | "clinic";
  body: string;
}): Promise<ChatMessage | null> {
  const session = getDentalSession();
  if (!session || session.role !== "admin") return null;
  const text = params.body.trim();
  if (!text) return null;
  return appendChatMessage({
    senderId: session.id,
    senderRole: "admin",
    senderName: session.fullName.trim() || "Администратор",
    recipientId: params.patientId,
    text,
    chatType: params.chatType,
  });
}

export async function sendStaffToPatientClinic(
  patientId: string,
  body: string
): Promise<ChatMessage | null> {
  const session = getDentalSession();
  if (!session || (session.role !== "doctor" && session.role !== "admin")) return null;
  const text = body.trim();
  if (!text) return null;
  const role = session.role === "doctor" ? "doctor" : "admin";
  return appendChatMessage({
    senderId: session.id,
    senderRole: role,
    senderName: session.fullName.trim() || (role === "doctor" ? "Врач" : "Клиника"),
    recipientId: patientId,
    text,
    chatType: "clinic",
  });
}

export async function sendDoctorToPatientPersonal(
  doctorPhone: string,
  patientId: string,
  body: string
): Promise<ChatMessage | null> {
  const session = getDentalSession();
  if (!session || session.role !== "doctor") return null;
  const text = body.trim();
  if (!text) return null;
  return appendChatMessage({
    senderId: session.id,
    senderRole: "doctor",
    senderName: session.fullName.trim() || "Врач",
    recipientId: patientId,
    text,
    chatType: "doctor",
  });
}

/** @deprecated — использовать sendAdminToPatient / sendStaffToPatientClinic */
export async function sendStaffMessage(
  patientId: string,
  channel: SupportChatChannel,
  body: string,
  staffLabel: string
): Promise<ChatMessage | null> {
  const session = getDentalSession();
  if (!session) return null;
  const chatType = channel === "clinic" ? "clinic" : "support";
  if (session.role === "admin") {
    return appendChatMessage({
      senderId: session.id,
      senderRole: "admin",
      senderName: staffLabel,
      recipientId: patientId,
      text: body.trim(),
      chatType,
    });
  }
  return appendChatMessage({
    senderId: session.id,
    senderRole: "doctor",
    senderName: staffLabel,
    recipientId: patientId,
    text: body.trim(),
    chatType,
  });
}

export function getStaffBranchMessages(
  branch: "clinic" | "support",
  patientId: string
): ChatMessage[] {
  const all = getAllMessages();
  return all
    .filter((m) => {
      if (branch === "clinic") {
        return (
          m.chatType === "clinic" &&
          ((m.senderRole === "client" && m.senderId === patientId && m.recipientId === "clinic") ||
            (m.recipientId === patientId && (m.senderRole === "admin" || m.senderRole === "doctor")))
        );
      }
      return (
        m.chatType === "support" &&
        ((m.senderRole === "client" && m.senderId === patientId && isSupportInboxRecipient(m.recipientId)) ||
          (m.senderRole === "admin" && m.recipientId === patientId))
      );
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function getDoctorPatientThreadMessages(
  doctorPhone: string,
  patientId: string
): ChatMessage[] {
  const d = normalizeDoctorPhone(doctorPhone);
  const emp = getDentalEmployees().find((e) => normalizeDoctorPhone(e.phone) === d);
  const doctorId = emp?.id ?? "";
  const all = getAllMessages();
  return all
    .filter((m) => {
      if (m.chatType === "clinic") {
        return (
          (m.senderRole === "client" && m.senderId === patientId && m.recipientId === "clinic") ||
          (m.recipientId === patientId && (m.senderRole === "admin" || m.senderRole === "doctor"))
        );
      }
      if (m.chatType === "doctor") {
        return (
          (m.senderId === patientId && doctorPeerMatches(doctorId, d, m.recipientId)) ||
          (doctorPeerMatches(doctorId, d, m.senderId) && m.recipientId === patientId)
        );
      }
      return false;
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function lastDoctorMessage(messages: ChatMessage[]): ChatMessage | null {
  if (!messages.length) return null;
  return messages[messages.length - 1];
}

export interface StaffDialogPreview {
  patientId: string;
  patientName: string;
  scope: "clinic" | "support" | "doctor_merge";
  lastMessage: ChatMessage | null;
  unread: boolean;
}

export function getStaffDialogPreviews(branch: "clinic" | "support"): StaffDialogPreview[] {
  const clients = getDentalClients();
  const out: StaffDialogPreview[] = [];

  for (const c of clients) {
    const msgs = getStaffBranchMessages(branch, c.id);
    if (msgs.length === 0) continue;
    const last = lastDoctorMessage(msgs);
    const name = `${c.lastName} ${c.firstName}`.trim() || c.phone;
    out.push({
      patientId: c.id,
      patientName: name,
      scope: branch,
      lastMessage: last,
      unread: getStaffUnread(c.id, branch),
    });
  }

  out.sort((a, b) => {
    const ta = a.lastMessage?.timestamp ?? 0;
    const tb = b.lastMessage?.timestamp ?? 0;
    return tb - ta;
  });
  return out;
}

export function getDoctorDialogPreviews(sessionPhone: string): StaffDialogPreview[] {
  const d = normalizeDoctorPhone(sessionPhone);
  const clients = getDentalClients();
  const out: StaffDialogPreview[] = [];

  for (const c of clients) {
    const thread = getDoctorPatientThreadMessages(d, c.id);
    if (thread.length === 0) continue;
    const last = lastDoctorMessage(thread);
    const name = `${c.lastName} ${c.firstName}`.trim() || c.phone;
    out.push({
      patientId: c.id,
      patientName: name,
      scope: "doctor_merge",
      lastMessage: last,
      unread: getStaffUnread(c.id, "doctor_merge", d),
    });
  }

  out.sort((a, b) => {
    const ta = a.lastMessage?.timestamp ?? 0;
    const tb = b.lastMessage?.timestamp ?? 0;
    return tb - ta;
  });
  return out;
}

export function inferDoctorReplyPreference(
  thread: ChatMessage[],
  doctorPhone: string
): "clinic" | "doctor" {
  const d = normalizeDoctorPhone(doctorPhone);
  const emp = getDentalEmployees().find((e) => normalizeDoctorPhone(e.phone) === d);
  const doctorId = emp?.id ?? "";
  const fromPatientLast = [...thread].reverse().find((m) => m.senderRole === "client");
  if (!fromPatientLast) return "clinic";
  if (fromPatientLast.chatType === "doctor") {
    const toThisDoc = doctorPeerMatches(doctorId, d, fromPatientLast.recipientId ?? "");
    return toThisDoc ? "doctor" : "clinic";
  }
  return "clinic";
}

export function getSupportMessages(
  patientId: string,
  channel: SupportChatChannel
): ChatMessage[] {
  const tab: PatientChatTab = channel === "clinic" ? "clinic" : "support";
  const uid = patientId;
  const all = getAllMessages();

  const clinicBranch = () =>
    all
      .filter(
        (m) =>
          m.chatType === "clinic" &&
          ((m.senderId === uid && m.recipientId === "clinic") ||
            (m.recipientId === uid && (m.senderRole === "admin" || m.senderRole === "doctor")))
      )
      .sort((a, b) => a.timestamp - b.timestamp);

  const supportBranch = () =>
    all
      .filter(
        (m) =>
          m.chatType === "support" &&
          ((m.senderId === uid && isSupportInboxRecipient(m.recipientId)) ||
            (m.senderRole === "admin" && m.recipientId === uid))
      )
      .sort((a, b) => a.timestamp - b.timestamp);

  return tab === "clinic" ? clinicBranch() : supportBranch();
}

/** Резервный интервал опроса (мало нужен при Realtime); оставлен для аудита localStorage. */
export const SUPPORT_CHAT_POLL_MS = 60_000;
