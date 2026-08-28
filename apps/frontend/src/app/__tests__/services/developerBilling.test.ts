import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
} from '@/app/services/developerBilling';
import { getData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

const getDataMock = getData as jest.Mock;
const postDataMock = postData as jest.Mock;

const sampleSubscription = {
  id: 's1',
  organisationId: 'o1',
  plan: 'free',
  status: 'active',
  stripeSubscriptionItemId: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  createdAt: null,
  updatedAt: null,
};

describe('developerBilling service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getSubscription', () => {
    it('returns the subscription from the data envelope', async () => {
      getDataMock.mockResolvedValue({ data: { data: sampleSubscription } });
      const result = await getSubscription();
      expect(result).toEqual(sampleSubscription);
      expect(getDataMock).toHaveBeenCalledWith('/v1/developers/billing');
    });
  });

  describe('createCheckoutSession', () => {
    it('posts successUrl + cancelUrl and returns the checkout URL', async () => {
      postDataMock.mockResolvedValue({
        data: { data: { url: 'https://checkout.stripe.com/x' } },
      });
      const url = await createCheckoutSession({
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      });
      expect(url).toBe('https://checkout.stripe.com/x');
      expect(postDataMock).toHaveBeenCalledWith('/v1/developers/billing/checkout', {
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      });
    });
  });

  describe('createPortalSession', () => {
    it('posts returnUrl and returns the portal URL', async () => {
      postDataMock.mockResolvedValue({
        data: { data: { url: 'https://billing.stripe.com/p' } },
      });
      const url = await createPortalSession('https://app.com/billing');
      expect(url).toBe('https://billing.stripe.com/p');
      expect(postDataMock).toHaveBeenCalledWith('/v1/developers/billing/portal', {
        returnUrl: 'https://app.com/billing',
      });
    });
  });
});
