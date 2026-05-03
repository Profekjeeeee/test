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

const PROFILE_KEY = "userProfile";
const NOTIF_KEY = "userNotifications";

const DEFAULT_PROFILE: UserProfile = {
  firstName: "Александр",
  lastName: "Коновалов",
  phone: "+7 (999) 123-45-67",
  email: "konovalov@email.com",
};

const DEFAULT_NOTIFS: UserNotifications = {
  push: true,
  sms: false,
};

export function getProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PROFILE;
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent("profileUpdated", { detail: profile }));
}

export function getNotifications(): UserNotifications {
  if (typeof window === "undefined") return DEFAULT_NOTIFS;
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return { ...DEFAULT_NOTIFS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_NOTIFS;
}

export function saveNotifications(notifs: UserNotifications): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
  window.dispatchEvent(new CustomEvent("notificationsUpdated", { detail: notifs }));
}
