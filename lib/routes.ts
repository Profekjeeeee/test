/** Канонические пути приложения (ролевая модель). */
export const ROUTES = {
  auth: "/auth",
  registration: "/registration",
  bookingSuccess: "/booking/success",
  clientHome: "/screens/03_Main",
  adminDashboard: "/screens/admin/dashboard",
  adminMessages: "/screens/admin/messages",
  doctorCabinet: "/screens/doctor/cabinet",
  doctorMessages: "/screens/doctor/messages",
  patientSupportChat: "/screens/support-chat",
} as const;

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
] as const;

export const ADMIN_ROUTE_PREFIX = "/screens/admin";
export const DOCTOR_ROUTE_PREFIX = "/screens/doctor";

export const PUBLIC_ROUTE_PREFIXES = [ROUTES.auth, ROUTES.registration] as const;
