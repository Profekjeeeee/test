export type PlanLimits = {
  max_doctors?: number;
  max_patients?: number;
  ai_enabled?: boolean;
  video_enabled?: boolean;
  crm_enabled?: boolean;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  currency: string;
  limits: PlanLimits;
  features: string[];
  sortOrder: number;
};

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "suspended";

export type ClinicSubscription = {
  planId: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  priceMonthly: number;
  limits: PlanLimits;
};

export type OnboardingStatus = "draft" | "pending" | "completed";

export type PlatformClinicRow = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  onboardingStatus: OnboardingStatus;
  onboardedAt: string | null;
  createdAt: string;
  displayName: string;
  subscription: ClinicSubscription | null;
  stats: {
    patients: number;
    doctors: number;
    appointmentsMonth: number;
  };
};

export type PlatformStats = {
  totalClinics: number;
  activeClinics: number;
  trialClinics: number;
  mrrRub: number;
  appointments24h: number;
  errors24h: number;
  planBreakdown: { code: string; name: string; count: number }[];
};

export type CreateClinicInput = {
  slug: string;
  name: string;
  displayName: string;
  planCode: string;
  adminPhone: string;
  adminName: string;
  phone?: string;
  email?: string;
  city?: string;
  primaryColor?: string;
};

export type PlatformMonitoringRow = {
  clinicId: string;
  slug: string;
  displayName: string;
  isActive: boolean;
  planCode: string;
  errors24h: number;
  warnings24h: number;
  lastErrorAt: string | null;
};
