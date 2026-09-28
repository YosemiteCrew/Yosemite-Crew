import { getData, postData } from '@/app/services/axios';
import {
  authoriseFills,
  getFillEligibility,
} from '@/app/features/appointments/services/prescriptionFillAuthorisationService';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

const eligibility = {
  authorizationId: 'authority-1',
  version: 1,
  eligible: true,
  reasonCodes: [],
  remainingFills: 3,
  remainingQuantity: '15',
  unit: 'tablet',
  expiresAt: '2027-01-01T00:00:00.000Z',
};

describe('prescription fill authorisation service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads eligibility for an encoded organisation and prescription line', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: eligibility });

    await expect(getFillEligibility('clinic / one', 'line/one')).resolves.toEqual(eligibility);
    expect(getData).toHaveBeenCalledWith(
      '/v1/prescriptions/organisations/clinic%20%2F%20one/items/line%2Fone/fill-eligibility'
    );
  });

  it('propagates eligibility read failures', async () => {
    const failure = new Error('offline');
    (getData as jest.Mock).mockRejectedValue(failure);

    await expect(getFillEligibility('clinic-1', 'line-1')).rejects.toBe(failure);
  });

  it('posts the exact authorisation terms without converting decimal quantity to a number', async () => {
    const authority = {
      id: 'authority-1',
      version: 2,
      validUntil: eligibility.expiresAt,
      maxAdditionalFills: 2,
    };
    const input = {
      validUntil: eligibility.expiresAt,
      maxAdditionalFills: 2,
      perFillQuantity: '0.1',
      perFillQuantityUnit: 'mL',
    };
    (postData as jest.Mock).mockResolvedValue({ data: authority });

    await expect(authoriseFills('clinic-1', 'line-1', input)).resolves.toEqual(authority);
    expect(postData).toHaveBeenCalledWith(
      '/v1/prescriptions/organisations/clinic-1/items/line-1/fill-authorisations',
      input
    );
  });

  it('propagates authorisation write failures', async () => {
    const failure = new Error('forbidden');
    (postData as jest.Mock).mockRejectedValue(failure);

    await expect(
      authoriseFills('clinic-1', 'line-1', {
        validUntil: eligibility.expiresAt,
        maxAdditionalFills: 2,
        perFillQuantity: '5',
        perFillQuantityUnit: 'tablet',
      })
    ).rejects.toBe(failure);
  });
});
