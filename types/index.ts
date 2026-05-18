// ─── Appointment ─────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "rescheduled";

export interface Doctor {
  id: string;
  name: string;
  speciality: string;
  avatarUrl?: string;
}

export interface Appointment {
  id: string;
  doctorId: string;
  doctor: Doctor;
  service: string;
  date: string; // ISO 8601
  durationMin: number;
  status: AppointmentStatus;
  cabinetNumber?: string;
  notes?: string;
  canCancel: boolean;
  canReschedule: boolean;
}

// ─── Dental Formula ──────────────────────────────────────────────────────────

export type ToothCondition =
  | "healthy"
  | "treated"
  | "caries"
  | "pulpitis"
  | "removed"
  | "crown"
  | "implant"
  | "prosthesis";

export type ToothJaw = "upper" | "lower";
export type ToothSide = "left" | "right";

export interface ToothStatus {
  number: number; // 11-18, 21-28, 31-38, 41-48 (FDI notation)
  condition: ToothCondition;
  jaw: ToothJaw;
  side: ToothSide;
  hasNote: boolean;
  lastTreatmentDate?: string;
  notes?: string;
  materials?: string[];
}

export interface DentalFormula {
  patientId: string;
  teeth: ToothStatus[];
  updatedAt: string;
}

// ─── Treatment Plan ───────────────────────────────────────────────────────────

export type TreatmentItemStatus = "pending" | "in_progress" | "done";

export interface TreatmentItem {
  id: string;
  toothNumber?: number;
  service: string;
  price: number;
  status: TreatmentItemStatus;
  plannedDate?: string;
  completedDate?: string;
}

export interface TreatmentStage {
  id: string;
  title: string;
  items: TreatmentItem[];
}

export interface TreatmentPlan {
  id: string;
  patientId: string;
  stages: TreatmentStage[];
  totalPrice: number;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
}

/** Сообщение чата клиники: данные из Supabase `chat_messages`. */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "client" | "doctor" | "admin";
  senderName: string;
  /** `clinic` | `support` | UUID пациента | id врача (`dental_employees.id`) или legacy телефон врача */
  recipientId: string;
  text: string;
  timestamp: number;
  chatType: "support" | "clinic" | "doctor";
}

// ─── Bills ───────────────────────────────────────────────────────────────────

export type BillStatus = "pending" | "paid" | "partial" | "overdue";

export interface BillItem {
  id: string;
  service: string;
  quantity: number;
  unitPrice: number;
  total: number;
  toothNumber?: number;
  date: string;
}

export interface Bill {
  id: string;
  number: string; // e.g. "№ 2024-0042"
  patientId: string;
  appointmentId?: string;
  items: BillItem[];
  totalAmount: number;
  paidAmount: number;
  status: BillStatus;
  issuedAt: string;
  dueDate?: string;
  paidAt?: string;
  canPayOnline: boolean;
}

// ─── Patient / Profile ───────────────────────────────────────────────────────

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  birthDate?: string;
  email?: string;
  avatarUrl?: string;
  doctorId?: string;
  doctor?: Doctor;
  notificationsEnabled: boolean;
  smsEnabled: boolean;
}

// ─── Prevention ──────────────────────────────────────────────────────────────

export interface PreventionRecommendation {
  id: string;
  title: string;
  description: string;
  iconName: string;
  completed: boolean;
}

export interface PreventionStatus {
  lastVisitDate: string;
  nextVisitDate: string;
  daysUntilNextVisit: number;
  progressPercent: number;
  recommendations: PreventionRecommendation[];
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type BottomTabId = "home" | "appointments" | "formula" | "bills" | "more";

export interface BottomTab {
  id: BottomTabId;
  label: string;
  href: string;
  iconName: string;
}
