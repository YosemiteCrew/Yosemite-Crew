export type BusinessCategory =
  | 'hospital'
  | 'groomer'
  | 'breeder'
  | 'pet_center'
  | 'boarder';

export interface VetBusiness {
  id: string;
  name: string;
  category: BusinessCategory;
  address: string;
  distanceMi?: number;
  distanceMeters?: number;
  rating?: number;
  openHours?: string;
  photo?: any; // Image source
  specialties?: string[];
  website?: string;
  description?: string;
  phone?: string;
  email?: string;
  lat?: number;
  lng?: number;
  googlePlacesId?: string | null;
  appointmentCheckInBufferMinutes?: number;
  appointmentCheckInRadiusMeters?: number;
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

export interface VetService {
  id: string;
  businessId: string;
  specialty: string;
  specialityId?: string | null;
  name: string;
  description?: string;
  basePrice?: number;
  currency?: string;
  icon?: any; // Image source
  defaultEmployeeId?: string;
}

export interface SlotWindow {
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
  vetIds?: string[];
  startTimeUtc?: string;
  endTimeUtc?: string;
  startTimeLocal?: string;
  endTimeLocal?: string;
}

export interface EmployeeAvailability {
  businessId: string;
  employeeId?: string | null;
  serviceId?: string | null;
  label?: string;
  slotsByDate: Record<string, SlotWindow[]>;
}

export type AppointmentStatus =
  | 'NO_PAYMENT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'UPCOMING'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'SCHEDULED'
  | 'PAYMENT_FAILED'
  | 'REQUESTED';

export interface Appointment {
  id: string;
  companionId: string;
  businessId: string;
  serviceId?: string | null;
  serviceName?: string | null;
  serviceCode?: string | null;
  specialityId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeAvatar?: string | null;
  employeeTitle?: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endTime?: string | null;
  start?: string;
  end?: string | null;
  type: string;
  concern?: string;
  emergency?: boolean;
  uploadedFiles?: {
    id: string;
    name: string;
    key?: string;
    url?: string;
    type?: string | null;
  }[];
  status: AppointmentStatus;
  paymentStatus?: string | null;
  invoiceId?: string;
  paymentIntent?: PaymentIntentInfo | null;
  species?: string | null;
  breed?: string | null;
  organisationName?: string | null;
  organisationAddress?: string | null;
  businessLat?: number | null;
  businessLng?: number | null;
  businessPhoto?: string | null;
  businessGooglePlacesId?: string | null;
  appointmentCheckInBufferMinutes?: number;
  appointmentCheckInRadiusMeters?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  description: string;
  rate: number;
  qty?: number;
  lineTotal: number;
}

export interface PaymentIntentInfo {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  paymentLinkUrl?: string | null;
}

export type PaymentCollectionMethod =
  | 'PAYMENT_INTENT'
  | 'PAYMENT_LINK'
  | 'PAYMENT_AT_CLINIC'
  | (string & {});

export interface Invoice {
  id: string;
  appointmentId: string;
  items: InvoiceItem[];
  subtotal: number;
  totalPriceComponent?: Array<{
    type?: string;
    amount?: {value: number; currency?: string};
    code?: {text?: string};
    factor?: number | null;
  }>;
  discountPercent?: number | null;
  taxPercent?: number | null;
  total: number;
  currency?: string;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  billedToName?: string;
  billedToEmail?: string;
  image?: any; // invoice preview
  status?: string;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentLinkId?: string | null;
  paymentIntent?: PaymentIntentInfo | null;
  downloadUrl?: string | null;
  refundId?: string | null;
  refundAmount?: number | null;
  refundDate?: string | null;
  refundStatus?: string | null;
  refundReason?: string | null;
  refundReceiptUrl?: string | null;
  paymentCollectionMethod?: PaymentCollectionMethod;
  metadata?: Record<string, string | number | boolean>;
  paidAt?: string | null;
  stripeChargeId?: string | null;
  stripeReceiptUrl?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCheckoutUrl?: string | null;
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
  services: VetService[];
  availability: EmployeeAvailability[];
  loading: boolean;
  error: string | null;
}
