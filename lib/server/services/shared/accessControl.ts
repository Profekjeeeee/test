import "server-only";

import crypto from "crypto";

import type { DentalGwActor } from "@/lib/dentalGwTypes";
import { apiError } from "@/lib/server/api/apiError";
import type { DentalGateVerified } from "@/lib/server/dentalGateVerify";
import { phoneDigitsNormalizedServer } from "@/lib/server/normalizePhoneDigitsServer";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";

export interface DentalServiceContext {
  adm: SupabaseClient;
  gate: DentalGateVerified;
  actor: DentalGwActor | null;
}

export function createDentalServiceContext(
  gate: DentalGateVerified,
  actor: DentalGwActor | null,
): DentalServiceContext {
  return { adm: getSupabaseServiceRole(), gate, actor };
}

const SAFE_IDENT = /^[a-zA-Z0-9_.\-]{1,128}$/;
const SAFE_UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeDentalScalarId(raw: unknown, label = "id"): string {
  if (typeof raw !== "string" || !raw.trim()) apiError(400, `Некорректное поле «${label}».`);
  const v = raw.trim();
  if (!SAFE_IDENT.test(v)) apiError(400, `Идентификатор недопустим: ${label}`);
  return v;
}

export function isSafeUuid(raw: string): boolean {
  return SAFE_UUIDISH.test(raw.trim());
}

export function isoDateLocal(year: number, monthNum: number, day: number): string {
  const mm = String(monthNum).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function telegramMatchesRowTelegram(
  row: { telegram_id?: unknown } | null,
  gate: DentalGateVerified,
): boolean {
  if (gate.kind === "dev") return true;
  const want = gate.telegramUserId;
  const storedRaw = row?.telegram_id;
  const stored = storedRaw == null ? "" : String(storedRaw).trim();
  if (!stored) return true;
  return stored === want;
}

function phonesMatch(actorPhone: string | undefined, dbPhone: string | null | undefined): boolean {
  if (!actorPhone?.trim()) return false;
  return normalizePhone(actorPhone) === normalizePhone(dbPhone ?? "");
}

export async function loadEmployee(
  adm: SupabaseClient,
  actor: DentalGwActor,
  gate: DentalGateVerified,
) {
  const { data, error } = await adm.from("dental_employees").select("*").eq("id", actor.id).maybeSingle();
  if (error) apiError(500, error.message);
  if (!data || typeof data !== "object") apiError(403, "Сессия не сопоставлена с записью сотрудника.");
  const row = data as Record<string, unknown>;
  if (!phonesMatch(actor.phone, String(row.phone ?? ""))) apiError(403, "Несовпадение телефона сессии с данными базы.");
  if (!telegramMatchesRowTelegram(row as { telegram_id?: unknown }, gate)) {
    apiError(403, "Telegram аккаунт не привязан к записи этого сотрудника.");
  }
  return row;
}

export async function loadClient(
  adm: SupabaseClient,
  actor: DentalGwActor,
  gate: DentalGateVerified,
) {
  const { data, error } = await adm.from("dental_clients").select("*").eq("id", actor.id).maybeSingle();
  if (error) apiError(500, error.message);
  if (!data || typeof data !== "object") apiError(403, "Сессия не сопоставлена с записью пациента.");
  const row = data as Record<string, unknown>;
  if (!phonesMatch(actor.phone, String(row.phone ?? ""))) apiError(403, "Несовпадение номера пациента.");
  if (!telegramMatchesRowTelegram(row as { telegram_id?: unknown }, gate)) {
    apiError(403, "Telegram не подтверждён для этой строки профиля.");
  }
  return row;
}

export function requireActor(actor: DentalGwActor | null | undefined): DentalGwActor {
  if (!actor?.id?.trim()) apiError(403, "Нужна сессия.");
  if (actor.role !== "client" && actor.role !== "doctor" && actor.role !== "admin") {
    apiError(400, "Некорректная роль.");
  }
  return actor;
}

export async function ensureShadowAuthForRow(
  table: "dental_clients" | "dental_employees",
  pk: string,
): Promise<string> {
  const admin = getSupabaseServiceRole();
  const { data: cur, error: rErr } = await admin.from(table).select("id, auth_user_id").eq("id", pk).maybeSingle();
  if (rErr) apiError(500, rErr.message);
  const row = cur as { auth_user_id?: unknown } | null;
  if (!row) apiError(404, `Строка ${table} не найдена`);
  const existing = row.auth_user_id != null ? String(row.auth_user_id).trim() : "";
  if (existing) return existing;

  const safePk = String(pk).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 72);
  const email = `shadow+${table === "dental_clients" ? "c" : "e"}_${safePk}@dental-miniapp.invalid`;
  const pass = crypto.randomBytes(44).toString("base64url");

  const { data: uc, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    user_metadata: { dental_gateway: table, dental_pk: pk },
  });
  if (cErr?.message?.toLowerCase().includes("duplicate") || cErr?.code === "phone_exists") {
    apiError(
      409,
      "Конфликт auth.users: возможно технический аккаунт уже существует под другим ключом почты.",
    );
  }
  if (cErr || !uc?.user?.id) apiError(500, cErr?.message ?? "Не удалось создать запись Supabase Auth.");

  const uid = uc.user!.id;
  const { error: updErr } = await admin.from(table).update({ auth_user_id: uid }).eq("id", pk);
  if (updErr) apiError(500, updErr.message);
  return uid;
}

export function chatDoctorCanSeeRow(
  m: Record<string, unknown>,
  emp: { id: string; phone: string; role: string },
  apptClientIds: Set<string>,
): boolean {
  const sender_id = String(m.sender_id ?? "");
  const recipient_id = String(m.recipient_id ?? "");
  const chat_type = String(m.chat_type ?? "");
  const sender_role = String(m.sender_role ?? "");
  const p = phoneDigitsNormalizedServer;
  const eph = p(emp.phone);

  if (emp.role === "admin") return true;
  if (emp.role !== "doctor") return false;
  if (chat_type === "support") return false;

  if (chat_type === "doctor") {
    return (
      p(sender_id) === eph ||
      p(recipient_id) === eph ||
      sender_id === emp.id ||
      recipient_id === emp.id
    );
  }

  if (chat_type !== "clinic") return false;

  const inAppt = apptClientIds.has(sender_id) || apptClientIds.has(recipient_id);
  const doctorSent =
    sender_role === "doctor" &&
    (p(sender_id) === eph || sender_id === emp.id);
  return inAppt || doctorSent;
}

export function safeRoomIds(raw: unknown, max = 60): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const ids: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const v = item.trim();
    if (!SAFE_IDENT.test(v)) continue;
    ids.push(v);
    if (ids.length >= max) break;
  }
  return [...new Set(ids)];
}

export function orderedDoctorPeerPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export async function assertDoctorCanUseRoomOrThrow(
  adm: SupabaseClient,
  selfEmployeeId: string,
  roomId: string,
): Promise<void> {
  const rid = safeDentalScalarId(roomId, "room");

  const { data, error } = await adm
    .from("doctor_rooms")
    .select("id, is_general, peer_low, peer_high")
    .eq("id", rid)
    .maybeSingle();

  if (error) apiError(500, error.message);

  const row = data as
    | { id?: string; is_general?: boolean | null; peer_low?: string | null; peer_high?: string | null }
    | null;

  if (!row?.id) apiError(404, "Комната не найдена.");

  if (row.is_general === true) return;

  const self = safeDentalScalarId(selfEmployeeId);
  const low = typeof row.peer_low === "string" ? row.peer_low : "";
  const high = typeof row.peer_high === "string" ? row.peer_high : "";
  if (low === self || high === self) return;

  apiError(403, "Нет доступа к этой комнате.");
}

export async function assertAppointmentAccessOrThrow(
  ctx: DentalServiceContext,
  appointmentPk: string,
): Promise<void> {
  const { data, error } = await ctx.adm
    .from("appointments")
    .select("client_id")
    .eq("id", appointmentPk)
    .maybeSingle();
  if (error) apiError(500, error.message);
  const ap = data as { client_id?: string | null } | null;
  if (!ap?.client_id) apiError(404, "Нет строки записи.");

  const act = requireActor(ctx.actor);
  if (act.role === "doctor" || act.role === "admin") {
    await loadEmployee(ctx.adm, act, ctx.gate);
    return;
  }
  const meRow = await loadClient(ctx.adm, act, ctx.gate);
  if (
    safeDentalScalarId(meRow.id ?? "", "patient") !== safeDentalScalarId(ap.client_id, "patient")
  ) {
    apiError(403, "Не ваша запись.");
  }
}
