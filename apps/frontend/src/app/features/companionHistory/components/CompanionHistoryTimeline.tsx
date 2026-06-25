import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  LuArrowRight,
  LuCalendarPlus,
  LuCheck,
  LuChevronDown,
  LuClipboardCheck,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFileText,
  LuFlaskConical,
  LuListFilter,
  LuLoader,
  LuStethoscope,
  LuWalletCards,
  LuX,
} from 'react-icons/lu';
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
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
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
  formatCurrency,
  formatHistoryDate,
  formatHistoryDateTime,
  getPayloadNumber,
  getPayloadString,
  getPrimaryActionLabel,
} from '@/app/features/companionHistory/utils/historyFormatters';

type CompanionHistoryTimelineProps = {
  companionId: string;
  activeAppointmentId?: string;
  showDocumentUpload?: boolean;
  onOpenAppointmentView?: (intent: AppointmentViewIntent) => void;
  compact?: boolean;
  fullPageHref?: string;
};

type SortKey = 'newest' | 'oldest';
type MoneyTone = 'neutral' | 'success' | 'danger' | 'warning';
type StatusOverrides = Record<string, string>;
type PdfPreviewState = {
  title: string;
  url: string;
};

type DetailPair = {
  label: string;
  value: string;
};

type TimelineBodyProps = {
  activeFilter: HistoryFilterKey;
  loading: boolean;
  error: string | null;
  auditLoading: boolean;
  auditError: string | null;
  auditEntries: AuditTrail[];
  filteredEntries: HistoryEntry[];
  statusOverrides: StatusOverrides;
  expandedId: string | null;
  onStatusChange: (entry: HistoryEntry, nextStatus: string) => void;
  canEditStatus: (entry: HistoryEntry) => boolean;
  onToggle: (entryId: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  onOpenResultPdf: (entry: HistoryEntry) => void;
  pdfLoadingId: string | null;
};

const getTimelineBody = ({
  activeFilter,
  loading,
  error,
  auditLoading,
  auditError,
  auditEntries,
  filteredEntries,
  statusOverrides,
  expandedId,
  onStatusChange,
  canEditStatus,
  onToggle,
  onOpen,
  onPreviewPdf,
  onOpenResultPdf,
  pdfLoadingId,
}: TimelineBodyProps) => {
  if (activeFilter === 'AUDIT_TRAIL') {
    return <AuditTimeline loading={auditLoading} error={auditError} entries={auditEntries} />;
  }
  if (loading) {
    return <div className="px-4 py-8 text-body-3 text-text-secondary">Loading overview…</div>;
  }
  if (error) {
    return <HistoryEmptyState isError message={error} />;
  }
  return (
    <EmptyOrRows
      activeFilter={activeFilter}
      entries={filteredEntries}
      statusOverrides={statusOverrides}
      expandedId={expandedId}
      onStatusChange={onStatusChange}
      canEditStatus={canEditStatus}
      onToggle={onToggle}
      onOpen={onOpen}
      onPreviewPdf={onPreviewPdf}
      onOpenResultPdf={onOpenResultPdf}
      pdfLoadingId={pdfLoadingId}
    />
  );
};

const getTimelineActionIcon = (loadingPdf: boolean, expanded: boolean): React.ReactNode => {
  if (loadingPdf) return <LoadingIcon />;
  if (expanded) return <LuEyeOff aria-hidden="true" />;
  return <LuEye aria-hidden="true" />;
};

const getTimelineActionLabel = (
  loadingPdf: boolean,
  expanded: boolean,
  entryTitle: string,
  entry: HistoryEntry
): string => {
  if (loadingPdf) return `Loading ${entryTitle}`;
  if (expanded) return `Hide ${entryTitle}`;
  return getPrimaryActionLabel(entry);
};

const getPersistStatusAction = (
  entryType: HistoryEntry['type'],
  persistAppointmentStatus: (entry: HistoryEntry, nextStatus: string) => Promise<void>,
  persistTaskStatus: (entry: HistoryEntry, nextStatus: string) => Promise<void>
): ((entry: HistoryEntry, nextStatus: string) => Promise<void>) | null => {
  if (entryType === 'APPOINTMENT') return persistAppointmentStatus;
  if (entryType === 'TASK') return persistTaskStatus;
  return null;
};

const DEFAULT_FILTER: HistoryFilterKey = 'APPOINTMENT';
const COMPACT_MAX_ENTRIES = 8;
const MEDICAL_RECORD_TYPES = new Set<HistoryEntryType>(['FORM_SUBMISSION', 'DOCUMENT']);

const TAB_ICONS: Record<HistoryFilterKey, React.ReactNode> = {
  APPOINTMENT: <LuCalendarPlus size={15} aria-hidden="true" />,
  LAB_RESULT: <LuFlaskConical size={15} aria-hidden="true" />,
  MEDICAL_RECORDS: <LuFileText size={15} aria-hidden="true" />,
  TASK: <LuClipboardCheck size={15} aria-hidden="true" />,
  INVOICE: <LuWalletCards size={15} aria-hidden="true" />,
  AUDIT_TRAIL: <LuListFilter size={15} aria-hidden="true" />,
};

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
  { label: 'Checked-in', value: 'checked_in', match: ['CHECKED_IN'] },
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
  const status = String(entry.status ?? getPayloadString(entry.payload, ['status']) ?? '')
    .trim()
    .toUpperCase();
  return option.match.includes(status);
};

const LAB_STATUS_OPTIONS = [
  { name: 'Created', key: 'created' },
  { name: 'Submitted', key: 'submitted' },
  { name: 'Completed', key: 'completed' },
  { name: 'Cancelled', key: 'cancelled' },
];

const BILLING_STATUS_OPTIONS = [
  { name: 'Unpaid', key: 'no_payment' },
  { name: 'Partial', key: 'pending' },
  { name: 'Paid full', key: 'completed' },
  { name: 'Cancelled', key: 'cancelled' },
];

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
  getAllowedAppointmentStatusTransitions(normalizeStatusKey(String(status ?? ''))).length === 0;
const isTaskStatusLocked = (status?: string | null): boolean =>
  getAllowedTaskStatusTransitions(normalizeStatusKey(String(status ?? ''))).length === 0;
const getRequestedButtonLabel = (status: string): string =>
  status === 'CHECKED_IN' ? 'Start' : 'Open';

const StatusPillSelect = ({
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
      <span
        className="inline-flex h-8 w-30 items-center justify-center rounded-2xl border px-2 text-caption-1 font-medium"
        style={statusPillStyle(normalizedStatus)}
        title={formatStatusLabel(status)}
      >
        <span className="truncate whitespace-nowrap">{label}</span>
      </span>
    );
  }

  return (
    <div className="relative w-30">
      <button
        type="button"
        aria-label="Status"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-2xl border px-2 text-caption-1 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        style={statusPillStyle(normalizedStatus)}
        title={formatStatusLabel(status)}
      >
        <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
        <LuChevronDown
          size={12}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
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

const CategoryPill = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <span
    className="inline-flex h-9 w-fit max-w-full items-center gap-2 rounded-2xl border px-4 text-body-4 text-neutral-900"
    style={{
      borderColor: 'var(--Neutrals-Neutral-300, #D6D1CD)',
      background: 'var(--Neutrals-Neutral-100, #FAF8F6)',
    }}
  >
    {icon}
    <span className="truncate">{label}</span>
  </span>
);

const TABLE_HEADING_STYLE = {
  color: 'var(--Neutrals-Neutral-600, #8F8984)',
  fontFamily: 'var(--font-satoshi), "Satoshi Variable", sans-serif',
  fontSize: '12px',
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: '120%',
} satisfies React.CSSProperties;

const TABLE_DATA_STYLE = {
  color: 'var(--Neutrals-Neutral-900, #302F2E)',
  fontFamily: 'var(--font-satoshi), "Satoshi Variable", sans-serif',
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: 500,
  lineHeight: '120%',
} satisfies React.CSSProperties;

const TableHeading = ({ children }: { children?: React.ReactNode }) => (
  <div style={TABLE_HEADING_STYLE}>{children}</div>
);

const APPOINTMENT_GRID =
  'grid-cols-[minmax(140px,0.9fr)_128px_minmax(130px,0.8fr)_minmax(210px,1.25fr)_minmax(150px,1fr)_minmax(128px,0.8fr)_112px]';
const DIAGNOSTICS_GRID =
  'grid-cols-[36px_minmax(112px,0.55fr)_minmax(110px,0.55fr)_minmax(145px,0.75fr)_132px_minmax(430px,1.35fr)]';
const MEDICAL_RECORD_GRID =
  'grid-cols-[minmax(150px,0.75fr)_minmax(220px,1.2fr)_minmax(190px,1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_112px]';
const TASK_GRID =
  'grid-cols-[minmax(260px,1.15fr)_minmax(110px,0.55fr)_minmax(145px,0.75fr)_132px_112px]';
const BILLING_GRID =
  'grid-cols-[36px_minmax(170px,0.9fr)_minmax(145px,0.75fr)_minmax(145px,0.85fr)_116px_120px_132px_112px]';

const LinkedName = ({ children }: { children: React.ReactNode }) => (
  <span className="font-medium text-text-brand">{children}</span>
);

const MoneyText = ({ value, tone }: { value: string; tone: MoneyTone }) => {
  const classNameByTone: Record<MoneyTone, string> = {
    neutral: 'text-neutral-900',
    success: 'text-pill-success-text',
    danger: 'text-danger-700',
    warning: 'text-pill-warning-text',
  };
  return <span className={`font-bold ${classNameByTone[tone]}`}>{value}</span>;
};

const LoadingIcon = () => <LuLoader className="animate-spin" aria-hidden="true" />;

const TimelineMarker = ({ active }: { active: boolean }) => {
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
  if (type === 'INVOICE') return { label: 'finance', subLabel: 'summary', open: 'finance' };
  if (type === 'FORM_SUBMISSION') return { label: 'prescription', subLabel: 'forms' };
  if (type === 'APPOINTMENT') return { label: 'info', subLabel: 'appointment' };
  if (type === 'TASK') return { label: 'tasks', subLabel: 'task' };
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

const getSearchableText = (entry: HistoryEntry): string => {
  const payloadText = Object.values(entry.payload)
    .filter((value) => ['string', 'number'].includes(typeof value))
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

const getRecordCategory = (entry: HistoryEntry): string => {
  if (entry.type === 'DOCUMENT') {
    return getPayloadString(entry.payload, ['category', 'subcategory']) || 'Documents';
  }
  return getPayloadString(entry.payload, ['formCategory', 'category', 'soapSubtype']) || 'SOAP';
};

const getRecordIcon = (entry: HistoryEntry) =>
  entry.type === 'DOCUMENT' ? (
    <LuFileText size={14} aria-hidden="true" />
  ) : (
    <LuStethoscope size={14} aria-hidden="true" />
  );

const getCreatedBy = (entry: HistoryEntry): string =>
  getPayloadString(entry.payload, [
    'createdByName',
    'submittedByName',
    'leadName',
    'leadVetName',
  ]) ||
  entry.actor?.name ||
  '-';

const getModifiedBy = (entry: HistoryEntry): string =>
  getPayloadString(entry.payload, ['modifiedByName', 'updatedByName', 'lastModifiedByName']) ||
  getCreatedBy(entry);

const getPaymentTone = (entry: HistoryEntry): MoneyTone => {
  const status = String(
    entry.status ?? getPayloadString(entry.payload, ['paymentStatus', 'status']) ?? ''
  )
    .trim()
    .toUpperCase();
  if (['PAID', 'PAID_FULL'].includes(status)) return 'success';
  if (['UNPAID', 'OVERDUE', 'AWAITING_PAYMENT'].includes(status)) return 'danger';
  if (['PARTIAL', 'PARTIALLY_PAID'].includes(status)) return 'warning';
  return 'neutral';
};

const getEntryAmount = (entry: HistoryEntry): string => {
  const amount = getPayloadNumber(entry.payload, [
    'totalAmount',
    'amount',
    'outstandingAmount',
    'total',
  ]);
  const currency = getPayloadString(entry.payload, ['currency']);
  return formatCurrency(amount, currency) || '-';
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
    return value.map(asRecord).filter(Boolean) as Record<string, unknown>[];
  }
  return [];
};

const getLabResults = (entry: HistoryEntry): DetailPair[] => {
  const rows = getRecordArray(entry.payload, ['results', 'tests', 'observations']);
  return rows.slice(0, 6).map((row, index) => ({
    label: getPayloadString(row, ['test', 'name', 'display']) || `Result ${index + 1}`,
    value: [
      getPayloadString(row, ['value', 'result']),
      getPayloadString(row, ['unit']),
      getPayloadString(row, ['reference', 'referenceRange']),
    ]
      .filter(Boolean)
      .join(' / '),
  }));
};

const StructuredResultsPanel = ({
  entry,
  results,
}: {
  entry: HistoryEntry;
  results: DetailPair[];
}) => (
  <div className="mt-4 rounded-2xl border border-card-border px-6 py-4">
    <div className="grid grid-cols-[minmax(220px,1fr)_160px_160px_120px] gap-4">
      <span style={TABLE_HEADING_STYLE}>Test</span>
      <span style={TABLE_HEADING_STYLE}>Value</span>
      <span style={TABLE_HEADING_STYLE}>Reference</span>
      <span style={TABLE_HEADING_STYLE}>Meter</span>
    </div>
    {results.map((result) => (
      <div
        key={`${entry.id}-${result.label}`}
        className="grid grid-cols-[minmax(220px,1fr)_160px_160px_120px] gap-4 py-1.5"
        style={TABLE_DATA_STYLE}
      >
        <span className="font-bold text-neutral-900">{result.label}</span>
        <span>{result.value || '-'}</span>
        <span>{getPayloadString(entry.payload, ['referenceRange']) || '-'}</span>
        <span>N/A</span>
      </div>
    ))}
  </div>
);

type RowActionProps = {
  entry: HistoryEntry;
  expanded: boolean;
  canExpand: boolean;
  onOpen: (entry: HistoryEntry) => void;
  onToggle: (id: string) => void;
};

const RowActions = ({ entry, expanded, canExpand, onOpen, onToggle }: RowActionProps) => (
  <div className="flex items-center justify-end gap-2">
    {canExpand ? (
      <CircleIconButton
        icon={expanded ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
        label={expanded ? `Hide ${entry.title}` : `View ${entry.title}`}
        variant="dark"
        onClick={() => onToggle(entry.id)}
      />
    ) : null}
    <CircleIconButton
      icon={<LuExternalLink aria-hidden="true" />}
      label={getPrimaryActionLabel(entry)}
      variant={canExpand ? 'outline' : 'dark'}
      onClick={() => onOpen(entry)}
    />
  </div>
);

const RequestedAppointmentActions = ({
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
      <div className="flex justify-end">
        <Primary
          text={getRequestedButtonLabel(status)}
          icon={<LuArrowRight size={17} aria-hidden="true" />}
          iconPosition="right"
          onClick={() => onOpen(entry)}
        />
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <CircleIconButton
        icon={<LuCheck aria-hidden="true" />}
        label={`Accept ${entry.title}`}
        variant="dark"
        onClick={() => onStatusChange(entry, 'upcoming')}
      />
      <CircleIconButton
        icon={<LuX aria-hidden="true" />}
        label={`Reject ${entry.title}`}
        variant="danger"
        onClick={() => onStatusChange(entry, 'cancelled')}
      />
    </div>
  );
};

const AppointmentRows = ({
  entries,
  statusOverrides,
  onStatusChange,
  canEditStatus,
  onOpen,
}: {
  entries: HistoryEntry[];
  statusOverrides: StatusOverrides;
  onStatusChange: (entry: HistoryEntry, status: string) => void;
  canEditStatus: (entry: HistoryEntry) => boolean;
  onOpen: (entry: HistoryEntry) => void;
}) => (
  <div className="w-full min-w-[1100px]">
    <div className={`grid ${APPOINTMENT_GRID} items-center gap-2 border-b border-card-border p-4`}>
      <TableHeading>Date &amp; Time</TableHeading>
      <TableHeading>Status</TableHeading>
      <TableHeading>Speciality</TableHeading>
      <TableHeading>Service / Package</TableHeading>
      <TableHeading>Assigned Lead</TableHeading>
      <TableHeading>Payment status</TableHeading>
      <TableHeading>
        <span className="block text-right">Action</span>
      </TableHeading>
    </div>
    {entries.map((entry) => {
      const paymentStatus = getPayloadString(entry.payload, ['paymentStatus', 'invoiceStatus']);
      const effectiveStatus = getEffectiveStatus(entry, statusOverrides);
      return (
        <div
          key={entry.id}
          className={`grid ${APPOINTMENT_GRID} items-center gap-2 border-b border-card-border p-4 last:border-b-0`}
          style={TABLE_DATA_STYLE}
        >
          <div className="whitespace-normal text-body-4 text-neutral-900">
            {formatHistoryDateTime(entry.occurredAt)}
          </div>
          <StatusPillSelect
            status={effectiveStatus}
            options={AppointmentLabels}
            disabled={!canEditStatus(entry)}
            locked={isAppointmentStatusLocked(effectiveStatus)}
            allowedKeys={getAllowedAppointmentStatusTransitions(
              normalizeStatusKey(String(effectiveStatus))
            )}
            onChange={(status) => onStatusChange(entry, status)}
          />
          <div className="whitespace-normal break-words text-body-4 text-neutral-900">
            {getPayloadString(entry.payload, ['specialityName', 'specialtyName']) || '-'}
          </div>
          <div className="whitespace-normal break-words text-body-4 font-medium text-neutral-900">
            {getPayloadString(entry.payload, ['serviceName', 'packageName']) || entry.title}
          </div>
          <div className="whitespace-normal break-words text-body-4 text-neutral-900">
            {getPayloadString(entry.payload, ['leadName', 'leadVetName']) ||
              entry.actor?.name ||
              '-'}
          </div>
          <div className="flex flex-col gap-1 text-body-4">
            <MoneyText
              value={paymentStatus ? formatStatusLabel(paymentStatus) : '-'}
              tone={getPaymentTone(entry)}
            />
            <MoneyText value={getEntryAmount(entry)} tone={getPaymentTone(entry)} />
          </div>
          <RequestedAppointmentActions
            entry={{ ...entry, status: effectiveStatus }}
            canEdit={canEditStatus(entry)}
            onStatusChange={onStatusChange}
            onOpen={onOpen}
          />
        </div>
      );
    })}
  </div>
);

const DiagnosticsRows = ({
  entries,
  statusOverrides,
  expandedId,
  onToggle,
  onOpen,
  onPreviewPdf,
  onOpenResultPdf,
  pdfLoadingId,
}: {
  entries: HistoryEntry[];
  statusOverrides: StatusOverrides;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  onOpenResultPdf: (entry: HistoryEntry) => void;
  pdfLoadingId: string | null;
}) => (
  <div className="w-full min-w-[1180px]">
    <div className={`grid ${DIAGNOSTICS_GRID} items-center gap-3 border-b border-card-border p-4`}>
      <TableHeading />
      <TableHeading>Order ID</TableHeading>
      <TableHeading>Type</TableHeading>
      <TableHeading>Date / Time</TableHeading>
      <TableHeading>Status</TableHeading>
      <TableHeading>
        <span className="block text-right">Action</span>
      </TableHeading>
    </div>
    {entries.map((entry, index) => {
      const results = getLabResults(entry);
      const acknowledgementPdfUrl = resolveFallbackUrl(entry);
      const resultId = resolveLabResultId(entry);
      const loadingPdf = pdfLoadingId === entry.id;
      const expanded = expandedId === entry.id;
      const effectiveStatus = getEffectiveStatus(entry, statusOverrides);
      return (
        <div key={entry.id} className="border-b border-card-border p-4 last:border-b-0">
          <div className={`grid ${DIAGNOSTICS_GRID} items-center gap-3`} style={TABLE_DATA_STYLE}>
            <div className="text-body-4 text-neutral-900">{index + 1}.</div>
            <div className="whitespace-normal break-words text-body-4 text-neutral-900">
              {getPayloadString(entry.payload, ['orderId', 'accessionId']) || entry.title}
            </div>
            <CategoryPill
              icon={<LuFlaskConical size={14} aria-hidden="true" />}
              label={getPayloadString(entry.payload, ['provider', 'type']) || 'IDEXX'}
            />
            <div className="whitespace-normal text-body-4 font-medium text-pill-success-text">
              {formatHistoryDateTime(entry.occurredAt)}
            </div>
            <StatusPillSelect
              status={effectiveStatus}
              options={LAB_STATUS_OPTIONS}
              disabled
              onChange={() => undefined}
            />
            <div className="flex items-center justify-end gap-2">
              {resultId ? (
                <Secondary
                  text={loadingPdf ? 'Loading…' : 'Result PDF'}
                  icon={loadingPdf ? <LoadingIcon /> : <LuEye aria-hidden="true" />}
                  isDisabled={loadingPdf}
                  onClick={() => onOpenResultPdf(entry)}
                />
              ) : null}
              {acknowledgementPdfUrl ? (
                <Secondary
                  text="Acknowledgment PDF"
                  icon={<LuEye aria-hidden="true" />}
                  onClick={() => onPreviewPdf(entry, acknowledgementPdfUrl)}
                />
              ) : null}
              <RowActions
                entry={entry}
                expanded={expanded}
                canExpand={results.length > 0}
                onOpen={onOpen}
                onToggle={onToggle}
              />
            </div>
          </div>
          {expanded && results.length > 0 ? (
            <StructuredResultsPanel entry={entry} results={results} />
          ) : null}
        </div>
      );
    })}
  </div>
);

const MedicalRecordRows = ({
  entries,
  expandedId,
  onToggle,
  onOpen,
  onPreviewPdf,
  pdfLoadingId,
}: {
  entries: HistoryEntry[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  pdfLoadingId: string | null;
}) => (
  <div className="w-full min-w-[1140px]">
    <div
      className={`grid ${MEDICAL_RECORD_GRID} items-center gap-4 border-b border-card-border p-4`}
    >
      <TableHeading>Category</TableHeading>
      <TableHeading>Name</TableHeading>
      <TableHeading>Appointment</TableHeading>
      <TableHeading>Created</TableHeading>
      <TableHeading>Last modified</TableHeading>
      <TableHeading>
        <span className="block text-right">Action</span>
      </TableHeading>
    </div>
    {entries.map((entry) => {
      const results = getLabResults(entry);
      const pdfUrl = resolveFallbackUrl(entry);
      const expanded = expandedId === entry.id;
      const loadingPdf = pdfLoadingId === entry.id;
      const handlePrimaryAction = () => {
        if (loadingPdf) return;
        if (results.length > 0) {
          onToggle(entry.id);
          return;
        }
        if (pdfUrl) {
          onPreviewPdf(entry, pdfUrl);
          return;
        }
        onOpen(entry);
      };
      return (
        <div key={entry.id} className="border-b border-card-border p-4 last:border-b-0">
          <div
            className={`grid ${MEDICAL_RECORD_GRID} items-center gap-4`}
            style={TABLE_DATA_STYLE}
          >
            <CategoryPill icon={getRecordIcon(entry)} label={getRecordCategory(entry)} />
            <div className="whitespace-normal break-words text-body-4 text-neutral-900">
              {entry.title}
            </div>
            <div className="whitespace-normal break-words text-body-4 text-neutral-900">
              {getPayloadString(entry.payload, ['appointmentName', 'serviceName']) || '-'}
            </div>
            <div className="flex flex-col gap-1 text-body-4">
              <LinkedName>{getCreatedBy(entry)}</LinkedName>
              <span>{formatHistoryDateTime(entry.occurredAt)}</span>
            </div>
            <div className="flex flex-col gap-1 text-body-4">
              <LinkedName>{getModifiedBy(entry)}</LinkedName>
              <span>
                {formatHistoryDateTime(
                  getPayloadString(entry.payload, ['updatedAt', 'modifiedAt']) || entry.occurredAt
                )}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <CircleIconButton
                icon={getTimelineActionIcon(loadingPdf, expanded)}
                label={getTimelineActionLabel(loadingPdf, expanded, entry.title, entry)}
                variant="dark"
                disabled={loadingPdf}
                onClick={handlePrimaryAction}
              />
            </div>
          </div>
          {expanded && results.length > 0 ? (
            <StructuredResultsPanel entry={entry} results={results} />
          ) : null}
        </div>
      );
    })}
  </div>
);

const TaskRows = ({
  entries,
  statusOverrides,
  onStatusChange,
  canEditStatus,
  onOpen,
}: {
  entries: HistoryEntry[];
  statusOverrides: StatusOverrides;
  onStatusChange: (entry: HistoryEntry, status: string) => void;
  canEditStatus: (entry: HistoryEntry) => boolean;
  onOpen: (entry: HistoryEntry) => void;
}) => (
  <div className="w-full min-w-[900px]">
    <div className={`grid ${TASK_GRID} items-center gap-2 border-b border-card-border p-4`}>
      <TableHeading>Task</TableHeading>
      <TableHeading>Audience</TableHeading>
      <TableHeading>Due / Completed</TableHeading>
      <TableHeading>Status</TableHeading>
      <TableHeading>
        <span className="block text-right">Action</span>
      </TableHeading>
    </div>
    {entries.map((entry) => {
      const effectiveStatus = getEffectiveStatus(entry, statusOverrides);
      return (
        <div
          key={entry.id}
          className={`grid ${TASK_GRID} items-center gap-2 border-b border-card-border p-4 last:border-b-0`}
          style={TABLE_DATA_STYLE}
        >
          <div className="min-w-0">
            <div className="whitespace-normal break-words text-body-4 font-bold text-neutral-900">
              {entry.title}
            </div>
            {entry.summary ? (
              <div className="text-caption-1 text-text-secondary">{entry.summary}</div>
            ) : null}
          </div>
          <div className="text-body-4 text-neutral-900">
            {getPayloadString(entry.payload, ['audience']) || '-'}
          </div>
          <div className="text-body-4 text-neutral-900">
            {formatHistoryDate(
              getPayloadString(entry.payload, ['completedAt', 'dueAt']) || entry.occurredAt
            )}
          </div>
          <StatusPillSelect
            status={effectiveStatus}
            options={TaskLabels}
            disabled={!canEditStatus(entry)}
            locked={isTaskStatusLocked(effectiveStatus)}
            allowedKeys={getAllowedTaskStatusTransitions(
              normalizeStatusKey(String(effectiveStatus))
            )}
            onChange={(status) => onStatusChange(entry, status)}
          />
          <RowActions
            entry={entry}
            expanded={false}
            canExpand={false}
            onOpen={onOpen}
            onToggle={() => undefined}
          />
        </div>
      );
    })}
  </div>
);

const isPaidInvoice = (entry: HistoryEntry): boolean => {
  const status = String(entry.status ?? getPayloadString(entry.payload, ['status']) ?? '')
    .trim()
    .toUpperCase();
  return ['PAID', 'PAID_FULL', 'COMPLETED'].includes(status);
};

const BillingRows = ({
  entries,
  statusOverrides,
  onOpen,
  onPreviewPdf,
}: {
  entries: HistoryEntry[];
  statusOverrides: StatusOverrides;
  onOpen: (entry: HistoryEntry) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
}) => (
  <div className="w-full min-w-[1120px]">
    <div className={`grid ${BILLING_GRID} items-center gap-3 border-b border-card-border p-4`}>
      <TableHeading />
      <TableHeading>Invoice ID</TableHeading>
      <TableHeading>Created</TableHeading>
      <TableHeading>Billed by</TableHeading>
      <TableHeading>Total amt</TableHeading>
      <TableHeading>Outstanding</TableHeading>
      <TableHeading>Status</TableHeading>
      <TableHeading>
        <span className="block text-right">Action</span>
      </TableHeading>
    </div>
    {entries.map((entry, index) => {
      const effectiveStatus = getEffectiveStatus(entry, statusOverrides);
      const pdfUrl = resolveFallbackUrl(entry);
      const outstanding =
        formatCurrency(
          getPayloadNumber(entry.payload, ['outstandingAmount']),
          getPayloadString(entry.payload, ['currency'])
        ) || '$0';
      return (
        <div key={entry.id} className="border-b border-card-border p-4 last:border-b-0">
          <div className={`grid ${BILLING_GRID} items-center gap-3`} style={TABLE_DATA_STYLE}>
            <div className="text-body-4">{index + 1}.</div>
            <div className="whitespace-normal break-words text-body-4 text-neutral-900">
              {getLinkedId(entry, ['invoiceId'], 'invoice') || entry.title}
            </div>
            <div className="text-body-4 font-medium text-pill-success-text">
              {formatHistoryDateTime(entry.occurredAt)}
            </div>
            <div className="whitespace-normal break-words text-body-4 text-neutral-900">
              {getPayloadString(entry.payload, ['billedByName', 'leadName']) ||
                entry.actor?.name ||
                '-'}
            </div>
            <div className="text-body-4 text-neutral-900">{getEntryAmount(entry)}</div>
            <div className="text-body-4 text-neutral-900">{outstanding}</div>
            <StatusPillSelect
              status={effectiveStatus}
              options={BILLING_STATUS_OPTIONS}
              disabled
              onChange={() => undefined}
            />
            <div className="flex items-center justify-end gap-2">
              {isPaidInvoice(entry) && pdfUrl ? (
                <CircleIconButton
                  icon={<LuEye aria-hidden="true" />}
                  label={`Preview ${entry.title}`}
                  variant="dark"
                  onClick={() => onPreviewPdf(entry, pdfUrl)}
                />
              ) : null}
              <CircleIconButton
                icon={<LuExternalLink aria-hidden="true" />}
                label={getPrimaryActionLabel(entry)}
                variant={isPaidInvoice(entry) && pdfUrl ? 'outline' : 'dark'}
                onClick={() => onOpen(entry)}
              />
            </div>
          </div>
        </div>
      );
    })}
  </div>
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

const AuditTimeline = ({
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
    <ol className="flex flex-col px-5 py-4">
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
          <div className="mb-2 flex-1 rounded-xl border border-card-border bg-neutral-0 px-3 py-2 shadow-[0_1px_10px_0_rgba(169,163,158,0.08)]">
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

const EmptyOrRows = ({
  activeFilter,
  entries,
  statusOverrides,
  expandedId,
  onStatusChange,
  canEditStatus,
  onToggle,
  onOpen,
  onPreviewPdf,
  onOpenResultPdf,
  pdfLoadingId,
}: {
  activeFilter: HistoryFilterKey;
  entries: HistoryEntry[];
  statusOverrides: StatusOverrides;
  expandedId: string | null;
  onStatusChange: (entry: HistoryEntry, status: string) => void;
  canEditStatus: (entry: HistoryEntry) => boolean;
  onToggle: (id: string) => void;
  onOpen: (entry: HistoryEntry) => void;
  onPreviewPdf: (entry: HistoryEntry, pdfUrl: string) => void;
  onOpenResultPdf: (entry: HistoryEntry) => void;
  pdfLoadingId: string | null;
}) => {
  if (entries.length === 0) return <HistoryEmptyState />;
  if (activeFilter === 'APPOINTMENT') {
    return (
      <AppointmentRows
        entries={entries}
        statusOverrides={statusOverrides}
        onStatusChange={onStatusChange}
        canEditStatus={canEditStatus}
        onOpen={onOpen}
      />
    );
  }
  if (activeFilter === 'LAB_RESULT') {
    return (
      <DiagnosticsRows
        entries={entries}
        statusOverrides={statusOverrides}
        expandedId={expandedId}
        onToggle={onToggle}
        onOpen={onOpen}
        onPreviewPdf={onPreviewPdf}
        onOpenResultPdf={onOpenResultPdf}
        pdfLoadingId={pdfLoadingId}
      />
    );
  }
  if (activeFilter === 'MEDICAL_RECORDS') {
    return (
      <MedicalRecordRows
        entries={entries}
        expandedId={expandedId}
        onToggle={onToggle}
        onOpen={onOpen}
        onPreviewPdf={onPreviewPdf}
        pdfLoadingId={pdfLoadingId}
      />
    );
  }
  if (activeFilter === 'TASK') {
    return (
      <TaskRows
        entries={entries}
        statusOverrides={statusOverrides}
        onStatusChange={onStatusChange}
        canEditStatus={canEditStatus}
        onOpen={onOpen}
      />
    );
  }
  return (
    <BillingRows
      entries={entries}
      statusOverrides={statusOverrides}
      onOpen={onOpen}
      onPreviewPdf={onPreviewPdf}
    />
  );
};

const CompanionHistoryTimeline = ({
  companionId,
  activeAppointmentId,
  showDocumentUpload = false,
  onOpenAppointmentView,
  compact = false,
  fullPageHref,
}: CompanionHistoryTimelineProps) => {
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
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<HistoryFilterKey>(DEFAULT_FILTER);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [statusOverrides, setStatusOverrides] = useState<StatusOverrides>({});
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const historyFilters = useMemo(() => getHistoryFilters(orgType), [orgType]);
  const statusFilterOptions = useMemo(() => getStatusFilterOptions(activeFilter), [activeFilter]);

  const requestedTypes = useMemo<HistoryEntryType[] | undefined>(() => {
    if (activeFilter === 'AUDIT_TRAIL') return undefined;
    if (activeFilter === 'MEDICAL_RECORDS') return ['FORM_SUBMISSION', 'DOCUMENT'];
    return HISTORY_FILTER_TYPE_MAP[activeFilter];
  }, [activeFilter]);

  const loadHistory = useCallback(
    async (cursor: string | null, shouldReplace: boolean) => {
      if (!organisationId || !companionId) {
        setEntries([]);
        setNextCursor(null);
        return;
      }
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
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
        setEntries((prev) => appendPage(prev, response, shouldReplace));
        setNextCursor(response.nextCursor);
      } catch (historyError) {
        console.error('Failed to load companion history:', historyError);
        setError('Unable to load overview. Please try again.');
        if (shouldReplace) setEntries([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [organisationId, companionId, requestedTypes]
  );

  useLayoutEffect(() => {
    setActiveFilter(DEFAULT_FILTER);
    setQuery('');
    setExpandedId(null);
    setStatusOverrides({});
  }, [companionId, organisationId]);

  useLayoutEffect(() => {
    if (activeFilter === 'AUDIT_TRAIL') return;
    setEntries([]);
    setAuditEntries([]);
    setNextCursor(null);
    setError(null);
    setAuditError(null);
    setExpandedId(null);
    loadHistory(null, true).catch((historyError) => {
      console.error('Failed to initialize companion history:', historyError);
    });
  }, [companionId, organisationId, activeFilter, loadHistory]);

  useLayoutEffect(() => {
    if (activeFilter !== 'AUDIT_TRAIL') {
      setAuditError(null);
      return;
    }
    if (!companionId) {
      setAuditEntries([]);
      setAuditError(null);
      return;
    }
    let cancelled = false;
    setAuditLoading(true);
    setAuditError(null);
    getCompanionAuditTrail(companionId)
      .then((response) => {
        if (!cancelled) setAuditEntries(Array.isArray(response) ? response : []);
      })
      .catch((auditTrailError) => {
        if (cancelled) return;
        console.error('Failed to load companion audit trail:', auditTrailError);
        setAuditEntries([]);
        setAuditError('Unable to load audit trail. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFilter, companionId]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byTab =
      activeFilter === 'MEDICAL_RECORDS'
        ? entries.filter((entry) => MEDICAL_RECORD_TYPES.has(entry.type))
        : entries.filter((entry) => requestedTypes?.includes(entry.type));
    const bySearch = normalizedQuery
      ? byTab.filter((entry) => getSearchableText(entry).includes(normalizedQuery))
      : byTab;
    const withStatusOverrides = bySearch.map((entry) => ({
      ...entry,
      status: getEffectiveStatus(entry, statusOverrides),
    }));
    const byStatus = withStatusOverrides.filter((entry) =>
      matchesStatusFilter(entry, activeFilter, statusFilter)
    );
    const sorted = byStatus.toSorted((a, b) => {
      const delta = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      return sortKey === 'newest' ? delta : -delta;
    });
    return compact ? sorted.slice(0, COMPACT_MAX_ENTRIES) : sorted;
  }, [
    activeFilter,
    compact,
    entries,
    query,
    requestedTypes,
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
    loadHistory(null, true).catch((historyError) => {
      console.error('Failed to refresh companion history after document upload:', historyError);
    });
  }, [loadHistory]);

  const handleToggleExpanded = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

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
      return false;
    },
    [appointmentsById, tasksById]
  );

  const persistAppointmentStatus = useCallback(
    async (entry: HistoryEntry, status: string) => {
      const nextStatus = toAppointmentStatus(status);
      const appointmentId = getLinkedAppointmentId(entry);
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
  const handlePreviewPdf = (entry: HistoryEntry, url: string) => {
    if (pdfPreview?.url.startsWith('blob:')) {
      URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview({ title: entry.title || 'Medical record preview', url });
  };

  const handleOpenResultPdf = useCallback(
    (entry: HistoryEntry) => {
      const resultId = resolveLabResultId(entry);
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

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
      <div className="flex w-full flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {statusFilterOptions.length > 0 ? (
              <div className="w-44">
                <LabelDropdown
                  placeholder="Status"
                  options={statusFilterOptions.map((option) => ({
                    label: option.label,
                    value: option.value,
                  }))}
                  defaultOption={statusFilter}
                  searchable={false}
                  onSelect={(option) => setStatusFilter(option.value)}
                />
              </div>
            ) : null}
            <div className="w-42">
              <LabelDropdown
                placeholder="Sort by"
                options={SORT_OPTIONS}
                defaultOption={sortKey}
                searchable={false}
                onSelect={(option) => setSortKey(option.value as SortKey)}
              />
            </div>
          </div>
          <Search
            value={query}
            setSearch={setQuery}
            placeholder="Search by service, appointment, invoice, or records"
            label="Search overview records"
            className="ml-auto w-full! md:w-120! xl:w-128!"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-card-border bg-neutral-0">
          <div role="tablist" className="flex min-w-230 border-b border-card-border">
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
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
                    active
                      ? 'border-text-brand text-yc-14-b-primary'
                      : 'border-transparent text-yc-14-m-neutral hover:text-neutral-900'
                  }`}
                >
                  {TAB_ICONS[filter.key]}
                  {filter.key === 'MEDICAL_RECORDS' ? 'Medical Records' : filter.label}
                </button>
              );
            })}
          </div>

          {fullPageHref ? (
            <div className="border-b border-card-border px-4 py-3 text-right">
              <Secondary
                href={fullPageHref}
                text="Open full overview"
                className="px-4 py-2! text-caption-1"
              />
            </div>
          ) : null}

          {showDocumentUpload && activeFilter === 'MEDICAL_RECORDS' ? (
            <div className="border-b border-card-border p-4">
              <HistoryDocumentUpload
                companionId={companionId}
                onUploaded={handleDocumentUploaded}
              />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            {getTimelineBody({
              activeFilter,
              loading,
              error,
              auditLoading,
              auditError,
              auditEntries,
              filteredEntries,
              statusOverrides,
              expandedId,
              onStatusChange: handleStatusChange,
              canEditStatus,
              onToggle: handleToggleExpanded,
              onOpen: handleOpenEntry,
              onPreviewPdf: handlePreviewPdf,
              onOpenResultPdf: handleOpenResultPdf,
              pdfLoadingId,
            })}
          </div>
        </div>

        {compact && entries.length > COMPACT_MAX_ENTRIES ? (
          <div className="rounded-2xl border border-card-border bg-card-hover px-4 py-3 text-caption-1 text-text-secondary">
            Showing latest {COMPACT_MAX_ENTRIES} records in compact view. Open full overview for the
            complete timeline.
          </div>
        ) : null}

        {!compact && nextCursor ? (
          <button
            type="button"
            onClick={() => {
              loadHistory(nextCursor, false).catch((historyError) => {
                console.error('Failed to load more history entries:', historyError);
              });
            }}
            disabled={loadingMore}
            className="w-full rounded-2xl border border-card-border bg-neutral-0 px-4 py-2 text-caption-1 text-text-primary transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : null}

        <PdfPreviewOverlay
          open={Boolean(pdfPreview)}
          pdfUrl={pdfPreview?.url ?? null}
          title={pdfPreview?.title ?? 'Medical record preview'}
          onClose={handleClosePdfPreview}
        />
      </div>
    </PermissionGate>
  );
};

export default CompanionHistoryTimeline;
