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
  | 'INVOICE';

export const HISTORY_FILTERS: Array<{ key: HistoryFilterKey; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'APPOINTMENT', label: 'Appointments' },
  { key: 'TASK', label: 'Tasks' },
  { key: 'FORM_SUBMISSION', label: 'SOAP / Forms' },
  { key: 'DOCUMENT', label: 'Documents' },
  { key: 'LAB_RESULT', label: 'Labs' },
  { key: 'INVOICE', label: 'Finance' },
];

export const HISTORY_FILTER_TYPE_MAP: Record<Exclude<HistoryFilterKey, 'ALL'>, HistoryEntryType> = {
  APPOINTMENT: 'APPOINTMENT',
  TASK: 'TASK',
  FORM_SUBMISSION: 'FORM_SUBMISSION',
  DOCUMENT: 'DOCUMENT',
  LAB_RESULT: 'LAB_RESULT',
  INVOICE: 'INVOICE',
};
