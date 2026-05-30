import "server-only";

import { apiError } from "@/lib/server/api/apiError";
import {
  assertDoctorCanUseRoomOrThrow,
  loadEmployee,
  orderedDoctorPeerPair,
  requireActor,
  safeDentalScalarId,
  safeRoomIds,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";
import { phoneDigitsNormalizedServer } from "@/lib/server/normalizePhoneDigitsServer";

const FALLBACK = "Ординаторская";

export async function ensureGeneralRoom(ctx: DentalServiceContext) {
  const act = requireActor(ctx.actor);
  await loadEmployee(ctx.adm, act, ctx.gate);

  let { data, error } = await ctx.adm
    .from("doctor_rooms")
    .select("id, name")
    .eq("is_general", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  let row = data as { id?: string; name?: string } | null;
  if (!row?.id) {
    const inserted = await ctx.adm
      .from("doctor_rooms")
      .insert({ name: FALLBACK, is_general: true } as never)
      .select("id, name")
      .single();

    const insRow = inserted.data as { id?: string; name?: string } | null | undefined;

    if (inserted.error) {
      const second = await ctx.adm
        .from("doctor_rooms")
        .select("id, name")
        .eq("is_general", true)
        .limit(1)
        .maybeSingle();
      row = second.data as { id?: string; name?: string } | null;
    } else {
      row = insRow ?? null;
    }

    if (!row?.id) {
      const second = await ctx.adm
        .from("doctor_rooms")
        .select("id, name")
        .eq("is_general", true)
        .limit(1)
        .maybeSingle();
      if (second.error) throw second.error;
      row = second.data as { id?: string; name?: string } | null;
    }
  }

  if (!row?.id) apiError(404, "Комната не создана.");

  const nameTrim = typeof row?.name === "string" ? row.name.trim() : FALLBACK;
  return { id: safeDentalScalarId(row.id, "room"), name: nameTrim.length ? nameTrim : FALLBACK };
}

export async function doctorDmPeerMap(ctx: DentalServiceContext, selfIdRaw?: string) {
  const act = requireActor(ctx.actor);
  if (act.role !== "doctor") apiError(403, "Зона врача.");
  const selfId = safeDentalScalarId(selfIdRaw ?? act.id);

  await loadEmployee(ctx.adm, { ...act, id: selfId }, ctx.gate);

  const { data, error } = await ctx.adm
    .from("doctor_rooms")
    .select("id, peer_low, peer_high")
    .eq("is_general", false)
    .or(`peer_low.eq.${selfId},peer_high.eq.${selfId}`);
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const rec = row as { id?: string; peer_low?: string | null; peer_high?: string | null };
    const id = typeof rec?.id === "string" ? rec.id : "";
    const low = rec.peer_low ?? "";
    const high = rec.peer_high ?? "";
    if (!id || !low || !high) continue;

    const peer = low === selfId ? high : high === selfId ? low : "";
    if (!peer.trim() || peer === selfId) continue;
    map[peer] = id;
  }
  return { map };
}

export async function findOrCreatePrivateRoom(ctx: DentalServiceContext, peerIdRaw: string) {
  const act = requireActor(ctx.actor);
  if (act.role !== "doctor") apiError(403, "Зона врача.");
  await loadEmployee(ctx.adm, act, ctx.gate);
  const selfId = safeDentalScalarId(act.id);
  const peerId = safeDentalScalarId(peerIdRaw.trim(), "peerId");
  if (selfId === peerId) apiError(400, "Некорректный собеседник.");

  const { low, high } = orderedDoctorPeerPair(selfId, peerId);

  const { data: existing, error: selErr } = await ctx.adm
    .from("doctor_rooms")
    .select("id")
    .eq("is_general", false)
    .eq("peer_low", low)
    .eq("peer_high", high)
    .maybeSingle();

  if (selErr) throw selErr;
  const exId =
    typeof (existing as { id?: string } | null)?.id === "string"
      ? String((existing as { id: string }).id)
      : "";

  if (exId.trim()) return { roomId: exId.trim() };

  const inserted = await ctx.adm
    .from("doctor_rooms")
    .insert({
      is_general: false,
      name: "",
      peer_low: low,
      peer_high: high,
    } as never)
    .select("id")
    .single();

  if (!inserted.error && inserted.data && typeof (inserted.data as { id?: string }).id === "string") {
    return { roomId: (inserted.data as { id: string }).id };
  }

  const insErr = inserted.error;
  const code = (insErr as { code?: string } | null)?.code;
  const msg = String(insErr?.message ?? "");
  if (code === "23505" || msg.toLowerCase().includes("duplicate")) {
    const { data: retry, error: retryErr } = await ctx.adm
      .from("doctor_rooms")
      .select("id")
      .eq("is_general", false)
      .eq("peer_low", low)
      .eq("peer_high", high)
      .maybeSingle();
    if (retryErr) throw retryErr;
    const rid =
      typeof (retry as { id?: string } | null)?.id === "string"
        ? String((retry as { id: string }).id).trim()
        : "";
    if (rid) return { roomId: rid };
  }

  apiError(500, inserted.error?.message ?? "Не удалось создать чат.");
}

export async function fetchRoomMessages(
  ctx: DentalServiceContext,
  roomId: string,
  limitRaw?: unknown,
) {
  const act = requireActor(ctx.actor);
  await loadEmployee(ctx.adm, act, ctx.gate);

  const limitNum =
    typeof limitRaw === "number"
      ? limitRaw
      : typeof limitRaw === "string"
        ? Number(limitRaw)
        : 80;
  const lim = Number.isFinite(limitNum) ? Math.min(Math.max(Math.floor(limitNum), 1), 500) : 80;

  await assertDoctorCanUseRoomOrThrow(ctx.adm, act.id, roomId);

  const { data, error } = await ctx.adm
    .from("doctor_messages")
    .select("id, room_id, sender_id, sender_name, body, created_at, metadata")
    .eq("room_id", safeDentalScalarId(roomId, "room"))
    .order("created_at", { ascending: false })
    .limit(lim);

  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  rows.sort((a, b) => {
    const ta = typeof a.created_at === "string" ? new Date(a.created_at).getTime() : 0;
    const tb = typeof b.created_at === "string" ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  return { rows };
}

export async function insertRoomMessage(ctx: DentalServiceContext, payload: Record<string, unknown>) {
  const act = requireActor(ctx.actor);
  const empRow = await loadEmployee(ctx.adm, act, ctx.gate);
  const empId = safeDentalScalarId(typeof empRow.id === "string" ? empRow.id : act.id);

  const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
  const senderId = typeof payload.senderId === "string" ? payload.senderId.trim() : "";
  const senderName = typeof payload.senderName === "string" ? payload.senderName.trim() : "Врач";
  const bodyText = typeof payload.body === "string" ? payload.body.trim() : "";
  const metadata = payload.metadata;

  if (!bodyText) apiError(400, "Пустое сообщение.");
  await assertDoctorCanUseRoomOrThrow(ctx.adm, empId, roomId);

  const phoneDg = phoneDigitsNormalizedServer(String(empRow.phone ?? ""));
  const phoneOk = phoneDigitsNormalizedServer(senderId) === phoneDg;
  const idOk = senderId === empId;
  if (!(phoneOk || idOk)) apiError(403, "Неверный sender_id.");

  const insertPayload: Record<string, unknown> = {
    room_id: safeDentalScalarId(roomId, "room"),
    sender_id: senderId,
    sender_name: senderName,
    body: bodyText,
  };
  if (metadata !== undefined && metadata !== null && typeof metadata === "object") {
    insertPayload.metadata = metadata;
  }

  const { data: created, error: insErr } = await ctx.adm
    .from("doctor_messages")
    .insert(insertPayload as never)
    .select("id, room_id, sender_id, sender_name, body, created_at, metadata")
    .single();

  if (insErr) throw insErr;
  return { row: created };
}

export async function updateRoomMessage(
  ctx: DentalServiceContext,
  messageId: string,
  body: string,
) {
  requireActor(ctx.actor);
  const id = safeDentalScalarId(messageId, "message");
  const { error } = await ctx.adm
    .from("doctor_messages")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { ok: true as const };
}

export async function deleteRoomMessage(ctx: DentalServiceContext, messageId: string) {
  requireActor(ctx.actor);
  const id = safeDentalScalarId(messageId, "message");
  const { error } = await ctx.adm.from("doctor_messages").delete().eq("id", id);
  if (error) throw error;
  return { ok: true as const };
}

export async function pollRooms(ctx: DentalServiceContext, roomIdsRaw?: unknown) {
  const act = requireActor(ctx.actor);
  await loadEmployee(ctx.adm, act, ctx.gate);
  const selfId = safeDentalScalarId(act.id);

  const filterIds = safeRoomIds(roomIdsRaw);

  const discover: string[] = [];
  if (!filterIds.length) {
    const { data: gen, error: gErr } = await ctx.adm
      .from("doctor_rooms")
      .select("id")
      .eq("is_general", true)
      .limit(1)
      .maybeSingle();
    if (gErr) throw gErr;
    const gid =
      typeof (gen as { id?: string } | null)?.id === "string" ? (gen as { id: string }).id.trim() : "";
    if (gid) discover.push(gid);

    const { data: dmRooms, error: dErr } = await ctx.adm
      .from("doctor_rooms")
      .select("id")
      .eq("is_general", false)
      .or(`peer_low.eq.${selfId},peer_high.eq.${selfId}`);
    if (dErr) throw dErr;
    for (const r of dmRooms ?? []) {
      const rid = typeof (r as { id?: string }).id === "string" ? (r as { id: string }).id.trim() : "";
      if (rid) discover.push(rid);
    }
  }

  const uniq = [...new Set(filterIds.length ? filterIds : discover)];

  const lastByRoom: Record<string, { created_at: string | null; body: string | null }> = {};

  for (const rid of uniq.slice(0, 80)) {
    await assertDoctorCanUseRoomOrThrow(ctx.adm, selfId, rid);
    const { data: tip, error: mErr } = await ctx.adm
      .from("doctor_messages")
      .select("created_at, body")
      .eq("room_id", rid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mErr && mErr.code !== "PGRST116") throw mErr;

    lastByRoom[safeDentalScalarId(rid, "room")] = {
      created_at:
        typeof (tip as { created_at?: string } | null)?.created_at === "string"
          ? (tip as { created_at: string }).created_at
          : null,
      body:
        typeof (tip as { body?: string } | null)?.body === "string"
          ? (tip as { body: string }).body
          : null,
    };
  }

  return { rooms: lastByRoom };
}
