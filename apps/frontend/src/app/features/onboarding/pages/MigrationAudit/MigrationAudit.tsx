'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PermissionGate from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  createMigrationAuditRun,
  getMigrationAuditRun,
  getMigrationAuditUploadUrl,
  uploadMigrationAuditFile,
  type MigrationAuditFileRole,
  type MigrationAuditRun,
} from '@/app/features/onboarding/services/migrationAuditService';

import MigrationAuditUploadForm from './MigrationAuditUploadForm';
import MigrationAuditReview from './MigrationAuditReview';
import { MIGRATION_AUDIT_SECTIONS } from './migrationAuditSchema';

import './MigrationAudit.css';
import '@/app/features/organizations/styles/Organizations.css';

export const POLL_INTERVAL_MS = 2000;
const getRequiredRoles = (): MigrationAuditFileRole[] => {
  const roles: MigrationAuditFileRole[] = [];
  for (const section of MIGRATION_AUDIT_SECTIONS) {
    if (section.required) roles.push(section.role);
  }
  return roles;
};
const REQUIRED_ROLES = getRequiredRoles();

const isTerminal = (status: MigrationAuditRun['status']) =>
  status === 'COMPLETED' || status === 'FAILED';

/**
 * The chosen files, the run and the error banner all belong to the
 * organisation they were produced for, so they carry that organisation's id
 * and are read back through it. Switching organisations must never leave the
 * previous one's report on screen, nor keep polling its run id through the
 * newly selected organisation's endpoint.
 */
type AuditState = {
  orgId: string | null;
  files: Partial<Record<MigrationAuditFileRole, File>>;
  run: MigrationAuditRun | null;
  error: string | null;
};

const emptyState = (orgId: string | null): AuditState => ({
  orgId,
  files: {},
  run: null,
  error: null,
});

/**
 * Review surface for #3056's read-only migration-audit API: upload the
 * source CSVs directly to S3 via presigned URLs, create the run, poll until
 * it leaves PENDING/RUNNING, then hand the result to MigrationAuditReview.
 * Owns the upload/create/poll requests; the upload form and the review are
 * separate presentational components, same split as
 * DeveloperFormDraftImport/DraftImportForm/DraftImportReview (#3060).
 */
const MigrationAudit = () => {
  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);

  const [submitting, setSubmitting] = useState(false);
  const [stored, setStored] = useState<AuditState>(() => emptyState(primaryOrgId));
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // React re-renders before committing a state update made during render, so
  // another organisation's leftovers are dropped without ever painting and
  // without the effects below ever seeing them.
  if (stored.orgId !== primaryOrgId) {
    setStored(emptyState(primaryOrgId));
  }
  const { files, run, error } = stored;

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (!primaryOrgId || !run || isTerminal(run.status)) return;
    const orgId = primaryOrgId;
    const runId = run.id;

    const interval = setInterval(async () => {
      try {
        const refreshed = await getMigrationAuditRun(orgId, runId);
        setStored((prev) => (prev.orgId === orgId ? { ...prev, run: refreshed } : prev));
        if (isTerminal(refreshed.status)) stopPolling();
      } catch (err) {
        logger.error('Failed to poll migration audit run', err);
      }
    }, POLL_INTERVAL_MS);
    pollTimer.current = interval;

    return () => {
      clearInterval(interval);
      if (pollTimer.current === interval) pollTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only on run id/status transitions, not every `run` update the poll itself produces
  }, [primaryOrgId, run?.id, run?.status, stopPolling]);

  const handleFileChange = (role: MigrationAuditFileRole, file: File | null) => {
    const next = { ...files };
    if (file) {
      next[role] = file;
    } else {
      delete next[role];
    }
    setStored({ orgId: primaryOrgId, files: next, run, error });
  };

  const canSubmit = REQUIRED_ROLES.every((role) => Boolean(files[role]));

  const handleSubmit = async () => {
    if (!primaryOrgId || !canSubmit) return;
    // Everything this submit writes back is tagged with the organisation it
    // was started for, so a switch mid-upload leaves the result inert.
    const orgId = primaryOrgId;
    const submittedFiles = files;
    setSubmitting(true);
    setStored({ orgId, files: submittedFiles, run: null, error: null });
    try {
      const uploads = MIGRATION_AUDIT_SECTIONS.flatMap((section) => {
        const file = submittedFiles[section.role];
        if (!file) return [];
        return [{ role: section.role, file }];
      });
      const uploadedFiles = await Promise.all(
        uploads.map(async ({ role, file }) => {
          const { url, key } = await getMigrationAuditUploadUrl(orgId);
          await uploadMigrationAuditFile(url, file);
          return [role, key] as const;
        })
      );
      const sourceKeys = Object.fromEntries(uploadedFiles) as Partial<
        Record<MigrationAuditFileRole, string>
      >;

      const created = await createMigrationAuditRun(orgId, sourceKeys);
      setStored({
        orgId,
        files: submittedFiles,
        error: null,
        run: {
          id: created.id,
          status: created.status,
          summary: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
          outcome: { resourceType: 'OperationOutcome', issue: [] },
        },
      });
    } catch (err) {
      logger.error('Failed to start migration audit', err);
      setStored({
        orgId,
        files: submittedFiles,
        run: null,
        error: 'Could not start the migration audit. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNew = () => {
    stopPolling();
    setStored(emptyState(primaryOrgId));
  };

  return (
    <ProtectedRoute>
      <PermissionGate
        anyOf={[PERMISSIONS.ORG_ONBOARDING]}
        deniedResource="Migration audit"
        orgId={primaryOrgId}
      >
        <div className="OperationsWrapper">
          <div className="TitleContainer">
            <h1 className="text-heading-1 text-text-primary">Migration audit</h1>
          </div>

          <p className="text-body-3 text-text-secondary MigrationAudit-intro">
            Upload the owners, animals and appointments CSVs exported from your previous system
            (attachments optional) to preview what would come across - counts, and every missing,
            duplicate or orphaned record - before deciding whether to proceed with an import.
          </p>

          {error && (
            <p className="text-body-3 MigrationAudit-error" role="alert">
              {error}
            </p>
          )}

          {!run && (
            <MigrationAuditUploadForm
              files={files}
              onFileChange={handleFileChange}
              submitting={submitting}
              canSubmit={canSubmit}
              onSubmit={handleSubmit}
            />
          )}

          {run && <MigrationAuditReview run={run} onStartNew={handleStartNew} />}
        </div>
      </PermissionGate>
    </ProtectedRoute>
  );
};

export default MigrationAudit;
