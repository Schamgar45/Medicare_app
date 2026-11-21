import type { components } from './api-schema';

/** Response schemas generated from backend/schema.yaml. */
type ApiSchema<Name extends keyof components['schemas']> = components['schemas'][Name];
type ApiResponse<Name extends keyof components['schemas']> = Required<ApiSchema<Name>>;

export type Role = ApiSchema<'UserRoleEnum'>;
export type ThemeColor = ApiSchema<'ServiceThemeColorEnum'>;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type User = ApiResponse<'User'>;
export type Service = ApiResponse<'MedicalService'>;
export type ServiceBrief = ApiResponse<'ServiceBrief'>;
export type Specialty = ApiResponse<'Specialty'>;
export type Doctor = ApiResponse<'Doctor'>;
export type DoctorBrief = ApiResponse<'DoctorBrief'>;
export type Patient = ApiResponse<'Patient'>;
export type PatientBrief = ApiResponse<'PatientBrief'>;
export type Appointment = ApiResponse<'Appointment'>;
export type Consultation = ApiResponse<'Consultation'>;
export type PrescriptionItem = ApiResponse<'PrescriptionItem'>;
export type Prescription = ApiResponse<'Prescription'> & { items: PrescriptionItem[] };
export type Medication = ApiResponse<'Medication'>;
export type MedicationBatch = ApiResponse<'MedicationBatch'>;
export type StockMovement = ApiResponse<'StockMovement'>;
export type LabTest = ApiResponse<'LabTest'>;
export type LabRequest = ApiResponse<'LabRequest'>;
export type LabResult = ApiResponse<'LabResult'>;
export type BillingItem = ApiResponse<'BillingItem'>;
export type InvoiceItem = ApiResponse<'InvoiceItem'>;
export type Invoice = ApiResponse<'Invoice'> & { items: InvoiceItem[] };
export type Payment = ApiResponse<'Payment'>;
export type AppNotification = ApiResponse<'Notification'>;
export type MonthPoint = ApiResponse<'MonthPoint'>;
export type Dashboard = components['schemas']['Dashboard'];
