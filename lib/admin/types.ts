export interface AdminDoctor {
  id: string;
  created_at: string;
  name: string;
  specialization: string;
  photo_url: string;
  is_active: boolean;
  sort_order: number;
}

export interface AdminService {
  id: string;
  name: string;
  price: number;
  category: string;
  is_visible: boolean;
}

export interface AdminServiceCreatePayload {
  name: string;
  price: number;
  category: string;
  is_visible?: boolean;
}

export interface AdminDoctorEditPayload {
  name?: string;
  specialization?: string;
  photo_url?: string;
  sort_order?: number;
}

export interface DashboardStats {
  revenueMonth: number;
  newAppointmentsMonth: number;
  unprocessedCount: number;
  appointmentsToday: number;
  activeDoctors: number;
  totalDoctors: number;
  /** Дебиторская задолженность (неоплаченные счета). */
  pendingDebt: number;
  /** Оплат за текущий месяц. */
  paymentsMonth: number;
}

export interface FinanceStats {
  revenueMonth: number;
  revenuePrevMonth: number;
  pendingDebt: number;
  overdueDebt: number;
  paymentsCountMonth: number;
  billsPaidMonth: number;
  billsPendingCount: number;
  avgPaymentAmount: number;
}

export interface AdminBillRow {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  issuedAt: string;
  dueDate?: string;
  description: string;
}

export interface AdminPaymentRow {
  id: string;
  billId: string;
  billNumber: string;
  patientName: string;
  amount: number;
  method: string;
  status: string;
  provider: string;
  completedAt?: string;
  createdAt: string;
}

export interface FinanceChartPoint {
  day: string;
  label: string;
  revenue: number;
  payments: number;
}

export interface DashboardChartPoint {
  day: string;
  label: string;
  revenue: number;
  appointments: number;
}

export interface DashboardAppointmentRow {
  id: string;
  time: string;
  patient: string;
  doctor: string;
  procedure: string;
  status: string;
}

export type PatientSegmentKey =
  | "new"
  | "active"
  | "at_risk"
  | "dormant"
  | "high_value"
  | "debtor";

export interface CrmSegmentStat {
  segment: PatientSegmentKey;
  label: string;
  count: number;
}

export interface CrmPatientRow {
  patientId: string;
  name: string;
  phone: string;
  segment: PatientSegmentKey;
  totalVisits: number;
  daysSinceVisit: number | null;
  totalPaid: number;
  overdueDebt: number;
  hasTelegram: boolean;
  lastVisitDate?: string;
}

export interface MarketingCampaignRow {
  id: string;
  name: string;
  segmentKey: PatientSegmentKey | null;
  messageTemplate: string;
  triggerType: "manual" | "reactivation_auto";
  minDaysSinceVisit: number | null;
  maxSendsPerRun: number;
  status: "draft" | "active" | "paused" | "completed";
  lastRunAt?: string;
  createdAt: string;
}

export interface CampaignDeliveryRow {
  id: string;
  campaignId: string;
  patientName: string;
  status: string;
  sentAt?: string;
  errorMessage?: string;
}

export interface DoctorKpiRow {
  doctorKey: string;
  doctorId?: string;
  doctorName: string;
  specialization: string;
  appointmentsMonth: number;
  appointmentsTotal: number;
  completedMonth: number;
  cancelledMonth: number;
  uniquePatientsMonth: number;
  revenueMonth: number;
  revenueTotal: number;
  completionRate: number;
}

export interface PatientAnalyticsSummary {
  totalPatients: number;
  newPatientsMonth: number;
  avgVisits: number;
  avgLtv: number;
  atRiskCount: number;
  dormantCount: number;
  highValueCount: number;
  withTelegram: number;
}

export interface AnalyticsOverview {
  totalPatients: number;
  newPatientsMonth: number;
  avgCompletionRate: number;
  topDoctorName: string;
  topDoctorRevenueMonth: number;
  atRiskCount: number;
  revenueMonth: number;
}
