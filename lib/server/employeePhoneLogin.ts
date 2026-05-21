import "server-only";

import { ensureProfileRowExists, profileHasPinHash } from "@/lib/server/authProfilePin";
import { employeeRowToPayload, type AuthSessionPayload } from "@/lib/server/authSessionPayload";
import { ensureShadowAuthForRow } from "@/lib/server/ensureShadowAuth";
import { issueSupabaseSessionForUserId } from "@/lib/server/issueSupabaseSession";
import { isCompleteRuMobileDigits, normalizePhone, phoneDigitsSuffixPattern } from "@/lib/phone";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export type EmployeeAuthRole = "admin" | "doctor";

export class EmployeePhoneLoginError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EmployeePhoneLoginError";
    this.status = status;
  }
}

const ROLE_LABEL: Record<EmployeeAuthRole, string> = {
  admin: "Администратор",
  doctor: "Врач",
};

/** Поиск сотрудника по телефону, shadow Auth + JWT-сессия + PIN-флаг из profiles. */
export async function loginEmployeeByPhone(
  rawPhone: string,
  role: EmployeeAuthRole,
): Promise<AuthSessionPayload> {
  const cleanPhone = normalizePhone(rawPhone);
  if (!isCompleteRuMobileDigits(cleanPhone)) {
    throw new EmployeePhoneLoginError("Некорректный номер.", 400);
  }

  const pattern = phoneDigitsSuffixPattern(cleanPhone);
  const admin = getSupabaseServiceRole();

  const { data: emp, error } = await admin
    .from("dental_employees")
    .select("*")
    .ilike("phone", pattern)
    .eq("role", role)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new EmployeePhoneLoginError(error.message, 502);
  }
  if (!emp) {
    throw new EmployeePhoneLoginError(`${ROLE_LABEL[role]} с таким номером не найден.`, 404);
  }

  const authId = await ensureShadowAuthForRow("dental_employees", String(emp.id));
  await ensureProfileRowExists(authId);
  const tokens = await issueSupabaseSessionForUserId(authId);
  const hasPin = await profileHasPinHash(authId);

  return employeeRowToPayload(emp as Record<string, unknown>, tokens, hasPin);
}
