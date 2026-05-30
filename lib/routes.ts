/** Канонические пути приложения (ролевая модель). */
export const ROUTES = {
  auth: "/auth",
  registration: "/registration",
  bookingSuccess: "/booking/success",
  clientHome: "/screens/03_Main",
  adminDashboard: "/screens/admin/dashboard",
  adminAnalytics: "/screens/admin/analytics",
  adminFinance: "/screens/admin/finance",
  adminCrm: "/screens/admin/crm",
  adminLogs: "/screens/admin/logs",
  adminAudit: "/screens/admin/audit",
  adminSettings: "/screens/admin/settings",
  adminMessages: "/screens/admin/messages",
  platformDashboard: "/screens/platform/dashboard",
  platformClinics: "/screens/platform/clinics",
  platformOnboarding: "/screens/platform/onboarding",
  platformMonitoring: "/screens/platform/monitoring",
  doctorCabinet: "/screens/doctor/cabinet",
  doctorMessages: "/screens/doctor/messages",
  patientSupportChat: "/screens/support-chat",
} as const;

export const SHARED_ROUTE_PREFIXES = ["/consultation"] as const;

/** Префиксы зоны пациента — доступ только при session.role === "client". */
export const PATIENT_ROUTE_PREFIXES = [
  ROUTES.clientHome,
  ROUTES.patientSupportChat,
  "/formula",
  "/tooth",
  "/appointments",
  "/booking",
  "/bills",
  "/profile",
  "/prevention",
  "/contacts",
  "/doctors",
  "/price-list",
  "/treatment-plan",
  "/treatment-history",
  "/documents",
  "/cabinet",
] as const;

export const ADMIN_ROUTE_PREFIX = "/screens/admin";
export const PLATFORM_ROUTE_PREFIX = "/screens/platform";
export const DOCTOR_ROUTE_PREFIX = "/screens/doctor";

export const PUBLIC_ROUTE_PREFIXES = [ROUTES.auth, ROUTES.registration] as const;
