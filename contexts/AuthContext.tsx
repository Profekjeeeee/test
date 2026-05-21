"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { PinScreen, verifyResultToUi } from "@/components/auth/PinScreen";
import {
  applyAuthSessionPayload,
  redirectForRole,
  type ClientAuthSessionPayload,
} from "@/lib/auth/applyAuthSession";
import {
  ensureProfileForAuthUser,
  fetchProfileHasPin,
  getAuthUserIdOrError,
  rpcSetUserPin,
  rpcVerifyUserPin,
} from "@/lib/auth/pinApi";
import { logout as clearDentalSession, getDentalSession } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { getTelegramInitData } from "@/lib/telegramWebApp";
import { normalizePhone } from "@/lib/phone";
import { ROUTES } from "@/lib/routes";

export type AuthStatus = "loading" | "anonymous" | "authenticated";
export type PinPhase = "none" | "create" | "verify";

type SignInResult = { error?: string; redirectTo?: string; needsRegistration?: boolean };

type AuthContextValue = {
  status: AuthStatus;
  pinPhase: PinPhase;
  pinUnlocked: boolean;
  authUserId: string | null;
  hasPin: boolean;
  pinError: string;
  pinLockedUntil: string | null;
  pinRemaining: number | undefined;
  pinBusy: boolean;
  signInWithTelegram: () => Promise<SignInResult>;
  signInEmployeeByPhone: (phone: string, role: "admin" | "doctor") => Promise<SignInResult>;
  /** @deprecated используйте signInEmployeeByPhone(phone, "admin") */
  signInAdminByPhone: (phone: string) => Promise<SignInResult>;
  completeRegistration: (payload: ClientAuthSessionPayload) => Promise<SignInResult>;
  submitCreatePin: (pin: string) => Promise<{ error?: string }>;
  submitVerifyPin: (pin: string) => Promise<{ error?: string }>;
  cancelPinFlow: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function postAuthJson(url: string, body: Record<string, unknown>): Promise<
  | { ok: true; session?: ClientAuthSessionPayload; needs_registration?: boolean }
  | { ok: false; error: string }
> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    ok?: boolean;
    session?: ClientAuthSessionPayload;
    needs_registration?: boolean;
    error?: string;
  };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  }
  return {
    ok: true,
    session: json.session,
    needs_registration: json.needs_registration,
  };
}

function PinOverlay({
  pendingRedirect,
  pinPhase,
}: {
  pendingRedirect: string | null;
  pinPhase: PinPhase;
}) {
  const auth = useAuth();
  const router = useRouter();

  if (pinPhase === "create") {
    return (
      <div className="fixed inset-0 z-[200] bg-surface dark:bg-app-canvas">
        <PinScreen
          mode="create"
          title="Создайте PIN"
          subtitle="4–6 цифр для защиты входа"
          loading={auth.pinBusy}
          errorMessage={auth.pinError}
          onCancel={auth.cancelPinFlow}
          onComplete={async (pin) => {
            const { error } = await auth.submitCreatePin(pin);
            if (!error && pendingRedirect) router.push(pendingRedirect);
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-surface dark:bg-app-canvas">
      <PinScreen
        mode="verify"
        title="Введите PIN"
        subtitle="Код доступа к кабинету"
        loading={auth.pinBusy}
        errorMessage={auth.pinError}
        lockedUntil={auth.pinLockedUntil}
        remainingAttempts={auth.pinRemaining}
        onCancel={auth.cancelPinFlow}
        onComplete={async (pin) => {
          const { error } = await auth.submitVerifyPin(pin);
          if (!error && pendingRedirect) router.push(pendingRedirect);
        }}
      />
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [pinPhase, setPinPhase] = useState<PinPhase>("none");
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [pinError, setPinError] = useState("");
  const [pinLockedUntil, setPinLockedUntil] = useState<string | null>(null);
  const [pinRemaining, setPinRemaining] = useState<number | undefined>(undefined);
  const [pinBusy, setPinBusy] = useState(false);

  const signOutInternal = useCallback(async () => {
    await supabase.auth.signOut();
    clearDentalSession();
    setStatus("anonymous");
    setPinPhase("none");
    setPinUnlocked(false);
    setAuthUserId(null);
    setPendingRedirect(null);
    setPinError("");
  }, []);

  const beginPinFlow = useCallback((userId: string, profileHasPin: boolean, redirect: string) => {
    setAuthUserId(userId);
    setHasPin(profileHasPin);
    setPendingRedirect(redirect);
    setPinUnlocked(false);
    setPinError("");
    setPinLockedUntil(null);
    setPinRemaining(undefined);
    setPinPhase(profileHasPin ? "verify" : "create");
    setStatus("authenticated");
  }, []);

  /** profiles.pin_hash IS NOT NULL → verify, иначе create. */
  const startPinGate = useCallback(
    async (userId: string, redirect: string): Promise<{ error?: string }> => {
      const profile = await ensureProfileForAuthUser();
      if (profile.error) return { error: profile.error };
      const profileHasPin = await fetchProfileHasPin(userId);
      beginPinFlow(userId, profileHasPin, redirect);
      return {};
    },
    [beginPinFlow],
  );

  const finishPinFlow = useCallback(() => {
    setPinUnlocked(true);
    setPinPhase("none");
    setPinError("");
    setPinLockedUntil(null);
    setPinRemaining(undefined);
  }, []);

  const afterSessionPayload = useCallback(
    async (session: ClientAuthSessionPayload): Promise<SignInResult> => {
      const applied = await applyAuthSessionPayload(session);
      if (applied.error) return { error: applied.error };

      const redirect = redirectForRole(session.role);
      const pin = await startPinGate(session.auth_user_id, redirect);
      if (pin.error) return { error: pin.error };
      return { redirectTo: ROUTES.auth };
    },
    [startPinGate],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      const dental = getDentalSession();

      if (!uid || !dental) {
        if (!cancelled) {
          setStatus("anonymous");
          setPinPhase("none");
          setPinUnlocked(false);
          setAuthUserId(null);
        }
        return;
      }

      try {
        const pin = await startPinGate(uid, redirectForRole(dental.role));
        if (pin.error && !cancelled) {
          setAuthUserId(uid);
          setStatus("authenticated");
          setPinUnlocked(false);
          setPendingRedirect(redirectForRole(dental.role));
          setPinError(pin.error);
        }
      } catch (e) {
        console.warn("[auth] pin session bootstrap:", e);
        if (!cancelled) {
          setAuthUserId(uid);
          setStatus("authenticated");
          setPinUnlocked(false);
          setPendingRedirect(redirectForRole(dental.role));
          setPinPhase("verify");
          setHasPin(true);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id && !getDentalSession()) {
        setAuthUserId(null);
        setPinUnlocked(false);
        setPinPhase("none");
        setStatus("anonymous");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [startPinGate]);

  const signInWithTelegram = useCallback(async (): Promise<SignInResult> => {
    const initData = getTelegramInitData();
    if (!initData) {
      return { error: "Откройте приложение из Telegram Mini App." };
    }
    const res = await postAuthJson("/api/auth/telegram", { initData });
    if (!res.ok) return { error: res.error };
    if (res.needs_registration) {
      return { needsRegistration: true, redirectTo: ROUTES.registration };
    }
    if (!res.session) return { error: "Пустой ответ сервера." };
    return afterSessionPayload(res.session);
  }, [afterSessionPayload]);

  const signInEmployeeByPhone = useCallback(
    async (phone: string, role: "admin" | "doctor"): Promise<SignInResult> => {
      const endpoint = role === "admin" ? "/api/auth/admin-phone" : "/api/auth/doctor-phone";
      const res = await postAuthJson(endpoint, { phone: normalizePhone(phone) });
      if (!res.ok) return { error: res.error };
      if (!res.session) return { error: "Пустой ответ сервера." };
      return afterSessionPayload(res.session);
    },
    [afterSessionPayload],
  );

  const signInAdminByPhone = useCallback(
    async (phone: string): Promise<SignInResult> => signInEmployeeByPhone(phone, "admin"),
    [signInEmployeeByPhone],
  );

  const completeRegistration = useCallback(
    async (session: ClientAuthSessionPayload): Promise<SignInResult> => {
      return afterSessionPayload({ ...session, has_pin: false });
    },
    [afterSessionPayload],
  );

  const submitCreatePin = useCallback(
    async (pin: string): Promise<{ error?: string }> => {
      const auth = await getAuthUserIdOrError();
      if ("error" in auth) return { error: auth.error };
      setPinBusy(true);
      setPinError("");
      try {
        const { error } = await rpcSetUserPin(pin);
        if (error) {
          setPinError(error);
          return { error };
        }
        setAuthUserId(auth.userId);
        setHasPin(true);
        finishPinFlow();
        return {};
      } finally {
        setPinBusy(false);
      }
    },
    [finishPinFlow],
  );

  const submitVerifyPin = useCallback(
    async (pin: string): Promise<{ error?: string }> => {
      const auth = await getAuthUserIdOrError();
      if ("error" in auth) return { error: auth.error };
      setPinBusy(true);
      setPinError("");
      try {
        const result = await rpcVerifyUserPin(pin);
        if (result.ok) {
          setAuthUserId(auth.userId);
          finishPinFlow();
          return {};
        }
        if (result.error === "no_pin") {
          setHasPin(false);
          setPinPhase("create");
          setPinError("");
          return {};
        }
        const ui = verifyResultToUi(result);
        setPinError(ui.message);
        setPinLockedUntil(ui.lockedUntil ?? null);
        setPinRemaining(ui.remaining);
        return { error: ui.message };
      } finally {
        setPinBusy(false);
      }
    },
    [finishPinFlow],
  );

  const cancelPinFlow = useCallback(() => {
    void signOutInternal();
  }, [signOutInternal]);

  const signOut = signOutInternal;

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      pinPhase,
      pinUnlocked,
      authUserId,
      hasPin,
      pinError,
      pinLockedUntil,
      pinRemaining,
      pinBusy,
      signInWithTelegram,
      signInEmployeeByPhone,
      signInAdminByPhone,
      completeRegistration,
      submitCreatePin,
      submitVerifyPin,
      cancelPinFlow,
      signOut,
    }),
    [
      status,
      pinPhase,
      pinUnlocked,
      authUserId,
      hasPin,
      pinError,
      pinLockedUntil,
      pinRemaining,
      pinBusy,
      signInWithTelegram,
      signInEmployeeByPhone,
      signInAdminByPhone,
      completeRegistration,
      submitCreatePin,
      submitVerifyPin,
      cancelPinFlow,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {pinPhase !== "none" && !pinUnlocked ? (
        <PinOverlay pendingRedirect={pendingRedirect} pinPhase={pinPhase} />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
