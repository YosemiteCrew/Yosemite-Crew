import { renderHook, waitFor } from '@testing-library/react';

import {
  useBillingForPrimaryOrg,
  useCanMoreForPrimaryOrg,
  useCounterForPrimaryOrg,
  useCurrencyForPrimaryOrg,
  useIsStripeActive,
  useLoadSubscriptionCounterForPrimaryOrg,
  useSubscriptionByOrgId,
  useSubscriptionForPrimaryOrg,
} from '@/app/hooks/useBilling';

const useOrgStoreMock = jest.fn();
const useCounterStoreMock = jest.fn();
const useSubscriptionStoreMock = jest.fn();
const checkStatusMock = jest.fn();

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => useOrgStoreMock(selector),
}));

jest.mock('@/app/stores/counterStore', () => ({
  useCounterStore: (selector: any) => useCounterStoreMock(selector),
}));

jest.mock('@/app/stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: any) => useSubscriptionStoreMock(selector),
}));

jest.mock('@/app/features/billing/services/stripeService', () => ({
  checkStatus: (...args: any[]) => checkStatusMock(...args),
}));

describe('useBilling hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOrgStoreMock.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    useCounterStoreMock.mockImplementation((selector: any) =>
      selector({
        countersByOrgId: {
          'org-1': {
            orgId: 'org-1',
            freeAppointmentsLimit: 5,
            appointmentsUsed: 2,
            freeUsersLimit: 3,
            usersBillableCount: 1,
          },
        },
      })
    );
    useSubscriptionStoreMock.mockImplementation((selector: any) =>
      selector({
        subscriptionByOrgId: {
          'org-1': { orgId: 'org-1', plan: 'free', canAcceptPayments: true, currency: 'EUR' },
          'org-2': { orgId: 'org-2', plan: 'business', canAcceptPayments: false, currency: 'USD' },
        },
      })
    );
    checkStatusMock.mockResolvedValue(undefined);
  });

  it('loads status for primary org', async () => {
    renderHook(() => useLoadSubscriptionCounterForPrimaryOrg());
    await waitFor(() => expect(checkStatusMock).toHaveBeenCalledWith('org-1'));
  });

  it('returns counter and subscription for primary org', () => {
    expect(renderHook(() => useCounterForPrimaryOrg()).result.current?.orgId).toBe('org-1');
    expect(renderHook(() => useSubscriptionForPrimaryOrg()).result.current?.currency).toBe('EUR');
    expect(renderHook(() => useSubscriptionByOrgId('org-2')).result.current?.plan).toBe('business');
    expect(renderHook(() => useSubscriptionByOrgId(null)).result.current).toBeNull();
  });

  it('returns combined billing object and derived payment/currency values', () => {
    expect(renderHook(() => useBillingForPrimaryOrg()).result.current.subscription?.orgId).toBe(
      'org-1'
    );
    expect(renderHook(() => useIsStripeActive()).result.current).toBe(true);
    expect(renderHook(() => useCurrencyForPrimaryOrg()).result.current).toBe('EUR');
  });

  it('computes canMore for appointments and users on free plan', () => {
    const appointments = renderHook(() => useCanMoreForPrimaryOrg('appointments')).result.current;
    expect(appointments.canMore).toBe(true);
    expect(appointments.remainingFree).toBe(3);

    const users = renderHook(() => useCanMoreForPrimaryOrg('users')).result.current;
    expect(users.canMore).toBe(true);
    expect(users.remainingFree).toBe(2);
  });

  it('handles no subscription / non-free / unknown values branches', () => {
    useSubscriptionStoreMock.mockImplementation((selector: any) =>
      selector({
        subscriptionByOrgId: {},
      })
    );
    expect(renderHook(() => useCanMoreForPrimaryOrg('appointments')).result.current.reason).toBe(
      'no_subscription'
    );

    useSubscriptionStoreMock.mockImplementation((selector: any) =>
      selector({
        subscriptionByOrgId: {
          'org-1': { orgId: 'org-1', plan: 'business', canAcceptPayments: false },
        },
      })
    );
    expect(renderHook(() => useCanMoreForPrimaryOrg('appointments')).result.current.reason).toBe(
      'not_free_plan'
    );

    useSubscriptionStoreMock.mockImplementation((selector: any) =>
      selector({
        subscriptionByOrgId: {
          'org-1': { orgId: 'org-1', plan: 'free', canAcceptPayments: false },
        },
      })
    );
    useCounterStoreMock.mockImplementation((selector: any) => selector({ countersByOrgId: {} }));
    expect(renderHook(() => useCanMoreForPrimaryOrg('appointments')).result.current.reason).toBe(
      'no_counter'
    );
  });
});
