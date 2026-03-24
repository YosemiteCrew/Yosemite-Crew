import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useOrgStore } from '@/app/stores/orgStore';
import Fallback from '@/app/ui/overlays/Fallback';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { loadDocumentDownloadURL } from '@/app/features/companions/services/companionDocumentService';
import HistoryEntryCard from '@/app/features/companionHistory/components/HistoryEntryCard';
import HistoryFilters from '@/app/features/companionHistory/components/HistoryFilters';
import HistoryEmptyState from '@/app/features/companionHistory/components/HistoryEmptyState';
import HistoryDocumentUpload from '@/app/features/companionHistory/components/HistoryDocumentUpload';
import {
  CompanionHistoryResponse,
  HISTORY_FILTER_TYPE_MAP,
  HistoryEntry,
  HistoryFilterKey,
} from '@/app/features/companionHistory/types/history';
import { fetchCompanionHistory } from '@/app/features/companionHistory/services/companionHistoryService';

type CompanionHistoryTimelineProps = {
  companionId: string;
  activeAppointmentId?: string;
  showDocumentUpload?: boolean;
  onOpenAppointmentView?: (intent: AppointmentViewIntent) => void;
};

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

const CompanionHistoryTimeline = ({
  companionId,
  activeAppointmentId,
  showDocumentUpload = false,
  onOpenAppointmentView,
}: CompanionHistoryTimelineProps) => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<HistoryFilterKey>('ALL');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

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
        });

        setEntries((prev) => appendPage(prev, response, shouldReplace));
        setNextCursor(response.nextCursor);
      } catch (historyError) {
        console.error('Failed to load companion history:', historyError);
        setError('Unable to load history. Please try again.');
        if (shouldReplace) {
          setEntries([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [organisationId, companionId]
  );

  useEffect(() => {
    setEntries([]);
    setNextCursor(null);
    setError(null);
    setActiveFilter('ALL');
    loadHistory(null, true).catch((historyError) => {
      console.error('Failed to initialize companion history:', historyError);
    });
  }, [companionId, organisationId, loadHistory]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'ALL') {
      return entries;
    }
    const type = HISTORY_FILTER_TYPE_MAP[activeFilter];
    return entries.filter((entry) => entry.type === type);
  }, [entries, activeFilter]);

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

      const payloadUrl = entry.payload.pdfUrl;
      const fallbackUrl = entry.payload.url;
      const resolvedUrl =
        typeof payloadUrl === 'string' && payloadUrl.trim()
          ? payloadUrl
          : typeof fallbackUrl === 'string' && fallbackUrl.trim()
            ? fallbackUrl
            : null;

      if (resolvedUrl && globalThis.window) {
        globalThis.window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [resolveAppointmentId, activeAppointmentId, onOpenAppointmentView]
  );

  const openAppointmentLinkedEntry = useCallback(
    (entry: HistoryEntry) => {
      const appointmentId = resolveAppointmentId(entry);
      if (!appointmentId) return;

      const isActiveAppointment = appointmentId === activeAppointmentId;

      if (entry.type === 'INVOICE') {
        if (isActiveAppointment && onOpenAppointmentView) {
          onOpenAppointmentView({ label: 'finance', subLabel: 'summary' });
          return;
        }
        if (globalThis.window) {
          globalThis.window.location.assign(
            buildAppointmentsLink(appointmentId, 'finance', 'summary')
          );
        }
        return;
      }

      if (entry.type === 'FORM_SUBMISSION') {
        if (isActiveAppointment && onOpenAppointmentView) {
          onOpenAppointmentView({ label: 'prescription', subLabel: 'forms' });
          return;
        }
        if (globalThis.window) {
          globalThis.window.location.assign(buildAppointmentsLink(appointmentId));
        }
        return;
      }

      if (entry.type === 'APPOINTMENT') {
        if (isActiveAppointment && onOpenAppointmentView) {
          onOpenAppointmentView({ label: 'info', subLabel: 'appointment' });
          return;
        }
        if (globalThis.window) {
          globalThis.window.location.assign(buildAppointmentsLink(appointmentId));
        }
        return;
      }

      if (entry.type === 'TASK') {
        if (isActiveAppointment && onOpenAppointmentView) {
          onOpenAppointmentView({ label: 'tasks', subLabel: 'task' });
          return;
        }
        if (globalThis.window) {
          globalThis.window.location.assign(buildAppointmentsLink(appointmentId));
        }
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

      openAppointmentLinkedEntry(entry);
    },
    [openDocument, openLabResult, openAppointmentLinkedEntry]
  );

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="text-body-2 text-text-primary">History</div>
          <div className="text-caption-1 text-text-secondary">
            Unified medical timeline with appointments, tasks, forms, documents, labs, and finance.
          </div>
        </div>

        {showDocumentUpload ? (
          <HistoryDocumentUpload
            companionId={companionId}
            onUploaded={() => {
              loadHistory(null, true).catch((historyError) => {
                console.error('Failed to refresh history after upload:', historyError);
              });
            }}
          />
        ) : null}

        <HistoryFilters activeFilter={activeFilter} onChange={setActiveFilter} />

        {loading ? (
          <div className="rounded-2xl border border-card-border bg-white px-4 py-6 text-body-3 text-text-secondary">
            Loading history...
          </div>
        ) : null}

        {!loading && error ? <HistoryEmptyState isError message={error} /> : null}

        {!loading && !error && filteredEntries.length === 0 ? <HistoryEmptyState /> : null}

        {!loading && !error && filteredEntries.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filteredEntries.map((entry) => (
              <HistoryEntryCard key={entry.id} entry={entry} onOpen={handleOpenEntry} />
            ))}
          </div>
        ) : null}

        {!loading && !error && nextCursor ? (
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
      </div>
    </PermissionGate>
  );
};

export default CompanionHistoryTimeline;
