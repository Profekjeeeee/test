import { getCurrentUserId } from "@/lib/auth";

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
  try {
    const raw = localStorage.getItem(profileKey());
    if (raw) return { ...EMPTY_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return { ...EMPTY_PROFILE };
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(profileKey(), JSON.stringify(profile));
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
