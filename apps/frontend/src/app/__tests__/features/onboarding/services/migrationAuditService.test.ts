import {
  createMigrationAuditRun,
  getMigrationAuditRun,
  getMigrationAuditUploadUrl,
  uploadMigrationAuditFile,
} from '@/app/features/onboarding/services/migrationAuditService';
import { uploadFileToS3 } from '@/app/features/inventory/services/inventoryUploadService';

const postDataMock = jest.fn();
const getDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  postData: (...args: any[]) => postDataMock(...args),
  getData: (...args: any[]) => getDataMock(...args),
  deleteData: jest.fn(),
  default: { get: jest.fn() },
}));

jest.mock('@/app/features/inventory/services/inventoryUploadService', () => ({
  uploadFileToS3: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getMigrationAuditUploadUrl', () => {
  it('requests a presigned upload url for the organisation', async () => {
    postDataMock.mockResolvedValue({
      data: { url: 'https://bucket.s3.amazonaws.com/put', key: 'orgs/org1/f.csv' },
    });

    const result = await getMigrationAuditUploadUrl('org1');

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/migration-audit/pms/organisations/org1/migration-audit/upload-url'
    );
    expect(result).toEqual({
      url: 'https://bucket.s3.amazonaws.com/put',
      key: 'orgs/org1/f.csv',
    });
  });

  it('rejects an organisation ID that could alter the request path', async () => {
    await expect(getMigrationAuditUploadUrl('../other-org')).rejects.toThrow(
      'Invalid organisation ID'
    );
    expect(postDataMock).not.toHaveBeenCalled();
  });
});

describe('uploadMigrationAuditFile', () => {
  it('PUTs the file with the fixed text/csv content type the presigned URL was signed for, not the file mime type', async () => {
    (uploadFileToS3 as jest.Mock).mockResolvedValue(undefined);
    const file = new File(['external_id\n1'], 'owners.csv', { type: 'application/vnd.ms-excel' });

    await uploadMigrationAuditFile('https://bucket.s3.amazonaws.com/put', file);

    expect(uploadFileToS3).toHaveBeenCalledWith(
      'https://bucket.s3.amazonaws.com/put',
      expect.objectContaining({ name: 'owners.csv', type: 'text/csv' })
    );
  });

  it.each([
    'http://bucket.s3.amazonaws.com/put',
    'https://user:password@bucket.s3.amazonaws.com/put',
    'https://attacker.example/put',
  ])('rejects an unsafe presigned URL: %s', async (uploadUrl) => {
    const file = new File(['external_id\n1'], 'owners.csv', { type: 'text/csv' });

    await expect(uploadMigrationAuditFile(uploadUrl, file)).rejects.toThrow(
      'Invalid migration audit upload URL'
    );
    expect(uploadFileToS3).not.toHaveBeenCalled();
  });
});

describe('createMigrationAuditRun', () => {
  it('posts the collected source keys for the organisation', async () => {
    postDataMock.mockResolvedValue({ data: { id: 'run1', status: 'PENDING' } });

    const result = await createMigrationAuditRun('org1', { owners: 'orgs/org1/o.csv' });

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/migration-audit/pms/organisations/org1/migration-audit',
      { sourceKeys: { owners: 'orgs/org1/o.csv' } }
    );
    expect(result).toEqual({ id: 'run1', status: 'PENDING' });
  });
});

describe('getMigrationAuditRun', () => {
  it('fetches a run by id for the organisation', async () => {
    const run = {
      id: 'run1',
      status: 'COMPLETED',
      summary: null,
      errorMessage: null,
      createdAt: '2026-09-12T00:00:00.000Z',
      completedAt: '2026-09-12T00:00:05.000Z',
      outcome: { resourceType: 'OperationOutcome', issue: [] },
    };
    getDataMock.mockResolvedValue({ data: run });

    const result = await getMigrationAuditRun('org1', 'run1');

    expect(getDataMock).toHaveBeenCalledWith(
      '/v1/migration-audit/pms/organisations/org1/migration-audit/run1'
    );
    expect(result).toEqual(run);
  });

  it('rejects a run ID that could alter the request path', async () => {
    await expect(getMigrationAuditRun('org1', '../other-run')).rejects.toThrow(
      'Invalid migration audit run ID'
    );
    expect(getDataMock).not.toHaveBeenCalled();
  });
});
