export type BusinessCategory = 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder';

export interface VetBusiness {
  id: string;
  name: string;
  category: BusinessCategory;
  address: string;
  distanceMi: number;
  rating: number;
  openHours?: string;
  photo?: any; // Image source
  specialties?: string[];
  website?: string;
  description?: string;
}

export interface VetEmployee {
  id: string;
  businessId: string;
  name: string;
  title: string;
  specialization: string;
  experienceYears?: number;
  consultationFee?: number;
  avatar?: any; // Image source
  rating?: number;
}

export interface AvailabilityMap {
  [dateISO: string]: string[]; // e.g., { '2025-08-20': ['10:00','11:30'] }
}

export interface EmployeeAvailability {
  businessId: string;
  employeeId: string;
  slotsByDate: AvailabilityMap;
}

export type AppointmentStatus =
  | 'requested'
  | 'approved'
  | 'paid'
  | 'checked_in'
  | 'completed'
  | 'canceled'
  | 'rescheduled';

export interface Appointment {
  id: string;
  companionId: string;
  businessId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: string;
  concern?: string;
  emergency?: boolean;
  uploadedFiles?: { id: string; name: string }[];
  status: AppointmentStatus;
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem { description: string; rate: number; qty?: number; lineTotal: number; }
export interface Invoice {
  id: string;
  appointmentId: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  billedToName?: string;
  billedToEmail?: string;
  image?: any; // invoice preview
}

export interface AppointmentsState {
  items: Appointment[];
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  hydratedCompanions: Record<string, boolean>;
}

export interface BusinessesState {
  businesses: VetBusiness[];
  employees: VetEmployee[];
  availability: EmployeeAvailability[];
  loading: boolean;
  error: string | null;
}
