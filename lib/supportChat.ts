import { getCurrentUserId, getDentalClients, type DentalClientRecord } from "@/lib/auth";

export type SupportChatChannel = "clinic" | "support";

export type SupportMessageSender = "patient" | "staff";

export interface SupportChatMessage {
  id: string;
  patientId: string;
  channel: SupportChatChannel;
  sender: SupportMessageSender;
  body: string;
  createdAt: string; // ISO
  /** Для сообщений персонала */
  staffLabel?: string;
}

export interface SupportAuditEntry {
  id: string;
  at: string;
  patientId: string;
  channel: "support";
  sender: SupportMessageSender;
  preview: string;
}

const CHAT_UPDATED_EVENT = "supportChatUpdated";

function messagesKey(patientId: string, channel: SupportChatChannel): string {
  return `dental_chat_${patientId}_${channel}`;
}

function patientReadsKey(patientId: string): string {
  return `dental_chat_patient_read_${patientId}`;
}

const STAFF_READS_KEY = "dental_chat_staff_read";
const SUPPORT_AUDIT_KEY = "dental_chat_support_audit";

function parseMessages(raw: string | null): SupportChatMessage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as SupportChatMessage[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_UPDATED_EVENT));
}

export function getSupportMessages(
  patientId: string,
  channel: SupportChatChannel
): SupportChatMessage[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(messagesKey(patientId, channel));
  return parseMessages(raw).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function getPatientReadMap(patientId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(patientReadsKey(patientId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function setPatientReadMap(patientId: string, map: Record<string, number>): void {
  localStorage.setItem(patientReadsKey(patientId), JSON.stringify(map));
}

function getStaffReadMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STAFF_READS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function setStaffReadMap(map: Record<string, number>): void {
  localStorage.setItem(STAFF_READS_KEY, JSON.stringify(map));
}

function convKey(patientId: string, channel: SupportChatChannel): string {
  return `${patientId}|${channel}`;
}

function lastOppositeMessageTime(
  messages: SupportChatMessage[],
  viewer: SupportMessageSender
): number {
  const opposite: SupportMessageSender = viewer === "patient" ? "staff" : "patient";
  let max = 0;
  for (const m of messages) {
    if (m.sender === opposite) {
      const t = new Date(m.createdAt).getTime();
      if (t > max) max = t;
    }
  }
  return max;
}

/** Непрочитанные для пациента: есть ответ персонала после отметки чтения. */
export function getPatientUnread(patientId: string, channel: SupportChatChannel): boolean {
  const messages = getSupportMessages(patientId, channel);
  const readMap = getPatientReadMap(patientId);
  const lastRead = readMap[channel] ?? 0;
  return lastOppositeMessageTime(messages, "patient") > lastRead;
}

/** Непрочитанные для сотрудников: есть сообщение пациента после отметки. */
export function getStaffUnread(patientId: string, channel: SupportChatChannel): boolean {
  const messages = getSupportMessages(patientId, channel);
  const staffMap = getStaffReadMap();
  const lastRead = staffMap[convKey(patientId, channel)] ?? 0;
  return lastOppositeMessageTime(messages, "staff") > lastRead;
}

export function markPatientConversationRead(patientId: string, channel: SupportChatChannel): void {
  if (typeof window === "undefined") return;
  const map = getPatientReadMap(patientId);
  map[channel] = Date.now();
  setPatientReadMap(patientId, map);
  emitUpdated();
}

export function markStaffConversationRead(patientId: string, channel: SupportChatChannel): void {
  if (typeof window === "undefined") return;
  const map = getStaffReadMap();
  map[convKey(patientId, channel)] = Date.now();
  setStaffReadMap(map);
  emitUpdated();
}

function appendSupportAudit(entry: Omit<SupportAuditEntry, "id">): void {
  try {
    const raw = localStorage.getItem(SUPPORT_AUDIT_KEY);
    const list = raw ? (JSON.parse(raw) as SupportAuditEntry[]) : [];
    const full: SupportAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    list.push(full);
    const capped = list.slice(-500);
    localStorage.setItem(SUPPORT_AUDIT_KEY, JSON.stringify(capped));
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

export function appendSupportMessage(params: {
  patientId: string;
  channel: SupportChatChannel;
  sender: SupportMessageSender;
  body: string;
  staffLabel?: string;
}): SupportChatMessage {
  const trimmed = params.body.trim();
  const msg: SupportChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    patientId: params.patientId,
    channel: params.channel,
    sender: params.sender,
    body: trimmed,
    createdAt: new Date().toISOString(),
    staffLabel: params.staffLabel,
  };

  const key = messagesKey(params.patientId, params.channel);
  const prev = parseMessages(localStorage.getItem(key));
  prev.push(msg);
  localStorage.setItem(key, JSON.stringify(prev));

  if (params.channel === "support") {
    appendSupportAudit({
      at: msg.createdAt,
      patientId: params.patientId,
      channel: "support",
      sender: params.sender,
      preview: trimmed.slice(0, 280),
    });
  }

  emitUpdated();

  return msg;
}

export function sendPatientMessage(channel: SupportChatChannel, body: string): SupportChatMessage | null {
  const uid = getCurrentUserId();
  if (!uid || typeof window === "undefined") return null;
  return appendSupportMessage({
    patientId: uid,
    channel,
    sender: "patient",
    body,
  });
}

export function sendStaffMessage(
  patientId: string,
  channel: SupportChatChannel,
  body: string,
  staffLabel: string
): SupportChatMessage {
  return appendSupportMessage({
    patientId,
    channel,
    sender: "staff",
    body,
    staffLabel,
  });
}

export interface StaffDialogPreview {
  patientId: string;
  patientName: string;
  channel: SupportChatChannel;
  lastMessage: SupportChatMessage | null;
  unread: boolean;
}

/** Активные треды: есть хотя бы одно сообщение. */
export function getStaffDialogPreviews(channel: SupportChatChannel): StaffDialogPreview[] {
  if (typeof window === "undefined") return [];

  const clients: DentalClientRecord[] = getDentalClients();

  const out: StaffDialogPreview[] = [];

  for (const c of clients) {
    const messages = getSupportMessages(c.id, channel);
    if (messages.length === 0) continue;
    const last = messages[messages.length - 1] ?? null;
    const name = `${c.lastName} ${c.firstName}`.trim() || c.phone;
    out.push({
      patientId: c.id,
      patientName: name,
      channel,
      lastMessage: last,
      unread: getStaffUnread(c.id, channel),
    });
  }

  out.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
  });

  return out;
}

export const SUPPORT_CHAT_POLL_MS = 2500;

export { CHAT_UPDATED_EVENT };
