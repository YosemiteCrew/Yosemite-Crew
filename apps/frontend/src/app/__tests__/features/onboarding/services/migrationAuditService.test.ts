import axios from 'axios';
import {
  createMigrationAuditRun,
  getMigrationAuditRun,
  getMigrationAuditUploadUrl,
  uploadMigrationAuditFile,
} from '@/app/features/onboarding/services/migrationAuditService';

const postDataMock = jest.fn();
const getDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  postData: (...args: any[]) => postDataMock(...args),
  getData: (...args: any[]) => getDataMock(...args),
  deleteData: jest.fn(),
  default: { get: jest.fn() },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { put: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getMigrationAuditUploadUrl', () => {
  it('requests a presigned upload url for the organisation', async () => {
    postDataMock.mockResolvedValue({
      data: { url: 'https://s3.example/put', key: 'orgs/org1/f.csv' },
    });

    const result = await getMigrationAuditUploadUrl('org1');

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/migration-audit/pms/organisations/org1/migration-audit/upload-url'
    );
    expect(result).toEqual({ url: 'https://s3.example/put', key: 'orgs/org1/f.csv' });
  });
});

describe('uploadMigrationAuditFile', () => {
  it('PUTs the file with the fixed text/csv content type the presigned URL was signed for, not the file mime type', async () => {
    (axios.put as jest.Mock).mockResolvedValue({});
    const file = new File(['external_id\n1'], 'owners.csv', { type: 'application/vnd.ms-excel' });

    await uploadMigrationAuditFile('https://s3.example/put', file);

    expect(axios.put).toHaveBeenCalledWith('https://s3.example/put', file, {
      headers: { 'Content-Type': 'text/csv' },
      withCredentials: false,
    });
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
});
