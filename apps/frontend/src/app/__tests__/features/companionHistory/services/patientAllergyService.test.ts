import {
  createPatientAllergy,
  fetchPatientAllergies,
  fetchPatientAllergy,
  resolvePatientAllergy,
  updatePatientAllergy,
} from '@/app/features/companionHistory/services/patientAllergyService';
import { getData, postData, putData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const ALLERGY_ID = '22222222-2222-4222-8222-222222222222';

let mockOrgId: string | null = ORG_ID;
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => ({ primaryOrgId: mockOrgId }) },
}));

const getMock = getData as jest.Mock;
const postMock = postData as jest.Mock;
const putMock = putData as jest.Mock;
const warnMock = logger.warn as jest.Mock;

const BASE = `/v1/pms/organisation/${ORG_ID}/patient-allergies`;

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId = ORG_ID;
});

describe('patientAllergyService', () => {
  it('fetches allergies scoped to the org and patient', async () => {
    getMock.mockResolvedValue({ data: [{ id: 'a-1' }] });
    const result = await fetchPatientAllergies({ patientId: 'pat-1' });
    expect(getMock).toHaveBeenCalledWith(BASE, { patientId: 'pat-1' });
    expect(result).toEqual([{ id: 'a-1' }]);
  });

  it('passes the status and type filters when supplied', async () => {
    getMock.mockResolvedValue({ data: [] });
    await fetchPatientAllergies({ patientId: 'pat-1', status: 'ACTIVE', allergyType: 'DRUG' });
    expect(getMock).toHaveBeenCalledWith(BASE, {
      patientId: 'pat-1',
      status: 'ACTIVE',
      allergyType: 'DRUG',
    });
  });

  it('throws when the patient id is missing', async () => {
    await expect(fetchPatientAllergies({ patientId: '' })).rejects.toThrow('Patient ID missing');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('returns [] and logs the typeof (not the payload) when the list is not an array', async () => {
    getMock.mockResolvedValue({ data: { message: 'unexpected object' } });
    const result = await fetchPatientAllergies({ patientId: 'pat-1' });
    expect(result).toEqual([]);
    expect(warnMock).toHaveBeenCalledWith(expect.any(String), 'object');
    // The payload itself must never be logged (PII).
    const loggedArgs = warnMock.mock.calls[0];
    expect(loggedArgs).not.toContainEqual({ message: 'unexpected object' });
  });

  it('fetches a single allergy by id', async () => {
    getMock.mockResolvedValue({ data: { id: 'a-1' } });
    const result = await fetchPatientAllergy(ALLERGY_ID);
    expect(getMock).toHaveBeenCalledWith(`${BASE}/${ALLERGY_ID}`);
    expect(result).toEqual({ id: 'a-1' });
  });

  it('creates an allergy', async () => {
    postMock.mockResolvedValue({ data: { id: 'a-new' } });
    const input = {
      patientId: 'pat-1',
      allergen: 'Penicillin',
      allergyType: 'DRUG' as const,
      severity: 'SEVERE' as const,
    };
    const result = await createPatientAllergy(input);
    expect(postMock).toHaveBeenCalledWith(BASE, input);
    expect(result).toEqual({ id: 'a-new' });
  });

  it('updates an allergy by id', async () => {
    putMock.mockResolvedValue({ data: { id: 'a-1', status: 'UNCONFIRMED' } });
    const result = await updatePatientAllergy(ALLERGY_ID, { status: 'UNCONFIRMED' });
    expect(putMock).toHaveBeenCalledWith(`${BASE}/${ALLERGY_ID}`, { status: 'UNCONFIRMED' });
    expect(result).toEqual({ id: 'a-1', status: 'UNCONFIRMED' });
  });

  it('resolves an allergy, defaulting the body to an empty object', async () => {
    postMock.mockResolvedValue({ data: { id: 'a-1', status: 'RESOLVED' } });
    await resolvePatientAllergy(ALLERGY_ID);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ALLERGY_ID}/resolve`, {});
  });

  it('resolves an allergy with an explicit resolved date', async () => {
    postMock.mockResolvedValue({ data: { id: 'a-1', status: 'RESOLVED' } });
    await resolvePatientAllergy(ALLERGY_ID, '2026-02-02T00:00:00.000Z');
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${ALLERGY_ID}/resolve`, {
      resolvedDate: '2026-02-02T00:00:00.000Z',
    });
  });

  it('rejects non-UUID path segments before making a request', async () => {
    mockOrgId = 'org/1';
    await expect(fetchPatientAllergies({ patientId: 'pat-1' })).rejects.toThrow(
      'Organisation ID must be a UUID'
    );
    mockOrgId = ORG_ID;
    await expect(fetchPatientAllergy('../allergy')).rejects.toThrow('Allergy ID must be a UUID');
    await expect(updatePatientAllergy('../allergy', { allergen: 'Latex' })).rejects.toThrow(
      'Allergy ID must be a UUID'
    );
    await expect(resolvePatientAllergy('../allergy')).rejects.toThrow('Allergy ID must be a UUID');
    expect(getMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('throws when no organisation is selected', async () => {
    mockOrgId = null;
    await expect(fetchPatientAllergies({ patientId: 'pat-1' })).rejects.toThrow(
      'No active organisation selected.'
    );
  });
});
