import axios from 'axios';
import { getData, postData } from '@/app/services/axios';
import {
  createControlledSubstanceLog,
  fetchControlledSubstanceLogs,
  getControlledSubstanceErrorMessage,
} from '@/app/features/compliance/services/controlledSubstanceService';
import {
  formatAmount,
  type ControlledSubstanceLog,
  type CreateControlledSubstanceLogInput,
} from '@/app/features/compliance/types/controlledSubstance';

jest.mock('axios', () => ({ isAxiosError: jest.fn() }));
jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

const mockGetData = getData as jest.Mock;
const mockPostData = postData as jest.Mock;
const mockIsAxiosError = axios.isAxiosError as unknown as jest.Mock;

const ORG = 'org-1';

const record: ControlledSubstanceLog = {
  id: 'log-1',
  organisationId: ORG,
  patientId: null,
  encounterId: null,
  loggedAt: '2026-09-03T14:30:00.000Z',
  drug: 'Ketamine',
  deaSchedule: 'III',
  lotNumber: null,
  strength: null,
  unit: 'MG',
  amountDrawn: 2,
  amountAdministered: 1.5,
  amountWasted: 0.5,
  wastedWitness: 'Dr. Alvarez',
  balanceBefore: null,
  balanceAfter: null,
  administeredBy: 'Dr. Reyes',
  notes: null,
  createdAt: '2026-09-03T14:31:00.000Z',
  updatedAt: '2026-09-03T14:31:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAxiosError.mockReturnValue(false);
});

describe('fetchControlledSubstanceLogs', () => {
  it('requests the org path and returns the array', async () => {
    mockGetData.mockResolvedValue({ data: [record] });
    const result = await fetchControlledSubstanceLogs(ORG);
    expect(mockGetData).toHaveBeenCalledWith(
      '/v1/pms/organisation/org-1/controlled-substance-logs',
      {}
    );
    expect(result).toEqual([record]);
  });

  it('passes only the filters that are set', async () => {
    mockGetData.mockResolvedValue({ data: [] });
    await fetchControlledSubstanceLogs(ORG, {
      drug: 'keta',
      deaSchedule: 'II',
      fromDate: '2026-09-01T00:00:00.000Z',
      toDate: '2026-09-30T23:59:59.999Z',
      patientId: 'pat-1',
    });
    expect(mockGetData).toHaveBeenCalledWith(
      '/v1/pms/organisation/org-1/controlled-substance-logs',
      {
        drug: 'keta',
        deaSchedule: 'II',
        fromDate: '2026-09-01T00:00:00.000Z',
        toDate: '2026-09-30T23:59:59.999Z',
        patientId: 'pat-1',
      }
    );
  });

  it('guards a non-array response', async () => {
    mockGetData.mockResolvedValue({ data: { message: 'nope' } });
    expect(await fetchControlledSubstanceLogs(ORG)).toEqual([]);
  });

  it('throws when the organisation id is missing', async () => {
    await expect(fetchControlledSubstanceLogs('')).rejects.toThrow('Organisation ID missing');
    expect(mockGetData).not.toHaveBeenCalled();
  });
});

describe('createControlledSubstanceLog', () => {
  const payload: CreateControlledSubstanceLogInput = {
    loggedAt: '2026-09-03T14:30:00.000Z',
    drug: 'Ketamine',
    deaSchedule: 'III',
    unit: 'MG',
    amountDrawn: 2,
    amountAdministered: 1.5,
    amountWasted: 0.5,
    wastedWitness: 'Dr. Alvarez',
  };

  it('posts to the org path and returns the record', async () => {
    mockPostData.mockResolvedValue({ data: record });
    const result = await createControlledSubstanceLog(ORG, payload);
    expect(mockPostData).toHaveBeenCalledWith(
      '/v1/pms/organisation/org-1/controlled-substance-logs',
      payload
    );
    expect(result).toBe(record);
  });

  it('throws when the organisation id is missing', async () => {
    await expect(createControlledSubstanceLog('', payload)).rejects.toThrow(
      'Organisation ID missing'
    );
    expect(mockPostData).not.toHaveBeenCalled();
  });
});

describe('formatAmount', () => {
  it('renders an exact decimal without rounding it away', () => {
    expect(formatAmount(0.05)).toBe('0.05');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(-2)).toBe('-2');
  });

  it('renders an em dash for missing or non-numeric values', () => {
    expect(formatAmount(null)).toBe('—');
    expect(formatAmount(undefined)).toBe('—');
    expect(formatAmount(Number.NaN)).toBe('—');
  });
});

describe('getControlledSubstanceErrorMessage', () => {
  it('reads the message from an axios error body', () => {
    mockIsAxiosError.mockReturnValue(true);
    const err = { response: { data: { message: 'Amount wasted cannot be negative.' } } };
    expect(getControlledSubstanceErrorMessage(err, 'fallback')).toBe(
      'Amount wasted cannot be negative.'
    );
  });

  it('falls back to the Error message for a non-axios error', () => {
    expect(getControlledSubstanceErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('uses the fallback when there is nothing usable', () => {
    mockIsAxiosError.mockReturnValue(true);
    expect(getControlledSubstanceErrorMessage({ response: { data: {} } }, 'fallback')).toBe(
      'fallback'
    );
  });
});
