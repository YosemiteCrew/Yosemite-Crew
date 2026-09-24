import { AxiosError } from 'axios';
import {
  createPocLabResult,
  fetchPocLabResults,
  type CreatePocLabResultInput,
} from '@/app/features/companionHistory/services/pocLabService';
import { getData, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/services/axios', () => ({ getData: jest.fn(), postData: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const ORG_ID = '11111111-1111-4111-8111-111111111111';
let mockOrgId: string | null = ORG_ID;

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => ({ primaryOrgId: mockOrgId }) },
}));

const getMock = getData as jest.Mock;
const postMock = postData as jest.Mock;
const errorMock = logger.error as jest.Mock;
const warnMock = logger.warn as jest.Mock;
const BASE = `/v1/pms/organisation/${ORG_ID}/poc-lab`;

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId = ORG_ID;
});

describe('pocLabService', () => {
  it('fetches patient results and passes an optional test type', async () => {
    getMock.mockResolvedValue({ data: [{ id: 'lab-1' }] });

    await expect(
      fetchPocLabResults({ patientId: 'patient-1', testType: 'BLOOD_CHEMISTRY' })
    ).resolves.toEqual([{ id: 'lab-1' }]);
    expect(getMock).toHaveBeenCalledWith(BASE, {
      patientId: 'patient-1',
      testType: 'BLOOD_CHEMISTRY',
    });
  });

  it('omits the test type when it is not supplied', async () => {
    getMock.mockResolvedValue({ data: [] });
    await fetchPocLabResults({ patientId: 'patient-1' });
    expect(getMock).toHaveBeenCalledWith(BASE, { patientId: 'patient-1' });
  });

  it('rejects missing patient and organisation ids before requesting', async () => {
    await expect(fetchPocLabResults({ patientId: '' })).rejects.toThrow('Patient ID missing');
    mockOrgId = null;
    await expect(fetchPocLabResults({ patientId: 'patient-1' })).rejects.toThrow(
      'No active organisation selected.'
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it('rejects an unsafe organisation path segment', async () => {
    mockOrgId = '../other-org';
    await expect(fetchPocLabResults({ patientId: 'patient-1' })).rejects.toThrow(
      'Organisation ID contains unsupported characters'
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it('returns an empty list and logs only the type for a malformed response', async () => {
    const payload = { patientName: 'Private' };
    getMock.mockResolvedValue({ data: payload });

    await expect(fetchPocLabResults({ patientId: 'patient-1' })).resolves.toEqual([]);
    expect(warnMock).toHaveBeenCalledWith(expect.any(String), 'object');
    expect(warnMock.mock.calls[0]).not.toContainEqual(payload);
  });

  it('logs an Axios server message and rethrows the error without logging its body', async () => {
    const error = new AxiosError('request failed');
    const responseData = { message: 'Unavailable', patientName: 'Private' };
    error.response = { data: responseData } as never;
    getMock.mockRejectedValue(error);

    await expect(fetchPocLabResults({ patientId: 'patient-1' })).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith(
      'Failed to load point-of-care lab results:',
      'Unavailable'
    );
    expect(errorMock.mock.calls[0]).not.toContainEqual(responseData);
  });

  it('falls back to the Axios message when no server message exists', async () => {
    const error = new AxiosError('offline');
    getMock.mockRejectedValue(error);

    await expect(fetchPocLabResults({ patientId: 'patient-1' })).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load point-of-care lab results:', 'offline');
  });

  it('logs and rethrows a non-Axios error', async () => {
    const error = new Error('raw');
    getMock.mockRejectedValue(error);

    await expect(fetchPocLabResults({ patientId: 'patient-1' })).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load point-of-care lab results:', error);
  });
});

describe('createPocLabResult', () => {
  const input: CreatePocLabResultInput = {
    patientId: 'patient-1',
    testType: 'CBC',
    conductedAt: '2026-09-24T08:15:00.000Z',
    results: [{ name: 'PLT', value: 38, flag: 'LL' }],
    criticalFlags: ['PLT'],
  };

  it('posts the body to the organisation poc-lab endpoint and returns the stored record', async () => {
    postMock.mockResolvedValue({ data: { id: 'lab-1' } });
    await expect(createPocLabResult(input)).resolves.toEqual({ id: 'lab-1' });
    expect(postMock).toHaveBeenCalledWith(BASE, input);
  });

  it('rejects a missing patient, a missing organisation and an unsafe organisation id', async () => {
    await expect(createPocLabResult({ ...input, patientId: '' })).rejects.toThrow(
      'Patient ID missing'
    );
    mockOrgId = null;
    await expect(createPocLabResult(input)).rejects.toThrow('No active organisation selected.');
    mockOrgId = 'org/../other';
    await expect(createPocLabResult(input)).rejects.toThrow(
      'Organisation ID contains unsupported characters'
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it('logs the server message, never the body, and rethrows', async () => {
    const error = new AxiosError('request failed');
    const responseData = { message: 'Companion not found.', patientName: 'Private' };
    error.response = { data: responseData } as never;
    postMock.mockRejectedValue(error);

    await expect(createPocLabResult(input)).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith(
      'Failed to record point-of-care lab result:',
      'Companion not found.'
    );
    expect(errorMock.mock.calls[0]).not.toContainEqual(responseData);
  });
});
