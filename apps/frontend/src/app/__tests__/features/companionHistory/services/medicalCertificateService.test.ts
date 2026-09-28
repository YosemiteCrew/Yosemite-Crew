import {
  createMedicalCertificate,
  fetchMedicalCertificates,
  issueMedicalCertificate,
  revokeMedicalCertificate,
} from '@/app/features/companionHistory/services/medicalCertificateService';
import { getData, postData } from '@/app/services/axios';

let mockOrgId: string | null = 'org/1';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: {
    getState: () => ({ primaryOrgId: mockOrgId }),
  },
}));

const getMock = getData as jest.Mock;
const postMock = postData as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId = 'org/1';
});

describe('medicalCertificateService', () => {
  it('lists certificates in the active organisation', async () => {
    getMock.mockResolvedValue({ data: [] });
    await expect(fetchMedicalCertificates('patient-1')).resolves.toEqual([]);
    expect(getMock).toHaveBeenCalledWith('/v1/pms/organisation/org%2F1/medical-certificates', {
      patientId: 'patient-1',
    });
  });

  it('rejects list requests without a patient id or active organisation', async () => {
    await expect(fetchMedicalCertificates('')).rejects.toThrow('Patient ID missing.');
    mockOrgId = null;
    await expect(fetchMedicalCertificates('patient-1')).rejects.toThrow(
      'No active organisation selected.'
    );
  });

  it('posts draft input to the collection', async () => {
    postMock.mockResolvedValue({ data: { id: 'cert-1' } });
    const input = {
      patientId: 'patient-1',
      clientId: 'client-1',
      certificateType: 'OTHER' as const,
    };
    await expect(createMedicalCertificate(input)).resolves.toEqual({ id: 'cert-1' });
    expect(postMock).toHaveBeenCalledWith(
      '/v1/pms/organisation/org%2F1/medical-certificates',
      input
    );
  });

  it('uses encoded ids for issue and revoke actions', async () => {
    postMock.mockResolvedValue({ data: { id: 'cert/1' } });
    await issueMedicalCertificate('cert/1', {});
    await revokeMedicalCertificate('cert/1', { revokedReason: 'Correction' });
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      '/v1/pms/organisation/org%2F1/medical-certificates/cert%2F1/issue',
      {}
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      '/v1/pms/organisation/org%2F1/medical-certificates/cert%2F1/revoke',
      { revokedReason: 'Correction' }
    );
  });
});
