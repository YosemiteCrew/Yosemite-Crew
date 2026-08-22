import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  IoArrowForwardOutline,
  IoCheckmarkOutline,
  IoChevronDownOutline,
  IoClose,
  IoEyeOffOutline,
  IoEyeOutline,
  IoReloadOutline,
} from 'react-icons/io5';
import type { Appointment } from '@yosemite-crew/types';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import { useLoadAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { useLoadTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useTaskStore } from '@/app/stores/taskStore';
import { getIdexxResultPdfBlob } from '@/app/features/integrations/services/idexxService';
import { parseFloatSafe } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests.helpers';
import { useOrgStore } from '@/app/stores/orgStore';
import Fallback from '@/app/ui/overlays/Fallback';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { toTitle } from '@/app/lib/validators';
import { formatDateTimeLocal } from '@/app/lib/date';
import { getSafeSameOriginPath } from '@/app/lib/urls';
import { loadDocumentDownloadURL } from '@/app/features/companions/services/companionDocumentService';
import HistoryEmptyState from '@/app/features/companionHistory/components/HistoryEmptyState';
import HistoryDocumentUpload from '@/app/features/companionHistory/components/HistoryDocumentUpload';
import HistoryEntryCard from '@/app/features/companionHistory/components/HistoryEntryCard';
import HistoryRecordDrawer from '@/app/features/companionHistory/components/HistoryRecordDrawer';
import {
  CompanionHistoryResponse,
  HISTORY_FILTER_TYPE_MAP,
  HistoryEntry,
  HistoryEntryType,
  HistoryFilterKey,
  getHistoryFilters,
} from '@/app/features/companionHistory/types/history';
import { fetchCompanionHistory } from '@/app/features/companionHistory/services/companionHistoryService';
import { AuditTrail } from '@/app/features/audit/types/audit';
import { getCompanionAuditTrail } from '@/app/features/audit/services/auditService';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Search from '@/app/ui/inputs/Search';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { AppointmentLabels, TaskLabels, getStatusStyle } from '@/app/config/statusConfig';
import {
  canTransitionAppointmentStatus,
  getAllowedAppointmentStatusTransitions,
  getInvalidAppointmentStatusTransitionMessage,
  normalizeAppointmentStatus,
} from '@/app/lib/appointments';
import {
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  getInvalidTaskStatusTransitionMessage,
  normalizeTaskStatus,
} from '@/app/lib/tasks';
import { useNotify } from '@/app/hooks/useNotify';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import {
  getPayloadString,
  resolveHistoryDocumentId,
} from '@/app/features/companionHistory/utils/historyFormatters';
import '@/app/ui/tables/GenericTable/Generictable.css';

type CompanionHistoryTimelineProps = {
  companionId: string;
  activeAppointmentId?: string;
  showDocumentUpload?: boolean;
  onOpenAppointmentView?: (intent: AppointmentViewIntent) => void;
  compact?: boolean;
  fullPageHref?: string;
  /**
   * Presentation only. `'phone'` drops the desktop Search / Sort / Status header
   * row and the bordered card chrome so the timeline reads as the compact
   * bespoke phone-record History section (< 768px). The data flow, filters and
   * every handler are identical to the default layout.
   */
  variant?: 'default' | 'phone';
  /**
   * Phone action-bar hook: incrementing this switches the active filter to
   * Medical records (revealing the document uploader when `showDocumentUpload`
   * is set). Ignored on the default layout.
   */
  openMedicalRecordsSignal?: number;
};

type SortKey = 'newest' | 'oldest';
type StatusOverrides = Record<string, string>;
type PdfPreviewState = {
  title: string;
  url: string;
};

type DetailPair = {
  label: string;
  value: string;
  range?: string;
  abnormal?: boolean;
  direction?: string;
};

const DEFAULT_FILTER: HistoryFilterKey = 'ALL';
const COMPACT_MAX_ENTRIES = 8;
const MEDICAL_RECORD_TYPES = new Set<HistoryEntryType>(['FORM_SUBMISSION', 'DOCUMENT']);

const SORT_OPTIONS: Array<{ label: string; value: SortKey }> = [
  { label: 'Sort by newest', value: 'newest' },
  { label: 'Sort by oldest', value: 'oldest' },
];

const STATUS_FILTER_ALL = 'all';

// Per-section status filter options. Each option lists the normalized
// (UPPER_SNAKE) status tokens it should match, sourced from the real statuses
// each section emits (frontend AppointmentLabels/TaskLabels and the backend
// HistoryEntryStatus / InvoiceStatus unions).
type StatusFilterOption = { label: string; value: string; match: string[] };

const ALL_STATUS_OPTION: StatusFilterOption = {
  label: 'All statuses',
  value: STATUS_FILTER_ALL,
  match: [],
};

const APPOINTMENT_STATUS_FILTERS: StatusFilterOption[] = [
  { label: 'Requested', value: 'requested', match: ['REQUESTED'] },
  { label: 'Upcoming', value: 'upcoming', match: ['UPCOMING'] },
  { label: 'Checked in', value: 'checked_in', match: ['CHECKED_IN'] },
  { label: 'In progress', value: 'in_progress', match: ['IN_PROGRESS'] },
  { label: 'Completed', value: 'completed', match: ['COMPLETED'] },
  { label: 'Cancelled', value: 'cancelled', match: ['CANCELLED'] },
  { label: 'No show', value: 'no_show', match: ['NO_SHOW'] },
];

const TASK_STATUS_FILTERS: StatusFilterOption[] = [
  { label: 'Pending', value: 'pending', match: ['PENDING'] },
  { label: 'In progress', value: 'in_progress', match: ['IN_PROGRESS'] },
  { label: 'Completed', value: 'completed', match: ['COMPLETED'] },
  { label: 'Cancelled', value: 'cancelled', match: ['CANCELLED'] },
];

const LAB_STATUS_FILTERS: StatusFilterOption[] = [
  { label: 'Completed', value: 'completed', match: ['COMPLETED'] },
  { label: 'Pending', value: 'pending', match: ['PENDING'] },
];

const MEDICAL_RECORD_STATUS_FILTERS: StatusFilterOption[] = [
  { label: 'Signed', value: 'signed', match: ['SIGNED'] },
  { label: 'Completed', value: 'completed', match: ['COMPLETED'] },
];

const BILLING_STATUS_FILTERS: StatusFilterOption[] = [
  { label: 'Paid', value: 'paid', match: ['PAID'] },
  { label: 'Awaiting payment', value: 'awaiting_payment', match: ['AWAITING_PAYMENT', 'PENDING'] },
  { label: 'Failed', value: 'failed', match: ['FAILED'] },
  { label: 'Cancelled', value: 'cancelled', match: ['CANCELLED', 'REFUNDED'] },
];

const STATUS_FILTERS_BY_TAB: Partial<Record<HistoryFilterKey, StatusFilterOption[]>> = {
  APPOINTMENT: APPOINTMENT_STATUS_FILTERS,
  TASK: TASK_STATUS_FILTERS,
  LAB_RESULT: LAB_STATUS_FILTERS,
  MEDICAL_RECORDS: MEDICAL_RECORD_STATUS_FILTERS,
  INVOICE: BILLING_STATUS_FILTERS,
};

const getStatusFilterOptions = (activeFilter: HistoryFilterKey): StatusFilterOption[] => {
  const sectionOptions = STATUS_FILTERS_BY_TAB[activeFilter];
  if (!sectionOptions) return [];
  return [ALL_STATUS_OPTION, ...sectionOptions];
};

const matchesStatusFilter = (
  entry: HistoryEntry,
  activeFilter: HistoryFilterKey,
  statusFilter: string
): boolean => {
  if (statusFilter === STATUS_FILTER_ALL) return true;
  const option = STATUS_FILTERS_BY_TAB[activeFilter]?.find((item) => item.value === statusFilter);
  if (!option) return true;
  /* v8 ignore next 3 -- defensive fallback unreachable: filteredEntries normalizes every entry's status to a string via getEffectiveStatus before this runs, so entry.status is never nullish here */
  const status = String(entry.status ?? getPayloadString(entry.payload, ['status']) ?? '')
    .trim()
    .toUpperCase();
  return option.match.includes(status);
};

// Surface the backend's message (e.g. "caseId could not be resolved for
// check-in.") when a status PATCH fails, instead of a generic retry prompt.
const getStatusErrorMessage = (error: unknown): string => {
  const fallback = 'Please try again.';
  if (!error || typeof error !== 'object') return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const serverMessage = response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage.trim();
  const message = (error as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return fallback;
};

const buildAppointmentsLink = (
  appointmentId: string,
  open?: 'finance' | 'labs',
  subLabel?: string
) => {
  const params = new URLSearchParams({ appointmentId });
  if (open) params.set('open', open);
  if (subLabel) params.set('subLabel', subLabel);
  return `/appointments?${params.toString()}`;
};

const buildTasksLink = (taskId: string) => {
  const params = new URLSearchParams({ taskId });
  return `/tasks?${params.toString()}`;
};

const buildFinanceLink = (invoiceId: string) => {
  const params = new URLSearchParams({ invoiceId });
  return `/finance?${params.toString()}`;
};

/**
 * Navigate to an internally-built path, but only after confirming it cannot
 * escape the current origin (defence-in-depth: the path is built from API ids).
 */
const navigateSameOrigin = (path: string) => {
  const safePath = getSafeSameOriginPath(path);
  if (!safePath) return;
  globalThis.window?.location.assign(safePath);
};

const appendPage = (
  previous: HistoryEntry[],
  response: CompanionHistoryResponse,
  shouldReplace: boolean
) => {
  if (shouldReplace) return response.entries;
  const mapById = new Map<string, HistoryEntry>();
  [...previous, ...response.entries].forEach((entry) => mapById.set(entry.id, entry));
  return Array.from(mapById.values()).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
};

const formatStatusLabel = (status?: string | null): string => {
  const normalized = String(status ?? '').trim();
  if (!normalized) return '-';
  return normalized
    .toLowerCase()
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const formatCompactStatusLabel = (status?: string | null): string => {
  const label = formatStatusLabel(status);
  if (label.toLowerCase() === 'awaiting payment') return 'Awaiting';
  return label;
};

const statusPillStyle = (status?: string | null): React.CSSProperties => {
  /* v8 ignore next 3 -- nullish fallback unreachable: every caller passes an already string-coalesced status, so this is never null/undefined */
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  const statusStyle = normalized ? getStatusStyle(normalized) : getStatusStyle('pending');
  return {
    color: statusStyle.color,
    backgroundColor: statusStyle.backgroundColor,
    borderColor: statusStyle.borderColor,
  };
};

const isRequestedStatus = (status: string): boolean => status === 'REQUESTED';

// A status is "locked" (read-only pill, no dropdown) when there are no valid
// transitions out of it — e.g. completed / cancelled / no-show appointments,
// completed / cancelled tasks.
const isAppointmentStatusLocked = (status?: string | null): boolean =>
  /* v8 ignore next -- nullish fallback unreachable: getEntryStatusSlot always passes an appointment entry's normalized string status */
  getAllowedAppointmentStatusTransitions(normalizeStatusKey(String(status ?? ''))).length === 0;
const isTaskStatusLocked = (status?: string | null): boolean =>
  /* v8 ignore next -- nullish fallback unreachable: getEntryStatusSlot always passes a task entry's normalized string status */
  getAllowedTaskStatusTransitions(normalizeStatusKey(String(status ?? ''))).length === 0;
const getRequestedButtonLabel = (status: string): string =>
  status === 'CHECKED_IN' ? 'Start' : 'Open';

export const StatusPillSelect = ({
  status,
  options,
  onChange,
  disabled = false,
  locked = false,
  allowedKeys,
}: {
  status?: string | null;
  options: Array<{ name: string; key: string }>;
  onChange: (status: string) => void;
  disabled?: boolean;
  locked?: boolean;
  // When provided, the menu only offers these status keys (the valid next
  // transitions). Keys are matched case-insensitively against option.key.
  allowedKeys?: string[];
}) => {
  const [open, setOpen] = useState(false);
  const normalizedStatus = String(status ?? 'pending')
    .trim()
    .toLowerCase();
  const optionLabel = options.find((option) => option.key === normalizedStatus)?.name;
  const label = formatCompactStatusLabel(optionLabel ?? status);
  const allowedSet = allowedKeys
    ? new Set(allowedKeys.map((key) => key.trim().toLowerCase()))
    : null;
  const menuOptions = allowedSet
    ? options.filter((option) => allowedSet.has(option.key.trim().toLowerCase()))
    : options;

  if (locked || disabled || menuOptions.length === 0) {
    return (
      <StatusPill
        style={statusPillStyle(normalizedStatus)}
        className="w-fit"
        label={
          <span className="whitespace-nowrap" title={formatStatusLabel(status)}>
            {label}
          </span>
        }
      />
    );
  }

  return (
    <div className="relative w-fit">
      <button
        type="button"
        aria-label="Status"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        className="w-fit rounded-full! transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        title={formatStatusLabel(status)}
      >
        <StatusPill
          style={statusPillStyle(normalizedStatus)}
          label={
            <>
              <span className="whitespace-nowrap">{label}</span>
              <IoChevronDownOutline
                size={10}
                aria-hidden="true"
                className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </>
          }
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 min-w-36 overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]"
        >
          {menuOptions.map((option) => {
            const optionStyle = getStatusStyle(option.key);
            return (
              <button
                key={option.key}
                type="button"
                role="menuitem"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.key);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-caption-1 hover:bg-neutral-100"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2 shrink-0 rounded-full border"
                  style={{
                    backgroundColor: optionStyle.borderColor,
                    borderColor: optionStyle.borderColor,
                  }}
                />
                <span style={{ color: optionStyle.color }}>{option.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const TABLE_DATA_STYLE = {
  color: 'var(--color-neutral-900)',
  fontFamily: 'var(--font-satoshi), "Satoshi Variable", sans-serif',
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: 500,
  lineHeight: '120%',
} satisfies React.CSSProperties;

export const LoadingIcon = () => <IoReloadOutline className="animate-spin" aria-hidden="true" />;

export const TimelineMarker = ({ active }: { active: boolean }) => {
  const ring = active ? 'border-text-brand' : 'border-neutral-300';
  const dot = active ? 'bg-text-brand' : 'bg-neutral-300';
  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-neutral-0 ${ring}`}
    >
      <span className={`size-2 rounded-full ${dot}`} />
    </span>
  );
};

const getLinkedId = (
  entry: HistoryEntry,
  payloadKeys: string[],
  kindMatcher: string
): string | null => {
  const linkKind = String(entry.link.kind ?? '')
    .trim()
    .toLowerCase();
  if (linkKind === kindMatcher) {
    const linkId = String(entry.link.id ?? '').trim();
    if (linkId) return linkId;
  }
  for (const key of payloadKeys) {
    const value = entry.payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const getLinkedAppointmentId = (entry: HistoryEntry): string | null =>
  getLinkedId(entry, ['appointmentId'], 'appointment') ?? resolveEntryAppointmentId(entry);

const normalizeStatusKey = (status: string): string => status.trim().toUpperCase();

const toAppointmentStatus = (status: string): AppointmentStatus | null =>
  normalizeAppointmentStatus(normalizeStatusKey(status));

const toTaskStatus = (status: string): TaskStatus | null =>
  normalizeTaskStatus(normalizeStatusKey(status));

const resolveFallbackUrl = (entry: HistoryEntry): string | null => {
  const urlKeys = ['pdfUrl', 'url', 'downloadUrl', 'receiptUrl', 'stripeReceiptUrl'];
  for (const key of urlKeys) {
    const payloadUrl = entry.payload[key];
    if (typeof payloadUrl === 'string' && payloadUrl.trim()) return payloadUrl.trim();
  }
  return null;
};

const resolveLabResultId = (entry: HistoryEntry): string | null =>
  getPayloadString(entry.payload, ['resultId']) || getLinkedId(entry, ['resultId'], 'lab_result');

const getLinkedEntryIntent = (
  type: HistoryEntry['type']
): {
  label: AppointmentViewIntent['label'];
  subLabel?: string;
  open?: 'finance' | 'labs';
} | null => {
  /* v8 ignore next -- unreachable: INVOICE is handled in handleOpenEntry before openAppointmentLinkedEntry (the only caller) runs, so it never reaches here */
  if (type === 'INVOICE') return { label: 'finance', subLabel: 'summary', open: 'finance' };
  if (type === 'FORM_SUBMISSION') return { label: 'prescription', subLabel: 'forms' };
  if (type === 'APPOINTMENT') return { label: 'info', subLabel: 'appointment' };
  /* v8 ignore next -- unreachable: TASK is handled in handleOpenEntry before openAppointmentLinkedEntry (the only caller) runs, so it never reaches here */
  if (type === 'TASK') return { label: 'tasks', subLabel: 'task' };
  /* v8 ignore next -- unreachable: openAppointmentLinkedEntry only passes APPOINTMENT/FORM_SUBMISSION, both of which return a non-null intent above */
  return null;
};

const resolveEntryAppointmentId = (entry: HistoryEntry): string | null => {
  if (entry.link.appointmentId) return entry.link.appointmentId;
  const payloadAppointmentId = entry.payload.appointmentId;
  if (typeof payloadAppointmentId === 'string' && payloadAppointmentId.trim()) {
    return payloadAppointmentId;
  }
  return null;
};

// Label for the record drawer's "Linked to" row: the parent appointment's
// service/type name (from the loaded appointment or the entry payload), or a
// neutral fallback. Returns null for appointment rows and unlinked records.
const getLinkedAppointmentLabel = (
  entry: HistoryEntry,
  appointmentsById: Record<string, unknown>
): string | null => {
  if (entry.type === 'APPOINTMENT') return null;
  const appointmentId = resolveEntryAppointmentId(entry);
  if (!appointmentId) return null;
  const appointment = appointmentsById[appointmentId];
  const appointmentRecord =
    appointment && typeof appointment === 'object' && !Array.isArray(appointment)
      ? (appointment as Record<string, unknown>)
      : null;
  const appointmentName = appointmentRecord
    ? getPayloadString(appointmentRecord, ['appointmentType', 'serviceName', 'title', 'name'])
    : null;
  return appointmentName || 'Linked appointment';
};

const SEARCHABLE_PAYLOAD_TYPES = new Set(['string', 'number']);

const getSearchableText = (entry: HistoryEntry): string => {
  const payloadText = Object.values(entry.payload)
    .filter((value) => SEARCHABLE_PAYLOAD_TYPES.has(typeof value))
    .join(' ');
  return [
    entry.title,
    entry.subtitle,
    entry.summary,
    entry.status,
    entry.actor?.name,
    entry.tags?.join(' '),
    payloadText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const entryMatchesSearchQuery = (entry: HistoryEntry, normalizedQuery: string): boolean =>
  getSearchableText(entry).includes(normalizedQuery);

const filterEntriesByActiveTab = (
  entries: HistoryEntry[],
  activeFilter: HistoryFilterKey,
  requestedTypeSet: Set<HistoryEntryType> | undefined
): HistoryEntry[] => {
  if (activeFilter === 'ALL') return entries;
  if (activeFilter === 'MEDICAL_RECORDS') {
    return entries.filter((entry) => MEDICAL_RECORD_TYPES.has(entry.type));
  }
  return entries.filter((entry) => requestedTypeSet?.has(entry.type) ?? false);
};

const getEffectiveStatus = (entry: HistoryEntry, statusOverrides: StatusOverrides): string =>
  statusOverrides[entry.id] ?? entry.status ?? getPayloadString(entry.payload, ['status']) ?? '';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getRecordArray = (
  payload: Record<string, unknown>,
  keys: string[]
): Record<string, unknown>[] => {
  for (const key of keys) {
    const value = payload[key];
    if (!Array.isArray(value)) continue;
    return value.flatMap((item) => {
      const record = asRecord(item);
      return record ? [record] : [];
    });
  }
  return [];
};

const HIGH_FLAG_CODES = new Set(['H', 'HH', 'HIGH', 'ABOVE']);
const LOW_FLAG_CODES = new Set(['L', 'LL', 'LOW', 'BELOW']);

// Reference intervals arrive as "23-212", "10 - 125" or "5.1 to 16.8". The
// shared LabTests parser only handles the spaced form, so analyte ranges get
// their own anchored pattern.
const ANALYTE_RANGE_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)$/i;

const parseAnalyteRange = (range: string): { min: number; max: number } | null => {
  const match = ANALYTE_RANGE_PATTERN.exec(range.replaceAll(',', '.').trim());
  if (!match) return null;
  const min = Number.parseFloat(match[1]);
  const max = Number.parseFloat(match[2]);
  return max > min ? { min, max } : null;
};

/**
 * Out-of-range state for a single analyte. The lab's own flag wins where it is
 * present; otherwise the value is compared against the reference interval. Only
 * a determinable direction earns the design's ↑/↓ arrow.
 */
const getResultFlag = (
  row: Record<string, unknown>,
  value: string,
  range: string
): { abnormal: boolean; direction: string } => {
  const code = (getPayloadString(row, ['interpretation', 'abnormalFlag', 'flag']) ?? '')
    .trim()
    .toUpperCase();
  const bounds = parseAnalyteRange(range);
  const numericValue = parseFloatSafe(value);
  const isHigh = bounds !== null && numericValue !== null && numericValue > bounds.max;
  const isLow = bounds !== null && numericValue !== null && numericValue < bounds.min;
  if (HIGH_FLAG_CODES.has(code) || isHigh) {
    return { abnormal: true, direction: '↑' };
  }
  if (LOW_FLAG_CODES.has(code) || isLow) {
    return { abnormal: true, direction: '↓' };
  }
  const flagged = row.outOfRange === true || row.abnormal === true;
  return { abnormal: flagged, direction: '' };
};

const getLabResults = (entry: HistoryEntry): DetailPair[] => {
  const rows = getRecordArray(entry.payload, ['results', 'tests', 'observations']);
  return rows.slice(0, 6).map((row, index) => {
    // The flag is measured against the bare reading: a unit such as "x10^9/L"
    // carries digits that would corrupt the numeric comparison.
    const reading = getPayloadString(row, ['value', 'result']) ?? '';
    const range = getPayloadString(row, ['reference', 'referenceRange']) ?? '';
    const flag = getResultFlag(row, reading, range);
    return {
      label: getPayloadString(row, ['test', 'name', 'display']) || `Result ${index + 1}`,
      value: [reading, getPayloadString(row, ['unit'])].filter(Boolean).join(' '),
      range,
      abnormal: flag.abnormal,
      direction: flag.direction,
    };
  });
};

export const StructuredResultsPanel = ({
  entry,
  results,
}: {
  entry: HistoryEntry;
  results: DetailPair[];
}) => (
  <div className="mt-3 rounded-2xl border border-card-border px-4 py-3">
    <div className="yc-table-head yc-table-head--static grid grid-cols-[minmax(160px,1fr)_120px_120px_100px] gap-3 px-0!">
      <span>Test</span>
      <span>Value</span>
      <span>Reference</span>
      <span>Meter</span>
    </div>
    {results.map((result) => (
      <div
        key={`${entry.id}-${result.label}`}
        className="grid grid-cols-[minmax(160px,1fr)_120px_120px_100px] gap-3 py-1.5"
        style={TABLE_DATA_STYLE}
      >
        <span className="font-bold text-neutral-900">{result.label}</span>
        <span>{result.value || '-'}</span>
        <span>{result.range || getPayloadString(entry.payload, ['referenceRange']) || '-'}</span>
        <span>N/A</span>
      </div>
    ))}
  </div>
);

// Inset action chip matching the design: rounded 9px, --inset fill, 11px/600,
// blue-tinted leading icon. Used for PDF preview / expand affordances.
const InsetChipButton = ({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center gap-1 rounded-[9px] px-2.5 py-[5px] text-[10.5px] font-semibold text-[var(--ink-body)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand disabled:cursor-not-allowed disabled:opacity-60 md:py-1 md:text-[11px]"
    style={{ background: 'var(--inset)' }}
  >
    <span aria-hidden="true" className="inline-flex text-[var(--blue-text)]">
      {icon}
    </span>
    <span>{label}</span>
  </button>
);

export const RequestedAppointmentActions = ({
  entry,
  canEdit,
  onStatusChange,
  onOpen,
}: {
  entry: HistoryEntry;
  canEdit: boolean;
  onStatusChange: (entry: HistoryEntry, status: string) => void;
  onOpen: (entry: HistoryEntry) => void;
}) => {
  const status = String(entry.status ?? '')
    .trim()
    .toUpperCase();
  if (!isRequestedStatus(status) || !canEdit) {
    return (
      <Primary
        text={getRequestedButtonLabel(status)}
        icon={<IoArrowForwardOutline size={15} aria-hidden="true" />}
        iconPosition="right"
        onClick={() => onOpen(entry)}
      />
    );
  }
  return (
    <>
      <CircleIconButton
        icon={<IoCheckmarkOutline aria-hidden="true" />}
        label={`Accept ${entry.title}`}
        variant="dark"
        onClick={() => onStatusChange(entry, 'upcoming')}
      />
      <CircleIconButton
        icon={<IoClose aria-hidden="true" />}
        label={`Reject ${entry.title}`}
        variant="danger"
        onClick={() => onStatusChange(entry, 'cancelled')}
      />
    </>
  );
};

type TimelineEntryProps = {
  entry: HistoryEntry;
  isLast: boolean;
  expandedId: string | null;
  pdfLoadingId: string | null;
  selectedId: string | null;
  onOpen: (entry: HistoryEntry) => void;
  onOpenDetail: (entry: HistoryEntry) => void;
  onStatusChange: (entry: HistoryEntry, status: string) => void;
  canEditStatus: (entry: HistoryEntry) => boolean;
  onToggle: (id: string) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  onOpenResultPdf: (entry: HistoryEntry) => void;
};

const getEntryStatusSlot = ({
  entry,
  onStatusChange,
  canEditStatus,
}: Pick<TimelineEntryProps, 'entry' | 'onStatusChange' | 'canEditStatus'>): React.ReactNode => {
  if (entry.type === 'APPOINTMENT') {
    return (
      <StatusPillSelect
        status={entry.status}
        options={AppointmentLabels}
        disabled={!canEditStatus(entry)}
        locked={isAppointmentStatusLocked(entry.status)}
        allowedKeys={getAllowedAppointmentStatusTransitions(
          normalizeStatusKey(String(entry.status))
        )}
        onChange={(status) => onStatusChange(entry, status)}
      />
    );
  }
  if (entry.type === 'TASK') {
    return (
      <StatusPillSelect
        status={entry.status}
        options={TaskLabels}
        disabled={!canEditStatus(entry)}
        locked={isTaskStatusLocked(entry.status)}
        allowedKeys={getAllowedTaskStatusTransitions(normalizeStatusKey(String(entry.status)))}
        onChange={(status) => onStatusChange(entry, status)}
      />
    );
  }
  return undefined;
};

const isPaidInvoice = (entry: HistoryEntry): boolean => {
  /* v8 ignore next 3 -- defensive fallback unreachable: getEntryActions receives entries whose status is normalized to a string by getEffectiveStatus, so entry.status is never nullish here */
  const status = String(entry.status ?? getPayloadString(entry.payload, ['status']) ?? '')
    .trim()
    .toUpperCase();
  return ['PAID', 'PAID_FULL', 'COMPLETED'].includes(status);
};

type LabResultActionsProps = {
  entry: HistoryEntry;
  loadingPdf: boolean;
  expanded: boolean;
  fallbackUrl: ReturnType<typeof resolveFallbackUrl>;
  results: ReturnType<typeof getLabResults>;
  onOpenResultPdf: (entry: HistoryEntry) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  onToggle: (id: string) => void;
};

const LabResultActions = ({
  entry,
  loadingPdf,
  expanded,
  fallbackUrl,
  results,
  onOpenResultPdf,
  onPreviewPdf,
  onToggle,
}: LabResultActionsProps): React.ReactNode => {
  const resultId = resolveLabResultId(entry);
  return (
    <>
      {resultId ? (
        <InsetChipButton
          icon={loadingPdf ? <LoadingIcon /> : <IoEyeOutline size={10} aria-hidden="true" />}
          label={loadingPdf ? 'Loading…' : 'Result PDF'}
          disabled={loadingPdf}
          onClick={() => onOpenResultPdf(entry)}
        />
      ) : null}
      {fallbackUrl ? (
        <InsetChipButton
          icon={<IoEyeOutline size={10} aria-hidden="true" />}
          label="Acknowledgment PDF"
          onClick={() => onPreviewPdf(entry, fallbackUrl)}
        />
      ) : null}
      {results.length > 0 ? (
        <InsetChipButton
          icon={
            expanded ? (
              <IoEyeOffOutline size={10} aria-hidden="true" />
            ) : (
              <IoEyeOutline size={10} aria-hidden="true" />
            )
          }
          label={expanded ? `Hide ${entry.title}` : `View ${entry.title}`}
          onClick={() => onToggle(entry.id)}
        />
      ) : null}
    </>
  );
};

const getEntryActions = ({
  entry,
  expandedId,
  pdfLoadingId,
  onOpen,
  onStatusChange,
  canEditStatus,
  onToggle,
  onPreviewPdf,
  onOpenResultPdf,
}: TimelineEntryProps): React.ReactNode => {
  const results = getLabResults(entry);
  const expanded = expandedId === entry.id;
  const loadingPdf = pdfLoadingId === entry.id;
  const fallbackUrl = resolveFallbackUrl(entry);

  if (entry.type === 'APPOINTMENT') {
    return (
      <RequestedAppointmentActions
        entry={entry}
        canEdit={canEditStatus(entry)}
        onStatusChange={onStatusChange}
        onOpen={onOpen}
      />
    );
  }

  if (entry.type === 'LAB_RESULT') {
    return (
      <LabResultActions
        entry={entry}
        loadingPdf={loadingPdf}
        expanded={expanded}
        fallbackUrl={fallbackUrl}
        results={results}
        onOpenResultPdf={onOpenResultPdf}
        onPreviewPdf={onPreviewPdf}
        onToggle={onToggle}
      />
    );
  }

  if (entry.type === 'INVOICE' && isPaidInvoice(entry) && fallbackUrl) {
    return (
      <InsetChipButton
        icon={<IoEyeOutline size={10} aria-hidden="true" />}
        label={`Preview ${entry.title}`}
        onClick={() => onPreviewPdf(entry, fallbackUrl)}
      />
    );
  }

  return undefined;
};

const TimelineEntry = (props: TimelineEntryProps) => {
  const { entry, isLast, expandedId, selectedId, onOpen, onOpenDetail } = props;
  const results = getLabResults(entry);
  const expanded = expandedId === entry.id;
  return (
    <HistoryEntryCard
      entry={entry}
      onOpen={onOpen}
      onOpenDetail={onOpenDetail}
      active={selectedId === entry.id}
      isLast={isLast}
      statusSlot={getEntryStatusSlot(props)}
      actions={getEntryActions(props)}
      expandedContent={
        expanded && results.length > 0 ? (
          <StructuredResultsPanel entry={entry} results={results} />
        ) : null
      }
    />
  );
};

type TimelineListProps = {
  entries: HistoryEntry[];
  expandedId: string | null;
  pdfLoadingId: string | null;
  selectedId: string | null;
  onOpen: (entry: HistoryEntry) => void;
  onOpenDetail: (entry: HistoryEntry) => void;
  onStatusChange: (entry: HistoryEntry, status: string) => void;
  canEditStatus: (entry: HistoryEntry) => boolean;
  onToggle: (id: string) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  onOpenResultPdf: (entry: HistoryEntry) => void;
};

const HistoryTimelineList = ({ entries, ...handlers }: TimelineListProps) => (
  <ol className="flex flex-col">
    {entries.map((entry, index) => (
      <TimelineEntry
        key={entry.id}
        entry={entry}
        isLast={index === entries.length - 1}
        {...handlers}
      />
    ))}
  </ol>
);

const getAuditActorDisplay = (entry: AuditTrail): string => {
  const actorTypeLabelMap: Record<string, string> = {
    PMS_USER: 'Team member',
    PARENT: 'Pet parent',
    SYSTEM: 'System',
  };
  const actorTypeLabel =
    actorTypeLabelMap[
      String(entry.actorType ?? '')
        .trim()
        .toUpperCase()
    ] || 'System';
  const actorName = String(entry.actorName ?? '').trim();
  return actorName ? `${actorName} • ${actorTypeLabel}` : actorTypeLabel;
};

export const AuditTimeline = ({
  loading,
  error,
  entries,
}: {
  loading: boolean;
  error: string | null;
  entries: AuditTrail[];
}) => {
  if (loading) {
    return <div className="px-4 py-8 text-body-3 text-text-secondary">Loading audit trail…</div>;
  }
  if (error) return <HistoryEmptyState isError message={error} />;
  if (entries.length === 0) return <HistoryEmptyState message="No audit entries found." />;

  return (
    <ol className="flex flex-col px-1 py-1">
      {entries.map((entry, index) => (
        <li
          key={entry.id ?? `${entry.eventType}-${entry.occurredAt}-${index}`}
          className="flex gap-3"
        >
          <span className="w-40 shrink-0 whitespace-nowrap pt-2.5 text-right text-caption-1 font-medium text-pill-success-text">
            {formatDateTimeLocal(entry.occurredAt, '-')}
          </span>
          <div className="relative flex shrink-0 flex-col items-center">
            <span className={`h-2.5 w-px flex-none ${index === 0 ? '' : 'bg-card-border'}`} />
            <TimelineMarker active={String(entry.eventType ?? '').trim().length > 0} />
            <span
              className={`w-px flex-1 ${index === entries.length - 1 ? '' : 'bg-card-border'}`}
            />
          </div>
          <div className="mb-2 flex-1 rounded-xl border border-card-border bg-neutral-0 px-3 py-2 shadow-[0_1px_10px_0_var(--sh08)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-body-4 font-bold text-neutral-900">
                {toTitle(entry.eventType)}
              </div>
              {entry.entityType ? (
                <div className="inline-flex shrink-0 rounded-2xl border border-card-border bg-card-hover px-2.5 py-1 text-caption-1 text-neutral-900">
                  {toTitle(entry.entityType)}
                </div>
              ) : null}
            </div>
            <div className="mt-1 text-caption-1 text-text-secondary">
              Updated by: {getAuditActorDisplay(entry)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};

type TimelineBodyProps = {
  activeFilter: HistoryFilterKey;
  loading: boolean;
  error: string | null;
  auditLoading: boolean;
  auditError: string | null;
  auditEntries: AuditTrail[];
  filteredEntries: HistoryEntry[];
  expandedId: string | null;
  pdfLoadingId: string | null;
  selectedId: string | null;
  onStatusChange: (entry: HistoryEntry, nextStatus: string) => void;
  canEditStatus: (entry: HistoryEntry) => boolean;
  onToggle: (entryId: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  onOpenDetail: (entry: HistoryEntry) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  onOpenResultPdf: (entry: HistoryEntry) => void;
};

const getTimelineBody = ({
  activeFilter,
  loading,
  error,
  auditLoading,
  auditError,
  auditEntries,
  filteredEntries,
  expandedId,
  pdfLoadingId,
  selectedId,
  onStatusChange,
  canEditStatus,
  onToggle,
  onOpen,
  onOpenDetail,
  onPreviewPdf,
  onOpenResultPdf,
}: TimelineBodyProps) => {
  if (activeFilter === 'AUDIT_TRAIL') {
    return <AuditTimeline loading={auditLoading} error={auditError} entries={auditEntries} />;
  }
  if (loading) {
    return <div className="px-1 py-8 text-body-3 text-text-secondary">Loading overview…</div>;
  }
  if (error) {
    return <HistoryEmptyState isError message={error} />;
  }
  if (filteredEntries.length === 0) {
    return <HistoryEmptyState />;
  }
  return (
    <HistoryTimelineList
      entries={filteredEntries}
      expandedId={expandedId}
      pdfLoadingId={pdfLoadingId}
      selectedId={selectedId}
      onStatusChange={onStatusChange}
      canEditStatus={canEditStatus}
      onToggle={onToggle}
      onOpen={onOpen}
      onOpenDetail={onOpenDetail}
      onPreviewPdf={onPreviewPdf}
      onOpenResultPdf={onOpenResultPdf}
    />
  );
};

const getPersistStatusAction = (
  entryType: HistoryEntry['type'],
  persistAppointmentStatus: (entry: HistoryEntry, nextStatus: string) => Promise<void>,
  persistTaskStatus: (entry: HistoryEntry, nextStatus: string) => Promise<void>
): ((entry: HistoryEntry, nextStatus: string) => Promise<void>) | null => {
  if (entryType === 'APPOINTMENT') return persistAppointmentStatus;
  if (entryType === 'TASK') return persistTaskStatus;
  /* v8 ignore next -- unreachable: handleStatusChange only fires from StatusPillSelect, which renders for APPOINTMENT/TASK rows only */
  return null;
};

const FILTER_CHIP_BASE =
  'inline-flex items-center rounded-full px-[11px] py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand md:px-[13px] md:text-[12px]';

// Slim rounded-full pill dropdown for the Status / Sort header selectors, so
// they read as filter pills consistent with the adjacent history-tab chips
// (1px --hairline border, --ink-muted text, IoChevronDown) instead of the
// boxed floating-label LabelDropdown.
export const PillDropdown = ({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onSelect: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? label;

  useEffect(() => {
    if (!open) return;
    const node = containerRef.current;
    /* v8 ignore next -- node is always mounted while the menu is open, so this guard never returns early */
    if (!node) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!node.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div className="relative w-fit" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${selectedLabel}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--divider)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <span className="whitespace-nowrap">{selectedLabel}</span>
        <IoChevronDownOutline
          size={12}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-40 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] py-1 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-[var(--inset)] ${
                option.value === value
                  ? 'font-bold text-[var(--ink)]'
                  : 'font-medium text-[var(--ink-muted)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

type HistoryLoadState = {
  entries: HistoryEntry[];
  auditEntries: AuditTrail[];
  loading: boolean;
  auditLoading: boolean;
  error: string | null;
  auditError: string | null;
  nextCursor: string | null;
  loadingMore: boolean;
  expandedId: string | null;
};

type HistoryLoadAction =
  | { type: 'PATCH'; patch: Partial<HistoryLoadState> }
  | { type: 'APPEND_PAGE'; response: CompanionHistoryResponse; shouldReplace: boolean };

const historyLoadReducer = (
  state: HistoryLoadState,
  action: HistoryLoadAction
): HistoryLoadState => {
  if (action.type === 'APPEND_PAGE') {
    return {
      ...state,
      entries: appendPage(state.entries, action.response, action.shouldReplace),
      nextCursor: action.response.nextCursor,
    };
  }
  return { ...state, ...action.patch };
};

// Desktop-only header row (Status / Sort pills + Search). Owns its own phone
// gate so the timeline's return stays a single branch. Renders nothing on the
// phone variant, matching the previous `isPhoneVariant ? null : (...)` block.
const TimelineHeaderControls = ({
  isPhoneVariant,
  statusFilterOptions,
  statusFilter,
  setStatusFilter,
  sortKey,
  setSortKey,
  query,
  setQuery,
}: {
  isPhoneVariant: boolean;
  statusFilterOptions: StatusFilterOption[];
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  sortKey: SortKey;
  setSortKey: React.Dispatch<React.SetStateAction<SortKey>>;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
}) => {
  if (isPhoneVariant) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {statusFilterOptions.length > 0 ? (
          <PillDropdown
            label="Status"
            options={statusFilterOptions.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            value={statusFilter}
            onSelect={setStatusFilter}
          />
        ) : null}
        <PillDropdown
          label="Sort by"
          options={SORT_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          value={sortKey}
          onSelect={(value) => setSortKey(value as SortKey)}
        />
      </div>
      <Search
        value={query}
        setSearch={setQuery}
        placeholder="Search by service, appointment, invoice, or records"
        label="Search overview records"
        className="ml-auto w-full! md:w-120! xl:w-128!"
      />
    </div>
  );
};

// "Load more" pager. Owns the compact / cursor gate so the timeline's return
// carries neither the `!compact && nextCursor` branch nor the nested
// loading-label ternary.
const TimelineLoadMore = ({
  compact,
  nextCursor,
  loadingMore,
  loadHistory,
}: {
  compact: boolean;
  nextCursor: string | null;
  loadingMore: boolean;
  loadHistory: (cursor: string | null, shouldReplace: boolean) => Promise<void>;
}) => {
  if (compact || !nextCursor) return null;
  return (
    <button
      type="button"
      onClick={() => {
        /* v8 ignore next 3 -- unreachable: loadHistory wraps its body in try/catch/finally and always resolves, so this defensive .catch never fires */
        loadHistory(nextCursor, false).catch((historyError) => {
          console.error('Failed to load more history entries:', historyError);
        });
      }}
      disabled={loadingMore}
      className="w-full rounded-2xl border border-card-border bg-neutral-0 px-4 py-2 text-caption-1 text-text-primary transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loadingMore ? 'Loading…' : 'Load more'}
    </button>
  );
};

const useCompanionHistoryTimelineView = ({
  companionId,
  activeAppointmentId,
  showDocumentUpload = false,
  onOpenAppointmentView,
  compact = false,
  fullPageHref,
  variant = 'default',
  openMedicalRecordsSignal = 0,
}: CompanionHistoryTimelineProps) => {
  const isPhoneVariant = variant === 'phone';
  useLoadAppointmentsForPrimaryOrg();
  useLoadTasksForPrimaryOrg();
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const orgType = useOrgStore((state) => {
    if (!state.primaryOrgId) return undefined;
    return state.orgsById?.[state.primaryOrgId]?.type;
  });
  const appointmentsById = useAppointmentStore((state) => state.appointmentsById);
  const tasksById = useTaskStore((state) => state.tasksById);
  const { notify } = useNotify();
  const [historyLoad, dispatchHistoryLoad] = useReducer(historyLoadReducer, {
    entries: [] as HistoryEntry[],
    auditEntries: [] as AuditTrail[],
    loading: false,
    auditLoading: false,
    error: null as string | null,
    auditError: null as string | null,
    nextCursor: null as string | null,
    loadingMore: false,
    expandedId: null as string | null,
  });
  const {
    entries,
    auditEntries,
    loading,
    auditLoading,
    error,
    auditError,
    nextCursor,
    loadingMore,
    expandedId,
  } = historyLoad;
  const patchHistoryLoad = useCallback(
    (patch: Partial<HistoryLoadState>) => dispatchHistoryLoad({ type: 'PATCH', patch }),
    []
  );
  const setExpandedId = useCallback<React.Dispatch<React.SetStateAction<string | null>>>(
    (value) => {
      dispatchHistoryLoad({
        type: 'PATCH',
        patch: {
          expandedId:
            typeof value === 'function'
              ? (value as (prev: string | null) => string | null)(historyLoad.expandedId)
              : value,
        },
      });
    },
    [historyLoad.expandedId]
  );
  const [activeFilter, setActiveFilter] = useState<HistoryFilterKey>(DEFAULT_FILTER);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [statusOverrides, setStatusOverrides] = useState<StatusOverrides>({});
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const historyFilters = useMemo(() => getHistoryFilters(orgType), [orgType]);
  const statusFilterOptions = useMemo(() => getStatusFilterOptions(activeFilter), [activeFilter]);

  const requestedTypes = useMemo<HistoryEntryType[] | undefined>(() => {
    if (activeFilter === 'AUDIT_TRAIL' || activeFilter === 'ALL') return undefined;
    if (activeFilter === 'MEDICAL_RECORDS') return ['FORM_SUBMISSION', 'DOCUMENT'];
    return HISTORY_FILTER_TYPE_MAP[activeFilter];
  }, [activeFilter]);

  const loadHistory = useCallback(
    async (cursor: string | null, shouldReplace: boolean) => {
      if (!organisationId || !companionId) {
        patchHistoryLoad({ entries: [], nextCursor: null });
        return;
      }
      patchHistoryLoad(
        cursor ? { loadingMore: true, error: null } : { loading: true, error: null }
      );
      try {
        const response = await fetchCompanionHistory({
          organisationId,
          companionId,
          limit: 50,
          cursor,
          types: requestedTypes,
        });
        if (!response || !Array.isArray(response.entries)) {
          throw new Error('Invalid companion history response');
        }
        dispatchHistoryLoad({ type: 'APPEND_PAGE', response, shouldReplace });
      } catch (historyError) {
        console.error('Failed to load companion history:', historyError);
        patchHistoryLoad({
          error: 'Unable to load overview. Please try again.',
          ...(shouldReplace ? { entries: [] } : {}),
        });
      } finally {
        patchHistoryLoad({ loading: false, loadingMore: false });
      }
    },
    [organisationId, companionId, requestedTypes, patchHistoryLoad]
  );

  const identityKey = `${companionId ?? ''}:${organisationId ?? ''}`;
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    setActiveFilter(DEFAULT_FILTER);
    setQuery('');
    setExpandedId(null);
    setStatusOverrides({});
    // The open record drawer belongs to the companion/organisation it was
    // opened from. Left behind, it keeps showing that record's title, summary,
    // lab values and linked appointment in the new context - and its Download /
    // Open actions still target the old record.
    setSelectedEntry(null);
  }

  // Phone action-bar upload trigger: when the signal advances, jump to Medical
  // records so the uploader is on screen. Adjust state during render (tracking
  // the previous value) rather than via an effect, matching the identity reset.
  const [prevUploadSignal, setPrevUploadSignal] = useState(openMedicalRecordsSignal);
  if (openMedicalRecordsSignal !== prevUploadSignal) {
    setPrevUploadSignal(openMedicalRecordsSignal);
    setActiveFilter('MEDICAL_RECORDS');
    setStatusFilter(STATUS_FILTER_ALL);
  }

  useLayoutEffect(() => {
    if (activeFilter === 'AUDIT_TRAIL') return;
    patchHistoryLoad({
      entries: [],
      auditEntries: [],
      nextCursor: null,
      error: null,
      auditError: null,
      expandedId: null,
    });
    /* v8 ignore next 3 -- unreachable: loadHistory wraps its body in try/catch/finally and always resolves, so this defensive .catch never fires */
    loadHistory(null, true).catch((historyError) => {
      console.error('Failed to initialize companion history:', historyError);
    });
  }, [companionId, organisationId, activeFilter, loadHistory, patchHistoryLoad]);

  useLayoutEffect(() => {
    if (activeFilter !== 'AUDIT_TRAIL') {
      patchHistoryLoad({ auditError: null });
      return;
    }
    if (!companionId) {
      patchHistoryLoad({ auditEntries: [], auditError: null });
      return;
    }
    let cancelled = false;
    patchHistoryLoad({ auditLoading: true, auditError: null });
    getCompanionAuditTrail(companionId)
      .then((response) => {
        if (!cancelled) patchHistoryLoad({ auditEntries: Array.isArray(response) ? response : [] });
      })
      .catch((auditTrailError) => {
        if (cancelled) return;
        console.error('Failed to load companion audit trail:', auditTrailError);
        patchHistoryLoad({
          auditEntries: [],
          auditError: 'Unable to load audit trail. Please try again.',
        });
      })
      .finally(() => {
        if (!cancelled) patchHistoryLoad({ auditLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [activeFilter, companionId, patchHistoryLoad]);

  const requestedTypeSet = useMemo(
    () => (requestedTypes ? new Set(requestedTypes) : undefined),
    [requestedTypes]
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byTab = filterEntriesByActiveTab(entries, activeFilter, requestedTypeSet);
    const bySearch = normalizedQuery
      ? byTab.filter((entry) => entryMatchesSearchQuery(entry, normalizedQuery))
      : byTab;
    const withStatusOverrides = bySearch.map((entry) => ({
      ...entry,
      status: getEffectiveStatus(entry, statusOverrides),
    }));
    const byStatus = withStatusOverrides.filter((entry) =>
      matchesStatusFilter(entry, activeFilter, statusFilter)
    );
    const sorted = [...byStatus].sort((a, b) => {
      const delta = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      return sortKey === 'newest' ? delta : -delta;
    });
    return compact ? sorted.slice(0, COMPACT_MAX_ENTRIES) : sorted;
  }, [
    activeFilter,
    compact,
    entries,
    query,
    requestedTypeSet,
    sortKey,
    statusFilter,
    statusOverrides,
  ]);

  const openDocument = useCallback(
    async (entry: HistoryEntry) => {
      const payloadDocumentId = entry.payload.documentId;
      const entryDocumentId =
        typeof payloadDocumentId === 'string' && payloadDocumentId.trim()
          ? payloadDocumentId
          : entry.link.id;
      setPdfLoadingId(entry.id);
      try {
        const urls = await loadDocumentDownloadURL(entryDocumentId);
        const pdfUrl = urls.find((item) => typeof item?.url === 'string' && item.url.trim())?.url;
        if (!pdfUrl) {
          notify('error', {
            title: 'Document unavailable',
            text: 'No preview URL is available for this document.',
          });
          return;
        }
        setPdfPreview((current) => {
          if (current?.url.startsWith('blob:')) {
            URL.revokeObjectURL(current.url);
          }
          return { title: entry.title || 'Medical record preview', url: pdfUrl };
        });
      } finally {
        setPdfLoadingId((current) => (current === entry.id ? null : current));
      }
    },
    [notify]
  );

  // The drawer's "Download PDF" action resolves the document's real URL and hands
  // it to the browser for download/open, rather than re-opening the in-app viewer.
  // It is only offered for records the document store actually holds — the drawer
  // gates on the same resolver, so a lab/invoice/task id never reaches this endpoint.
  const handleDownloadRecord = useCallback(
    async (entry: HistoryEntry) => {
      const entryDocumentId = resolveHistoryDocumentId(entry);
      /* v8 ignore next -- unreachable: HistoryRecordDrawer only renders the download action when resolveHistoryDocumentId returns an id */
      if (!entryDocumentId) return;
      setPdfLoadingId(entry.id);
      try {
        const urls = await loadDocumentDownloadURL(entryDocumentId);
        const pdfUrl = urls.find((item) => typeof item?.url === 'string' && item.url.trim())?.url;
        if (!pdfUrl) {
          notify('error', {
            title: 'Document unavailable',
            text: 'No downloadable file is available for this document.',
          });
          return;
        }
        const anchor = document.createElement('a');
        anchor.href = pdfUrl;
        anchor.download = entry.title || 'medical-record.pdf';
        anchor.rel = 'noopener';
        anchor.target = '_blank';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } catch (error) {
        // The drawer calls this straight from a click handler, so a rejection
        // here escaped as an unhandled promise rejection and the user saw the
        // spinner stop with no explanation.
        console.error('Failed to download the record PDF:', error);
        notify('error', {
          title: 'Download failed',
          text: 'The document could not be downloaded. Please try again.',
        });
      } finally {
        setPdfLoadingId((current) => (current === entry.id ? null : current));
      }
    },
    [notify]
  );

  const openLabResult = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveEntryAppointmentId(entry);
      if (appointmentId) {
        if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
          onOpenAppointmentView({ label: 'labs', subLabel: 'idexx-labs' });
          return;
        }
        navigateSameOrigin(buildAppointmentsLink(appointmentId, 'labs', 'idexx-labs'));
        return;
      }
      const resolvedUrl = resolveFallbackUrl(entry);
      if (resolvedUrl && globalThis.window) {
        globalThis.window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [activeAppointmentId, onOpenAppointmentView]
  );

  const openAppointmentLinkedEntry = useCallback(
    (entry: HistoryEntry) => {
      const intent = getLinkedEntryIntent(entry.type);
      /* v8 ignore next -- unreachable: only APPOINTMENT/FORM_SUBMISSION reach this callback, and both yield a non-null intent */
      if (!intent) return;
      const appointmentId = resolveEntryAppointmentId(entry);
      if (!appointmentId) return;
      if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
        onOpenAppointmentView({ label: intent.label, subLabel: intent.subLabel });
        return;
      }
      navigateSameOrigin(buildAppointmentsLink(appointmentId, intent.open, intent.subLabel));
    },
    [activeAppointmentId, onOpenAppointmentView]
  );

  const openTaskEntry = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveEntryAppointmentId(entry);
      if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
        onOpenAppointmentView({ label: 'tasks', subLabel: 'task' });
        return;
      }
      const taskId = getLinkedId(entry, ['taskId'], 'task');
      if (taskId) {
        navigateSameOrigin(buildTasksLink(taskId));
        return;
      }
      if (appointmentId) {
        navigateSameOrigin(buildAppointmentsLink(appointmentId, undefined, 'task'));
      }
    },
    [activeAppointmentId, onOpenAppointmentView]
  );

  const openInvoiceEntry = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveEntryAppointmentId(entry);
      if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
        onOpenAppointmentView({ label: 'finance', subLabel: 'summary' });
        return;
      }
      const invoiceId = getLinkedId(entry, ['invoiceId'], 'invoice');
      if (invoiceId) {
        navigateSameOrigin(buildFinanceLink(invoiceId));
        return;
      }
      if (appointmentId) {
        navigateSameOrigin(buildAppointmentsLink(appointmentId, 'finance', 'summary'));
      }
    },
    [activeAppointmentId, onOpenAppointmentView]
  );

  const handleOpenEntry = useCallback(
    (entry: HistoryEntry) => {
      if (entry.type === 'DOCUMENT') {
        openDocument(entry).catch((documentError) => {
          console.error('Failed to open document:', documentError);
        });
        return;
      }
      if (entry.type === 'LAB_RESULT') {
        openLabResult(entry);
        return;
      }
      if (entry.type === 'TASK') {
        openTaskEntry(entry);
        return;
      }
      if (entry.type === 'INVOICE') {
        openInvoiceEntry(entry);
        return;
      }
      openAppointmentLinkedEntry(entry);
    },
    [openDocument, openLabResult, openTaskEntry, openInvoiceEntry, openAppointmentLinkedEntry]
  );

  const handleDocumentUploaded = useCallback(() => {
    /* v8 ignore next 3 -- unreachable: loadHistory wraps its body in try/catch/finally and always resolves, so this defensive .catch never fires */
    loadHistory(null, true).catch((historyError) => {
      console.error('Failed to refresh companion history after document upload:', historyError);
    });
  }, [loadHistory]);

  const handleToggleExpanded = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

  const handlePreviewPdf = (entry: HistoryEntry, url: string) => {
    if (pdfPreview?.url.startsWith('blob:')) {
      URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview({ title: entry.title || 'Medical record preview', url });
  };

  // Medical records (forms + documents) keep the table's primary-action logic:
  // structured results expand inline, otherwise a bundled PDF previews, otherwise
  // fall through to the document/form open handler.
  const handleMedicalPrimary = (entry: HistoryEntry) => {
    if (pdfLoadingId === entry.id) return;
    if (getLabResults(entry).length > 0) {
      handleToggleExpanded(entry.id);
      return;
    }
    const pdfUrl = resolveFallbackUrl(entry);
    if (pdfUrl) {
      handlePreviewPdf(entry, pdfUrl);
      return;
    }
    handleOpenEntry(entry);
  };

  const handleTimelineOpen = (entry: HistoryEntry) => {
    if (entry.type === 'FORM_SUBMISSION' || entry.type === 'DOCUMENT') {
      handleMedicalPrimary(entry);
      return;
    }
    handleOpenEntry(entry);
  };

  const canEditStatus = useCallback(
    (entry: HistoryEntry): boolean => {
      if (entry.type === 'APPOINTMENT') {
        const appointmentId = getLinkedAppointmentId(entry);
        return Boolean(appointmentId && appointmentsById[appointmentId]);
      }
      if (entry.type === 'TASK') {
        const taskId = getLinkedId(entry, ['taskId'], 'task');
        return Boolean(taskId && tasksById[taskId]);
      }
      /* v8 ignore next -- unreachable: canEditStatus is only invoked for APPOINTMENT/TASK rows (getEntryStatusSlot / getEntryActions), so the neither-branch never runs */
      return false;
    },
    [appointmentsById, tasksById]
  );

  const persistAppointmentStatus = useCallback(
    async (entry: HistoryEntry, status: string) => {
      const nextStatus = toAppointmentStatus(status);
      const appointmentId = getLinkedAppointmentId(entry);
      /* v8 ignore next -- unreachable else: the pill is only editable when getLinkedAppointmentId resolves an id, so appointmentId is always truthy here */
      const appointment = appointmentId ? appointmentsById[appointmentId] : undefined;
      if (!nextStatus || !appointment) {
        notify('error', {
          title: 'Open appointment to change status',
          text: 'This appointment needs to be loaded before its status can be changed here.',
        });
        return;
      }
      if (!canTransitionAppointmentStatus(appointment.status, nextStatus)) {
        notify('error', {
          title: 'Status cannot be changed',
          text: getInvalidAppointmentStatusTransitionMessage(appointment.status, nextStatus),
        });
        return;
      }
      await changeAppointmentStatus(appointment as Appointment, nextStatus);
      setStatusOverrides((current) => ({ ...current, [entry.id]: nextStatus }));
      notify('success', { title: 'Appointment status updated', text: 'Status has been saved.' });
    },
    [appointmentsById, notify]
  );

  const persistTaskStatus = useCallback(
    async (entry: HistoryEntry, status: string) => {
      const nextStatus = toTaskStatus(status);
      const taskId = getLinkedId(entry, ['taskId'], 'task');
      /* v8 ignore next -- unreachable else: the pill is only editable when getLinkedId resolves a task id, so taskId is always truthy here */
      const task = taskId ? tasksById[taskId] : undefined;
      if (!nextStatus || !task) {
        notify('error', {
          title: 'Open task to change status',
          text: 'This task needs to be loaded before its status can be changed here.',
        });
        return;
      }
      if (!canTransitionTaskStatus(task.status, nextStatus)) {
        notify('error', {
          title: 'Status cannot be changed',
          text: getInvalidTaskStatusTransitionMessage(task.status, nextStatus),
        });
        return;
      }
      await changeTaskStatus({ ...(task as Task), status: nextStatus });
      setStatusOverrides((current) => ({ ...current, [entry.id]: nextStatus }));
      notify('success', { title: 'Task status updated', text: 'Status has been saved.' });
    },
    [notify, tasksById]
  );

  const handleStatusChange = useCallback(
    (entry: HistoryEntry, status: string) => {
      const persistStatus = getPersistStatusAction(
        entry.type,
        persistAppointmentStatus,
        persistTaskStatus
      );
      /* v8 ignore next -- unreachable: getPersistStatusAction returns null only for non-APPOINTMENT/TASK, but this handler only fires for those rows */
      if (!persistStatus) return;
      persistStatus(entry, status).catch((statusError) => {
        console.error('Failed to update history row status:', statusError);
        notify('error', {
          title: 'Status update failed',
          text: getStatusErrorMessage(statusError),
        });
      });
    },
    [notify, persistAppointmentStatus, persistTaskStatus]
  );

  const handleOpenResultPdf = useCallback(
    (entry: HistoryEntry) => {
      const resultId = resolveLabResultId(entry);
      /* v8 ignore next 4 -- unreachable: the Result PDF chip only renders when resolveLabResultId is truthy and a primary org is present, so this fallback never runs */
      if (!organisationId || !resultId) {
        handleOpenEntry(entry);
        return;
      }
      setPdfLoadingId(entry.id);
      getIdexxResultPdfBlob({ organisationId, resultId })
        .then((pdfBlob) => {
          const objectUrl = URL.createObjectURL(pdfBlob);
          setPdfPreview((current) => {
            if (current?.url.startsWith('blob:')) {
              URL.revokeObjectURL(current.url);
            }
            return {
              title: `IDEXX Result PDF #${resultId}`,
              url: objectUrl,
            };
          });
        })
        .catch((resultPdfError) => {
          console.error('Failed to open lab result PDF:', resultPdfError);
          notify('error', {
            title: 'Result PDF unavailable',
            text: 'Open Diagnostics to refresh or view this result.',
          });
        })
        .finally(() => {
          setPdfLoadingId((current) => (current === entry.id ? null : current));
        });
    },
    [handleOpenEntry, notify, organisationId]
  );

  const handleClosePdfPreview = useCallback(() => {
    setPdfPreview((current) => {
      if (current?.url.startsWith('blob:')) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }, []);

  const handleOpenLinkedFromDrawer = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveEntryAppointmentId(entry);
      /* v8 ignore next -- unreachable: the "Linked to" button only renders when getLinkedAppointmentLabel resolves an appointment id, so this guard never triggers from the UI */
      if (!appointmentId) return;
      if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
        onOpenAppointmentView({ label: 'info', subLabel: 'appointment' });
        setSelectedEntry(null);
        return;
      }
      navigateSameOrigin(buildAppointmentsLink(appointmentId, undefined, 'appointment'));
    },
    [activeAppointmentId, onOpenAppointmentView]
  );

  // The drawer's open action for non-document records: it reuses the row's
  // type-aware routing (lab → diagnostics, invoice → finance, task → tasks,
  // appointment/form → the appointment workspace) and dismisses the drawer so the
  // destination is not left behind an overlay when it opens in place.
  const handleViewRecord = useCallback(
    (entry: HistoryEntry) => {
      setSelectedEntry(null);
      handleOpenEntry(entry);
    },
    [handleOpenEntry]
  );

  const handleShareRecord = useCallback(
    (entry: HistoryEntry) => {
      notify('info', {
        title: 'Share to app',
        text: `“${entry.title}” will be shared to the pet parent app.`,
      });
    },
    [notify]
  );

  const handleDiscussRecord = useCallback(
    (entry: HistoryEntry) => {
      notify('info', {
        title: 'Discuss in chat',
        text: `Start a chat about “${entry.title}”.`,
      });
    },
    [notify]
  );

  const selectedResults = useMemo(
    () => (selectedEntry ? getLabResults(selectedEntry) : []),
    [selectedEntry]
  );
  const selectedLinkedLabel = useMemo(
    () => (selectedEntry ? getLinkedAppointmentLabel(selectedEntry, appointmentsById) : null),
    [selectedEntry, appointmentsById]
  );

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
      <div className={isPhoneVariant ? 'flex w-full flex-col gap-3' : 'flex w-full flex-col gap-5'}>
        <TimelineHeaderControls
          isPhoneVariant={isPhoneVariant}
          statusFilterOptions={statusFilterOptions}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortKey={sortKey}
          setSortKey={setSortKey}
          query={query}
          setQuery={setQuery}
        />

        <div
          className={
            isPhoneVariant
              ? 'flex flex-col gap-3'
              : 'flex flex-col gap-3 overflow-hidden rounded-[18px] border border-hairline bg-[var(--screen)] px-[22px] py-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[14px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[16px]">
              History
            </span>
            <div
              role="tablist"
              className={
                isPhoneVariant
                  ? 'flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                  : 'flex flex-wrap items-center gap-1.5'
              }
            >
              {historyFilters.map((filter) => {
                const active = filter.key === activeFilter;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveFilter(filter.key);
                      setStatusFilter(STATUS_FILTER_ALL);
                    }}
                    className={
                      isPhoneVariant
                        ? `${FILTER_CHIP_BASE} shrink-0 whitespace-nowrap`
                        : FILTER_CHIP_BASE
                    }
                    style={
                      active
                        ? {
                            background: 'var(--inset)',
                            border: '1px solid var(--divider)',
                            fontWeight: 700,
                            color: 'var(--ink)',
                          }
                        : {
                            border: '1px solid var(--hairline)',
                            fontWeight: 600,
                            color: 'var(--ink-muted)',
                          }
                    }
                  >
                    {filter.label}
                  </button>
                );
              })}
              {fullPageHref ? (
                <Secondary
                  href={fullPageHref}
                  text="Open full overview"
                  className="px-3 py-1.5! text-caption-1"
                />
              ) : null}
            </div>
          </div>

          {showDocumentUpload && activeFilter === 'MEDICAL_RECORDS' ? (
            <HistoryDocumentUpload companionId={companionId} onUploaded={handleDocumentUploaded} />
          ) : null}

          {getTimelineBody({
            activeFilter,
            loading,
            error,
            auditLoading,
            auditError,
            auditEntries,
            filteredEntries,
            expandedId,
            pdfLoadingId,
            selectedId: selectedEntry?.id ?? null,
            onStatusChange: handleStatusChange,
            canEditStatus,
            onToggle: handleToggleExpanded,
            onOpen: handleTimelineOpen,
            onOpenDetail: setSelectedEntry,
            onPreviewPdf: handlePreviewPdf,
            onOpenResultPdf: handleOpenResultPdf,
          })}
        </div>

        {compact && entries.length > COMPACT_MAX_ENTRIES ? (
          <div className="rounded-2xl border border-card-border bg-card-hover px-4 py-3 text-caption-1 text-text-secondary">
            Showing latest {COMPACT_MAX_ENTRIES} records in compact view. Open full overview for the
            complete timeline.
          </div>
        ) : null}

        <TimelineLoadMore
          compact={compact}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          loadHistory={loadHistory}
        />

        <PdfPreviewOverlay
          open={Boolean(pdfPreview)}
          pdfUrl={pdfPreview?.url ?? null}
          title={pdfPreview?.title ?? 'Medical record preview'}
          onClose={handleClosePdfPreview}
        />

        <HistoryRecordDrawer
          entry={selectedEntry}
          results={selectedResults}
          linkedLabel={selectedLinkedLabel}
          onClose={() => setSelectedEntry(null)}
          onDownload={handleDownloadRecord}
          onView={handleViewRecord}
          onOpenLinked={handleOpenLinkedFromDrawer}
          onShare={handleShareRecord}
          onDiscuss={handleDiscussRecord}
        />
      </div>
    </PermissionGate>
  );
};

const CompanionHistoryTimeline = (props: CompanionHistoryTimelineProps) =>
  useCompanionHistoryTimelineView(props);

export default CompanionHistoryTimeline;
