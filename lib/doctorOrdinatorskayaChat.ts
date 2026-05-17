import { supabase } from "@/lib/supabaseClient";
import { sanitizeFormulaTeethForSupabase } from "@/lib/patientTeeth";
import type { ToothStatus } from "@/types";

export type DoctorConsiliumMetadata = {
  type: "consilium";
  patientId: string;
  patientName?: string;
  formulaTeeth: ToothStatus[];
};

export type DoctorMessageMetadata = DoctorConsiliumMetadata;

export type DoctorOrdinatorskayaMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: number;
  metadata: DoctorMessageMetadata | null;
};

interface DoctorMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  metadata?: unknown;
}

export function parseDoctorMessageMetadata(raw: unknown): DoctorMessageMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== "consilium") return null;
  const patientId =
    typeof o.patient_id === "string"
      ? o.patient_id
      : typeof o.patientId === "string"
        ? o.patientId
        : null;
  if (!patientId?.trim()) return null;
  const patientNameRaw =
    typeof o.patient_name === "string"
      ? o.patient_name
      : typeof o.patientName === "string"
        ? o.patientName
        : undefined;
  const rawTeeth = o.formula_teeth ?? o.formulaTeeth;
  if (!Array.isArray(rawTeeth)) return null;
  const formulaTeeth = sanitizeFormulaTeethForSupabase(rawTeeth as ToothStatus[]);
  return {
    type: "consilium",
    patientId: patientId.trim(),
    patientName: patientNameRaw?.trim() || undefined,
    formulaTeeth,
  };
}

function rowToMessage(row: DoctorMessageRow): DoctorOrdinatorskayaMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    senderName: row.sender_name ?? "",
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
    metadata: parseDoctorMessageMetadata(row.metadata),
  };
}

const GENERAL_ROOM_FALLBACK_NAME = "Ординаторская";

function pickDoctorRoomRowId(row: unknown): string | null {
  const id = row && typeof (row as { id?: string }).id === "string" ? (row as { id: string }).id : null;
  return id?.trim() ? id : null;
}

/** Общая комната из БД: id + человекочитаемое имя колонки `name`. */
function pickGeneralDoctorRoomRow(row: unknown): { id: string; name: string } | null {
  const id = pickDoctorRoomRowId(row);
  if (!id) return null;
  const raw = row && typeof (row as { name?: unknown }).name === "string" ? (row as { name: string }).name : "";
  const name = raw.trim() || GENERAL_ROOM_FALLBACK_NAME;
  return { id, name };
}

/**
 * Комната с is_general = true (общий чат клиники).
 * Если записи ещё нет (пустая БД, первая сессия Mini App) — создаём строку автоматически.
 */
export async function ensureGeneralDoctorRoom(): Promise<{ id: string; name: string } | null> {
  const selectGeneral = async () => {
    const { data, error } = await supabase
      .from("doctor_rooms")
      .select("id, name")
      .eq("is_general", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[doctorOrdinatorskayaChat] general room select:", error);
      return null;
    }
    return pickGeneralDoctorRoomRow(data);
  };

  const existing = await selectGeneral();
  if (existing) return existing;

  const { data: created, error: insErr } = await supabase
    .from("doctor_rooms")
    .insert({ name: GENERAL_ROOM_FALLBACK_NAME, is_general: true })
    .select("id, name")
    .single();

  const createdRoom = pickGeneralDoctorRoomRow(created);
  if (!insErr && createdRoom) return createdRoom;

  const afterRace = await selectGeneral();
  if (afterRace) return afterRace;

  if (insErr) console.error("[doctorOrdinatorskayaChat] general room insert:", insErr);
  return null;
}

/** Все личные комнаты текущего врача: peerId → roomId. */
export async function fetchMyDirectRoomPeerMap(selfId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("doctor_rooms")
    .select("id, peer_low, peer_high")
    .eq("is_general", false)
    .or(`peer_low.eq.${selfId},peer_high.eq.${selfId}`);

  if (error) {
    console.error("[doctorOrdinatorskayaChat] dm map:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const rec = row as { id?: string; peer_low?: string | null; peer_high?: string | null };
    const id = rec.id;
    const low = rec.peer_low ?? "";
    const high = rec.peer_high ?? "";
    if (!id || !low || !high) continue;
    const peer = low === selfId ? high : high === selfId ? low : "";
    if (peer) map[peer] = id;
  }
  return map;
}

function orderedPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

/**
 * Найти или создать приватную комнату 1:1. `id` в insert не передаём — default в БД.
 */
export async function findOrCreatePrivateDoctorRoom(
  selfId: string,
  peerId: string
): Promise<{ roomId: string | null; error: string | null }> {
  if (!selfId || !peerId || selfId === peerId) {
    return { roomId: null, error: "Некорректный собеседник" };
  }
  const { low, high } = orderedPair(selfId, peerId);

  const { data: existing, error: selErr } = await supabase
    .from("doctor_rooms")
    .select("id")
    .eq("is_general", false)
    .eq("peer_low", low)
    .eq("peer_high", high)
    .maybeSingle();

  if (selErr) {
    console.error("[doctorOrdinatorskayaChat] find dm:", selErr);
    return { roomId: null, error: selErr.message ?? "Ошибка БД" };
  }
  const exId = existing && typeof (existing as { id?: string }).id === "string" ? (existing as { id: string }).id : null;
  if (exId) return { roomId: exId, error: null };

  const { data: created, error: insErr } = await supabase
    .from("doctor_rooms")
    .insert({
      is_general: false,
      name: "",
      peer_low: low,
      peer_high: high,
    })
    .select("id")
    .single();

  if (!insErr && created && typeof (created as { id?: string }).id === "string") {
    return { roomId: (created as { id: string }).id, error: null };
  }

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    const msg = insErr.message ?? "";
    if (code === "23505" || msg.toLowerCase().includes("duplicate")) {
      const { data: retry } = await supabase
        .from("doctor_rooms")
        .select("id")
        .eq("is_general", false)
        .eq("peer_low", low)
        .eq("peer_high", high)
        .maybeSingle();
      const rid = retry && typeof (retry as { id?: string }).id === "string" ? (retry as { id: string }).id : null;
      if (rid) return { roomId: rid, error: null };
    }
    console.error("[doctorOrdinatorskayaChat] create dm:", insErr);
    return { roomId: null, error: insErr.message ?? "Ошибка создания чата" };
  }

  return { roomId: null, error: "Не удалось создать чат" };
}

/** Последние `limit` сообщений, по времени по возрастанию (для списка в UI). */
export async function fetchDoctorRoomMessages(
  roomId: string,
  limit: number
): Promise<DoctorOrdinatorskayaMessage[]> {
  const { data, error } = await supabase
    .from("doctor_messages")
    .select("id, room_id, sender_id, sender_name, body, created_at, metadata")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[doctorOrdinatorskayaChat] messages:", error);
    return [];
  }

  const rows = (data ?? []) as DoctorMessageRow[];
  return rows.map(rowToMessage).sort((a, b) => a.createdAt - b.createdAt);
}

const GLOBAL_CHANNEL = "doctor_messages_global_inserts_v1";

function isCompleteDoctorMessageRow(row: DoctorMessageRow): boolean {
  return (
    typeof row.id === "string" &&
    typeof row.body === "string" &&
    typeof row.sender_id === "string" &&
    typeof row.room_id === "string"
  );
}

/**
 * Все INSERT в doctor_messages (одна подписка — удобно переключать активную комнату без смены канала).
 */
export function subscribeAllDoctorMessageInserts(onInsert: (msg: DoctorOrdinatorskayaMessage) => void): () => void {
  const channel = supabase
    .channel(GLOBAL_CHANNEL)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "doctor_messages",
      },
      (payload: { new?: unknown }) => {
        const row = payload.new as DoctorMessageRow | undefined;
        if (row && isCompleteDoctorMessageRow(row)) {
          onInsert(rowToMessage(row));
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function sendDoctorRoomMessage(payload: {
  roomId: string;
  senderId: string;
  senderName: string;
  body: string;
  metadata?: Record<string, unknown> | null;
}): Promise<{ message: DoctorOrdinatorskayaMessage | null; error: string | null }> {
  const body = payload.body.trim();
  if (!body) return { message: null, error: "Пустое сообщение" };

  const insertPayload: Record<string, unknown> = {
    room_id: payload.roomId,
    sender_id: payload.senderId,
    sender_name: payload.senderName.trim() || "Врач",
    body,
  };
  if (payload.metadata != null) {
    insertPayload.metadata = payload.metadata;
  }

  const { data, error } = await supabase
    .from("doctor_messages")
    .insert(insertPayload)
    .select("id, room_id, sender_id, sender_name, body, created_at, metadata")
    .single();

  if (error) {
    console.error("[doctorOrdinatorskayaChat] send:", error);
    return { message: null, error: error.message ?? "Ошибка отправки" };
  }

  return { message: rowToMessage(data as DoctorMessageRow), error: null };
}

/**
 * Консилиум: тело сообщения в колонке `body` (в схеме нет `text`).
 * metadata: patient_id, patient_name, formula_teeth (снимок).
 */
export async function sendConsiliumCaseMessage(payload: {
  roomId: string;
  senderId: string;
  senderName: string;
  patientId: string;
  patientName: string;
  formulaTeeth: ToothStatus[];
}): Promise<{ message: DoctorOrdinatorskayaMessage | null; error: string | null }> {
  const patientName = payload.patientName.trim() || "Пациент";
  const body = `Направлен клинический случай пациента: ${patientName}. Требуется консультация.`;
  const teeth = sanitizeFormulaTeethForSupabase(payload.formulaTeeth);
  const metadata = {
    type: "consilium",
    patient_id: payload.patientId.trim(),
    patient_name: patientName,
    formula_teeth: teeth,
  };
  return sendDoctorRoomMessage({
    roomId: payload.roomId,
    senderId: payload.senderId,
    senderName: payload.senderName.trim() || "Врач",
    body,
    metadata,
  });
}
