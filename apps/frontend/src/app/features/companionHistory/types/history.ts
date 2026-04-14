export type HistoryEntryType =
  | 'APPOINTMENT'
  | 'TASK'
  | 'FORM_SUBMISSION'
  | 'DOCUMENT'
  | 'LAB_RESULT'
  | 'INVOICE';

export type HistoryEntry = {
  id: string;
  type: HistoryEntryType;
  occurredAt: string;
  status?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  actor?: {
    id?: string;
    name?: string;
    role?: 'VET' | 'STAFF' | 'PARENT' | 'SYSTEM';
  };
  tags?: string[];
  link: {
    kind: string;
    id: string;
    appointmentId?: string;
    companionId: string;
  };
  source: string;
  payload: Record<string, unknown>;
};

export type CompanionHistoryResponse = {
  entries: HistoryEntry[];
  nextCursor: string | null;
  summary: {
    totalReturned: number;
    countsByType: Record<string, number>;
  };
};

export type HistoryFilterKey =
  | 'ALL'
  | 'APPOINTMENT'
  | 'TASK'
  | 'FORM_SUBMISSION'
  | 'DOCUMENT'
  | 'LAB_RESULT'
  | 'INVOICE'
  | 'AUDIT_TRAIL';

export type HistoryFilterDefinition = { key: HistoryFilterKey; label: string };

const CLINICAL_ORG_TYPES = new Set(['HOSPITAL', 'CLINIC']);

export const getFormHistoryLabel = (orgType?: string | null): string => {
  const normalizedOrgType = String(orgType ?? '')
    .trim()
    .toUpperCase();
  return CLINICAL_ORG_TYPES.has(normalizedOrgType) ? 'SOAP / Templates' : 'Care plan / Templates';
};

export const getHistoryFilters = (orgType?: string | null): HistoryFilterDefinition[] => [
  { key: 'ALL', label: 'All' },
  { key: 'APPOINTMENT', label: 'Appointments' },
  { key: 'TASK', label: 'Tasks' },
  { key: 'FORM_SUBMISSION', label: getFormHistoryLabel(orgType) },
  { key: 'DOCUMENT', label: 'Documents' },
  { key: 'LAB_RESULT', label: 'Labs' },
  { key: 'INVOICE', label: 'Finance' },
  { key: 'AUDIT_TRAIL', label: 'Audit trail' },
];

export const HISTORY_FILTER_TYPE_MAP: Record<
  Exclude<HistoryFilterKey, 'ALL' | 'AUDIT_TRAIL'>,
  HistoryEntryType
> = {
  APPOINTMENT: 'APPOINTMENT',
  TASK: 'TASK',
  FORM_SUBMISSION: 'FORM_SUBMISSION',
  DOCUMENT: 'DOCUMENT',
  LAB_RESULT: 'LAB_RESULT',
  INVOICE: 'INVOICE',
};
