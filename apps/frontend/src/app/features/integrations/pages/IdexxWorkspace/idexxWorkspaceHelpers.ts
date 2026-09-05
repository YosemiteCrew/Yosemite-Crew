/**
 * Pure lab-result, order and census helpers for the IDEXX workspace.
 *
 * Split out of index.tsx because a module that exports both React components and
 * plain values loses per-component Fast Refresh: an edit here would invalidate the
 * whole workspace module instead of hot-swapping one component
 * (react-doctor/only-export-components).
 */
import type { StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  CensusEntry,
  LabOrder,
  LabResult,
  LabResultTest,
} from '@/app/features/integrations/services/types';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';

export type ModalityFilter = 'ALL' | 'REFLAB' | 'INHOUSE';

export type CensusTone = 'green' | 'blue' | 'amber';

export const formatTitleCase = (value?: string | null, fallback = 'Unknown') => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const getInitials = (value?: string | null): string => {
  const parts = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

export const isResultComplete = (status?: string | null): boolean => {
  const key = String(status ?? '').toLowerCase();
  return key.includes('complete') || key.includes('final') || key.includes('confirm');
};

// There is no acknowledgement state yet — LabResult carries none, the lab-result
// API is read-only, and `labs:view:any` is the only labs permission. So "awaiting
// review" is derived purely from completion: every completed result stays in the
// queue. That over-reports rather than hiding a result, which is the safe side to
// fail on until a real, attributable acknowledgement is added (#1867). Do NOT
// fake it client-side: a localStorage or useState ack is per-browser and
// unaudited, so a result one vet "acknowledged" silently leaves their queue
// while a colleague still sees it.
export const resultAwaitingReview = (result: LabResult): boolean => isResultComplete(result.status);

export const getResultOwnerName = (result: LabResult): string =>
  [result.clientFirstName, result.clientLastName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');

export const formatCensusIvlsDevices = (entry: CensusEntry) => {
  const devices = entry.ivls ?? [];
  if (devices.length === 0) return '-';
  return devices
    .map((device) => {
      const serial = String(device.serialNumber ?? '').trim();
      const displayName = String(device.displayName ?? '').trim();
      if (displayName && serial) return `${displayName} (${serial})`;
      return displayName || serial || '-';
    })
    .join(', ');
};

export const getCensusDeviceSerial = (entry: CensusEntry): string => {
  const first = (entry.ivls ?? [])[0];
  return String(first?.serialNumber ?? '').trim();
};

export const buildCensusDeviceByPatientId = (entries: CensusEntry[]): Record<string, string> =>
  entries.reduce<Record<string, string>>((acc, entry) => {
    const patientId = String(entry.patient?.patientId ?? '').trim();
    const serial = getCensusDeviceSerial(entry);
    if (patientId && serial) acc[patientId] = serial;
    return acc;
  }, {});

export const getCensusCardStatus = (
  entry: CensusEntry,
  results: LabResult[]
): { label: string; tone: CensusTone; pulse: boolean } => {
  const patientId = String(entry.patient?.patientId ?? '').trim();
  const patientResults = results.filter(
    (result) => String(result.patientId ?? '').trim() === patientId
  );
  const complete = patientResults.filter((result) => isResultComplete(result.status)).length;
  const running = patientResults.length - complete;
  // In-progress runs keep the patient "blue" even when some panels are already
  // back; the card flips green only once every run has landed.
  if (running > 0) {
    const suffix = complete > 0 ? ` · ${complete} complete` : '';
    return { label: `${running} running${suffix}`, tone: 'blue', pulse: false };
  }
  if (complete > 0) return { label: 'Results ready · awaiting review', tone: 'green', pulse: true };
  return { label: 'Awaiting collection', tone: 'amber', pulse: false };
};

export const getResultStatusTone = (status?: string | null): StatusTone => {
  const key = String(status ?? '').toLowerCase();
  if (key.includes('complete') || key.includes('final')) return 'success';
  if (key.includes('error') || key.includes('fail') || key.includes('cancel')) return 'danger';
  if (
    key.includes('pending') ||
    key.includes('running') ||
    key.includes('partial') ||
    key.includes('inprocess')
  ) {
    return 'progress';
  }
  return 'neutral';
};

const parseFloatSafe = (value?: string): number | null => {
  if (!value) return null;
  const cleaned = String(value)
    .replaceAll(',', '.')
    .replaceAll(/[^0-9.+-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseReferenceRange = (range?: string): { min: number; max: number } | null => {
  if (!range) return null;
  const matches = range.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) return null;
  const min = Number.parseFloat(matches[0]);
  const max = Number.parseFloat(matches[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  return { min, max };
};

export const getMeterMeta = (test: LabResultTest) => {
  const range = parseReferenceRange(test.referenceRange);
  const value = parseFloatSafe(test.result);
  if (!range || value == null) {
    return { canRender: false, percent: 0, markerClass: 'bg-text-secondary' };
  }
  const rawPercent = ((value - range.min) / (range.max - range.min)) * 100;
  const percent = Math.min(100, Math.max(0, rawPercent));
  const markerClass =
    test.outOfRange || rawPercent < 0 || rawPercent > 100
      ? 'bg-[var(--danger)]'
      : 'bg-text-primary';
  return { canRender: true, percent, markerClass };
};

export const getOrderUiUrl = (order: LabOrder | null): string => {
  if (!order) return '';
  const nestedUrl = String(
    (order as unknown as { responsePayload?: { uiURL?: string } })?.responsePayload?.uiURL ?? ''
  ).trim();
  const raw = String(order.uiUrl ?? '').trim() || nestedUrl;
  return getSafeIdexxIframeUrl(raw);
};

export const getOrderPdfUrl = (order: LabOrder | null): string => {
  if (!order) return '';
  const nestedUrl = String(
    (order as unknown as { responsePayload?: { pdfURL?: string } })?.responsePayload?.pdfURL ?? ''
  ).trim();
  const raw = String(order.pdfUrl ?? '').trim() || nestedUrl;
  return getSafeIdexxIframeUrl(raw);
};

export const buildAppointmentIdByOrderId = (orders: LabOrder[]): Record<string, string> =>
  orders.reduce<Record<string, string>>((acc, order) => {
    const orderId = String(order.idexxOrderId ?? '').trim();
    const appointmentId = String(order.appointmentId ?? '').trim();
    if (orderId && appointmentId) acc[orderId] = appointmentId;
    return acc;
  }, {});

export const normalizeModality = (
  modality?: string | null
): Exclude<ModalityFilter, 'ALL'> | null => {
  const raw = String(modality ?? '')
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw === 'REFLAB' || raw === 'REFERENCE_LAB') return 'REFLAB';
  if (raw === 'INHOUSE' || raw === 'IN_HOUSE') return 'INHOUSE';
  return null;
};

export const matchesResultQuery = (result: LabResult, q: string): boolean =>
  String(result.resultId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.orderId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.accessionId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.patientName ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.patientId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.requisitionId ?? '')
    .toLowerCase()
    .includes(q) ||
  String(result.status ?? '')
    .toLowerCase()
    .includes(q);

export const getOrderExternalStatusSuffix = (order: LabOrder): string => {
  if (!order.externalStatus) return '';
  const externalStatus = String(order.externalStatus).trim().toLowerCase();
  const currentStatus = String(order.status ?? '')
    .trim()
    .toLowerCase();
  if (!externalStatus || externalStatus === currentStatus) return '';
  return ` (${formatTitleCase(order.externalStatus, '-')})`;
};
