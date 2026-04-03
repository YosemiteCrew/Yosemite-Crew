import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useOrgStore } from '@/app/stores/orgStore';
import Fallback from '@/app/ui/overlays/Fallback';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { PERMISSIONS } from '@/app/lib/permissions';
import { toTitle } from '@/app/lib/validators';
import { formatDateTimeLocal } from '@/app/lib/date';
import { loadDocumentDownloadURL } from '@/app/features/companions/services/companionDocumentService';
import HistoryEntryCard from '@/app/features/companionHistory/components/HistoryEntryCard';
import HistoryFilters from '@/app/features/companionHistory/components/HistoryFilters';
import HistoryEmptyState from '@/app/features/companionHistory/components/HistoryEmptyState';
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
import { Secondary } from '@/app/ui/primitives/Buttons';
import { Badge, Card } from '@/app/ui';

type CompanionHistoryTimelineProps = {
  companionId: string;
  activeAppointmentId?: string;
  showDocumentUpload?: boolean;
  onOpenAppointmentView?: (intent: AppointmentViewIntent) => void;
  compact?: boolean;
  fullPageHref?: string;
};

const COMPACT_MAX_ENTRIES = 8;

const buildAppointmentsLink = (
  appointmentId: string,
  open?: 'finance' | 'labs',
  subLabel?: string
) => {
  const params = new URLSearchParams({ appointmentId });
  if (open) {
    params.set('open', open);
  }
  if (subLabel) {
    params.set('subLabel', subLabel);
  }
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

const appendPage = (
  previous: HistoryEntry[],
  response: CompanionHistoryResponse,
  shouldReplace: boolean
) => {
  if (shouldReplace) {
    return response.entries;
  }

  const mapById = new Map<string, HistoryEntry>();
  [...previous, ...response.entries].forEach((entry) => mapById.set(entry.id, entry));
  return Array.from(mapById.values()).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
};

const resolveFallbackUrl = (entry: HistoryEntry): string | null => {
  const payloadUrl = entry.payload.pdfUrl;
  if (typeof payloadUrl === 'string' && payloadUrl.trim()) {
    return payloadUrl;
  }

  const secondaryUrl = entry.payload.url;
  if (typeof secondaryUrl === 'string' && secondaryUrl.trim()) {
    return secondaryUrl;
  }

  return null;
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
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const getLinkedEntryIntent = (
  type: HistoryEntry['type']
): {
  label: AppointmentViewIntent['label'];
  subLabel?: string;
  open?: 'finance' | 'labs';
} | null => {
  if (type === 'INVOICE') {
    return { label: 'finance', subLabel: 'summary', open: 'finance' };
  }
  if (type === 'FORM_SUBMISSION') {
    return { label: 'prescription', subLabel: 'forms' };
  }
  if (type === 'APPOINTMENT') {
    return { label: 'info', subLabel: 'appointment' };
  }
  if (type === 'TASK') {
    return { label: 'tasks', subLabel: 'task' };
  }
  return null;
};

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
  if (actorName) {
    return `${actorName} • ${actorTypeLabel}`;
  }
  return actorTypeLabel;
};

const getAuditEntityLabel = (entityType?: string | null): string => {
  const entityTypeLabelMap: Record<string, string> = {
    COMPANION_ORGANISATION: 'Companion profile',
    APPOINTMENT: 'Appointment',
    INVOICE: 'Finance',
    DOCUMENT: 'Document',
    FORM: 'Template',
  };
  const normalized = String(entityType ?? '')
    .trim()
    .toUpperCase();
  return entityTypeLabelMap[normalized] || toTitle(normalized);
};

const getAuditEntityBadgeTone = (
  entityType?: string | null
): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' => {
  const normalized = String(entityType ?? '')
    .trim()
    .toUpperCase();
  if (normalized === 'APPOINTMENT') return 'brand';
  if (normalized === 'INVOICE') return 'success';
  if (normalized === 'DOCUMENT') return 'warning';
  return 'neutral';
};

type AuditTrailSectionProps = {
  activeFilter: HistoryFilterKey;
  auditLoading: boolean;
  auditError: string | null;
  auditEntries: AuditTrail[];
};

const AuditTrailSection = ({
  activeFilter,
  auditLoading,
  auditError,
  auditEntries,
}: AuditTrailSectionProps) => {
  if (activeFilter !== 'AUDIT_TRAIL') return null;
  if (auditLoading) {
    return (
      <div className="rounded-2xl border border-card-border bg-white px-4 py-6 text-body-3 text-text-secondary">
        Loading audit trail...
      </div>
    );
  }
  if (auditError) {
    return <HistoryEmptyState isError message={auditError} />;
  }
  if (auditEntries.length === 0) {
    return <HistoryEmptyState message="No audit entries found." />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {auditEntries.map((entry, index) => (
        <Card
          key={entry.id ?? `${entry.eventType}-${entry.occurredAt}-${index}`}
          variant="default"
          className="w-full font-satoshi px-3 py-2.5 md:px-4 md:py-3"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 truncate text-body-3-emphasis text-text-primary">
                {toTitle(entry.eventType)}
              </div>
              {entry.entityType ? (
                <Badge
                  tone={getAuditEntityBadgeTone(entry.entityType)}
                  className="px-2 py-0.5 text-caption-1"
                >
                  {getAuditEntityLabel(entry.entityType)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-0.5 flex items-end justify-between gap-2">
              <div className="truncate text-caption-1 text-text-secondary">
                Updated by: {getAuditActorDisplay(entry)}
              </div>
              <div className="shrink-0 text-caption-1 text-text-secondary md:whitespace-nowrap">
                {formatDateTimeLocal(entry.occurredAt, '—')}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

type HistoryEntriesSectionProps = {
  activeFilter: HistoryFilterKey;
  loading: boolean;
  error: string | null;
  filteredEntries: HistoryEntry[];
  displayedEntries: HistoryEntry[];
  compact: boolean;
  handleOpenEntry: (entry: HistoryEntry) => void;
  nextCursor: string | null;
  loadingMore: boolean;
  loadHistory: (cursor: string | null, shouldReplace: boolean) => Promise<void>;
};

const HistoryEntriesSection = ({
  activeFilter,
  loading,
  error,
  filteredEntries,
  displayedEntries,
  compact,
  handleOpenEntry,
  nextCursor,
  loadingMore,
  loadHistory,
}: HistoryEntriesSectionProps) => {
  if (activeFilter === 'AUDIT_TRAIL') return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-card-border bg-white px-4 py-6 text-body-3 text-text-secondary">
        Loading overview...
      </div>
    );
  }
  if (error) {
    return <HistoryEmptyState isError message={error} />;
  }
  if (filteredEntries.length === 0) {
    return <HistoryEmptyState />;
  }

  return (
    <>
      {displayedEntries.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {displayedEntries.map((entry) => (
            <HistoryEntryCard key={entry.id} entry={entry} onOpen={handleOpenEntry} />
          ))}
        </div>
      ) : null}

      {compact && filteredEntries.length > COMPACT_MAX_ENTRIES ? (
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
          className="w-full rounded-2xl border border-card-border bg-white px-4 py-2 text-caption-1 text-text-primary transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </>
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
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const orgType = useOrgStore((state) => {
    if (!state.primaryOrgId) return undefined;
    return state.orgsById?.[state.primaryOrgId]?.type;
  });
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<HistoryFilterKey>('ALL');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const historyFilters = useMemo(() => getHistoryFilters(orgType), [orgType]);
  const enableInternalResultsScroll = !compact && !fullPageHref;
  const requestedTypes = useMemo<HistoryEntryType[] | undefined>(() => {
    if (activeFilter === 'ALL' || activeFilter === 'AUDIT_TRAIL') {
      return undefined;
    }

    const type = HISTORY_FILTER_TYPE_MAP[activeFilter];
    return type ? [type] : undefined;
  }, [activeFilter]);

  const resolveAppointmentId = useCallback((entry: HistoryEntry): string | null => {
    if (entry.link.appointmentId) return entry.link.appointmentId;
    const payloadAppointmentId = entry.payload.appointmentId;
    if (typeof payloadAppointmentId === 'string' && payloadAppointmentId.trim()) {
      return payloadAppointmentId;
    }
    return null;
  }, []);

  const loadHistory = useCallback(
    async (cursor: string | null, shouldReplace: boolean) => {
      if (!organisationId || !companionId) {
        setEntries([]);
        setNextCursor(null);
        return;
      }

      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetchCompanionHistory({
          organisationId,
          companionId,
          limit: 50,
          cursor,
          types: requestedTypes,
        });

        setEntries((prev) => appendPage(prev, response, shouldReplace));
        setNextCursor(response.nextCursor);
      } catch (historyError) {
        console.error('Failed to load companion history:', historyError);
        setError('Unable to load overview. Please try again.');
        if (shouldReplace) {
          setEntries([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [organisationId, companionId, requestedTypes]
  );

  useEffect(() => {
    setActiveFilter('ALL');
  }, [companionId, organisationId]);

  useEffect(() => {
    if (activeFilter === 'AUDIT_TRAIL') {
      return;
    }
    setEntries([]);
    setAuditEntries([]);
    setNextCursor(null);
    setError(null);
    setAuditError(null);
    loadHistory(null, true).catch((historyError) => {
      console.error('Failed to initialize companion history:', historyError);
    });
  }, [companionId, organisationId, activeFilter, loadHistory]);

  useEffect(() => {
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
        if (cancelled) return;
        setAuditEntries(Array.isArray(response) ? response : []);
      })
      .catch((auditTrailError) => {
        if (cancelled) return;
        console.error('Failed to load companion audit trail:', auditTrailError);
        setAuditEntries([]);
        setAuditError('Unable to load audit trail. Please try again.');
      })
      .finally(() => {
        if (cancelled) return;
        setAuditLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilter, companionId]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'ALL') {
      return entries;
    }
    if (activeFilter === 'AUDIT_TRAIL') {
      return [];
    }
    const type = HISTORY_FILTER_TYPE_MAP[activeFilter];
    return entries.filter((entry) => entry.type === type);
  }, [entries, activeFilter]);

  const displayedEntries = useMemo(
    () => (compact ? filteredEntries.slice(0, COMPACT_MAX_ENTRIES) : filteredEntries),
    [compact, filteredEntries]
  );

  const openDocument = useCallback(async (entry: HistoryEntry) => {
    const payloadDocumentId = entry.payload.documentId;
    const entryDocumentId =
      typeof payloadDocumentId === 'string' && payloadDocumentId.trim()
        ? payloadDocumentId
        : entry.link.id;

    const urls = await loadDocumentDownloadURL(entryDocumentId);
    if (urls.length > 0 && urls[0]?.url && globalThis.window) {
      globalThis.window.open(urls[0].url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const openLabResult = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveAppointmentId(entry);
      if (appointmentId) {
        if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
          onOpenAppointmentView({ label: 'labs', subLabel: 'idexx-labs' });
          return;
        }
        if (globalThis.window) {
          globalThis.window.location.assign(
            buildAppointmentsLink(appointmentId, 'labs', 'idexx-labs')
          );
          return;
        }
      }

      const resolvedUrl = resolveFallbackUrl(entry);

      if (resolvedUrl && globalThis.window) {
        globalThis.window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [resolveAppointmentId, activeAppointmentId, onOpenAppointmentView]
  );

  const openAppointmentLinkedEntry = useCallback(
    (entry: HistoryEntry) => {
      const intent = getLinkedEntryIntent(entry.type);
      if (!intent) return;

      const appointmentId = resolveAppointmentId(entry);
      if (!appointmentId) return;

      const isActiveAppointment = appointmentId === activeAppointmentId;

      if (isActiveAppointment && onOpenAppointmentView) {
        onOpenAppointmentView({ label: intent.label, subLabel: intent.subLabel });
        return;
      }

      if (globalThis.window) {
        globalThis.window.location.assign(
          buildAppointmentsLink(appointmentId, intent.open, intent.subLabel)
        );
      }
    },
    [resolveAppointmentId, activeAppointmentId, onOpenAppointmentView]
  );

  const openTaskEntry = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveAppointmentId(entry);
      if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
        onOpenAppointmentView({ label: 'tasks', subLabel: 'task' });
        return;
      }

      const taskId = getLinkedId(entry, ['taskId'], 'task');
      if (taskId && globalThis.window) {
        globalThis.window.location.assign(buildTasksLink(taskId));
        return;
      }

      if (appointmentId && globalThis.window) {
        globalThis.window.location.assign(buildAppointmentsLink(appointmentId, undefined, 'task'));
      }
    },
    [resolveAppointmentId, activeAppointmentId, onOpenAppointmentView]
  );

  const openInvoiceEntry = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveAppointmentId(entry);
      if (appointmentId === activeAppointmentId && onOpenAppointmentView) {
        onOpenAppointmentView({ label: 'finance', subLabel: 'summary' });
        return;
      }

      const invoiceId = getLinkedId(entry, ['invoiceId'], 'invoice');
      if (invoiceId && globalThis.window) {
        globalThis.window.location.assign(buildFinanceLink(invoiceId));
        return;
      }

      if (appointmentId && globalThis.window) {
        globalThis.window.location.assign(
          buildAppointmentsLink(appointmentId, 'finance', 'summary')
        );
      }
    },
    [resolveAppointmentId, activeAppointmentId, onOpenAppointmentView]
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

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
      <div
        className={
          enableInternalResultsScroll
            ? 'flex h-full min-h-0 w-full flex-col gap-4'
            : 'flex w-full flex-col gap-4'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-body-2 text-text-primary">Overview</div>
            <GlassTooltip
              content="Unified medical timeline with appointments, tasks, forms, documents, labs, and finance."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Overview info"
                className="relative top-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none text-text-secondary transition-colors hover:text-text-primary"
              >
                <IoInformationCircleOutline size={18} />
              </button>
            </GlassTooltip>
          </div>
          {fullPageHref ? (
            <Secondary
              href={fullPageHref}
              text="Open full overview"
              className="px-4 py-2! text-caption-1"
            />
          ) : null}
          {compact ? null : (
            <div className="w-full md:w-auto md:ml-auto">
              <HistoryFilters
                filters={historyFilters}
                activeFilter={activeFilter}
                onChange={setActiveFilter}
              />
            </div>
          )}
        </div>

        {compact ? (
          <HistoryFilters
            filters={historyFilters}
            activeFilter={activeFilter}
            onChange={setActiveFilter}
          />
        ) : null}

        <div
          className={
            enableInternalResultsScroll
              ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1'
              : 'flex flex-col gap-4'
          }
        >
          <AuditTrailSection
            activeFilter={activeFilter}
            auditLoading={auditLoading}
            auditError={auditError}
            auditEntries={auditEntries}
          />

          <HistoryEntriesSection
            activeFilter={activeFilter}
            loading={loading}
            error={error}
            filteredEntries={filteredEntries}
            displayedEntries={displayedEntries}
            compact={compact}
            handleOpenEntry={handleOpenEntry}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            loadHistory={loadHistory}
          />
        </div>
      </div>
    </PermissionGate>
  );
};

export default CompanionHistoryTimeline;
