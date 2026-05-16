import {
  getCurrentUserId,
  getDentalClients,
  getDentalEmployees,
  getDentalSession,
} from "@/lib/auth";
import { getAppointments, getNextAppointment } from "@/lib/appointments";
import type { ChatMessage } from "@/types";
import type { Appointment } from "@/lib/appointments";

export type { ChatMessage };

/** Каналы на экране пациента: клиника | ТП | лечащий врач */
export type PatientChatTab = "clinic" | "support" | "doctor";

/** @deprecated alias — используйте PatientChatTab */
export type SupportChatChannel = "clinic" | "support";

export const DENTAL_MESSAGES_KEY = "dental_messages";
export const DENTAL_CHAT_UPDATED_EVENT = "dental_chat_updated";
/** Совместимость со старыми импортами */
export const CHAT_UPDATED_EVENT = DENTAL_CHAT_UPDATED_EVENT;

const PATIENT_READS_KEY = "dental_chat_patient_read_v2";
const STAFF_READS_KEY = "dental_chat_staff_read_v2";
const SUPPORT_AUDIT_KEY = "dental_chat_support_audit";
const MIGRATION_FLAG = "dental_messages_migrated_v1";

const DEFAULT_ATTENDING_DOCTOR_PHONE = "79991112233";

// ─── legacy (pre dental_messages) ─────────────────────────────────────────────

interface LegacySupportMessage {
  id: string;
  patientId: string;
  channel: "clinic" | "support";
  sender: "patient" | "staff";
  body: string;
  createdAt: string;
  staffLabel?: string;
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DENTAL_CHAT_UPDATED_EVENT));
}

function parseAll(raw: string | null): ChatMessage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function getAllRaw(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  return parseAll(localStorage.getItem(DENTAL_MESSAGES_KEY));
}

function saveAll(messages: ChatMessage[]): void {
  localStorage.setItem(DENTAL_MESSAGES_KEY, JSON.stringify(messages));
}

function legacyToNew(m: LegacySupportMessage): ChatMessage {
  const ts = new Date(m.createdAt).getTime();
  const isPatient = m.sender === "patient";
  const recipientId = isPatient
    ? m.channel === "clinic"
      ? "clinic"
      : "admin"
    : m.patientId;
  return {
    id: m.id,
    senderId: isPatient ? m.patientId : "emp_legacy_staff",
    senderRole: isPatient ? "client" : "admin",
    senderName: isPatient ? "Пациент" : (m.staffLabel ?? "Сотрудник"),
    recipientId,
    text: m.body,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    chatType: m.channel === "clinic" ? "clinic" : "support",
  };
}

function migrateLegacyIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG) === "1") return;

  const existing = getAllRaw();
  const byId = new Set(existing.map((m) => m.id));
  const merged = [...existing];

  try {
    const clients = getDentalClients();
    for (const c of clients) {
      for (const ch of ["clinic", "support"] as const) {
        const key = `dental_chat_${c.id}_${ch}`;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const arr = JSON.parse(raw) as LegacySupportMessage[];
        if (!Array.isArray(arr)) continue;
        for (const m of arr) {
          const next = legacyToNew(m);
          if (!byId.has(next.id)) {
            byId.add(next.id);
            merged.push(next);
          }
        }
      }
    }
    merged.sort((a, b) => a.timestamp - b.timestamp);
    saveAll(merged);
  } catch {
    /* ignore */
  }

  localStorage.setItem(MIGRATION_FLAG, "1");
}

function ensureInitialized(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  if (localStorage.getItem(DENTAL_MESSAGES_KEY) === null) {
    localStorage.setItem(DENTAL_MESSAGES_KEY, JSON.stringify([]));
  }
  migrateLegacyIfNeeded();
  return getAllRaw();
}

export function getAllMessages(): ChatMessage[] {
  return ensureInitialized();
}

// ─── пациент: ветки ─────────────────────────────────────────────────────────

export function patientReadKey(tab: PatientChatTab, doctorPhone?: string): string {
  if (tab === "doctor" && doctorPhone) return `${tab}|${doctorPhone}`;
  return tab;
}

function normalizeDoctorPhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length > 0 && !d.startsWith("7")) d = "7" + d;
  return d;
}

/** Подбираем врача по записям; иначе дежурный терапевт Михайлова (79991112233). */
export function resolveAttendingDoctor(): { doctorPhone: string; doctorName: string } {
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
    if (emp) return { doctorPhone: emp.phone, doctorName: emp.fullName };
  }

  const all = getAppointments().filter((a) => a.status !== "cancelled");
  const score = (a: Appointment): number =>
    new Date(a.year, a.monthNum - 1, a.day).getTime();

  const sorted = [...all].sort((a, b) => score(b) - score(a));
  for (const a of sorted) {
    const emp = byName(a.doctor);
    if (emp) return { doctorPhone: emp.phone, doctorName: emp.fullName };
  }

  if (fallback) {
    return { doctorPhone: fallback.phone, doctorName: fallback.fullName };
  }
  return { doctorPhone: DEFAULT_ATTENDING_DOCTOR_PHONE, doctorName: "Врач" };
}

/** Сообщения ветки для текущего пациента */
export function getPatientBranchMessages(tab: PatientChatTab): ChatMessage[] {
  const uid = getCurrentUserId();
  if (!uid) return [];
  const all = getAllMessages();
  const doc = resolveAttendingDoctor();
  const dPhone = normalizeDoctorPhone(doc.doctorPhone);

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
        ((m.senderId === uid && m.recipientId === "admin") ||
          (m.senderRole === "admin" && m.recipientId === uid))
      );
    }
    /** doctor tab */
    return (
      m.chatType === "doctor" &&
      ((m.senderId === uid && normalizeDoctorPhone(m.recipientId) === dPhone) ||
        (normalizeDoctorPhone(m.senderId) === dPhone && m.recipientId === uid))
    );
  });
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

// ─── reads / unread ───────────────────────────────────────────────────────────

function getPatientReadMap(uid: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(PATIENT_READS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function setPatientReadMap(uid: string, map: Record<string, number>): void {
  localStorage.setItem(PATIENT_READS_KEY, JSON.stringify(map));
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

/** Непрочитанное для пациента по вкладке */
export function getPatientUnread(uid: string, tab: PatientChatTab): boolean {
  const all = getAllMessages();
  const doc = resolveAttendingDoctor();
  const dPhone = normalizeDoctorPhone(doc.doctorPhone);
  const msgs = all.filter((m) => {
    if (tab === "clinic")
      return (
        m.chatType === "clinic" &&
        ((m.senderId === uid && m.recipientId === "clinic") ||
          (m.recipientId === uid && (m.senderRole === "admin" || m.senderRole === "doctor")))
      );
    if (tab === "support") {
      return (
        m.chatType === "support" &&
        ((m.senderId === uid && m.recipientId === "admin") ||
          (m.senderRole === "admin" && m.recipientId === uid))
      );
    }
    return (
      m.chatType === "doctor" &&
      ((m.senderId === uid && normalizeDoctorPhone(m.recipientId) === dPhone) ||
        (normalizeDoctorPhone(m.senderId) === dPhone && m.recipientId === uid))
    );
  });
  const readMap = getPatientReadMap(uid);
  const key = patientReadKey(tab, tab === "doctor" ? dPhone : undefined);
  const lastRead = readMap[key] ?? 0;
  return lastUnreadFromPeer(msgs, uid, true) > lastRead;
}

export function markPatientConversationRead(uid: string, tab: PatientChatTab): void {
  if (typeof window === "undefined") return;
  const doc = resolveAttendingDoctor();
  const dPhone = normalizeDoctorPhone(doc.doctorPhone);
  const map = getPatientReadMap(uid);
  const key = patientReadKey(tab, tab === "doctor" ? dPhone : undefined);
  map[key] = Date.now();
  setPatientReadMap(uid, map);
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
  const messages = scope === "doctor_merge"
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

// ─── append ───────────────────────────────────────────────────────────────────

export function appendChatMessage(msg: Omit<ChatMessage, "id" | "timestamp">): ChatMessage {
  ensureInitialized();
  const full: ChatMessage = {
    ...msg,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };

  const all = getAllRaw();
  all.push(full);
  saveAll(all);

  if (full.chatType === "support") {
    appendSupportAudit({
      at: new Date(full.timestamp).toISOString(),
      patientId:
        full.senderRole === "client" ? full.senderId : full.recipientId,
      channel: "support",
      sender: full.senderRole === "client" ? "patient" : "staff",
      preview: full.text.slice(0, 280),
    });
  }

  emitUpdated();
  return full;
}

function clientSenderName(uid: string): string {
  const c = getDentalClients().find((x) => x.id === uid);
  if (!c) return "Пациент";
  return `${c.lastName} ${c.firstName}`.trim() || c.phone;
}

/** Сообщение от пациента (вкладка клиника / ТП / врач) */
export function sendPatientMessage(tab: PatientChatTab, body: string): ChatMessage | null {
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
      recipientId: "admin",
      text,
      chatType: "support",
    });
  }

  const { doctorPhone } = resolveAttendingDoctor();
  return appendChatMessage({
    senderId: uid,
    senderRole: "client",
    senderName: name,
    recipientId: normalizeDoctorPhone(doctorPhone),
    text,
    chatType: "doctor",
  });
}

/** Сообщение от админа клиенту (техподдержка или клиника) */
export function sendAdminToPatient(params: {
  patientId: string;
  chatType: "support" | "clinic";
  body: string;
}): ChatMessage | null {
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

/** Ответ врача или админа в ветке клиники */
export function sendStaffToPatientClinic(patientId: string, body: string): ChatMessage | null {
  const session = getDentalSession();
  if (!session || (session.role !== "doctor" && session.role !== "admin")) return null;
  const text = body.trim();
  if (!text) return null;
  const role = session.role === "doctor" ? "doctor" : "admin";
  return appendChatMessage({
    senderId: session.phone,
    senderRole: role,
    senderName: session.fullName.trim() || (role === "doctor" ? "Врач" : "Клиника"),
    recipientId: patientId,
    text,
    chatType: "clinic",
  });
}

/** Личное сообщение врача пациенту */
export function sendDoctorToPatientPersonal(
  doctorPhone: string,
  patientId: string,
  body: string
): ChatMessage | null {
  const session = getDentalSession();
  if (!session || session.role !== "doctor") return null;
  const text = body.trim();
  if (!text) return null;
  return appendChatMessage({
    senderId: normalizeDoctorPhone(doctorPhone),
    senderRole: "doctor",
    senderName: session.fullName.trim() || "Врач",
    recipientId: patientId,
    text,
    chatType: "doctor",
  });
}

/** @deprecated — использовать sendAdminToPatient / sendStaffToPatientClinic */
export function sendStaffMessage(
  patientId: string,
  channel: SupportChatChannel,
  body: string,
  staffLabel: string
): ChatMessage | null {
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
    senderId: session.phone,
    senderRole: "doctor",
    senderName: staffLabel,
    recipientId: patientId,
    text: body.trim(),
    chatType,
  });
}

// ─── списки для сотрудников ──────────────────────────────────────────────────

/** Сообщения одной ветки для модерации админом */
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
        ((m.senderRole === "client" && m.senderId === patientId && m.recipientId === "admin") ||
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
          (m.senderId === patientId && normalizeDoctorPhone(m.recipientId) === d) ||
          (normalizeDoctorPhone(m.senderId) === d && m.recipientId === patientId)
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

export function getStaffDialogPreviews(
  branch: "clinic" | "support"
): StaffDialogPreview[] {
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

/** Список диалогов для врача: клиника + личный чат по текущему номеру */
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

/** Как отправить ответ из кабинета врача: приоритет по последнему сообщению пациента */
export function inferDoctorReplyPreference(
  thread: ChatMessage[],
  doctorPhone: string
): "clinic" | "doctor" {
  const d = normalizeDoctorPhone(doctorPhone);
  const fromPatientLast = [...thread].reverse().find((m) => m.senderRole === "client");
  if (!fromPatientLast) return "clinic";
  if (fromPatientLast.chatType === "doctor") {
    const toThisDoc =
      fromPatientLast.recipientId && normalizeDoctorPhone(fromPatientLast.recipientId) === d;
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
          ((m.senderId === uid && m.recipientId === "admin") ||
            (m.senderRole === "admin" && m.recipientId === uid))
      )
      .sort((a, b) => a.timestamp - b.timestamp);

  return tab === "clinic" ? clinicBranch() : supportBranch();
}

export const SUPPORT_CHAT_POLL_MS = 2500;
