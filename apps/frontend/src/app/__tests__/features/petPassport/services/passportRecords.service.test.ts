import { postData } from '@/app/services/axios';
import {
  attestRecord,
  isValidClinicalDate,
  issuePassport,
  recordClinicalExam,
  recordImmunization,
  recordParasiteTreatment,
  recordRabiesTitration,
  requestRecordSignature,
  revokeRecord,
} from '@/app/features/petPassport/services/passportRecords.service';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  default: {},
  postData: jest.fn(),
}));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: { getState: jest.fn() } }));

const mockedPost = postData as jest.Mock;
const mockedOrgState = useOrgStore.getState as jest.Mock;

const COMPANION_BASE = '/v1/pet-passport/pms/organisation/org-1/companion/pat-1';

beforeEach(() => {
  jest.clearAllMocks();
  mockedOrgState.mockReturnValue({ primaryOrgId: 'org-1' });
  mockedPost.mockResolvedValue({ data: {} });
});

describe('clinical-record capture', () => {
  it('posts an immunization with the encounter id merged into the body', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'vac-1', vaccineName: 'Nobivac' } });

    const res = await recordImmunization('pat-1', 'enc-9', {
      vaccineType: 'RABIES',
      vaccineName: 'Nobivac',
      dateAdministered: '2026-02-14',
    });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/immunizations`, {
      encounterId: 'enc-9',
      vaccineType: 'RABIES',
      vaccineName: 'Nobivac',
      dateAdministered: '2026-02-14',
    });
    expect(res).toEqual({ id: 'vac-1', vaccineName: 'Nobivac' });
  });

  it('posts a parasite treatment to the treatments route', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'trt-1' } });

    const res = await recordParasiteTreatment('pat-1', 'enc-9', {
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Milbemax',
      treatedAt: '2026-02-14T09:30:00Z',
    });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/treatments`, {
      encounterId: 'enc-9',
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Milbemax',
      treatedAt: '2026-02-14T09:30:00Z',
    });
    expect(res).toEqual({ id: 'trt-1' });
  });

  it('posts a rabies titration to the titrations route', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'tit-1', resultIuMl: 0.7 } });

    const res = await recordRabiesTitration('pat-1', 'enc-9', {
      approvedLab: 'EU Ref Lab',
      sampleDate: '2026-02-14',
      resultIuMl: 0.7,
    });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/titrations`, {
      encounterId: 'enc-9',
      approvedLab: 'EU Ref Lab',
      sampleDate: '2026-02-14',
      resultIuMl: 0.7,
    });
    expect(res).toEqual({ id: 'tit-1', resultIuMl: 0.7 });
  });

  it('posts a clinical exam to the clinical-exams route', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'exam-1', fitForTravel: true } });

    const res = await recordClinicalExam('pat-1', 'enc-9', {
      examinedAt: '2026-02-14',
      fitForTravel: true,
      weightKg: 12.4,
    });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/clinical-exams`, {
      encounterId: 'enc-9',
      examinedAt: '2026-02-14',
      fitForTravel: true,
      weightKg: 12.4,
    });
    expect(res).toEqual({ id: 'exam-1', fitForTravel: true });
  });

  it('rejects capture when no organisation is selected', async () => {
    mockedOrgState.mockReturnValue({ primaryOrgId: null });

    await expect(
      recordImmunization('pat-1', 'enc-9', {
        vaccineType: 'CORE',
        vaccineName: 'DHPP',
        dateAdministered: '2026-02-14',
      })
    ).rejects.toThrow('No active organisation selected.');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('surfaces the API error so the caller can show the 400 message', async () => {
    mockedPost.mockRejectedValue(new Error('Invalid request body'));

    await expect(
      recordClinicalExam('pat-1', 'enc-9', { examinedAt: '2026-02-30', fitForTravel: true })
    ).rejects.toThrow('Invalid request body');
  });
});

describe('attestation actions', () => {
  it('requests a signature and returns the pending e-signature record', async () => {
    mockedPost.mockResolvedValue({
      data: { artifactId: 'art-1', status: 'IN_PROGRESS', documensoDocumentId: 'doc-7' },
    });

    const res = await requestRecordSignature('pat-1', 'art-1', {
      signatoryName: 'Dr Vet',
      signatoryLicence: 'LIC-1',
    });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/records/art-1/sign`, {
      signatoryName: 'Dr Vet',
      signatoryLicence: 'LIC-1',
    });
    expect(res.status).toBe('IN_PROGRESS');
    expect(res.documensoDocumentId).toBe('doc-7');
  });

  it('attests a record and returns the signed state', async () => {
    mockedPost.mockResolvedValue({
      data: { artifactId: 'art-1', status: 'SIGNED', signedAt: '2026-02-14T10:00:00.000Z' },
    });

    const res = await attestRecord('pat-1', 'art-1', { signatoryName: 'Dr Vet' });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/records/art-1/attest`, {
      signatoryName: 'Dr Vet',
    });
    expect(res).toEqual({
      artifactId: 'art-1',
      status: 'SIGNED',
      signedAt: '2026-02-14T10:00:00.000Z',
    });
  });

  it('defaults the attestation body to an empty object when no signatory is given', async () => {
    await attestRecord('pat-1', 'art-1');

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/records/art-1/attest`, {});
  });

  it('defaults the signature-request body to an empty object', async () => {
    await requestRecordSignature('pat-1', 'art-1');

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/records/art-1/sign`, {});
  });

  it('revokes a record with a reason and returns the void state', async () => {
    mockedPost.mockResolvedValue({ data: { artifactId: 'art-1', status: 'VOID' } });

    const res = await revokeRecord('pat-1', 'art-1', { reason: 'Recorded in error' });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/records/art-1/revoke`, {
      reason: 'Recorded in error',
    });
    expect(res).toEqual({ artifactId: 'art-1', status: 'VOID' });
  });

  it('defaults the revoke body to an empty object when no reason is given', async () => {
    await revokeRecord('pat-1', 'art-1');

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/records/art-1/revoke`, {});
  });

  it('propagates the 403 a non-veterinarian receives from an attest route', async () => {
    mockedPost.mockRejectedValue(new Error('Forbidden'));

    await expect(attestRecord('pat-1', 'art-1')).rejects.toThrow('Forbidden');
  });

  it('rejects attestation when no organisation is selected', async () => {
    mockedOrgState.mockReturnValue({ primaryOrgId: null });

    await expect(attestRecord('pat-1', 'art-1')).rejects.toThrow(
      'No active organisation selected.'
    );
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe('issuePassport', () => {
  it('posts the issuance body and returns the issuance record', async () => {
    mockedPost.mockResolvedValue({
      data: { passportNumber: 'GB-123', issueDate: '2026-02-14T00:00:00.000Z' },
    });

    const res = await issuePassport('pat-1', {
      passportNumber: 'GB-123',
      issuingCountry: 'GB',
      issuingVetName: 'Dr Vet',
    });

    expect(mockedPost).toHaveBeenCalledWith(`${COMPANION_BASE}/issue`, {
      passportNumber: 'GB-123',
      issuingCountry: 'GB',
      issuingVetName: 'Dr Vet',
    });
    expect(res.passportNumber).toBe('GB-123');
  });

  it('rejects issuance when no organisation is selected', async () => {
    mockedOrgState.mockReturnValue({ primaryOrgId: null });

    await expect(issuePassport('pat-1', { passportNumber: 'GB-123' })).rejects.toThrow(
      'No active organisation selected.'
    );
  });
});

describe('isValidClinicalDate', () => {
  it('accepts an unambiguous ISO calendar date', () => {
    expect(isValidClinicalDate('2026-02-14')).toBe(true);
  });

  it('accepts a full ISO datetime with Z or a numeric offset', () => {
    expect(isValidClinicalDate('2026-02-14T09:30:00Z')).toBe(true);
    expect(isValidClinicalDate('2026-02-14T09:30:00.500+02:00')).toBe(true);
  });

  it('rejects an impossible calendar day that Date would roll over', () => {
    // new Date('2026-02-30') silently becomes 2 March, which would put a wrong
    // date on a travel health document.
    expect(isValidClinicalDate('2026-02-30')).toBe(false);
  });

  it('rejects a datetime with no timezone', () => {
    expect(isValidClinicalDate('2026-02-14T09:30:00')).toBe(false);
  });

  it('rejects non-ISO and unparseable values', () => {
    expect(isValidClinicalDate('14/02/2026')).toBe(false);
    expect(isValidClinicalDate('')).toBe(false);
    expect(isValidClinicalDate('not-a-date')).toBe(false);
  });
});
