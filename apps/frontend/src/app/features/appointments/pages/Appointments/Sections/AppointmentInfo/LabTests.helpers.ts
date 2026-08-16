import { listIdexxOrders } from '@/app/features/integrations/services/idexxService';
import type {
  CensusEntry,
  IdexxTest,
  LabOrder,
  LabResult,
  LabResultTest,
} from '@/app/features/integrations/services/types';
import { toTitleCase } from './labTestsUtils';

export const getResultOrderId = (result: LabResult) => {
  const raw = result.rawPayload as
    { orderId?: string | number; requisitionId?: string | number } | undefined;
  return String(
    result.orderId ?? result.requisitionId ?? raw?.orderId ?? raw?.requisitionId ?? ''
  ).trim();
};

export const normalizeResultProgress = (status?: string | null) => {
  const key = String(status ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  if (key.includes('PARTIAL') || key.includes('INPROCESS') || key.includes('IN_PROCESS')) {
    return 'In process';
  }
  if (key.includes('PENDING') || key.includes('RUNNING')) return 'In process';
  if (key.includes('COMPLETE') || key.includes('FINAL')) return 'Complete';
  if (key.includes('ERROR') || key.includes('FAIL')) return 'Error';
  return '';
};

export const getOrderResultProgressFromResults = (
  allResults: LabResult[],
  orderId: string
): string => {
  const orderIdStr = String(orderId).trim();
  const statuses = new Set(
    allResults.flatMap((result) => {
      if (getResultOrderId(result) !== orderIdStr) return [];
      const raw = result.rawPayload;
      const status = normalizeResultProgress(
        result.statusDetail ?? result.status ?? raw?.statusDetail ?? raw?.status
      );
      return status ? [status] : [];
    })
  );
  if (statuses.has('In process')) return 'In process';
  if (statuses.has('Error')) return 'Error';
  if (statuses.has('Complete')) return 'Complete';
  return '';
};

export const orderSortDate = (order: LabOrder) => order.updatedAt ?? order.createdAt ?? '';

export const normalizeOrders = (orders: LabOrder[]): LabOrder[] =>
  orders.toSorted((a, b) => {
    const aDate = new Date(orderSortDate(a)).getTime();
    const bDate = new Date(orderSortDate(b)).getTime();
    return bDate - aDate;
  });

export const listIdexxOrdersWithFallback = async (
  organisationId: string,
  appointmentId: string,
  companionId?: string
): Promise<LabOrder[]> => {
  try {
    return await listIdexxOrders({ organisationId, appointmentId, companionId });
  } catch (error) {
    if (!companionId) throw error;
    return listIdexxOrders({ organisationId, companionId });
  }
};

export const resolveLatestOrder = (
  prev: LabOrder | null,
  normalizedOrders: LabOrder[]
): LabOrder => {
  if (!prev) return normalizedOrders[0];
  return normalizedOrders.find((order) => order._id === prev._id) ?? normalizedOrders[0];
};

export const mergeUniqueTests = (current: IdexxTest[], incoming: IdexxTest[]): IdexxTest[] => {
  const seen = new Set(current.map((item) => item.code || item._id));
  const next = [...current];
  incoming.forEach((item) => {
    const key = item.code || item._id;
    if (!seen.has(key)) {
      seen.add(key);
      next.push(item);
    }
  });
  return next;
};

export const formatCensusIvlsDevices = (entry: CensusEntry | null) => {
  const devices = entry?.ivls ?? [];
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

export const parseFloatSafe = (value?: string): number | null => {
  if (!value) return null;
  const normalized = String(value).replaceAll(',', '.');
  const allowedChars = '0123456789.+-';
  const cleaned = Array.from(normalized)
    .filter((char) => allowedChars.includes(char))
    .join('');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseReferenceRange = (range?: string): { min: number; max: number } | null => {
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
  const isOutOfRangeByValue = value < range.min || value > range.max;
  const percent = Math.min(100, Math.max(0, ((value - range.min) / (range.max - range.min)) * 100));
  const markerClass = test.outOfRange || isOutOfRangeByValue ? 'bg-red-500' : 'bg-text-primary';
  return { canRender: true, percent, markerClass };
};

export const getNormalizedLifecycleStatus = (order: LabOrder | null) =>
  String(order?.externalStatus ?? order?.status ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_');

export const formatOrderStatus = (order: LabOrder) => {
  const status = String(order.status ?? '').trim();
  const external = String(order.externalStatus ?? '').trim();
  if (external && external.toLowerCase() !== status.toLowerCase()) {
    return `${toTitleCase(status || '-')} (${toTitleCase(external)})`;
  }
  return toTitleCase(status || '-');
};

export const getOrderActionLabel = (order: LabOrder): string => {
  const statusKey = String(order.status ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_');
  if (statusKey === 'SUBMITTED') return 'Follow up';
  if (statusKey === 'CREATED' || !statusKey) return 'Continue';
  return 'Open IDEXX';
};

export const getOrderActionSource = (order: LabOrder): 'order' | 'followup' =>
  String(order.status ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_') === 'SUBMITTED'
    ? 'followup'
    : 'order';

export const shouldCloseOrderIframe = (args: {
  source: 'order' | 'followup';
  initialStatus: string | null;
  nextStatus: string;
  nextHasAcknowledgement: boolean;
  initialOrderId: string | null;
  newestKnownOrderId: string;
}) => {
  const {
    source,
    initialStatus,
    nextStatus,
    nextHasAcknowledgement,
    initialOrderId,
    newestKnownOrderId,
  } = args;
  const initialStatusKey = String(initialStatus ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_');
  const nextStatusKey = String(nextStatus ?? '')
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, '_');
  if (!nextStatusKey) return false;
  if (source === 'followup') {
    return (
      nextHasAcknowledgement &&
      Boolean(initialOrderId) &&
      Boolean(newestKnownOrderId) &&
      newestKnownOrderId !== initialOrderId
    );
  }
  const startedAsDraft =
    initialStatusKey === 'CREATED' ||
    initialStatusKey === 'IN_PROCESS' ||
    initialStatusKey === 'INPROCESS' ||
    initialStatusKey === 'PENDING' ||
    !initialStatusKey;
  return startedAsDraft && nextStatusKey === 'SUBMITTED' && nextHasAcknowledgement;
};
