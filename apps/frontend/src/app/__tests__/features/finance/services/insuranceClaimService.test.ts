import {
  getClaimErrorMessage,
  listInsuranceClaims,
  getInsuranceClaim,
  createInsuranceClaim,
  updateInsuranceClaim,
  submitInsuranceClaim,
  updateInsuranceClaimStatus,
  cancelInsuranceClaim,
} from '@/app/features/finance/services/insuranceClaimService';
import type { InsuranceClaim } from '@/app/features/finance/types/insuranceClaim';

const getData = jest.fn();
const postData = jest.fn();
const putData = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...a: unknown[]) => getData(...a),
  postData: (...a: unknown[]) => postData(...a),
  putData: (...a: unknown[]) => putData(...a),
}));

const claim: InsuranceClaim = {
  id: 'c-1',
  organisationId: 'org-1',
  patientId: 'p-1',
  invoiceId: null,
  encounterId: null,
  insurerName: 'Acme Pet',
  policyNumber: 'PN-1',
  claimNumber: null,
  submittedAmount: 45.5,
  approvedAmount: null,
  paidAmount: null,
  currency: 'GBP',
  status: 'DRAFT',
  submittedAt: null,
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  notes: null,
  externalClaimRef: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
};

const BASE = '/v1/pms/organisation/org-1/insurance-claims';

describe('insuranceClaimService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getClaimErrorMessage', () => {
    it('prefers the API message', () => {
      const err = { response: { data: { message: '  claim exists  ' } } };
      expect(getClaimErrorMessage(err, 'fb')).toBe('claim exists');
    });
    it('falls back to the Error message', () => {
      expect(getClaimErrorMessage(new Error('  boom  '), 'fb')).toBe('boom');
    });
    it('falls back to the provided default', () => {
      expect(getClaimErrorMessage({ response: { data: {} } }, 'fb')).toBe('fb');
      expect(getClaimErrorMessage(null, 'fb')).toBe('fb');
    });
  });

  describe('listInsuranceClaims', () => {
    it('throws when the org id is missing', async () => {
      await expect(listInsuranceClaims('')).rejects.toThrow('Organisation ID missing');
      expect(getData).not.toHaveBeenCalled();
    });
    it('sends only the provided filters', async () => {
      getData.mockResolvedValue({ data: [claim] });
      await expect(
        listInsuranceClaims('org-1', { patientId: 'p-1', status: 'DRAFT', invoiceId: 'i-1' })
      ).resolves.toEqual([claim]);
      expect(getData).toHaveBeenCalledWith(BASE, {
        patientId: 'p-1',
        status: 'DRAFT',
        invoiceId: 'i-1',
      });
    });
    it('omits empty filters', async () => {
      getData.mockResolvedValue({ data: [claim] });
      await listInsuranceClaims('org-1');
      expect(getData).toHaveBeenCalledWith(BASE, {});
    });
    it('guards against a non-array body', async () => {
      getData.mockResolvedValue({ data: { message: 'nope' } });
      await expect(listInsuranceClaims('org-1')).resolves.toEqual([]);
    });
  });

  describe('single-claim reads and writes', () => {
    beforeEach(() => {
      getData.mockResolvedValue({ data: claim });
      postData.mockResolvedValue({ data: claim });
      putData.mockResolvedValue({ data: claim });
    });

    it('gets one claim', async () => {
      await expect(getInsuranceClaim('org-1', 'c-1')).resolves.toEqual(claim);
      expect(getData).toHaveBeenCalledWith(`${BASE}/c-1`);
    });
    it('creates a claim', async () => {
      const input = {
        patientId: 'p-1',
        insurerName: 'Acme',
        policyNumber: 'PN',
        submittedAmount: 10,
      };
      await expect(createInsuranceClaim('org-1', input)).resolves.toEqual(claim);
      expect(postData).toHaveBeenCalledWith(BASE, input);
    });
    it('updates a claim', async () => {
      await expect(updateInsuranceClaim('org-1', 'c-1', { notes: 'n' })).resolves.toEqual(claim);
      expect(putData).toHaveBeenCalledWith(`${BASE}/c-1`, { notes: 'n' });
    });
    it('submits a claim', async () => {
      await expect(submitInsuranceClaim('org-1', 'c-1')).resolves.toEqual(claim);
      expect(postData).toHaveBeenCalledWith(`${BASE}/c-1/submit`, {});
    });
    it('updates the status', async () => {
      await expect(
        updateInsuranceClaimStatus('org-1', 'c-1', { status: 'SUBMITTED' })
      ).resolves.toEqual(claim);
      expect(postData).toHaveBeenCalledWith(`${BASE}/c-1/status`, { status: 'SUBMITTED' });
    });
    it('cancels a claim', async () => {
      await expect(cancelInsuranceClaim('org-1', 'c-1')).resolves.toEqual(claim);
      expect(postData).toHaveBeenCalledWith(`${BASE}/c-1/cancel`, {});
    });
    it('encodes ids that carry a reserved character', async () => {
      await getInsuranceClaim('org/1', 'c 1');
      expect(getData).toHaveBeenCalledWith('/v1/pms/organisation/org%2F1/insurance-claims/c%201');
    });
    it('rejects a write without an org id', async () => {
      await expect(getInsuranceClaim('', 'c-1')).rejects.toThrow('Organisation ID missing');
    });
  });
});
