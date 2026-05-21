import "server-only";

import crypto from "crypto";

import type { DentalGatewayRequestBody, DentalGwActor } from "@/lib/dentalGwTypes";
import type { DentalGateVerified } from "@/lib/server/dentalGateVerify";
import { DentalGateError, verifyDentalGateRequest } from "@/lib/server/dentalGateVerify";
import { phoneDigitsNormalizedServer } from "@/lib/server/normalizePhoneDigitsServer";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCompleteRuMobileDigits, normalizePhone, phoneDigitsSuffixPattern } from "@/lib/phone";

function gw(status: number, msg: string): never {
  throw new DentalGateError(status, msg);
}

const SAFE_IDENT = /^[a-zA-Z0-9_.\-]{1,128}$/;
const SAFE_UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeDentalScalarId(raw: unknown, label = "id"): string {
  if (typeof raw !== "string" || !raw.trim()) gw(400, `Некорректное поле «${label}».`);
  const v = raw.trim();
  if (!SAFE_IDENT.test(v)) gw(400, `Идентификатор недопустим: ${label}`);
  return v;
}

function isoDateLocal(year: number, monthNum: number, day: number): string {
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

async function loadEmployee(actor: DentalGwActor, gate: DentalGateVerified) {
  const adm = getSupabaseServiceRole();
  const { data, error } = await adm.from("dental_employees").select("*").eq("id", actor.id).maybeSingle();
  if (error) gw(500, error.message);
  if (!data || typeof data !== "object") gw(403, "Сессия не сопоставлена с записью сотрудника.");
  const row = data as Record<string, unknown>;
  if (!phonesMatch(actor.phone, String(row.phone ?? ""))) gw(403, "Несовпадение телефона сессии с данными базы.");
  if (!telegramMatchesRowTelegram(row as { telegram_id?: unknown }, gate)) {
    gw(403, "Telegram аккаунт не привязан к записи этого сотрудника.");
  }
  return row;
}

async function loadClient(actor: DentalGwActor, gate: DentalGateVerified) {
  const adm = getSupabaseServiceRole();
  const { data, error } = await adm.from("dental_clients").select("*").eq("id", actor.id).maybeSingle();
  if (error) gw(500, error.message);
  if (!data || typeof data !== "object") gw(403, "Сессия не сопоставлена с записью пациента.");
  const row = data as Record<string, unknown>;
  if (!phonesMatch(actor.phone, String(row.phone ?? ""))) gw(403, "Несовпадение номера пациента.");
  if (!telegramMatchesRowTelegram(row as { telegram_id?: unknown }, gate)) {
    gw(403, "Telegram не подтверждён для этой строки профиля.");
  }
  return row;
}

function requireActor(actor: DentalGwActor | null | undefined): DentalGwActor {
  if (!actor?.id?.trim()) gw(403, "Нужна сессия.");
  if (actor.role !== "client" && actor.role !== "doctor" && actor.role !== "admin") gw(400, "Некорректная роль.");
  return actor;
}

async function ensureShadowAuthForRow(table: "dental_clients" | "dental_employees", pk: string): Promise<string> {
  const admin = getSupabaseServiceRole();
  const { data: cur, error: rErr } = await admin.from(table).select("id, auth_user_id").eq("id", pk).maybeSingle();
  if (rErr) gw(500, rErr.message);
  const row = cur as { auth_user_id?: unknown } | null;
  if (!row) gw(404, `Строка ${table} не найдена`);
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
    gw(
      409,
      "Конфликт auth.users: возможно технический аккаунт уже существует под другим ключом почты.",
    );
  }
  if (cErr || !uc?.user?.id) gw(500, cErr?.message ?? "Не удалось создать запись Supabase Auth.");

  const uid = uc.user!.id;
  const { error: updErr } = await admin.from(table).update({ auth_user_id: uid }).eq("id", pk);
  if (updErr) gw(500, updErr.message);
  return uid;
}

async function gatewayResolvePatientClientId(params: {
  adm: SupabaseClient;
  gate: DentalGateVerified;
  actor: DentalGwActor | null;
  /** Явное dental_clients.id (из сессии currentUserId или eq). */
  uidHint?: string | null | undefined;
  /** Опциональный телефон в свободной форме. */
  explicitPhone?: string | null | undefined;
  /** Если true и actor — client — uidHint обязательно совпадает с профилем. */
  enforceClientOwnership: boolean;
}): Promise<string> {
  const { adm, gate, actor, uidHint: uidHintRaw, explicitPhone: explicitRaw, enforceClientOwnership } = params;

  let uidPass = typeof uidHintRaw === "string" && uidHintRaw.trim().length ? uidHintRaw.trim() : null;

  /** actor.id для клиента */
  if (
    enforceClientOwnership &&
    (!uidPass || !uidPass.length) &&
    actor?.role === "client" &&
    typeof actor?.id === "string"
  ) {
    uidPass = actor.id;
  }

  let explicitPhoneDigits: string | null = explicitRaw?.trim().length ? normalizePhone(explicitRaw) : null;
  const sessionPhoneDigits =
    typeof actor?.phone === "string" && actor.phone.trim() ? normalizePhone(actor.phone) : "";
  if ((!explicitPhoneDigits || explicitPhoneDigits.length < 10) && sessionPhoneDigits.length >= 10)
    explicitPhoneDigits = sessionPhoneDigits;

  if (uidPass) {
    uidPass = safeDentalScalarId(uidPass, "client");
    if (enforceClientOwnership && actor?.role === "client") {
      const actorRow = await loadClient(requireActor(actor), gate);
      if (String(actorRow.id ?? "") !== uidPass) gw(403, "Несогласованный профиль пациента.");
    }
    const { data, error } = await adm.from("dental_clients").select("*").eq("id", uidPass).maybeSingle();
    if (error) gw(500, error.message);
    const picked = data as Record<string, unknown> | null;
    if (!picked?.id) gw(404, "Пациент не найден.");
    if (!telegramMatchesRowTelegram(picked as { telegram_id?: unknown }, gate)) gw(403, "Профиль привязан к другому Telegram.");
    return safeDentalScalarId(picked.id, "patient");
  }

  const digits = normalizePhone(explicitPhoneDigits ?? "");
  if (!digits || digits.length < 10) gw(400, "Не удалось определить пациента по телефону.");

  /** eq phone */
  {
    const { data, error } = await adm.from("dental_clients").select("*").eq("phone", digits).maybeSingle();
    if (error && error.code !== "PGRST116") gw(500, error.message);
    const picked = data as Record<string, unknown> | null;
    if (picked?.id) {
      if (!telegramMatchesRowTelegram(picked as { telegram_id?: unknown }, gate)) gw(403, "Привязка Telegram.");
      const id = safeDentalScalarId(picked.id, "patient");
      if (enforceClientOwnership && actor?.role === "client") {
        if (normalizePhone(actor.phone ?? "") !== normalizePhone(String(picked.phone ?? ""))) gw(403, "Не ваш профиль.");
        if (actor.id.trim() !== id) gw(403, "Клиент может записывать только со своего профиля.");
      }
      return id;
    }
  }

  const pat = phoneDigitsSuffixPattern(digits);
  const { data: bySx, error: sxErr } = await adm
    .from("dental_clients")
    .select("*")
    .ilike("phone", pat)
    .maybeSingle();

  if (sxErr && sxErr.code !== "PGRST116") gw(500, sxErr.message);
  const sx = bySx as Record<string, unknown> | null;

  if (!sx?.id) {
    gw(404, "Пациент не найден в базе (нужна регистрация).");
  }
  if (!telegramMatchesRowTelegram(sx as { telegram_id?: unknown }, gate)) gw(403, "Привязка Telegram.");

  const id = safeDentalScalarId(sx.id, "patient");
  if (enforceClientOwnership && actor?.role === "client") {
    if (normalizePhone(actor.phone ?? "") !== normalizePhone(String(sx.phone ?? ""))) gw(403, "Не ваш профиль.");
    if (actor.id.trim() !== id) gw(403, "Клиент может записать только свой профиль.");
  }
  return id;
}

function chatDoctorCanSeeRow(
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

function safeRoomIds(raw: unknown, max = 60): string[] {
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

function orderedDoctorPeerPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

async function assertDoctorCanUseRoomOrThrow(
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

  if (error) gw(500, error.message);

  const row = data as
    | { id?: string; is_general?: boolean | null; peer_low?: string | null; peer_high?: string | null }
    | null;

  if (!row?.id) gw(404, "Комната не найдена.");

  if (row.is_general === true) return;

  const self = safeDentalScalarId(selfEmployeeId);
  const low = typeof row.peer_low === "string" ? row.peer_low : "";
  const high = typeof row.peer_high === "string" ? row.peer_high : "";
  if (low === self || high === self) return;

  gw(403, "Нет доступа к этой комнате.");
}

async function assertAppointmentAccessOrThrow(
  actorInput: DentalGwActor | null,
  gate: DentalGateVerified,
  appointmentPk: string,
): Promise<void> {
  const admLocal = getSupabaseServiceRole();
  const { data, error } = await admLocal
    .from("appointments")
    .select("client_id")
    .eq("id", appointmentPk)
    .maybeSingle();
  if (error) gw(500, error.message);
  const ap = data as { client_id?: string | null } | null;
  if (!ap?.client_id) gw(404, "Нет строки записи.");

  const act = requireActor(actorInput);
  if (act.role === "doctor" || act.role === "admin") {
    await loadEmployee(act, gate);
    return;
  }
  const meRow = await loadClient(act, gate);
  if (
    safeDentalScalarId(meRow.id ?? "", "patient") !== safeDentalScalarId(ap.client_id, "patient")
  )
    gw(403, "Не ваша запись.");
}

export async function dentalDbGateway(body: DentalGatewayRequestBody): Promise<unknown> {
  const gate = verifyDentalGateRequest(body.telegramInitData);
  const op = typeof body.op === "string" ? body.op.trim() : "";
  if (!op) gw(400, "Нет операции.");

  const rawPayload = body.payload ?? undefined;
  const payload = typeof rawPayload === "object" && rawPayload !== null ? (rawPayload as Record<string, unknown>) : {};
  const actor = body.actor ?? null;

  const adm = getSupabaseServiceRole();

  switch (op) {
    case "authLookupEmployeeClient": {
      const digits = normalizePhone(typeof payload.cleanPhone === "string" ? payload.cleanPhone : "");
      if (!isCompleteRuMobileDigits(digits)) gw(400, "Телефон некорректен.");
      const pat = phoneDigitsSuffixPattern(digits);
      let employee = null as Record<string, unknown> | null;

      const { data: emp, error: eErr } = await adm.from("dental_employees").select("*").ilike("phone", pat).limit(1).maybeSingle();
      if (eErr) gw(500, eErr.message);
      employee = emp as Record<string, unknown> | null;

      let client = null as Record<string, unknown> | null;
      if (!employee) {
        const { data: cli, error: cErr } = await adm.from("dental_clients").select("*").ilike("phone", pat).limit(1).maybeSingle();
        if (cErr) gw(500, cErr.message);
        client = cli as Record<string, unknown> | null;
      }

      if (employee && !telegramMatchesRowTelegram(employee as { telegram_id?: unknown }, gate)) employee = null;
      if (client && !telegramMatchesRowTelegram(client as { telegram_id?: unknown }, gate)) client = null;
      return { employee, client };
    }

    case "refreshDentalCaches": {
      if (!actor?.id?.trim()) {
        const { data, error } = await adm.from("dental_employees").select("*").order("name", { ascending: true });
        if (error) gw(500, error.message);
        return { dental_clients: [], dental_employees: data ?? [] };
      }

      if (actor.role === "doctor" || actor.role === "admin") {
        await loadEmployee(actor, gate);
        const [clientsRes, empRes] = await Promise.all([
          adm.from("dental_clients").select("*").order("created_at", { ascending: true }),
          adm.from("dental_employees").select("*").order("name", { ascending: true }),
        ]);
        if (clientsRes.error) gw(500, clientsRes.error.message);
        if (empRes.error) gw(500, empRes.error.message);
        return { dental_clients: clientsRes.data ?? [], dental_employees: empRes.data ?? [] };
      }

      if (actor.role === "client") {
        await loadClient(actor, gate);
        const { data: me, error } = await adm.from("dental_clients").select("*").eq("id", actor.id).maybeSingle();
        if (error) gw(500, error.message);
        const { data: empRows, error: ee } = await adm
          .from("dental_employees")
          .select("*")
          .order("name", { ascending: true });
        if (ee) gw(500, ee.message);

        const clientsArr = me ? [me as Record<string, unknown>] : [];
        return { dental_clients: clientsArr, dental_employees: empRows ?? [] };
      }

      gw(403, "Неизвестный actor.");
    }

    case "registerClient": {
      const cleanPhone = normalizePhone(typeof payload.phone === "string" ? payload.phone : "");
      if (cleanPhone.length < 10) gw(400, "Телефон.");

      const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
      const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
      const email = typeof payload.email === "string" ? payload.email.trim() : "";
      const fullName = `${firstName} ${lastName}`.trim();

      const tgDigits =
        gate.kind === "telegram"
          ? gate.telegramUserId.replace(/\D/g, "")
          : typeof payload.telegramId === "string"
            ? payload.telegramId.replace(/\D/g, "")
            : "";

      const { data: ua, error: auErr } = await adm.auth.admin.createUser({
        email: `signup+client_${crypto.randomUUID()}@dental-miniapp.invalid`,
        password: crypto.randomBytes(44).toString("base64url"),
        email_confirm: true,
        user_metadata: { dental_register: "client", phone: cleanPhone },
      });
      if (auErr || !ua?.user?.id) gw(500, auErr?.message ?? "auth.admin.createUser");

      const authId = ua.user!.id;

      const insertPayload: Record<string, unknown> = {
        id: authId,
        auth_user_id: authId,
        phone: cleanPhone,
        role: "client",
        first_name: firstName,
        last_name: lastName,
        name: fullName || null,
        email: email || null,
      };
      if (tgDigits.length > 5) insertPayload.telegram_id = tgDigits;

      let row = await adm.from("dental_clients").insert(insertPayload as never).select("*").single();
      const insErrMsg = row.error?.message ?? "";
      if (
        row.error &&
        (insErrMsg.includes("telegram_id") || row.error.code === "PGRST204" || row.error.code === "42703")
      ) {
        delete insertPayload.telegram_id;
        row = await adm.from("dental_clients").insert(insertPayload as never).select("*").single();
      }
      if (row.error) gw(500, row.error.message);

      /** Подтягиваем auth_user_id уже выставили */
      await ensureShadowAuthForRow("dental_clients", String((row.data as { id?: string }).id ?? authId)).catch(() => {});
      return row.data;
    }

    case "shadowEnsureActor": {
      const act = requireActor(actor);
      if (act.role === "client") {
        await loadClient(act, gate);
        return { auth_user_id: await ensureShadowAuthForRow("dental_clients", act.id) };
      }
      await loadEmployee(act, gate);
      return { auth_user_id: await ensureShadowAuthForRow("dental_employees", act.id) };
    }

    case "patchTelegramIdIfEmpty": {
      const act = requireActor(actor);
      const tgDigits =
        typeof payload.telegramId === "string" && payload.telegramId.trim()
          ? payload.telegramId.trim().replace(/\D/g, "")
          : gate.kind === "telegram"
            ? gate.telegramUserId.trim().replace(/\D/g, "")
            : "";

      const table = act.role === "client" ? "dental_clients" : "dental_employees";

      await (table === "dental_clients" ? loadClient(act, gate) : loadEmployee(act, gate));

      if (!tgDigits) gw(400, "Нет telegram id.");

      const { error } = await adm.from(table).update({ telegram_id: tgDigits }).eq("id", act.id).is("telegram_id", null);

      if (error?.code === "42703" || String(error?.message ?? "").includes("telegram_id"))
        return { ok: true as const };

      if (error) gw(500, error.message);

      /** Линковка технического аккаунта после привязки Telegram */
      void ensureShadowAuthForRow(table === "dental_clients" ? "dental_clients" : "dental_employees", act.id);
      return { ok: true as const };
    }

    case "selectClientByPatientUuid": {
      const act = requireActor(actor);
      const uuid = typeof payload.uuid === "string" ? payload.uuid.trim() : "";
      if (!SAFE_UUIDISH.test(uuid)) gw(400, "UUID.");

      if (act.role === "client") {
        const me = await loadClient(act, gate);
        if (String(me.id ?? "") !== uuid) gw(403, "Не ваш профиль.");
      } else await loadEmployee(act, gate);

      const { data, error } = await adm.from("dental_clients").select("*").eq("id", uuid).maybeSingle();
      if (error) gw(500, error.message);
      return { row: data };
    }

    case "resolveClientPkForAppointment": {
      const patientId = await gatewayResolvePatientClientId({
        adm,
        gate,
        actor,
        uidHint: typeof payload.uid === "string" ? payload.uid : null,
        explicitPhone: typeof payload.explicitPhone === "string" ? payload.explicitPhone : null,
        enforceClientOwnership: actor?.role === "client",
      });
      return { clientId: patientId };
    }

    case "appointmentList": {
      if (!actor?.id) {
        const { data, error } = await adm
          .from("appointments")
          .select("*")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });
        if (error) gw(500, error.message);
        return { rows: data ?? [] };
      }

      if (actor.role === "doctor" || actor.role === "admin") {
        await loadEmployee(actor, gate);
        const { data, error } = await adm
          .from("appointments")
          .select("*")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });
        if (error) gw(500, error.message);
        return { rows: data ?? [] };
      }

      const c = await loadClient(actor, gate);
      const cid = safeDentalScalarId(c.id ?? "", "patient");
      const { data, error } = await adm
        .from("appointments")
        .select("*")
        .eq("client_id", cid)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });
      if (error) gw(500, error.message);
      return { rows: data ?? [] };
    }

    case "appointmentInsert": {
      const act = requireActor(actor);
      if (act.role !== "client") gw(403, "Запись на приём — только аккаунт пациента.");
      await loadClient(act, gate);

      const monthNum = typeof payload.monthNum === "number" ? payload.monthNum : Number(payload.monthNum);
      const day = typeof payload.day === "number" ? payload.day : Number(payload.day);
      const year = typeof payload.year === "number" ? payload.year : Number(payload.year);
      const timeSlot = typeof payload.time === "string" ? payload.time : "";
      const doctorNameRaw = typeof payload.doctorName === "string" ? payload.doctorName : "";
      const status = typeof payload.status === "string" ? payload.status : "pending";
      const clientPhoneExplicit = typeof payload.clientPhone === "string" ? payload.clientPhone : null;

      const clientId = await gatewayResolvePatientClientId({
        adm,
        gate,
        actor: act,
        uidHint: act.id,
        explicitPhone: clientPhoneExplicit ?? act.phone ?? null,
        enforceClientOwnership: true,
      });

      const doctorNameTrim = doctorNameRaw.trim();

      const { data, error } = await adm
        .from("appointments")
        .insert([
          {
            client_id: clientId,
            doctor_name: doctorNameTrim || "Врач",
            appointment_date: isoDateLocal(year, monthNum, day),
            appointment_time: timeSlot,
            status,
          } as Record<string, unknown>,
        ] as never)
        .select("*")
        .single();

      if (error) gw(500, error.message);
      return { row: data };
    }

    case "appointmentCancel": {
      const id = typeof payload.id === "string" ? payload.id : gw(400, "id");
      await assertAppointmentAccessOrThrow(actor, gate, safeDentalScalarId(id, "appointment"));
      const { error } = await adm.from("appointments").update({ status: "cancelled" }).eq("id", safeDentalScalarId(id, "appointment"));
      if (error) gw(500, error.message);
      return { ok: true as const };
    }

    case "appointmentReschedule": {
      const id = typeof payload.id === "string" ? payload.id : gw(400, "id");
      await assertAppointmentAccessOrThrow(actor, gate, safeDentalScalarId(id, "appointment"));
      const updates = typeof payload.updates === "object" && payload.updates !== null ? (payload.updates as Record<string, unknown>) : gw(400, "updates");
      const day = typeof updates.day === "number" ? updates.day : Number(updates.day);
      const monthNum = typeof updates.monthNum === "number" ? updates.monthNum : Number(updates.monthNum);
      const year = typeof updates.year === "number" ? updates.year : Number(updates.year);
      const slot = typeof updates.time === "string" ? updates.time : "";

      const { error } = await adm
        .from("appointments")
        .update({
          appointment_date: isoDateLocal(year, monthNum, day),
          appointment_time: slot,
          status: "scheduled",
        })
        .eq("id", safeDentalScalarId(id, "appointment"));
      if (error) gw(500, error.message);
      return { ok: true as const };
    }

    case "chatListMessages": {
      const limit = typeof payload.limit === "number" && payload.limit > 0 ? Math.min(Math.floor(payload.limit), 16000) : 12000;
      const { data, error } = await adm
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) gw(500, error.message);
      let rows = (data ?? []) as Record<string, unknown>[];

      if (!actor?.id) gw(403, "Чат недоступен без сессии.");

      if (actor.role === "doctor" || actor.role === "admin") {
        const empRow = await loadEmployee(actor, gate);

        /** Администратор смотрит весь журнал сообщений поддержки под одну шапку фильтров */
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
        if (!ae && Array.isArray(apts))
          for (const r of apts as { client_id?: string | null }[]) {
            if (r.client_id) setClients.add(String(r.client_id));
          }

        if (roleText === "admin") return { rows };

        rows = rows.filter((m) =>
          empMini.role !== "doctor" ? false : chatDoctorCanSeeRow(m, empMini, setClients),
        );
        return { rows };
      }

      /** client */
      const meRow = await loadClient(actor, gate);
      const cid = safeDentalScalarId(meRow.id ?? "", "patient");
      rows = rows.filter((m) => {
        const s = String(m.sender_id ?? "");
        const r = String(m.recipient_id ?? "");
        return s === cid || r === cid;
      });

      return { rows };
    }

    case "chatInsertMessage": {
      const senderId = typeof payload.senderId === "string" ? payload.senderId.trim() : "";
      const recipientId = typeof payload.recipientId === "string" ? payload.recipientId.trim() : "";
      const text = typeof payload.text === "string" ? payload.text : "";
      const senderRole = typeof payload.senderRole === "string" ? payload.senderRole : "";
      const chatType = typeof payload.chatType === "string" ? payload.chatType : "";
      const senderName = typeof payload.senderName === "string" ? payload.senderName.trim() : "";

      if (!senderId || !recipientId || !text.trim()) gw(400, "Не хватает полей сообщения.");
      const act = requireActor(actor);

      if (senderRole === "client") {
        if (act.role !== "client") gw(403, "Только аккаунт пациента.");
        const meRow = await loadClient(act, gate);
        if (safeDentalScalarId(meRow.id ?? "", "patient") !== safeDentalScalarId(senderId)) gw(403, "Подмена отправителя.");
      } else if (senderRole === "doctor" || senderRole === "admin") {
        await loadEmployee(act, gate);
        const emp = await adm.from("dental_employees").select("*").eq("id", act.id).maybeSingle();
        const row = emp.data as Record<string, unknown> | null;
        const phoneDg = phoneDigitsNormalizedServer(String(row?.phone ?? ""));
        if (senderRole === "admin") {
          if (String(act.role) !== "admin") gw(403, "Только аккаунт администратора.");
          const adminIdMatches = senderId.trim() === String(row?.id ?? "").trim();
          if (!adminIdMatches) gw(403, "Несовпадение sender_id админа.");
        } else if (senderRole === "doctor") {
          const phoneOk = phoneDigitsNormalizedServer(senderId) === phoneDg;
          const idOk = senderId.trim() === String(row?.id ?? "").trim();
          if (!(phoneOk || idOk)) gw(403, "Неверный sender_id для врача.");
        }
      } else gw(400, "Роль отправителя не поддерживается.");

      /** id по умолчанию — gen_random_uuid() в Postgres */
      const { data: created, error: insErr } = await adm
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

      if (insErr) gw(500, insErr.message);
      return { row: created };
    }

    case "doctorEnsureGeneralRoom": {
      const act = requireActor(actor);
      await loadEmployee(act, gate);
      const FALLBACK = "Ординаторская";

      let { data, error } = await adm
        .from("doctor_rooms")
        .select("id, name")
        .eq("is_general", true)
        .limit(1)
        .maybeSingle();

      if (error) gw(500, error.message);

      let row = data as { id?: string; name?: string } | null;
      if (!row?.id) {
        const inserted = await adm
          .from("doctor_rooms")
          .insert({ name: FALLBACK, is_general: true } as never)
          .select("id, name")
          .single();

        const insRow = inserted.data as { id?: string; name?: string } | null | undefined;

        /** гонки */
        if (inserted.error) {
          const second = await adm
            .from("doctor_rooms")
            .select("id, name")
            .eq("is_general", true)
            .limit(1)
            .maybeSingle();
          row = second.data as { id?: string; name?: string } | null;
        } else row = insRow ?? null;

        /** fallback второй попыткой */
        if (!row?.id) {
          const second = await adm
            .from("doctor_rooms")
            .select("id, name")
            .eq("is_general", true)
            .limit(1)
            .maybeSingle();
          if (second.error) gw(500, second.error.message);
          row = second.data as { id?: string; name?: string } | null;
        }
      }

      if (!row?.id) gw(404, "Комната не создана.");

      const nameTrim = typeof row?.name === "string" ? row.name.trim() : FALLBACK;
      return { id: safeDentalScalarId(row.id, "room"), name: nameTrim.length ? nameTrim : FALLBACK };
    }

    case "doctorDmPeerMap": {
      const act = requireActor(actor);
      if (act.role !== "doctor") gw(403, "Зона врача.");
      const selfId = safeDentalScalarId(typeof payload.selfId === "string" ? payload.selfId : act.id);

      /** Самосогласование */
      await loadEmployee({ ...act, id: selfId }, gate);

      const { data, error } = await adm
        .from("doctor_rooms")
        .select("id, peer_low, peer_high")
        .eq("is_general", false)
        .or(`peer_low.eq.${selfId},peer_high.eq.${selfId}`);
      if (error) gw(500, error.message);

      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        const rec = row as { id?: string; peer_low?: string | null; peer_high?: string | null };
        const id = typeof rec?.id === "string" ? rec.id : "";
        const low = rec.peer_low ?? "";
        const high = rec.peer_high ?? "";
        if (!id || !low || !high) continue;

        const peer = low === selfId ? high : high === selfId ? low : "";
        if (!peer.trim() || peer === selfId || !SAFE_IDENT.test(peer)) continue;
        map[peer] = id;
      }
      return { map };
    }

    case "doctorFindOrCreatePrivateRoom": {
      const act = requireActor(actor);
      if (act.role !== "doctor") gw(403, "Зона врача.");
      await loadEmployee(act, gate);
      const selfId = safeDentalScalarId(act.id);
      const peerId =
        typeof payload.peerId === "string" ? safeDentalScalarId(payload.peerId.trim()) : gw(400, "peerId");
      if (selfId === peerId) gw(400, "Некорректный собеседник.");

      const { low, high } = orderedDoctorPeerPair(selfId, peerId);

      const { data: existing, error: selErr } = await adm
        .from("doctor_rooms")
        .select("id")
        .eq("is_general", false)
        .eq("peer_low", low)
        .eq("peer_high", high)
        .maybeSingle();

      if (selErr) gw(500, selErr.message);
      const exId =
        typeof (existing as { id?: string } | null)?.id === "string" ? String((existing as { id: string }).id) : "";

      if (exId.trim()) return { roomId: exId.trim() };

      const inserted = await adm
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
        const { data: retry, error: retryErr } = await adm
          .from("doctor_rooms")
          .select("id")
          .eq("is_general", false)
          .eq("peer_low", low)
          .eq("peer_high", high)
          .maybeSingle();
        if (retryErr) gw(500, retryErr.message);
        const rid =
          typeof (retry as { id?: string } | null)?.id === "string"
            ? String((retry as { id: string }).id).trim()
            : "";
        if (rid) return { roomId: rid };
      }

      gw(500, inserted.error?.message ?? "Не удалось создать чат.");
    }

    case "doctorFetchRoomMessages": {
      const act = requireActor(actor);
      await loadEmployee(act, gate);

      const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
      const limitRaw =
        typeof payload.limit === "number"
          ? payload.limit
          : typeof payload.limit === "string"
            ? Number(payload.limit)
            : 80;
      const lim = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 80;

      await assertDoctorCanUseRoomOrThrow(adm, act.id, roomId);

      const { data, error } = await adm
        .from("doctor_messages")
        .select("id, room_id, sender_id, sender_name, body, created_at, metadata")
        .eq("room_id", safeDentalScalarId(roomId, "room"))
        .order("created_at", { ascending: false })
        .limit(lim);

      if (error) gw(500, error.message);

      const rows = (data ?? []) as Record<string, unknown>[];
      rows.sort((a, b) => {
        const ta = typeof a.created_at === "string" ? new Date(a.created_at).getTime() : 0;
        const tb = typeof b.created_at === "string" ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });

      return { rows };
    }

    case "doctorInsertRoomMessage": {
      const act = requireActor(actor);
      const empRow = await loadEmployee(act, gate);
      const empId = safeDentalScalarId(typeof empRow.id === "string" ? empRow.id : act.id);

      const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
      const senderId = typeof payload.senderId === "string" ? payload.senderId.trim() : "";
      const senderName = typeof payload.senderName === "string" ? payload.senderName.trim() : "Врач";
      const bodyText = typeof payload.body === "string" ? payload.body.trim() : "";
      const metadata = payload.metadata;

      if (!bodyText) gw(400, "Пустое сообщение.");
      await assertDoctorCanUseRoomOrThrow(adm, empId, roomId);

      const phoneDg = phoneDigitsNormalizedServer(String(empRow.phone ?? ""));
      const phoneOk = phoneDigitsNormalizedServer(senderId) === phoneDg;
      const idOk = senderId === empId;
      if (!(phoneOk || idOk)) gw(403, "Неверный sender_id.");

      const insertPayload: Record<string, unknown> = {
        room_id: safeDentalScalarId(roomId, "room"),
        sender_id: senderId,
        sender_name: senderName,
        body: bodyText,
      };
      if (metadata !== undefined && metadata !== null && typeof metadata === "object") {
        insertPayload.metadata = metadata;
      }

      const { data: created, error: insErr } = await adm
        .from("doctor_messages")
        .insert(insertPayload as never)
        .select("id, room_id, sender_id, sender_name, body, created_at, metadata")
        .single();

      if (insErr) gw(500, insErr.message);
      return { row: created };
    }

    case "doctorPollRooms": {
      const act = requireActor(actor);
      await loadEmployee(act, gate);
      const selfId = safeDentalScalarId(act.id);

      const filterIds = safeRoomIds(payload.roomIds);

      const discover: string[] = [];
      if (!filterIds.length) {
        const { data: gen, error: gErr } = await adm
          .from("doctor_rooms")
          .select("id")
          .eq("is_general", true)
          .limit(1)
          .maybeSingle();
        if (gErr) gw(500, gErr.message);
        const gid =
          typeof (gen as { id?: string } | null)?.id === "string" ? (gen as { id: string }).id.trim() : "";
        if (gid) discover.push(gid);

        const { data: dmRooms, error: dErr } = await adm
          .from("doctor_rooms")
          .select("id")
          .eq("is_general", false)
          .or(`peer_low.eq.${selfId},peer_high.eq.${selfId}`);
        if (dErr) gw(500, dErr.message);
        for (const r of dmRooms ?? []) {
          const rid = typeof (r as { id?: string }).id === "string" ? (r as { id: string }).id.trim() : "";
          if (rid) discover.push(rid);
        }
      }

      const uniq = [...new Set(filterIds.length ? filterIds : discover)];

      const lastByRoom: Record<string, { created_at: string | null; body: string | null }> = {};

      for (const rid of uniq.slice(0, 80)) {
        await assertDoctorCanUseRoomOrThrow(adm, selfId, rid);
        const { data: tip, error: mErr } = await adm
          .from("doctor_messages")
          .select("created_at, body")
          .eq("room_id", rid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (mErr && mErr.code !== "PGRST116") gw(500, mErr.message);

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

    case "updateClientFormulaTeethById": {
      await loadEmployee(requireActor(actor), gate);
      const clientId =
        typeof payload.clientId === "string"
          ? safeDentalScalarId(payload.clientId.trim(), "patient")
          : gw(400, "clientId");
      const teeth = payload.teeth;
      if (!Array.isArray(teeth)) gw(400, "formula");

      const jsonPayload = JSON.parse(JSON.stringify(teeth));
      const { error: uErr } = await adm
        .from("dental_clients")
        .update({ formula_teeth: jsonPayload } as never)
        .eq("id", clientId);
      const m = String(uErr?.message ?? "");
      if (uErr?.code === "42703" || m.includes("formula_teeth"))
        return { ok: true as const, schemaMissing: true as const };
      if (uErr) gw(500, uErr.message);
      return { ok: true as const };
    }

    case "updateClientInternalNotes": {
      await loadEmployee(requireActor(actor), gate);
      const clientId =
        typeof payload.clientId === "string"
          ? safeDentalScalarId(payload.clientId.trim(), "patient")
          : gw(400, "clientId");
      const internalNotes =
        typeof payload.internalNotes === "string"
          ? payload.internalNotes
          : typeof payload.notes === "string"
            ? payload.notes
            : "";

      const { error: uErr } = await adm
        .from("dental_clients")
        .update({ internal_notes: internalNotes } as never)
        .eq("id", clientId);

      const m = String(uErr?.message ?? "");
      if (uErr?.code === "42703" || m.includes("internal_notes"))
        return { ok: true as const, schemaMissing: true as const };

      if (uErr) gw(500, uErr.message);

      return { ok: true as const };
    }

    case "updateClientPersonalProfile": {
      const act = requireActor(actor);
      if (act.role !== "client") gw(403, "Только аккаунт пациента.");
      await loadClient(act, gate);

      const clientId =
        typeof payload.clientId === "string"
          ? safeDentalScalarId(payload.clientId.trim(), "patient")
          : gw(400, "clientId");
      if (clientId !== act.id) gw(403, "Несовпадение профиля.");

      const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
      const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
      const email = typeof payload.email === "string" ? payload.email.trim() : "";
      const phoneDigitsRaw = typeof payload.phoneDigits === "string" ? payload.phoneDigits : "";
      const phone = normalizePhone(phoneDigitsRaw);
      if (phone.length < 10) gw(400, "Телефон.");
      const name = `${firstName} ${lastName}`.trim();

      const { error: uErr } = await adm
        .from("dental_clients")
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          email: email || null,
          phone,
          name: name || null,
        } as never)
        .eq("id", clientId);

      if (uErr) gw(500, uErr.message);

      return { ok: true as const };
    }

    default:
      gw(404, `Неизвестная операция: ${op}`);
  }
}
