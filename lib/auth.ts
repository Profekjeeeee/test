import type { ToothStatus } from "@/types";

export interface RegisteredUser {
  id: string;
  phone: string; // digits only, e.g. "79991234567"
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
  /** Снимок формулы 32 зубов — источник правды для ЛК врача и синхронизация с ЛК пациента */
  formulaTeeth?: ToothStatus[];
}

export interface DentalSession {
  id: string;
  role: DentalRole;
  fullName: string;
  phone: string;
  specialization?: string;
}

const REGISTRY_KEY = "usersRegistry";
const DENTAL_CLIENTS_KEY = "dental_clients";
const DENTAL_EMPLOYEES_KEY = "dental_employees";
export const DENTAL_SESSION_STORAGE_KEY = "dental_session";
export const CURRENT_USER_STORAGE_KEY = "currentUserId";

const SEED_EMPLOYEES: DentalEmployeeRecord[] = [
  { id: "emp_admin", phone: "77777777777", role: "admin", fullName: "Системный Администратор" },
  {
    id: "emp_doc_1",
    phone: "79991112233",
    role: "doctor",
    fullName: "Михайлова А.В.",
    specialization: "Терапевт",
  },
  {
    id: "emp_doc_2",
    phone: "79994445566",
    role: "doctor",
    fullName: "Иванов П.С.",
    specialization: "Хирург",
  },
];

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith("7")) digits = "7" + digits;
  return digits;
}

/** Инициализация коллекции dental_employees моковыми данными при первом запуске. */
export function ensureDentalEmployeesInitialized(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(DENTAL_EMPLOYEES_KEY) === null) {
    localStorage.setItem(DENTAL_EMPLOYEES_KEY, JSON.stringify(SEED_EMPLOYEES));
  }
}

function ensureDentalClientsInitialized(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(DENTAL_CLIENTS_KEY) !== null) return;

  try {
    const legacyRaw = localStorage.getItem(REGISTRY_KEY);
    if (!legacyRaw) {
      localStorage.setItem(DENTAL_CLIENTS_KEY, JSON.stringify([]));
      return;
    }
    const legacy = JSON.parse(legacyRaw) as RegisteredUser[];
    const clients: DentalClientRecord[] = legacy.map((u) => ({
      id: u.id,
      phone: u.phone,
      role: "client",
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
    }));
    localStorage.setItem(DENTAL_CLIENTS_KEY, JSON.stringify(clients));
  } catch {
    localStorage.setItem(DENTAL_CLIENTS_KEY, JSON.stringify([]));
  }
}

function saveDentalClients(clients: DentalClientRecord[]): void {
  localStorage.setItem(DENTAL_CLIENTS_KEY, JSON.stringify(clients));
}

/** Обновляет поле formulaTeeth у клиента в dental_clients. */
export function updateClientFormulaTeeth(clientId: string, teeth: ToothStatus[]): void {
  if (typeof window === "undefined") return;
  ensureDentalClientsInitialized();
  const clients = getDentalClients();
  const idx = clients.findIndex((c) => c.id === clientId);
  if (idx === -1) return;
  const next = [...clients];
  next[idx] = { ...next[idx], formulaTeeth: teeth };
  saveDentalClients(next);
  window.dispatchEvent(new CustomEvent("dentalClientsUpdated"));
}

export function getDentalClients(): DentalClientRecord[] {
  if (typeof window === "undefined") return [];
  ensureDentalClientsInitialized();
  try {
    const raw = localStorage.getItem(DENTAL_CLIENTS_KEY);
    return raw ? (JSON.parse(raw) as DentalClientRecord[]) : [];
  } catch {
    return [];
  }
}

export function getDentalEmployees(): DentalEmployeeRecord[] {
  if (typeof window === "undefined") return [];
  ensureDentalEmployeesInitialized();
  try {
    const raw = localStorage.getItem(DENTAL_EMPLOYEES_KEY);
    return raw ? (JSON.parse(raw) as DentalEmployeeRecord[]) : [];
  } catch {
    return [];
  }
}

export function findEmployeeByPhone(phone: string): DentalEmployeeRecord | null {
  const n = normalizePhone(phone);
  return getDentalEmployees().find((e) => e.phone === n) ?? null;
}

export function findClientByPhone(phone: string): DentalClientRecord | null {
  const n = normalizePhone(phone);
  return getDentalClients().find((c) => c.phone === n) ?? null;
}

/** Совместимость: представление клиентов как прежний реестр пользователей. */
export function getUserRegistry(): RegisteredUser[] {
  return getDentalClients().map((c) => ({
    id: c.id,
    phone: c.phone,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
  }));
}

export function findUserByPhone(phone: string): RegisteredUser | null {
  const c = findClientByPhone(phone);
  if (!c) return null;
  return {
    id: c.id,
    phone: c.phone,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
  };
}

export function createUser(
  phone: string,
  profile: { firstName: string; lastName: string; email: string }
): RegisteredUser {
  ensureDentalClientsInitialized();
  const user: RegisteredUser = {
    id: `u_${Date.now()}`,
    phone: normalizePhone(phone),
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
  };
  const record: DentalClientRecord = { ...user, role: "client" };
  saveDentalClients([...getDentalClients(), record]);
  return user;
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

/** Починить сессию пациента, если есть currentUserId, но потерян JSON dental_session. */
export function resolveHydratedSession(): DentalSession | null {
  const existing = getDentalSession();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  const uid = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  if (!uid) return null;
  ensureDentalClientsInitialized();
  const client = getDentalClients().find((c) => c.id === uid);
  if (!client) return null;
  const rebuilt: DentalSession = {
    id: client.id,
    role: "client",
    fullName: `${client.firstName} ${client.lastName}`.trim() || client.phone,
    phone: client.phone,
  };
  localStorage.setItem(DENTAL_SESSION_STORAGE_KEY, JSON.stringify(rebuilt));
  return rebuilt;
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_USER_STORAGE_KEY);
}

export function setCurrentUser(id: string): void {
  ensureDentalClientsInitialized();
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

/** Устарело: вход только через SMS-поток и dental_employees. */
export function setAdminMode(): void {
  const emp = findEmployeeByPhone(ADMIN_PHONE);
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
