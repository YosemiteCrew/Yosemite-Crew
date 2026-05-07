import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedStripeOnboarding from '@/app/features/onboarding/pages/StripeOnboarding';

const pushMock = jest.fn();
const useStripeOnboardingMock = jest.fn();
const useSubscriptionCounterUpdateMock = jest.fn();
const useSubscriptionMock = jest.fn();
const createAccountMock = jest.fn();
const onboardAccountMock = jest.fn();
const loadConnectMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: () => 'org-1' }),
}));

jest.mock('@/app/hooks/useStripeOnboarding', () => ({
  useStripeOnboarding: (...args: any[]) => useStripeOnboardingMock(...args),
  useSubscriptionCounterUpdate: () => ({
    refetch: useSubscriptionCounterUpdateMock,
  }),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionByOrgId: () => useSubscriptionMock(),
}));

jest.mock('@/app/features/billing/services/stripeService', () => ({
  createConnectedAccount: (...args: any[]) => createAccountMock(...args),
  onBoardConnectedAccount: (...args: any[]) => onboardAccountMock(...args),
}));

jest.mock('@stripe/connect-js/pure', () => ({
  loadConnectAndInitialize: (...args: any[]) => loadConnectMock(...args),
}));

jest.mock('@stripe/react-connect-js', () => ({
  ConnectComponentsProvider: ({ children }: any) => (
    <div data-testid="connect-provider">{children}</div>
  ),
  ConnectAccountOnboarding: () => <div data-testid="connect-onboarding" />,
  ConnectTaxRegistrations: () => <div data-testid="connect-tax-registrations" />,
  ConnectTaxSettings: () => <div data-testid="connect-tax-settings" />,
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

describe('Stripe onboarding page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SANDBOX_PUBLISH = 'pk_test';
    useSubscriptionCounterUpdateMock.mockResolvedValue(undefined);
  });

  it('returns null when onboarding is disabled', () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: false });
    useSubscriptionMock.mockReturnValue(null);

    render(<ProtectedStripeOnboarding />);
    expect(screen.queryByText('Stripe Onboarding')).not.toBeInTheDocument();
  });

  it('redirects when subscription already connected', async () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: true,
      connectAccountId: 'acct_1',
    });

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('renders connect onboarding when instance is created', async () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: false,
      connectAccountId: 'acct_1',
    });
    onboardAccountMock.mockResolvedValue('secret');
    loadConnectMock.mockReturnValue({});

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(loadConnectMock).toHaveBeenCalled();
    });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Stripe Onboarding' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tax Business Details' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tax Registrations' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    expect(screen.getByTestId('connect-onboarding')).toBeInTheDocument();
  });

  it('shows a retryable alert when account creation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: false,
      connectAccountId: '',
    });
    createAccountMock.mockRejectedValue(new Error('failed'));

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(
      screen.getByText('We could not prepare Stripe onboarding. Please try again.')
    ).toBeInTheDocument();

    createAccountMock.mockResolvedValue('acct_retry');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(createAccountMock.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByTestId('connect-provider')).toBeInTheDocument());
  });
});
