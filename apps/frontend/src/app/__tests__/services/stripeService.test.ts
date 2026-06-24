import {
  checkStatus,
  createConnectedAccount,
  onBoardConnectedAccount,
} from '@/app/features/billing/services/stripeService';
import * as axiosService from '@/app/services/axios';
import { useCounterStore } from '@/app/stores/counterStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

describe('stripeService', () => {
  const mockErrorLogger = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    jest.clearAllMocks();
    useCounterStore.getState().clearCounters();
    useSubscriptionStore.getState().clearSubscriptions();
  });

  afterAll(() => {
    mockErrorLogger.mockRestore();
  });

  describe('checkStatus', () => {
    it('throws when orgId is missing', async () => {
      await expect(checkStatus(null)).rejects.toThrow('OrgId does not exist');
      expect(axiosService.getData).not.toHaveBeenCalled();
    });

    it('loads current finance subscription and usage snapshots', async () => {
      (axiosService.getData as jest.Mock)
        .mockResolvedValueOnce({
          data: {
            data: {
              organisationId: 'org-123',
              providerLink: {
                externalCustomerId: 'cus_123',
                externalSubscriptionId: 'sub_123',
              },
              entitlement: {
                code: 'business',
                status: 'ACTIVE',
                grantedAt: '2026-06-18T10:00:00.000Z',
              },
              usageCounter: {
                orgId: 'org-123',
                appointmentsUsed: 4,
                toolsUsed: 3,
                usersBillableCount: 2,
                freeAppointmentsLimit: 120,
                freeToolsLimit: 200,
                freeUsersLimit: 10,
              },
            },
            meta: null,
            error: null,
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ appointmentsUsed: 5 }],
            meta: null,
            error: null,
          },
        });

      const result = await checkStatus('org-123');

      expect(axiosService.getData).toHaveBeenCalledWith(
        '/v1/finance/subscriptions/current?organisationId=org-123'
      );
      expect(axiosService.getData).toHaveBeenCalledWith(
        '/v1/finance/usage-snapshots?organisationId=org-123&featureKey=appointments'
      );
      expect(result.orgBilling.plan).toBe('business');
      expect(result.orgBilling.stripeCustomerId).toBe('cus_123');
      expect(result.orgUsage.appointmentsUsed).toBe(4);
      expect(useSubscriptionStore.getState().getSubscriptionByOrgId('org-123')?.plan).toBe(
        'business'
      );
      expect(useCounterStore.getState().getCounterByOrgId('org-123')?.freeAppointmentsLimit).toBe(
        120
      );
    });

    it('falls back to free plan defaults when finance usage counter is not created yet', async () => {
      (axiosService.getData as jest.Mock)
        .mockResolvedValueOnce({
          data: {
            data: {
              organisationId: 'org-123',
              providerLink: null,
              entitlement: null,
              usageCounter: null,
              latestSnapshot: { appointmentsUsed: 2, toolsUsed: 1, seatsBillable: 1 },
            },
            meta: null,
            error: null,
          },
        })
        .mockResolvedValueOnce({ data: { data: [], meta: null, error: null } });

      const result = await checkStatus('org-123');

      expect(result.orgBilling.plan).toBe('free');
      expect(result.orgUsage).toEqual(
        expect.objectContaining({
          orgId: 'org-123',
          appointmentsUsed: 2,
          freeAppointmentsLimit: 120,
          freeToolsLimit: 200,
          freeUsersLimit: 10,
        })
      );
    });
  });

  describe('createConnectedAccount', () => {
    it('throws when orgId is missing', async () => {
      await expect(createConnectedAccount(null)).rejects.toThrow('OrgId does not exist');
      expect(axiosService.postData).not.toHaveBeenCalled();
    });

    it('returns account id from API', async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({ data: { accountId: 'acc_123' } });

      const accountId = await createConnectedAccount('org-123');

      expect(axiosService.postData).toHaveBeenCalledWith('/v1/stripe/organisation/org-123/account');
      expect(accountId).toBe('acc_123');
    });
  });

  describe('onBoardConnectedAccount', () => {
    it('throws when orgId is missing', async () => {
      await expect(onBoardConnectedAccount(null)).rejects.toThrow('OrgId does not exist');
      expect(axiosService.postData).not.toHaveBeenCalled();
    });

    it('returns client secret from API', async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({
        data: { client_secret: 'secret_123' },
      });

      const clientSecret = await onBoardConnectedAccount('org-999');

      expect(axiosService.postData).toHaveBeenCalledWith(
        '/v1/stripe/organisation/org-999/onboarding'
      );
      expect(clientSecret).toBe('secret_123');
    });
  });
});
