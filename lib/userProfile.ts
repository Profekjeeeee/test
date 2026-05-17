import { getCurrentUserId, getDentalSession, normalizePhone, setDentalSession } from "@/lib/auth";

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface UserNotifications {
  push: boolean;
  sms: boolean;
}

const BASE_PROFILE_KEY = "userProfile";
const BASE_NOTIF_KEY = "userNotifications";

const EMPTY_PROFILE: UserProfile = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
};

const DEFAULT_NOTIFS: UserNotifications = {
  push: true,
  sms: false,
};

/** Маска как на экране профиля: +7 (XXX) XXX-XX-XX */
function phoneDisplayDigits(digitsRaw: string): string {
  let digits = normalizePhone(digitsRaw);
  if (digits.length > 0 && !digits.startsWith("7")) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const d = digits.slice(1);
  let result = "+7";
  if (d.length >= 1) result += ` (${d.slice(0, 3)}`;
  if (d.length >= 4) result += `) ${d.slice(3, 6)}`;
  if (d.length >= 7) result += `-${d.slice(6, 8)}`;
  if (d.length >= 9) result += `-${d.slice(8, 10)}`;
  return result;
}

function profileKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_PROFILE_KEY}_${uid}` : BASE_PROFILE_KEY;
}

function notifKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_NOTIF_KEY}_${uid}` : BASE_NOTIF_KEY;
}

export function getProfile(): UserProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;

  let legacy: UserProfile = { ...EMPTY_PROFILE };
  try {
    const raw = localStorage.getItem(profileKey());
    if (raw) legacy = { ...EMPTY_PROFILE, ...JSON.parse(raw) };
  } catch {}

  const sess = getDentalSession();

  /** Источник правды после лога — ключ `user_session` + объект сессии. */
  if (sess?.role === "client") {
    const fromDigits =
      sess.phone?.trim() ?
        normalizePhone(sess.phone)
      : normalizePhone(legacy.phone);
    const ph =
      fromDigits.length >= 10 ?
        phoneDisplayDigits(fromDigits)
      : legacy.phone || "";
    return {
      firstName: (sess.firstName ?? "").trim() || legacy.firstName.trim(),
      lastName: (sess.lastName ?? "").trim() || legacy.lastName.trim(),
      email: (sess.email ?? "").trim() || legacy.email.trim(),
      phone: ph || phoneDisplayDigits(fromDigits || legacy.phone || ""),
    };
  }

  return { ...EMPTY_PROFILE, ...legacy };
}

/** Сохраняет профиль формы и зеркало в единый `user_session` для активного пациента. */
export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(profileKey(), JSON.stringify(profile));

  const uid = getCurrentUserId();
  const sess = getDentalSession();
  const digits = normalizePhone(profile.phone);

  if (sess?.role === "client" && uid && sess.id === uid && digits.length >= 10) {
    const fullName =
      `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim() ||
      sess.fullName ||
      digits;

    setDentalSession({
      ...sess,
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: profile.email.trim(),
      phone: digits,
      fullName,
    });
  }

  window.dispatchEvent(new CustomEvent("profileUpdated", { detail: profile }));
}

export function getNotifications(): UserNotifications {
  if (typeof window === "undefined") return DEFAULT_NOTIFS;
  try {
    const raw = localStorage.getItem(notifKey());
    if (raw) return { ...DEFAULT_NOTIFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_NOTIFS };
}

export function saveNotifications(notifs: UserNotifications): void {
  localStorage.setItem(notifKey(), JSON.stringify(notifs));
  window.dispatchEvent(new CustomEvent("notificationsUpdated", { detail: notifs }));
}
