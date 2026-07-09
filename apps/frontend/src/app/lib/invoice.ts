import { Appointment, Invoice } from '@yosemite-crew/types';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';

// UUIDs and Mongo ObjectIds are opaque; showing one verbatim as an invoice
// "number" reads as a bug. When we have to fall back to the id, derive a short,
// stable, upper-cased code from it instead (e.g. "#C93099").
const OPAQUE_ID_MIN_LENGTH = 24;

const deriveShortInvoiceCode = (id: string): string | null => {
  const compact = id.replace(/[^a-zA-Z0-9]/g, '');
  const isOpaque = compact.length >= OPAQUE_ID_MIN_LENGTH && /^[0-9a-f]+$/i.test(compact);
  return isOpaque ? compact.slice(-6).toUpperCase() : null;
};

/**
 * Human-facing invoice number for headers and list cells.
 * Uses a backend-provided invoice number from metadata when present. Otherwise
 * falls back to the invoice id — shortened to a compact code when the id is an
 * opaque UUID/ObjectId. Always prefixed with a single '#'.
 */
export const getInvoiceNumberLabel = (
  invoice?: Pick<Invoice, 'id' | 'metadata'> | null
): string => {
  if (!invoice) return '';
  const metadata = invoice.metadata ?? {};
  const explicit = String(metadata.invoiceNumber ?? metadata.number ?? '').trim();
  if (explicit) return explicit.startsWith('#') ? explicit : `#${explicit}`;
  const id = String(invoice.id ?? '').trim();
  if (!id) return '';
  return `#${deriveShortInvoiceCode(id) ?? id}`;
};

export const normalizeAppointmentId = (appointmentId: string | undefined): string | undefined => {
  const raw = String(appointmentId ?? '').trim();
  if (!raw) return undefined;

  // Accept values like "Appointment/123", full URLs, and plain IDs.
  const withoutQuery = raw.split(/[?#]/)[0];
  const tail = withoutQuery.split('/').findLast(Boolean);
  return tail?.trim() || undefined;
};

export const appointmentIdsMatch = (
  leftId: string | undefined,
  rightId: string | undefined
): boolean => {
  const left = normalizeAppointmentId(leftId);
  const right = normalizeAppointmentId(rightId);
  return Boolean(left && right && left === right);
};

export const getAppointmentByIdFromList = (
  appointments: Appointment[],
  appointmentId: string | undefined
): Appointment | undefined => {
  if (!appointmentId) return undefined;
  return appointments.find((a) => appointmentIdsMatch(a.id, appointmentId));
};

export const getCompanionNameFromAppointments = (
  appointments: Appointment[],
  appointmentId: string | undefined
): string => {
  const match = getAppointmentByIdFromList(appointments, appointmentId);
  return formatCompanionNameWithOwnerLastName(match?.companion?.name, match?.companion?.parent);
};

export const getParentNameFromAppointments = (
  appointments: Appointment[],
  appointmentId: string | undefined
): string => {
  const match = getAppointmentByIdFromList(appointments, appointmentId);
  return getOwnerFirstName(match?.companion?.parent) || '-';
};
