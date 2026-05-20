import type { DentalSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import type { ChatMessage } from "@/types";

export type ChatViewerContext = {
  viewerId: string;
  viewerRole: DentalSession["role"];
  /** Для врача: legacy-сообщения могут иметь sender_id = телефон, а не dental_employees.id */
  viewerPhone?: string;
};

export function buildChatViewerContext(session: DentalSession | null): ChatViewerContext | null {
  if (!session?.id) return null;
  return {
    viewerId: session.id,
    viewerRole: session.role,
    viewerPhone: session.phone,
  };
}

function doctorSenderMatchesViewer(m: ChatMessage, ctx: ChatViewerContext): boolean {
  if (m.senderRole !== "doctor" || ctx.viewerRole !== "doctor") return false;
  if (m.senderId === ctx.viewerId) return true;
  const viewerPhone = ctx.viewerPhone ? normalizePhone(ctx.viewerPhone) : "";
  if (viewerPhone.length < 10) return false;
  const senderDigits = normalizePhone(m.senderId);
  return senderDigits.length >= 10 && senderDigits === viewerPhone;
}

/** Свои сообщения: id сотрудника или legacy-телефон врача в doctor-ветке. */
export function isOwnDentalChatMessage(m: ChatMessage, ctx: ChatViewerContext): boolean {
  if (!ctx.viewerId) return false;
  if (m.senderRole === "client") {
    return ctx.viewerRole === "client" && m.senderId === ctx.viewerId;
  }
  if (m.senderRole === "doctor") {
    return doctorSenderMatchesViewer(m, ctx);
  }
  if (m.senderRole === "admin") {
    return ctx.viewerRole === "admin" && m.senderId === ctx.viewerId;
  }
  return false;
}

export function canEditDentalChatMessage(m: ChatMessage, ctx: ChatViewerContext): boolean {
  return isOwnDentalChatMessage(m, ctx);
}

/** Удалить своё; администратор — любое сообщение в диалоге. */
export function canDeleteDentalChatMessage(m: ChatMessage, ctx: ChatViewerContext): boolean {
  if (ctx.viewerRole === "admin") return true;
  return isOwnDentalChatMessage(m, ctx);
}
