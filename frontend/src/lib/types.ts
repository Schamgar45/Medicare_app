export type Role = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'LABORANT' | 'PHARMACIST' | 'CASHIER';
export type ThemeColor = 'MARINE' | 'VERT';

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  gender?: string;
  role: Role;
  status: string;
  created_at?: string;
  is_superuser?: boolean;
  avatar?: string | null;
  password_changed_at?: string | null;
}
export interface Service {
  id: number;
  name: string;
  description?: string;
  price?: string;
  is_active: boolean;
  theme_color: ThemeColor;
}
export interface ServiceBrief {
  id: number;
  name: string;
  theme_color: ThemeColor;
}
export interface Specialty {
  id: number;
  name: string;
  description?: string;
}
export interface Doctor {
  id: number;
  user: number;
  name: string;
  email: string;
  phone: string;
  specialty: number | null;
  specialty_name: string | null;
  registration_number: string;
  service: number | null;
  service_detail: ServiceBrief | null;
  consultation_fee: string;
  is_available: boolean;
}
export interface DoctorBrief {
  id: number;
  name: string;
  registration_number: string;
  service_detail: ServiceBrief | null;
}
export interface Patient {
  id: number;
  patient_number: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string | null;
  phone: string;
  email: string;
  address: string;
  blood_group: string;
  allergies: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  status: string;
}
export interface PatientBrief {
  id: number;
  patient_number: string;
  first_name: string;
  last_name: string;
  gender?: string;
  date_of_birth?: string | null;
  phone?: string;
}
export interface Appointment {
  id: number;
  appointment_number: string;
  patient: number;
  patient_detail: PatientBrief;
  doctor: number;
  doctor_detail: DoctorBrief;
  service: number | null;
  service_detail: ServiceBrief | null;
  appointment_date: string;
  appointment_time: string;
  reason: string;
  status: string;
  notes: string;
}
export interface Consultation {
  id: number;
  consultation_number: string;
  patient: number;
  patient_detail: PatientBrief;
  doctor: number;
  doctor_detail: DoctorBrief;
  appointment: number | null;
  consultation_date: string;
  reason: string;
  symptoms: string;
  temperature: string | null;
  weight: string | null;
  height: string | null;
  blood_pressure: string;
  heart_rate: number | null;
  diagnosis: string;
  observations: string;
  treatment_plan: string;
  status: string;
}
export interface PrescriptionItem {
  id: number;
  prescription: number;
  medication: number;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  instructions: string;
  dispensed_quantity: number;
}
export interface Prescription {
  id: number;
  prescription_number: string;
  consultation: number;
  patient: number;
  patient_detail: PatientBrief;
  doctor: number;
  doctor_detail: DoctorBrief;
  prescription_date: string;
  instructions: string;
  status: string;
  items: PrescriptionItem[];
}
export interface Medication {
  id: number;
  name: string;
  generic_name: string;
  form: string;
  dosage: string;
  manufacturer: string;
  unit: string;
  minimum_stock: number;
  unit_price: string;
  is_active: boolean;
  current_stock: number;
  is_low_stock: boolean;
}
export interface MedicationBatch {
  id: number;
  medication: number;
  medication_name: string;
  batch_number: string;
  expiration_date: string;
  quantity: number;
  purchase_price: string;
}
export interface StockMovement {
  id: number;
  medication: number;
  medication_name: string;
  batch: number | null;
  movement_type: string;
  quantity: number;
  reason: string;
  reference: string;
  movement_date: string;
}
export interface LabTest {
  id: number;
  name: string;
  description: string;
  price: string;
  normal_range: string;
  is_active: boolean;
}
export interface LabRequest {
  id: number;
  request_number: string;
  consultation: number;
  patient: number;
  patient_detail: PatientBrief;
  doctor: number;
  doctor_name: string;
  lab_test: number;
  lab_test_detail: { id: number; name: string; normal_range: string };
  priority: string;
  clinical_information: string;
  status: string;
  requested_at: string;
  sample_collected_at: string | null;
  completed_at: string | null;
}
export interface LabResult {
  id: number;
  lab_request: number;
  request_detail: LabRequest;
  result: string;
  comment: string;
  validated_by: number | null;
  validated_by_name: string | null;
  result_date: string;
  validated_at: string | null;
}
export interface BillingItem {
  id: number;
  name: string;
  description: string;
  category: string;
  price: string;
  is_active: boolean;
}
export interface InvoiceItem {
  id: number;
  invoice: number;
  billing_item: number | null;
  medication: number | null;
  description: string;
  quantity: number;
  unit_price: string;
  total: string;
}
export interface Invoice {
  id: number;
  invoice_number: string;
  patient: number;
  patient_detail: PatientBrief;
  service: number | null;
  service_detail: ServiceBrief | null;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amount_paid: string;
  balance: string;
  status: string;
  invoice_date: string;
  items: InvoiceItem[];
}
export interface Payment {
  id: number;
  payment_number: string;
  invoice: number;
  invoice_number: string;
  invoice_total: string;
  invoice_balance: string;
  patient_detail: PatientBrief;
  service_detail: ServiceBrief | null;
  amount: string;
  payment_method: string;
  reference: string;
  status: string;
  payment_date: string;
  received_by_name: string | null;
  notes: string;
}
export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
export interface MonthPoint {
  month: string;
  value: number;
}
export interface Dashboard {
  generated_at: string;
  months: number;
  sections: string[];
  patients?: { total: number; new_this_month: number; per_month: MonthPoint[] };
  doctors?: { total: number; available: number };
  appointments?: { today: number; by_status: Record<string, number>; per_month: MonthPoint[] };
  consultations?: { total: number; today: number; per_month: MonthPoint[] };
  lab?: {
    pending_requests: number;
    by_status: Record<string, number>;
    requests_per_month: MonthPoint[];
  };
  billing?: {
    revenue_total: number;
    revenue_this_month: number;
    outstanding_balance: number;
    unpaid_invoices: number;
    revenue_per_month: MonthPoint[];
  };
  pharmacy?: {
    low_stock_count: number;
    expiring_soon_count: number;
    expired_count: number;
    consumed_per_month: MonthPoint[];
    top_consumed: { medication: string; quantity: number }[];
  };
}
