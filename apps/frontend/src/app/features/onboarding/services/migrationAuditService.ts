import { getData, postData } from '@/app/services/axios';
import { uploadFileToS3 } from '@/app/features/inventory/services/inventoryUploadService';
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

const assertPathId = (value: string, label: string): string => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`Invalid ${label} ID`);
  return value;
};

const runsBase = (organisationId: string) => {
  const safeOrganisationId = assertPathId(organisationId, 'organisation');
  return `/v1/migration-audit/pms/organisations/${safeOrganisationId}/migration-audit`;
};

const assertUploadUrl = (value: string): string => {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.amazonaws.com') ||
    url.username ||
    url.password
  ) {
    throw new Error('Invalid migration audit upload URL');
  }
  return url.toString();
};

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
  const safeUploadUrl = assertUploadUrl(uploadUrl);
  const csvFile = new File([file], file.name, {
    type: 'text/csv',
    lastModified: file.lastModified,
  });
  await uploadFileToS3(safeUploadUrl, csvFile);
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
  const safeAuditRunId = assertPathId(auditRunId, 'migration audit run');
  const res = await getData<MigrationAuditRun>(`${runsBase(organisationId)}/${safeAuditRunId}`);
  return res.data;
};
