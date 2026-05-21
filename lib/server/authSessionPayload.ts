import "server-only";

export type AuthRole = "client" | "doctor" | "admin";

export type AuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  auth_user_id: string;
  role: AuthRole;
  dental_id: string;
  full_name: string;
  phone: string;
  specialization?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  has_pin: boolean;
  needs_registration?: boolean;
};

export function employeeRowToPayload(
  row: Record<string, unknown>,
  tokens: { access_token: string; refresh_token: string; user_id: string },
  hasPin: boolean,
): AuthSessionPayload {
  const role = row.role === "admin" ? "admin" : "doctor";
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    auth_user_id: tokens.user_id,
    role,
    dental_id: String(row.id),
    full_name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    specialization:
      row.specialization === null || row.specialization === undefined
        ? undefined
        : String(row.specialization),
    has_pin: hasPin,
  };
}

export function clientRowToPayload(
  row: Record<string, unknown>,
  tokens: { access_token: string; refresh_token: string; user_id: string },
  hasPin: boolean,
): AuthSessionPayload {
  const firstName = String(row.first_name ?? "").trim();
  const lastName = String(row.last_name ?? "").trim();
  const singleName = row.name != null ? String(row.name).trim() : "";
  let fn = firstName;
  let ln = lastName;
  if (!fn && !ln && singleName) {
    const parts = singleName.split(/\s+/).filter(Boolean);
    fn = parts[0] ?? "";
    ln = parts.slice(1).join(" ");
  }
  const fullName = `${fn} ${ln}`.trim() || String(row.phone ?? "");
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    auth_user_id: tokens.user_id,
    role: "client",
    dental_id: String(row.id),
    full_name: fullName,
    phone: String(row.phone ?? ""),
    first_name: fn || undefined,
    last_name: ln || undefined,
    email: row.email != null ? String(row.email) : undefined,
    has_pin: hasPin,
  };
}
