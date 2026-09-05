import { AxiosError } from 'axios';
import {
  fetchPatientConsent,
  fetchPatientConsents,
  grantPatientConsent,
  revokePatientConsent,
} from '@/app/features/companionHistory/services/patientConsentService';
import { getData, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CONSENT_ID = '22222222-2222-4222-8222-222222222222';
const LEGACY_ORG_ID = '507f1f77bcf86cd799439011';

let mockOrgId: string | null = ORG_ID;
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => ({ primaryOrgId: mockOrgId }) },
}));

const getMock = getData as jest.Mock;
const postMock = postData as jest.Mock;
const errorMock = logger.error as jest.Mock;
const warnMock = logger.warn as jest.Mock;

const BASE = `/v1/pms/organisation/${ORG_ID}/patient-consents`;

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId = ORG_ID;
});

describe('patientConsentService', () => {
  it('fetches consents scoped to the org and patient', async () => {
    getMock.mockResolvedValue({ data: [{ id: 'c-1' }] });
    const result = await fetchPatientConsents({ patientId: 'pat-1' });
    expect(getMock).toHaveBeenCalledWith(BASE, { patientId: 'pat-1' });
    expect(result).toEqual([{ id: 'c-1' }]);
  });

  it('passes the status and type filters when supplied', async () => {
    getMock.mockResolvedValue({ data: [] });
    await fetchPatientConsents({ patientId: 'pat-1', status: 'ACTIVE', consentType: 'SURGICAL' });
    expect(getMock).toHaveBeenCalledWith(BASE, {
      patientId: 'pat-1',
      status: 'ACTIVE',
      consentType: 'SURGICAL',
    });
  });

  it('throws when the patient id is missing', async () => {
    await expect(fetchPatientConsents({ patientId: '' })).rejects.toThrow('Patient ID missing');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('returns an empty list and logs only the response type for a malformed list', async () => {
    const payload = { message: 'unexpected object' };
    getMock.mockResolvedValue({ data: payload });
    await expect(fetchPatientConsents({ patientId: 'pat-1' })).resolves.toEqual([]);
    expect(warnMock).toHaveBeenCalledWith(expect.any(String), 'object');
    // The payload itself must never be logged (PII).
    expect(warnMock.mock.calls[0]).not.toContainEqual(payload);
  });

  it('accepts a legacy ObjectId organisation id', async () => {
    mockOrgId = LEGACY_ORG_ID;
    getMock.mockResolvedValue({ data: [] });
    await fetchPatientConsents({ patientId: 'pat-1' });
    expect(getMock).toHaveBeenCalledWith(`/v1/pms/organisation/${LEGACY_ORG_ID}/patient-consents`, {
      patientId: 'pat-1',
    });
  });

  it('fetches a single consent by id', async () => {
    getMock.mockResolvedValue({ data: { id: 'c-1' } });
    const result = await fetchPatientConsent(CONSENT_ID);
    expect(getMock).toHaveBeenCalledWith(`${BASE}/${CONSENT_ID}`);
    expect(result).toEqual({ id: 'c-1' });
  });

  it('grants a consent', async () => {
    postMock.mockResolvedValue({ data: { id: 'c-new' } });
    const input = {
      patientId: 'pat-1',
      consentType: 'SURGICAL' as const,
      procedureDesc: 'Dental extraction',
    };
    const result = await grantPatientConsent(input);
    expect(postMock).toHaveBeenCalledWith(BASE, input);
    expect(result).toEqual({ id: 'c-new' });
  });

  it('revokes a consent, defaulting the body to an empty object', async () => {
    postMock.mockResolvedValue({ data: { id: 'c-1', status: 'REVOKED' } });
    await revokePatientConsent(CONSENT_ID);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${CONSENT_ID}/revoke`, {});
  });

  it('revokes a consent with an explicit reason', async () => {
    postMock.mockResolvedValue({ data: { id: 'c-1', status: 'REVOKED' } });
    await revokePatientConsent(CONSENT_ID, 'Procedure cancelled');
    expect(postMock).toHaveBeenCalledWith(`${BASE}/${CONSENT_ID}/revoke`, {
      revokedReason: 'Procedure cancelled',
    });
  });

  it('rejects reserved characters in route ids before making a request', async () => {
    mockOrgId = 'org/1';
    await expect(fetchPatientConsents({ patientId: 'pat-1' })).rejects.toThrow(
      'Organisation ID contains unsupported characters'
    );
    await expect(grantPatientConsent({ patientId: 'pat-1', consentType: 'OTHER' })).rejects.toThrow(
      'Organisation ID contains unsupported characters'
    );

    mockOrgId = ORG_ID;
    await expect(fetchPatientConsent('../consent')).rejects.toThrow(
      'Consent ID contains unsupported characters'
    );
    await expect(revokePatientConsent('../consent')).rejects.toThrow(
      'Consent ID contains unsupported characters'
    );
    expect(getMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('throws when no organisation is selected', async () => {
    mockOrgId = null;
    await expect(fetchPatientConsents({ patientId: 'pat-1' })).rejects.toThrow(
      'No active organisation selected.'
    );
  });

  it('logs an Axios error without a response using its message, then rethrows it', async () => {
    const error = new AxiosError('offline');
    getMock.mockRejectedValue(error);

    await expect(fetchPatientConsents({ patientId: 'pat-1' })).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load patient consents:', 'offline');
  });

  it('logs a server Axios error message without logging the response body', async () => {
    const error = new AxiosError('request failed');
    const responseData = { message: 'Unavailable', patientName: 'private' };
    error.response = { data: responseData } as never;
    getMock.mockRejectedValue(error);

    await expect(fetchPatientConsent(CONSENT_ID)).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to load patient consent:', 'Unavailable');
    expect(errorMock.mock.calls[0]).not.toContainEqual(responseData);
  });

  it('falls back to the Axios message when the response carries no message', async () => {
    const error = new AxiosError('grant failed');
    error.response = { data: {} } as never;
    postMock.mockRejectedValue(error);

    await expect(
      grantPatientConsent({ patientId: 'pat-1', consentType: 'TREATMENT' })
    ).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to grant patient consent:', 'grant failed');
  });

  it('logs and rethrows a non-Axios error', async () => {
    const error = new Error('raw');
    postMock.mockRejectedValue(error);

    await expect(revokePatientConsent(CONSENT_ID, 'because')).rejects.toBe(error);
    expect(errorMock).toHaveBeenCalledWith('Failed to revoke patient consent:', error);
  });
});
