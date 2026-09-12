import axios from 'axios';
import { getData, postData } from '@/app/services/axios';
import type { OperationOutcome } from '@yosemite-crew/fhir';

export type MigrationAuditFileRole = 'owners' | 'animals' | 'appointments' | 'attachments';

export type MigrationAuditRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type MigrationAuditSectionName = 'OWNERS' | 'ANIMALS' | 'APPOINTMENTS' | 'ATTACHMENTS';

export interface MigrationAuditSectionSummary {
  status: 'ASSESSED' | 'NOT_ASSESSED';
  notAssessedReason?: string;
  totalRows: number;
  duplicateIdentifiers: number;
  orphanReferences: number;
}

export interface MigrationAuditRun {
  id: string;
  status: MigrationAuditRunStatus;
  summary: Partial<Record<MigrationAuditSectionName, MigrationAuditSectionSummary>> | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  outcome: OperationOutcome;
}

const runsBase = (organisationId: string) =>
  `/v1/migration-audit/pms/organisations/${organisationId}/migration-audit`;

export const getMigrationAuditUploadUrl = async (
  organisationId: string
): Promise<{ url: string; key: string }> => {
  const res = await postData<{ url: string; key: string }>(
    `${runsBase(organisationId)}/upload-url`
  );
  return res.data;
};

/**
 * The presigned URL's signature is bound to a fixed `text/csv` content type
 * (mintMigrationAuditUploadUrl on the backend always signs it that way) - the
 * browser's own guess at `file.type` for a .csv file is not guaranteed to
 * match, which would fail the S3 PUT with a signature mismatch. Send the
 * exact value that was signed, not the file's reported type.
 */
export const uploadMigrationAuditFile = async (uploadUrl: string, file: File): Promise<void> => {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': 'text/csv' },
    withCredentials: false,
  });
};

export const createMigrationAuditRun = async (
  organisationId: string,
  sourceKeys: Partial<Record<MigrationAuditFileRole, string>>
): Promise<{ id: string; status: MigrationAuditRunStatus }> => {
  const res = await postData<{ id: string; status: MigrationAuditRunStatus }>(
    runsBase(organisationId),
    { sourceKeys }
  );
  return res.data;
};

export const getMigrationAuditRun = async (
  organisationId: string,
  auditRunId: string
): Promise<MigrationAuditRun> => {
  const res = await getData<MigrationAuditRun>(`${runsBase(organisationId)}/${auditRunId}`);
  return res.data;
};
