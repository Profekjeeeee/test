import type { ToothStatus } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { getTelegramUserId } from "@/lib/telegramWebApp";
import {
  normalizePhone,
  phoneDigitsSuffixPattern,
  ADMIN_LOGIN_DIGITS,
} from "@/lib/phone";

export { normalizePhone, phoneDigitsSuffixPattern } from "@/lib/phone";

export interface RegisteredUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type DentalRole = "client" | "doctor" | "admin";

export interface DentalEmployeeRecord {
  id: string;
  phone: string;
  role: "admin" | "doctor";
  fullName: string;
  specialization?: string;
  /** Supabase: telegram_id — заполняется из Mini App. */
  telegramId?: string | null;
}

export interface DentalClientRecord {
  id: string;
  phone: string;
  role: "client";
  firstName: string;
  lastName: string;
  email: string;
  formulaTeeth?: ToothStatus[];
  /** Заметки только для персонала (Supabase: internal_notes). */
  internalNotes?: string | null;
  /** Supabase: telegram_id — заполняется из Mini App. */
  telegramId?: string | null;
}

export interface DentalSession {
  id: string;
  role: DentalRole;
  fullName: string;
  phone: string;
  specialization?: string;
  /** ЛК пациента; для сотрудников поля могут отсутствовать. */
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** Полный объект сессии + профиля в одном ключе (источник правды после логина). */
export const USER_SESSION_STORAGE_KEY = "user_session";
export const DENTAL_SESSION_STORAGE_KEY = "dental_session";
/** JSON в LS: id, name, role, phone, опционально ФИО и email — бронирование и защитник роутов. */
export const DENTAL_USER_SESSION_STORAGE_KEY = "dental_user_session";
export const CURRENT_USER_STORAGE_KEY = "currentUserId";
/** После записи сессии в этой вкладке (StorageEvent здесь не приходит). */
export const DENTAL_SESSION_CHANGED_EVENT = "dental_session_changed";

/** Кэш списков для синхронных читателей (чат, календарь). Обновляется через refreshDentalCaches(). */
let clientsCache: DentalClientRecord[] = [];
let employeesCache: DentalEmployeeRecord[] = [];

function mapEmployeeRow(row: {
  id: string;
  phone: string;
  name: string;
  role: string;
  specialization: string | null;
  telegram_id?: string | null;
}): DentalEmployeeRecord {
  const tg = row.telegram_id;
  return {
    id: row.id,
    phone: row.phone,
    role: row.role as "admin" | "doctor",
    fullName: row.name,
    specialization: row.specialization ?? undefined,
    telegramId: tg != null && String(tg).trim() !== "" ? String(tg) : null,
  };
}

function mapClientRow(row: {
  id: string;
  phone: string;
  first_name?: string | null;
  last_name?: string | null;
  /** Новая схема Supabase: одно поле ФИО вместо first_name / last_name */
  name?: string | null;
  email?: string | null;
  formula_teeth?: unknown | null;
  internal_notes?: string | null;
  telegram_id?: string | null;
}): DentalClientRecord {
  const ft = row.formula_teeth;
  let firstName = row.first_name ?? "";
  let lastName = row.last_name ?? "";
  const singleName = row.name != null ? String(row.name).trim() : "";
  if (!firstName && !lastName && singleName) {
    const parts = singleName.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }
  const tg = row.telegram_id;
  return {
    id: row.id,
    phone: row.phone,
    role: "client",
    firstName,
    lastName,
    email: row.email ?? "",
    formulaTeeth: Array.isArray(ft) ? (ft as ToothStatus[]) : undefined,
    internalNotes: row.internal_notes ?? "",
    telegramId: tg != null && String(tg).trim() !== "" ? String(tg) : null,
  };
}

/** Строка похожа на UUID клиента Supabase (v4 и совместимые варианты). */
export function isDentalClientUuidKey(key: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key.trim());
}

/**
 * Пациент из кэша по id строки записи или по нормализованному телефону (без запроса к Supabase).
 */
export function resolveDentalClientFromCacheSync(key: string): DentalClientRecord | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  const cache = getDentalClients();
  const byId = cache.find((c) => c.id === trimmed);
  if (byId) return byId;
  const digits = normalizePhone(trimmed.replace(/\D/g, ""));
  if (digits.length >= 10 && digits.length <= 15) {
    return cache.find((c) => normalizePhone(c.phone) === digits) ?? null;
  }
  return null;
}

/**
 * Можно безопасно искать строку в dental_clients: телефон (цифры), UUID, уже известный id из кэша,
 * или непрозрачный текстовый id из БД (длиной 8–64 символа).
 */
export function isDentalPatientKeyQueryable(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (resolveDentalClientFromCacheSync(trimmed)) return true;
  const digits = normalizePhone(trimmed.replace(/\D/g, ""));
  if (digits.length >= 10 && digits.length <= 15) return true;
  if (isDentalClientUuidKey(trimmed)) return true;
  return /^[a-zA-Z0-9_-]{8,64}$/.test(trimmed);
}

/** Разрешить ключ карты из календаря (uuid или телефон из legacy client_id) в запись dental_clients. */
export async function resolveDentalClientByPatientKey(key: string): Promise<DentalClientRecord | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;

  const cached = resolveDentalClientFromCacheSync(trimmed);
  if (cached) return cached;

  const digits = normalizePhone(trimmed.replace(/\D/g, ""));
  if (digits.length >= 10 && digits.length <= 15) {
    return findClientByPhone(trimmed);
  }

  /** Только UUID-ключ: иначе `.eq('id', телефон/текст)` даёт invalid input syntax for type uuid при типе id = uuid. */
  if (!isDentalClientUuidKey(trimmed)) {
    return null;
  }

  const { data, error } = await supabase
    .from("dental_clients")
    .select("*")
    .eq("id", trimmed)
    .maybeSingle();
  if (error || !data) return null;
  return mapClientRow(data as Parameters<typeof mapClientRow>[0]);
}

async function supabaseSelectEmployeeByPhone(cleanPhone: string) {
  const pattern = phoneDigitsSuffixPattern(cleanPhone);
  return supabase
    .from("dental_employees")
    .select("*")
    .ilike("phone", pattern)
    .limit(1)
    .maybeSingle();
}

async function supabaseSelectClientByPhone(cleanPhone: string) {
  const pattern = phoneDigitsSuffixPattern(cleanPhone);
  return supabase
    .from("dental_clients")
    .select("*")
    .ilike("phone", pattern)
    .limit(1)
    .maybeSingle();
}

function formatPostgrestError(error: { message: string; code?: string; details?: string }): string {
  const code = error.code ?? "unknown";
  const details = error.details ? ` details=${error.details}` : "";
  return `${error.message} [code=${code}]${details}`;
}

/** Шаг A авторизации: сотрудник; supabaseError — только при сбое запроса (не при «нет строки»). */
export async function fetchEmployeeByPhoneForAuth(rawPhone: string): Promise<{
  cleanPhone: string;
  employee: DentalEmployeeRecord | null;
  supabaseError: string | null;
}> {
  const cleanPhone = normalizePhone(rawPhone);
  const { data, error } = await supabaseSelectEmployeeByPhone(cleanPhone);
  if (error) {
    return { cleanPhone, employee: null, supabaseError: formatPostgrestError(error) };
  }
  if (!data) {
    return { cleanPhone, employee: null, supabaseError: null };
  }
  return {
    cleanPhone,
    employee: mapEmployeeRow(data as Parameters<typeof mapEmployeeRow>[0]),
    supabaseError: null,
  };
}

/** Шаг B: клиент по уже нормализованному номеру. */
export async function fetchClientByPhoneForAuth(cleanPhone: string): Promise<{
  client: DentalClientRecord | null;
  supabaseError: string | null;
}> {
  const { data, error } = await supabaseSelectClientByPhone(cleanPhone);
  if (error) {
    return { client: null, supabaseError: formatPostgrestError(error) };
  }
  if (!data) {
    return { client: null, supabaseError: null };
  }
  return {
    client: mapClientRow(data as Parameters<typeof mapClientRow>[0]),
    supabaseError: null,
  };
}

/** Подтянуть клиентов и сотрудников в память (нужно перед UI, завязанным на getDentalClients). */
export async function refreshDentalCaches(): Promise<void> {
  const [clientsRes, empRes] = await Promise.all([
    supabase.from("dental_clients").select("*").order("created_at", { ascending: true }),
    supabase.from("dental_employees").select("*").order("name", { ascending: true }),
  ]);
  if (!clientsRes.error && clientsRes.data) {
    clientsCache = clientsRes.data.map((r) =>
      mapClientRow(r as Parameters<typeof mapClientRow>[0])
    );
  }
  if (!empRes.error && empRes.data) {
    employeesCache = empRes.data.map((r) =>
      mapEmployeeRow(r as Parameters<typeof mapEmployeeRow>[0])
    );
  }
}

export function getDentalClients(): DentalClientRecord[] {
  return clientsCache;
}

export function getDentalEmployees(): DentalEmployeeRecord[] {
  return employeesCache;
}

export async function findEmployeeByPhone(phone: string): Promise<DentalEmployeeRecord | null> {
  const n = normalizePhone(phone);
  const { data, error } = await supabaseSelectEmployeeByPhone(n);
  if (error || !data) return null;
  return mapEmployeeRow(data as Parameters<typeof mapEmployeeRow>[0]);
}

export async function findClientByPhone(phone: string): Promise<DentalClientRecord | null> {
  const n = normalizePhone(phone);
  const { data, error } = await supabaseSelectClientByPhone(n);
  if (error || !data) return null;
  return mapClientRow(data as Parameters<typeof mapClientRow>[0]);
}

/** Живой uuid строки dental_clients по ключу из календаря (uuid или телефон в legacy client_id). */
export async function requireDentalClientByPatientKey(patientKey: string): Promise<DentalClientRecord> {
  const trimmed = patientKey.trim();
  if (!trimmed || !isDentalPatientKeyQueryable(trimmed)) {
    throw new Error("Некорректный идентификатор пациента.");
  }
  const client = await resolveDentalClientByPatientKey(trimmed);
  if (!client) throw new Error("Клиент не найден в dental_clients.");
  return client;
}

export function getUserRegistry(): RegisteredUser[] {
  return getDentalClients().map((c) => ({
    id: c.id,
    phone: c.phone,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
  }));
}

export async function findUserByPhone(phone: string): Promise<RegisteredUser | null> {
  const c = await findClientByPhone(phone);
  if (!c) return null;
  return {
    id: c.id,
    phone: c.phone,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
  };
}

/** Регистрация пациента: в БД уходит только phone (цифры), name (ФИО), role — без лишних полей. */
export async function createUser(
  phone: string,
  profile: { firstName: string; lastName: string; email: string }
): Promise<RegisteredUser> {
  const cleanPhone = normalizePhone(phone);
  const fullName = `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim();

  const baseInsert: Record<string, unknown> = {
    phone: cleanPhone,
    name: fullName,
    role: "client",
    first_name: profile.firstName.trim(),
    last_name: profile.lastName.trim(),
    email: profile.email.trim(),
  };
  const tgId = getTelegramUserId();
  if (tgId) baseInsert.telegram_id = tgId;

  let { data, error } = await supabase.from("dental_clients").insert(baseInsert).select("*").single();

  if (error && tgId && isTelegramIdSchemaMissingError(error)) {
    delete baseInsert.telegram_id;
    ({ data, error } = await supabase.from("dental_clients").insert(baseInsert).select("*").single());
  }

  if (error) throw error;

  const mapped = mapClientRow(data as Parameters<typeof mapClientRow>[0]);
  clientsCache = [...clientsCache.filter((c) => c.id !== mapped.id), mapped];

  return {
    id: mapped.id,
    phone: mapped.phone,
    firstName: profile.firstName.trim(),
    lastName: profile.lastName.trim(),
    email: profile.email.trim(),
  };
}

export async function updateClientFormulaTeethByClientId(clientId: string, teeth: ToothStatus[]): Promise<void> {
  /** Явно сериализуем в JSON для jsonb (без ссылок/циклов). */
  const jsonPayload = JSON.parse(JSON.stringify(teeth)) as ToothStatus[];
  const { error } = await supabase
    .from("dental_clients")
    .update({ formula_teeth: jsonPayload })
    .eq("id", clientId);
  if (error) throw error;
  const idx = clientsCache.findIndex((c) => c.id === clientId);
  if (idx !== -1) {
    const next = [...clientsCache];
    next[idx] = { ...next[idx], formulaTeeth: teeth };
    clientsCache = next;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dentalClientsUpdated"));
  }
}

/** patientKey — uuid клиента или телефон / legacy ключ из appointments.client_id */
export async function updateClientFormulaTeeth(patientKey: string, teeth: ToothStatus[]): Promise<void> {
  const client = await requireDentalClientByPatientKey(patientKey);
  await updateClientFormulaTeethByClientId(client.id, teeth);
}

export type ClientInternalNotesFetch = {
  notes: string;
  /** Колонки ещё нет в проекте Supabase — нужна миграция 005. */
  schemaMissing: boolean;
  /** Ключ некорректен или пациент не найден — строку notes не загружали из БД по клиенту */
  clientFound: boolean;
};

/** Колонка ещё не добавлена в Supabase — см. миграцию `005_dental_clients_internal_notes.sql`. */
export function isInternalNotesSchemaMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "42703") return true;
  const m = typeof e.message === "string" ? e.message : "";
  return m.includes("internal_notes") && m.includes("does not exist");
}

/** PostgREST: колонка `formula_teeth` отсутствует в `dental_clients` — см. `006_dental_clients_formula_teeth.sql`. */
export function isFormulaTeethSchemaMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string };
  if (e.code === "PGRST204") return true;
  const m = `${typeof e.message === "string" ? e.message : ""} ${typeof e.details === "string" ? e.details : ""}`;
  return (
    m.includes("formula_teeth") &&
    (m.includes("Could not find") || m.includes("column") || m.includes("schema cache"))
  );
}

/** Колонка `telegram_id` ещё не в Supabase — миграция `007_dental_telegram_id.sql`. */
export function isTelegramIdSchemaMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string };
  if (e.code === "42703") return true;
  if (e.code === "PGRST204") return true;
  const m = `${typeof e.message === "string" ? e.message : ""} ${typeof e.details === "string" ? e.details : ""}`;
  return (
    m.includes("telegram_id") &&
    (m.includes("Could not find") || m.includes("column") || m.includes("does not exist") || m.includes("schema cache"))
  );
}

/**
 * Полная строка `dental_clients` строго по id (UUID или legacy-ключ, приведённый к id через resolve).
 * Используй для ЛК врача: один запрос вместо «ключ в .eq('id', …)» с телефоном.
 */
export async function fetchDentalClientById(patientKey: string): Promise<{
  client: DentalClientRecord | null;
  internalNotesSchemaMissing: boolean;
}> {
  const trimmed = patientKey.trim();
  if (!trimmed) return { client: null, internalNotesSchemaMissing: false };

  let idForQuery: string | null = null;
  if (isDentalClientUuidKey(trimmed)) {
    idForQuery = trimmed;
  } else {
    const resolved = await resolveDentalClientByPatientKey(trimmed);
    if (!resolved) return { client: null, internalNotesSchemaMissing: false };
    idForQuery = resolved.id;
  }

  const { data, error } = await supabase
    .from("dental_clients")
    .select("*")
    .eq("id", idForQuery)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { client: null, internalNotesSchemaMissing: false };

  const raw = data as Record<string, unknown>;
  const schemaMissing = !Object.prototype.hasOwnProperty.call(raw, "internal_notes");
  return {
    client: mapClientRow(data as Parameters<typeof mapClientRow>[0]),
    internalNotesSchemaMissing: schemaMissing,
  };
}

export async function fetchClientInternalNotes(patientKey: string): Promise<ClientInternalNotesFetch> {
  const trimmed = patientKey.trim();
  if (!trimmed || !isDentalPatientKeyQueryable(trimmed)) {
    return { notes: "", schemaMissing: false, clientFound: false };
  }

  const { client, internalNotesSchemaMissing } = await fetchDentalClientById(trimmed);
  if (!client) {
    return { notes: "", schemaMissing: false, clientFound: false };
  }

  if (internalNotesSchemaMissing) {
    return { notes: "", schemaMissing: true, clientFound: true };
  }
  const notes = typeof client.internalNotes === "string" ? client.internalNotes : "";
  return { notes, schemaMissing: false, clientFound: true };
}

export async function updateClientInternalNotes(patientKey: string, internalNotes: string): Promise<void> {
  const client = await requireDentalClientByPatientKey(patientKey);
  const { error } = await supabase
    .from("dental_clients")
    .update({ internal_notes: internalNotes })
    .eq("id", client.id);
  if (error) throw error;
  const idx = clientsCache.findIndex((c) => c.id === client.id);
  if (idx !== -1) {
    const next = [...clientsCache];
    next[idx] = { ...next[idx], internalNotes };
    clientsCache = next;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dentalClientsUpdated"));
  }
}

/** Нормализует ФИО: fullName всегда непустой для UI. */
function normalizeDentalSession(session: DentalSession): DentalSession {
  const firstName = session.firstName?.trim() ?? "";
  const lastName = session.lastName?.trim() ?? "";
  const phoneTrimmed = typeof session.phone === "string" ? session.phone.trim() : "";
  const fromParts = `${firstName} ${lastName}`.trim();
  const fullName =
    session.fullName?.trim() ||
    fromParts ||
    phoneTrimmed ||
    "?";
  return {
    ...session,
    ...(phoneTrimmed ? { phone: phoneTrimmed } : {}),
    fullName,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(session.email != null && String(session.email).trim() !== ""
      ? { email: String(session.email).trim() }
      : {}),
  };
}

export function dentalSessionFromClient(c: DentalClientRecord): DentalSession {
  const firstName = c.firstName ?? "";
  const lastName = c.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || c.phone;
  return normalizeDentalSession({
    id: c.id,
    role: "client",
    fullName,
    phone: c.phone,
    firstName,
    lastName,
    email: (c.email ?? "").trim(),
  });
}

/** Обновляет данные пациента в Supabase и в памяти/LS сессии. */
export async function updateClientPersonalProfile(payload: {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneDigits: string;
}): Promise<void> {
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const email = payload.email.trim();
  const phone = normalizePhone(payload.phoneDigits);
  const name = `${firstName} ${lastName}`.trim();

  const { error } = await supabase
    .from("dental_clients")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
      phone,
      name: name || null,
    })
    .eq("id", payload.clientId);

  if (error) throw error;

  await refreshDentalCaches();

  const cur = typeof window !== "undefined" ? getDentalSession() : null;
  if (cur?.role === "client" && cur.id === payload.clientId) {
    const clientRow = getDentalClients().find((c) => c.id === payload.clientId);
    if (clientRow) {
      setDentalSession(dentalSessionFromClient(clientRow));
    }
  }

  await syncTelegramIdToSupabaseIfNeeded();
}

/**
 * Если в Mini App есть Telegram id и в строке пользователя `telegram_id` пустой — один UPDATE.
 * Вне Telegram / без id — no-op; при отсутствии колонки — тихий выход.
 */
export async function syncTelegramIdToSupabaseIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  const tgId = getTelegramUserId();
  if (!tgId) return;

  const session = getDentalSession();
  if (!session?.id) return;

  const table =
    session.role === "client" ? "dental_clients"
    : session.role === "doctor" || session.role === "admin" ? "dental_employees"
    : null;
  if (!table) return;

  const patch = { telegram_id: tgId };
  const { error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", session.id)
    .is("telegram_id", null);

  if (error) {
    if (isTelegramIdSchemaMissingError(error)) return;
    console.warn("[auth] syncTelegramIdToSupabaseIfNeeded:", error.message ?? error);
    return;
  }

  try {
    await refreshDentalCaches();
  } catch (e) {
    console.warn("[auth] refreshDentalCaches after telegram_id:", e);
  }
}

/**
 * Фоном подтянуть профиль из Supabase по телефону (после мгновенной гидратации из LS).
 */
export async function refreshDentalSessionFromSupabase(
  current: DentalSession | null
): Promise<DentalSession | null> {
  if (!current?.phone) return current;
  const cleanPhone = normalizePhone(current.phone);
  if (cleanPhone.length < 10) return current;

  try {
    if (current.role === "client") {
      const { client, supabaseError } = await fetchClientByPhoneForAuth(cleanPhone);
      if (supabaseError || !client || client.id !== current.id) return current;
      const next = dentalSessionFromClient(client);
      const same =
        next.fullName === current.fullName &&
        (next.phone || "") === (current.phone || "") &&
        (next.email || "") === (current.email ?? "") &&
        (next.firstName || "") === (current.firstName ?? "") &&
        (next.lastName || "") === (current.lastName ?? "");
      if (!same) setDentalSession(next);
      await syncTelegramIdToSupabaseIfNeeded();
      return next;
    }

    const { employee, supabaseError } = await fetchEmployeeByPhoneForAuth(cleanPhone);
    if (supabaseError || !employee || employee.id !== current.id) return current;
    const next: DentalSession = normalizeDentalSession({
      id: employee.id,
      role: employee.role,
      fullName: employee.fullName,
      phone: employee.phone,
      specialization: employee.specialization,
    });
    const same =
      next.fullName === current.fullName &&
      (next.phone || "") === (current.phone || "") &&
      next.specialization === current.specialization;
    if (!same) setDentalSession(next);
    await syncTelegramIdToSupabaseIfNeeded();
    return next;
  } catch (err) {
    console.warn("[auth] refreshDentalSessionFromSupabase:", err);
    return current;
  }
}

export function setDentalSession(session: DentalSession): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeDentalSession(session);
  try {
    const json = JSON.stringify(normalized);
    localStorage.setItem(USER_SESSION_STORAGE_KEY, json);
    localStorage.setItem(DENTAL_SESSION_STORAGE_KEY, json);
  } catch (err) {
    console.warn("[auth] session JSON:", err);
  }
  try {
    localStorage.setItem(
      DENTAL_USER_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: normalized.id,
        name: normalized.fullName,
        role: normalized.role,
        phone: normalized.phone,
        first_name: normalized.firstName ?? "",
        last_name: normalized.lastName ?? "",
        email: normalized.email ?? "",
      })
    );
  } catch (err) {
    console.warn("[auth] dental_user_session:", err);
  }
  localStorage.setItem("isLoggedIn", "true");
  if (normalized.role === "admin") {
    localStorage.setItem("isAdmin", "true");
  } else {
    localStorage.removeItem("isAdmin");
  }
  localStorage.setItem(CURRENT_USER_STORAGE_KEY, normalized.id);
  window.dispatchEvent(new CustomEvent(DENTAL_SESSION_CHANGED_EVENT));
}

/** Синхронно залогинить пациента по строке из `dental_clients` (без ожидания кэша). */
export function applyLoggedInClientFromSupabaseRow(row: Record<string, unknown>): void {
  const mapped = mapClientRow(row as Parameters<typeof mapClientRow>[0]);
  setDentalSession(dentalSessionFromClient(mapped));
}

export function getDentalSession(): DentalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const primary = localStorage.getItem(USER_SESSION_STORAGE_KEY);
    if (primary) {
      return normalizeDentalSession(JSON.parse(primary) as DentalSession);
    }
    const leg = localStorage.getItem(DENTAL_SESSION_STORAGE_KEY);
    const parsed = leg ? (JSON.parse(leg) as DentalSession) : null;
    return parsed ? normalizeDentalSession(parsed) : null;
  } catch {
    return null;
  }
}

export async function resolveHydratedSession(): Promise<DentalSession | null> {
  const existing = getDentalSession();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  const uid = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  if (!uid) return null;
  await refreshDentalCaches();
  const client = getDentalClients().find((c) => c.id === uid);
  if (!client) return null;
  const rebuilt = dentalSessionFromClient(client);
  setDentalSession(rebuilt);
  return rebuilt;
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_USER_STORAGE_KEY);
}

export async function setCurrentUser(id: string): Promise<void> {
  await refreshDentalCaches();
  const client = getDentalClients().find((c) => c.id === id);
  if (client) {
    setDentalSession(dentalSessionFromClient(client));
  } else {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, id);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.removeItem("isAdmin");
  }
}

export function logout(): void {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("isAdmin");
  localStorage.removeItem(USER_SESSION_STORAGE_KEY);
  localStorage.removeItem(DENTAL_SESSION_STORAGE_KEY);
  localStorage.removeItem(DENTAL_USER_SESSION_STORAGE_KEY);
}

export const ADMIN_PHONE = ADMIN_LOGIN_DIGITS;

export async function setAdminMode(): Promise<void> {
  const emp = await findEmployeeByPhone(ADMIN_PHONE);
  if (emp) {
    setDentalSession({
      id: emp.id,
      role: "admin",
      fullName: emp.fullName,
      phone: emp.phone,
    });
    return;
  }
  localStorage.setItem("isAdmin", "true");
  localStorage.setItem("isLoggedIn", "true");
}

export function isAdminMode(): boolean {
  return getDentalSession()?.role === "admin";
}

export function clearAdminMode(): void {
  logout();
}
