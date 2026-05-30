export type WorkingHoursRow = {
  day: string;
  hours: string;
};

export type BookingSlotsConfig = {
  startHour: number;
  endHour: number;
  stepMinutes: number;
};

export type ClinicBranding = {
  clinicId: string;
  slug: string;
  name: string;
  displayName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
};

export type ClinicContacts = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  metroHint: string;
  phone: string;
  whatsapp: string;
  email: string;
  mapEmbedUrl: string;
};

export type ClinicSchedule = {
  workingHours: WorkingHoursRow[];
  bookingSlots: BookingSlotsConfig;
  timezone: string;
  tzOffset: string;
};

export type ClinicTelegram = {
  botUsername: string;
  miniAppUrl: string;
};

export type ClinicPublicSettings = ClinicBranding &
  ClinicContacts &
  ClinicSchedule &
  ClinicTelegram & {
    locale: string;
  };
