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
  | 'APPOINTMENT'
  | 'TASK'
  | 'MEDICAL_RECORDS'
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
  { key: 'APPOINTMENT', label: 'Appointments' },
  { key: 'LAB_RESULT', label: 'Diagnostics' },
  { key: 'MEDICAL_RECORDS', label: getFormHistoryLabel(orgType) },
  { key: 'TASK', label: 'Tasks' },
  { key: 'INVOICE', label: 'Billing' },
  { key: 'AUDIT_TRAIL', label: 'Audit trail' },
];

export const HISTORY_FILTER_TYPE_MAP: Record<
  Exclude<HistoryFilterKey, 'MEDICAL_RECORDS' | 'AUDIT_TRAIL'>,
  HistoryEntryType[]
> = {
  APPOINTMENT: ['APPOINTMENT'],
  TASK: ['TASK'],
  LAB_RESULT: ['LAB_RESULT'],
  INVOICE: ['INVOICE'],
};
