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
