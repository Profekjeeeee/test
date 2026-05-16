import type { ToothStatus } from "@/types";
import { supabase } from "@/lib/supabaseClient";

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
}

export interface DentalClientRecord {
  id: string;
  phone: string;
  role: "client";
  firstName: string;
  lastName: string;
  email: string;
  formulaTeeth?: ToothStatus[];
}

export interface DentalSession {
  id: string;
  role: DentalRole;
  fullName: string;
  phone: string;
  specialization?: string;
}

export const DENTAL_SESSION_STORAGE_KEY = "dental_session";
export const CURRENT_USER_STORAGE_KEY = "currentUserId";

/** Кэш списков для синхронных читателей (чат, календарь). Обновляется через refreshDentalCaches(). */
let clientsCache: DentalClientRecord[] = [];
let employeesCache: DentalEmployeeRecord[] = [];

function mapEmployeeRow(row: {
  id: string;
  phone: string;
  name: string;
  role: string;
  specialization: string | null;
}): DentalEmployeeRecord {
  return {
    id: row.id,
    phone: row.phone,
    role: row.role as "admin" | "doctor",
    fullName: row.name,
    specialization: row.specialization ?? undefined,
  };
}

function mapClientRow(row: {
  id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  formula_teeth: unknown;
}): DentalClientRecord {
  const ft = row.formula_teeth;
  return {
    id: row.id,
    phone: row.phone,
    role: "client",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email ?? "",
    formulaTeeth: Array.isArray(ft) ? (ft as ToothStatus[]) : undefined,
  };
}

/** Только цифры; ведущая 8 заменяется на 7 (совпадение с полем phone в Supabase). */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  return digits;
}

/** Паттерн для `.ilike('phone', …)`: совпадение по последним 10 цифрам (формат в БД может отличаться). */
export function phoneDigitsSuffixPattern(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return `%${d.slice(-10)}`;
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

export async function createUser(
  phone: string,
  profile: { firstName: string; lastName: string; email: string }
): Promise<RegisteredUser> {
  const user: RegisteredUser = {
    id: `u_${Date.now()}`,
    phone: normalizePhone(phone),
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
  };
  const { error } = await supabase.from("dental_clients").insert({
    id: user.id,
    phone: user.phone,
    role: "client",
    first_name: user.firstName,
    last_name: user.lastName,
    email: user.email,
  });
  if (error) throw error;
  clientsCache = [
    ...clientsCache.filter((c) => c.id !== user.id),
    {
      id: user.id,
      phone: user.phone,
      role: "client",
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  ];
  return user;
}

export async function updateClientFormulaTeeth(clientId: string, teeth: ToothStatus[]): Promise<void> {
  const { error } = await supabase
    .from("dental_clients")
    .update({ formula_teeth: teeth })
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

export function setDentalSession(session: DentalSession): void {
  localStorage.setItem(DENTAL_SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem("isLoggedIn", "true");
  if (session.role === "admin") {
    localStorage.setItem("isAdmin", "true");
  } else {
    localStorage.removeItem("isAdmin");
  }
  localStorage.setItem(CURRENT_USER_STORAGE_KEY, session.id);
}

export function getDentalSession(): DentalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DENTAL_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DentalSession) : null;
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
  const rebuilt: DentalSession = {
    id: client.id,
    role: "client",
    fullName: `${client.firstName} ${client.lastName}`.trim() || client.phone,
    phone: client.phone,
  };
  setDentalSession(rebuilt);
  return rebuilt;
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_USER_STORAGE_KEY);
}

export async function setCurrentUser(id: string): Promise<void> {
  await refreshDentalCaches();
  localStorage.setItem(CURRENT_USER_STORAGE_KEY, id);
  localStorage.setItem("isLoggedIn", "true");
  localStorage.removeItem("isAdmin");
  const client = getDentalClients().find((c) => c.id === id);
  if (client) {
    setDentalSession({
      id: client.id,
      role: "client",
      fullName: `${client.firstName} ${client.lastName}`.trim(),
      phone: client.phone,
    });
  }
}

export function logout(): void {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("isAdmin");
  localStorage.removeItem(DENTAL_SESSION_STORAGE_KEY);
}

export const ADMIN_PHONE = "77777777777";

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
