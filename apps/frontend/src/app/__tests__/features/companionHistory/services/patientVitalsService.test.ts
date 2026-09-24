import { AxiosError } from 'axios';
import { fetchPatientVitalsHistory } from '@/app/features/companionHistory/services/patientVitalsService';
import { getData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/services/axios', () => ({ getData: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const ORG_ID = '507f191e810c19729de860ea';
let mockOrgId: string | null = ORG_ID;

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => ({ primaryOrgId: mockOrgId }) },
}));

const getMock = getData as jest.Mock;
const errorMock = logger.error as jest.Mock;
const warnMock = logger.warn as jest.Mock;
const URL = `/v1/companion-history/pms/organisation/${ORG_ID}/companion/patient-1/vitals`;

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId = ORG_ID;
});

describe('patientVitalsService', () => {
  it('fetches the patient history', async () => {
    const entries = [{ measuredAt: '2026-01-01T00:00:00.000Z' }];
    getMock.mockResolvedValue({ data: { entries, truncated: true } });

    await expect(fetchPatientVitalsHistory('patient-1')).resolves.toEqual({
      entries,
      truncated: true,
    });
    expect(getMock).toHaveBeenCalledWith(URL);
  });

  it('treats anything but a true truncated flag as a complete list', async () => {
    getMock.mockResolvedValue({ data: { entries: [], truncated: 'yes' } });
    await expect(fetchPatientVitalsHistory('patient-1')).resolves.toEqual({
      entries: [],
      truncated: false,
    });
  });

  it.each([[null], [{ entries: 'nope' }]])('returns an empty history for %p', async (data) => {
    getMock.mockResolvedValue({ data });
    await expect(fetchPatientVitalsHistory('patient-1')).resolves.toEqual({
      entries: [],
      truncated: false,
    });
    expect(warnMock).toHaveBeenCalled();
  });

  it('rejects missing ids and unsafe path segments before requesting', async () => {
    await expect(fetchPatientVitalsHistory('')).rejects.toThrow('Patient ID missing');
    await expect(fetchPatientVitalsHistory('../x')).rejects.toThrow(
      'Patient ID contains unsupported characters'
    );
    mockOrgId = '../other';
    await expect(fetchPatientVitalsHistory('patient-1')).rejects.toThrow(
      'Organisation ID contains unsupported characters'
    );
    mockOrgId = null;
    await expect(fetchPatientVitalsHistory('patient-1')).rejects.toThrow(
      'No active organisation selected.'
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it('logs the server message of a failed request and rethrows', async () => {
    const error = new AxiosError('Request failed');
    error.response = { data: { message: 'Companion not found' } } as never;
    getMock.mockRejectedValue(error);

    await expect(fetchPatientVitalsHistory('patient-1')).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load vitals history:', 'Companion not found');
  });

  it('logs a non-HTTP failure and rethrows', async () => {
    const error = new Error('boom');
    getMock.mockRejectedValue(error);

    await expect(fetchPatientVitalsHistory('patient-1')).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load vitals history:', error);
  });
});
