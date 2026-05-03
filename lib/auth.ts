export interface RegisteredUser {
  id: string;
  phone: string; // digits only, e.g. "79991234567"
  firstName: string;
  lastName: string;
  email: string;
}

const REGISTRY_KEY = "usersRegistry";
const CURRENT_USER_KEY = "currentUserId";

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith("7")) digits = "7" + digits;
  return digits;
}

export function getUserRegistry(): RegisteredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as RegisteredUser[]) : [];
  } catch {
    return [];
  }
}

function saveRegistry(users: RegisteredUser[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(users));
}

export function findUserByPhone(phone: string): RegisteredUser | null {
  const normalized = normalizePhone(phone);
  return getUserRegistry().find((u) => u.phone === normalized) ?? null;
}

export function createUser(
  phone: string,
  profile: { firstName: string; lastName: string; email: string }
): RegisteredUser {
  const user: RegisteredUser = {
    id: `u_${Date.now()}`,
    phone: normalizePhone(phone),
    ...profile,
  };
  saveRegistry([...getUserRegistry(), user]);
  return user;
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function setCurrentUser(id: string): void {
  localStorage.setItem(CURRENT_USER_KEY, id);
  localStorage.setItem("isLoggedIn", "true");
}

export function logout(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem("isLoggedIn");
}
