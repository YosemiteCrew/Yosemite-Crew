// Types for the Yosemite Crew Developer Data API v1 (read-only).
//
// List endpoints return the { data, pagination } envelope; single resources
// return { data }. Field lists mirror the v1 contract; timestamps are ISO
// 8601 strings.

export interface Pagination {
  /** Opaque cursor for the next page, or null on the last page. */
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface Page<T> {
  data: T[];
  pagination: Pagination;
}

export interface PageQuery {
  /** Items per page, 1-100 (default 50). */
  limit?: number;
  /** Cursor from pagination.nextCursor. Opaque - never parse it. */
  cursor?: string;
}

/**
 * Shape of the JSON snapshot columns on appointments (patient, lead,
 * appointmentType, room). These are denormalised at booking time, not
 * joined rows, so only treat id and name as best-effort hints and fetch
 * the real resource when you need authoritative data.
 */
export interface Snapshot {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export type AppointmentStatus =
  | 'REQUESTED'
  | 'UPCOMING'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface Appointment {
  id: string;
  organisationId: string;
  patient: Snapshot | null;
  lead: Snapshot | null;
  appointmentType: Snapshot | null;
  room: Snapshot | null;
  appointmentDate: string;
  startTime: string | null;
  endTime: string | null;
  timeSlot: string | null;
  durationMinutes: number | null;
  status: AppointmentStatus;
  isEmergency: boolean;
  concern: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /v1/developer/appointments/:id adds these to the list fields. */
export interface AppointmentDetail extends Appointment {
  supportStaff: unknown;
  attachments: unknown;
  formIds: unknown;
  caseId: string | null;
  encounterId: string | null;
  appointmentKind: string | null;
}

export interface AppointmentQuery extends PageQuery {
  status?: AppointmentStatus;
  /** ISO 8601 with offset; filters on appointmentDate. */
  dateFrom?: string;
  dateTo?: string;
}

export interface Patient {
  id: string;
  name: string;
  type: string | null;
  breed: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  photoUrl: string | null;
  status: string;
  isInsured: boolean | null;
  microchipNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /v1/developer/patients/:id adds these to the list fields. */
export interface PatientDetail extends Patient {
  speciesCode: string | null;
  breedCode: string | null;
  currentWeight: number | null;
  colour: string | null;
  allergy: string | null;
  isNeutered: boolean | null;
  passportNumber: string | null;
}

export interface PatientQuery extends PageQuery {
  status?: 'active' | 'archived' | 'inactive';
}

export interface Encounter {
  id: string;
  caseId: string | null;
  organisationId: string;
  patientId: string | null;
  parentId: string | null;
  status: string;
  encounterClass: string | null;
  appointmentKind: string | null;
  title: string | null;
  reason: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncounterQuery extends PageQuery {
  status?: string;
  patientId?: string;
  caseId?: string;
  /** ISO 8601 with offset; filters on periodStart. */
  dateFrom?: string;
  dateTo?: string;
}

export type InvoiceStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface Invoice {
  id: string;
  organisationId: string;
  patientId: string | null;
  parentId: string | null;
  appointmentId: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  visitBillingStage: string | null;
  paidAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /v1/developer/invoices/:id adds these to the list fields. */
export interface InvoiceDetail extends Invoice {
  items: unknown;
  invoiceDiscountType: string | null;
  invoiceDiscountValue: number | null;
  invoiceDiscountTotal: number | null;
  taxPercent: number | null;
  depositTargetAmount: number | null;
  depositCollectedAmount: number | null;
  paymentCollectionMethod: string | null;
  billingCollectionMode: string | null;
}

export interface InvoiceQuery extends PageQuery {
  status?: InvoiceStatus;
  patientId?: string;
  appointmentId?: string;
  /** ISO 8601 with offset; filters on createdAt. */
  dateFrom?: string;
  dateTo?: string;
}

export interface OrganizationAddress {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Organization {
  id: string;
  name: string;
  type: string | null;
  email: string | null;
  phoneNo: string | null;
  website: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  petNamePreference: string | null;
  averageRating: number | null;
  ratingCount: number | null;
  createdAt: string;
  updatedAt: string;
  address: OrganizationAddress | null;
}

export interface Usage {
  /** UTC billing month, e.g. "2026-07". */
  billingPeriod: string;
  callCount: number;
  /** null on pro/enterprise plans (no hard monthly cap). */
  limit: number | null;
}
