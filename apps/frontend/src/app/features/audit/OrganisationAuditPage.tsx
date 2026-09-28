'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IoDownloadOutline } from 'react-icons/io5';
import { useOrgStore } from '@/app/stores/orgStore';
import { getOrganisationAuditTrail } from '@/app/features/audit/services/auditService';
import type { OrganisationAuditEntry } from '@/app/features/audit/types/audit';
import { organisationAuditCsv } from '@/app/features/audit/organisationAuditCsv';
import {
  getAuditActorLabel,
  getAuditEventLabel,
  getAuditRecordLabel,
} from '@/app/features/audit/auditPresentation';
import { formatDateTimeLocal } from '@/app/lib/date';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import Fallback from '@/app/ui/overlays/Fallback';
import { Primary } from '@/app/ui/primitives/Buttons';

const PAGE_SIZE = 50;
const cellClass = 'px-4 py-3 text-left align-top text-body-4 text-text-primary';

const downloadCsv = (entries: OrganisationAuditEntry[]) => {
  const blob = new Blob([organisationAuditCsv(entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'organisation-audit.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const OrganisationAuditContent = () => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const [feed, setFeed] = useState<{
    organisationId: string | null;
    entries: OrganisationAuditEntry[];
    nextCursor: string | null;
    loading: boolean;
    loadingMore: boolean;
    error: boolean;
  }>({
    organisationId: null,
    entries: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: false,
  });
  const generation = useRef(0);

  const load = useCallback(
    async (cursor?: string) => {
      const requestGeneration = generation.current;
      const requestedOrganisationId = organisationId;
      setFeed((current) => ({
        organisationId: requestedOrganisationId,
        entries: current.organisationId === requestedOrganisationId ? current.entries : [],
        nextCursor: current.organisationId === requestedOrganisationId ? current.nextCursor : null,
        loading: !cursor,
        loadingMore: Boolean(cursor),
        error: false,
      }));
      try {
        const page = await getOrganisationAuditTrail({ cursor, limit: PAGE_SIZE });
        if (requestGeneration !== generation.current) return;
        setFeed((current) => ({
          organisationId: requestedOrganisationId,
          entries: cursor ? [...current.entries, ...page.entries] : page.entries,
          nextCursor: page.nextCursor,
          loading: false,
          loadingMore: false,
          error: false,
        }));
      } catch {
        if (requestGeneration !== generation.current) return;
        setFeed((current) => ({ ...current, loading: false, loadingMore: false, error: true }));
      } finally {
        if (requestGeneration === generation.current) {
          setFeed((current) => ({ ...current, loading: false, loadingMore: false }));
        }
      }
    },
    [organisationId]
  );

  useEffect(() => {
    generation.current += 1;
    const requestGeneration = generation.current;
    if (!organisationId) return;
    getOrganisationAuditTrail({ limit: PAGE_SIZE })
      .then((page) => {
        if (requestGeneration !== generation.current) return;
        setFeed({
          organisationId,
          entries: page.entries,
          nextCursor: page.nextCursor,
          loading: false,
          loadingMore: false,
          error: false,
        });
      })
      .catch(() => {
        if (requestGeneration !== generation.current) return;
        setFeed({
          organisationId,
          entries: [],
          nextCursor: null,
          loading: false,
          loadingMore: false,
          error: true,
        });
      });
    return () => {
      generation.current += 1;
    };
  }, [organisationId]);

  const currentFeed =
    feed.organisationId === organisationId
      ? feed
      : {
          entries: [],
          nextCursor: null,
          loading: Boolean(organisationId),
          loadingMore: false,
          error: false,
        };
  const { entries, nextCursor, loading, loadingMore, error } = currentFeed;
  const showEmpty = !loading && entries.length === 0 && !error;
  const showTable = !loading && entries.length > 0;

  return (
    <main className="flex flex-col gap-5 px-3 py-4 md:px-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">Audit log</h1>
          <p className="mt-1 text-body-4 text-text-secondary">
            Review activity across patient and practice records.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(entries)}
          disabled={!entries.length}
          className="inline-flex items-center gap-2 rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IoDownloadOutline size={18} aria-hidden />
          Export loaded activity
        </button>
      </header>

      <section
        className="overflow-hidden rounded-2xl border border-divider bg-neutral-0"
        aria-label="Organisation activity"
      >
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 p-5 text-body-4 text-text-primary"
          >
            <span>Activity could not be loaded.</span>
            <Primary text="Try again" onClick={() => load()} />
          </div>
        )}
        {loading && (
          <p className="p-5 text-body-4 text-text-secondary" role="status">
            Loading activity…
          </p>
        )}
        {showEmpty && (
          <p className="p-5 text-body-4 text-text-secondary">No activity to show yet.</p>
        )}
        {showTable && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse">
              <thead className="border-b border-divider bg-neutral-100">
                <tr>
                  <th className={cellClass} scope="col">
                    When
                  </th>
                  <th className={cellClass} scope="col">
                    Activity
                  </th>
                  <th className={cellClass} scope="col">
                    Updated by
                  </th>
                  <th className={cellClass} scope="col">
                    Record
                  </th>
                  <th className={cellClass} scope="col">
                    Record reference
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr className="border-b border-divider last:border-0" key={entry.id}>
                    <td className={`${cellClass} whitespace-nowrap text-text-secondary`}>
                      {formatDateTimeLocal(entry.occurredAt, '—')}
                    </td>
                    <td className={cellClass}>{getAuditEventLabel(entry.eventType)}</td>
                    <td className={cellClass}>
                      {getAuditActorLabel(entry.actorName, entry.actorType)}
                    </td>
                    <td className={cellClass}>{getAuditRecordLabel(entry.entityType)}</td>
                    <td className={`${cellClass} font-mono text-caption-2`}>{entry.patientId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {nextCursor && (
        <div className="flex justify-center">
          <Primary
            text={loadingMore ? 'Loading…' : 'Load more activity'}
            onClick={() => load(nextCursor)}
            isDisabled={loadingMore}
          />
        </div>
      )}
      <p className="text-caption-2 text-text-tertiary">
        Export includes the activity currently loaded on this page.
      </p>
    </main>
  );
};

const OrganisationAudit = () => (
  <PermissionGate allOf={[PERMISSIONS.AUDIT_VIEW_ANY]} fallback={<Fallback />}>
    <OrganisationAuditContent />
  </PermissionGate>
);

const ProtectedOrganisationAudit = () => (
  <ProtectedRoute skeleton={<PageSkeleton variant="list" />}>
    <OrgGuard skeleton={<PageSkeleton variant="list" />}>
      <OrganisationAudit />
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedOrganisationAudit;
