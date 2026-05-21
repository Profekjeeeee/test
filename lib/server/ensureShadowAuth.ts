import "server-only";

import crypto from "crypto";

import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export async function ensureShadowAuthForRow(
  table: "dental_clients" | "dental_employees",
  pk: string,
): Promise<string> {
  const admin = getSupabaseServiceRole();
  const { data: cur, error: rErr } = await admin.from(table).select("id, auth_user_id").eq("id", pk).maybeSingle();
  if (rErr) throw new Error(rErr.message);
  const row = cur as { auth_user_id?: unknown } | null;
  if (!row) throw new Error(`Строка ${table} не найдена`);
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
    throw new Error("Конфликт auth.users для shadow-аккаунта.");
  }
  if (cErr || !uc?.user?.id) {
    throw new Error(cErr?.message ?? "Не удалось создать запись Supabase Auth.");
  }

  const uid = uc.user.id;
  const { error: updErr } = await admin.from(table).update({ auth_user_id: uid }).eq("id", pk);
  if (updErr) throw new Error(updErr.message);
  return uid;
}
