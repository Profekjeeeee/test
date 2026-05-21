import "server-only";

import { getSupabaseAnonServer } from "@/lib/server/supabaseAnon";
import { getSupabaseServiceRole } from "@/lib/supabase/serverAdmin";

export type IssuedSupabaseSession = {
  access_token: string;
  refresh_token: string;
  user_id: string;
};

/** Выдаёт JWT-сессию для auth.users без передачи пароля клиенту. */
export async function issueSupabaseSessionForUserId(userId: string): Promise<IssuedSupabaseSession> {
  const admin = getSupabaseServiceRole();
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user?.email) {
    throw new Error(userErr?.message ?? "Пользователь Auth не найден.");
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkErr || !linkData) {
    throw new Error(linkErr?.message ?? "Не удалось сгенерировать ссылку входа.");
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Нет hashed_token в ответе generateLink.");
  }

  const anon = getSupabaseAnonServer();
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (otpErr || !otpData.session) {
    throw new Error(otpErr?.message ?? "Не удалось подтвердить magic link.");
  }

  return {
    access_token: otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,
    user_id: userId,
  };
}
