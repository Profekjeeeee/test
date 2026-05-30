import "server-only";

import { apiError } from "@/lib/server/api/apiError";
import {
  chatDoctorCanSeeRow,
  loadClient,
  loadEmployee,
  requireActor,
  safeDentalScalarId,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";
import { phoneDigitsNormalizedServer } from "@/lib/server/normalizePhoneDigitsServer";

export async function listChatMessages(ctx: DentalServiceContext, limitRaw?: unknown) {
  const limit =
    typeof limitRaw === "number" && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 16000) : 12000;

  const { data, error } = await ctx.adm
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  let rows = (data ?? []) as Record<string, unknown>[];

  const { actor, gate, adm } = ctx;
  if (!actor?.id) apiError(403, "Чат недоступен без сессии.");

  if (actor.role === "doctor" || actor.role === "admin") {
    const empRow = await loadEmployee(adm, actor, gate);

    const roleText = String(empRow.role ?? "");
    const empMini = {
      id: String(empRow.id ?? ""),
      phone: String(empRow.phone ?? ""),
      role: roleText === "doctor" ? "doctor" : roleText === "admin" ? "admin" : "doctor",
    };
    const { data: apts, error: ae } =
      empMini.role !== "doctor"
        ? ({ data: null, error: null } as const)
        : await adm.from("appointments").select("client_id").eq("doctor_id", empMini.id);

    const setClients = new Set<string>();
    if (!ae && Array.isArray(apts)) {
      for (const r of apts as { client_id?: string | null }[]) {
        if (r.client_id) setClients.add(String(r.client_id));
      }
    }

    if (roleText === "admin") return { rows };

    rows = rows.filter((m) =>
      empMini.role !== "doctor" ? false : chatDoctorCanSeeRow(m, empMini, setClients),
    );
    return { rows };
  }

  const meRow = await loadClient(adm, actor, gate);
  const cid = safeDentalScalarId(meRow.id ?? "", "patient");
  rows = rows.filter((m) => {
    const s = String(m.sender_id ?? "");
    const r = String(m.recipient_id ?? "");
    return s === cid || r === cid;
  });

  return { rows };
}

export async function insertChatMessage(ctx: DentalServiceContext, payload: Record<string, unknown>) {
  const senderId = typeof payload.senderId === "string" ? payload.senderId.trim() : "";
  const recipientId = typeof payload.recipientId === "string" ? payload.recipientId.trim() : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  const senderRole = typeof payload.senderRole === "string" ? payload.senderRole : "";
  const chatType = typeof payload.chatType === "string" ? payload.chatType : "";
  const senderName = typeof payload.senderName === "string" ? payload.senderName.trim() : "";

  if (!senderId || !recipientId || !text.trim()) apiError(400, "Не хватает полей сообщения.");
  const act = requireActor(ctx.actor);

  if (senderRole === "client") {
    if (act.role !== "client") apiError(403, "Только аккаунт пациента.");
    const meRow = await loadClient(ctx.adm, act, ctx.gate);
    if (safeDentalScalarId(meRow.id ?? "", "patient") !== safeDentalScalarId(senderId)) {
      apiError(403, "Подмена отправителя.");
    }
  } else if (senderRole === "doctor" || senderRole === "admin") {
    await loadEmployee(ctx.adm, act, ctx.gate);
    const emp = await ctx.adm.from("dental_employees").select("*").eq("id", act.id).maybeSingle();
    const row = emp.data as Record<string, unknown> | null;
    const phoneDg = phoneDigitsNormalizedServer(String(row?.phone ?? ""));
    if (senderRole === "admin") {
      if (String(act.role) !== "admin") apiError(403, "Только аккаунт администратора.");
      const adminIdMatches = senderId.trim() === String(row?.id ?? "").trim();
      if (!adminIdMatches) apiError(403, "Несовпадение sender_id админа.");
    } else if (senderRole === "doctor") {
      const phoneOk = phoneDigitsNormalizedServer(senderId) === phoneDg;
      const idOk = senderId.trim() === String(row?.id ?? "").trim();
      if (!(phoneOk || idOk)) apiError(403, "Неверный sender_id для врача.");
    }
  } else {
    apiError(400, "Роль отправителя не поддерживается.");
  }

  const { data: created, error: insErr } = await ctx.adm
    .from("chat_messages")
    .insert([
      {
        sender_id: senderId,
        recipient_id: recipientId,
        text,
        sender_role: senderRole,
        chat_type: chatType,
        sender_name: senderName,
      } as Record<string, unknown>,
    ] as never)
    .select("*")
    .single();

  if (insErr) throw insErr;
  return { row: created };
}

export async function updateChatMessage(
  ctx: DentalServiceContext,
  messageId: string,
  text: string,
) {
  requireActor(ctx.actor);
  const id = safeDentalScalarId(messageId, "message");
  const { error } = await ctx.adm
    .from("chat_messages")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { ok: true as const };
}

export async function deleteChatMessage(ctx: DentalServiceContext, messageId: string) {
  requireActor(ctx.actor);
  const id = safeDentalScalarId(messageId, "message");
  const { error } = await ctx.adm.from("chat_messages").delete().eq("id", id);
  if (error) throw error;
  return { ok: true as const };
}
