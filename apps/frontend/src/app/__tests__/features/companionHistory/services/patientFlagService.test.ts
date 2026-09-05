import { AxiosError } from 'axios';
import {
  createPatientFlag,
  fetchPatientFlag,
  fetchPatientFlags,
  resolvePatientFlag,
  updatePatientFlag,
} from '@/app/features/companionHistory/services/patientFlagService';
import { getData, patchData, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const FLAG_ID = '22222222-2222-4222-8222-222222222222';
let mockOrgId: string | null = ORG_ID;

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => ({ primaryOrgId: mockOrgId }) },
}));

const getMock = getData as jest.Mock;
const patchMock = patchData as jest.Mock;
const postMock = postData as jest.Mock;
const errorMock = logger.error as jest.Mock;
const warnMock = logger.warn as jest.Mock;
const BASE = `/v1/pms/organisation/${ORG_ID}/patient-flags`;

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId = ORG_ID;
});

describe('patientFlagService', () => {
  it('lists active flags for a patient', async () => {
    getMock.mockResolvedValue({ data: [{ id: FLAG_ID }] });

    await expect(fetchPatientFlags({ patientId: 'patient-1', isActive: true })).resolves.toEqual([
      { id: FLAG_ID },
    ]);
    expect(getMock).toHaveBeenCalledWith(BASE, { patientId: 'patient-1', isActive: true });
  });

  it('passes every optional list filter, including false', async () => {
    getMock.mockResolvedValue({ data: [] });

    await fetchPatientFlags({ flagType: 'QUARANTINE', severity: 'CRITICAL', isActive: false });

    expect(getMock).toHaveBeenCalledWith(BASE, {
      flagType: 'QUARANTINE',
      severity: 'CRITICAL',
      isActive: false,
    });
  });

  it('returns an empty list and logs only the response type for a malformed list', async () => {
    const payload = { patientName: 'private' };
    getMock.mockResolvedValue({ data: payload });

    await expect(fetchPatientFlags()).resolves.toEqual([]);
    expect(warnMock).toHaveBeenCalledWith(expect.any(String), 'object');
    expect(warnMock.mock.calls[0]).not.toContainEqual(payload);
  });

  it('fetches one flag', async () => {
    getMock.mockResolvedValue({ data: { id: FLAG_ID } });

    await expect(fetchPatientFlag(FLAG_ID)).resolves.toEqual({ id: FLAG_ID });
    expect(getMock).toHaveBeenCalledWith(`${BASE}/${FLAG_ID}`);
  });

  it('creates a flag', async () => {
    const input = {
      patientId: 'patient-1',
      flagType: 'AGGRESSION' as const,
      severity: 'HIGH' as const,
      title: 'Use a muzzle',
    };
    postMock.mockResolvedValue({ data: { id: FLAG_ID } });

    await expect(createPatientFlag(input)).resolves.toEqual({ id: FLAG_ID });
    expect(postMock).toHaveBeenCalledWith(BASE, input);
  });

  it('updates a flag with PATCH', async () => {
    patchMock.mockResolvedValue({ data: { id: FLAG_ID, severity: 'CRITICAL' } });

    await expect(updatePatientFlag(FLAG_ID, { severity: 'CRITICAL' })).resolves.toEqual({
      id: FLAG_ID,
      severity: 'CRITICAL',
    });
    expect(patchMock).toHaveBeenCalledWith(`${BASE}/${FLAG_ID}`, { severity: 'CRITICAL' });
  });

  it('resolves a flag with an empty request body', async () => {
    postMock.mockResolvedValue({ data: { id: FLAG_ID, isActive: false } });

    await expect(resolvePatientFlag(FLAG_ID)).resolves.toEqual({ id: FLAG_ID, isActive: false });
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${FLAG_ID}/resolve`, {});
  });

  it('rejects reserved characters in route ids before making a request', async () => {
    mockOrgId = 'org/1';
    await expect(fetchPatientFlags()).rejects.toThrow('Organisation ID must be a UUID');
    await expect(
      createPatientFlag({ patientId: 'p', flagType: 'OTHER', title: 'Note' })
    ).rejects.toThrow('Organisation ID must be a UUID');

    mockOrgId = ORG_ID;
    await expect(fetchPatientFlag('f 1')).rejects.toThrow('Flag ID must be a UUID');
    await expect(updatePatientFlag('../flag', { title: 'No' })).rejects.toThrow(
      'Flag ID must be a UUID'
    );
    await expect(resolvePatientFlag('../flag')).rejects.toThrow('Flag ID must be a UUID');
    expect(getMock).not.toHaveBeenCalled();
    expect(patchMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('throws when no organisation is selected', async () => {
    mockOrgId = null;
    await expect(fetchPatientFlags()).rejects.toThrow('No active organisation selected.');
  });

  it('logs an Axios error without a response using its message, then rethrows it', async () => {
    const error = new AxiosError('offline');
    getMock.mockRejectedValue(error);

    await expect(fetchPatientFlags()).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load patient flags:', 'offline');
  });

  it('logs a server Axios error message without logging the response body', async () => {
    const error = new AxiosError('request failed');
    const responseData = { message: 'Unavailable', patientName: 'private' };
    error.response = { data: responseData } as never;
    getMock.mockRejectedValue(error);

    await expect(fetchPatientFlags()).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load patient flags:', 'Unavailable');
    expect(errorMock.mock.calls[0]).not.toContainEqual(responseData);
  });

  it('logs and rethrows a non-Axios error', async () => {
    const error = new Error('raw');
    postMock.mockRejectedValue(error);

    await expect(createPatientFlag({ patientId: 'p', flagType: 'VIP', title: 'VIP' })).rejects.toBe(
      error
    );
    expect(errorMock).toHaveBeenCalledWith('Failed to create patient flag:', error);
  });
});
