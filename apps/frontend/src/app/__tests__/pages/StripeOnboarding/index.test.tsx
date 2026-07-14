import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedStripeOnboarding from '@/app/features/onboarding/pages/StripeOnboarding';

const pushMock = jest.fn();
const backMock = jest.fn();
const redirectMock = jest.fn((path: string) => {
  void path;
  throw new Error('NEXT_REDIRECT');
});
const useStripeOnboardingMock = jest.fn();
const useSubscriptionCounterUpdateMock = jest.fn();
const useSubscriptionMock = jest.fn();
const createAccountMock = jest.fn();
const onboardAccountMock = jest.fn();
const loadConnectMock = jest.fn();
let mockOrgIdFromQuery: string | null = 'org-1';

jest.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  useRouter: () => ({ push: pushMock, back: backMock }),
  useSearchParams: () => ({ get: () => mockOrgIdFromQuery }),
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
  ConnectAccountOnboarding: ({ onExit, onStepChange }: any) => (
    <div data-testid="connect-onboarding">
      <button type="button" onClick={onExit}>
        Exit onboarding
      </button>
      <button type="button" onClick={() => onStepChange({ step: 'stripe_user_authentication' })}>
        Auth step
      </button>
      <button type="button" onClick={() => onStepChange({ step: 'business_profile' })}>
        Business step
      </button>
    </div>
  ),
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
    loadConnectMock.mockReset();
    mockOrgIdFromQuery = 'org-1';
    process.env.NEXT_PUBLIC_SANDBOX_PUBLISH = 'pk_test';
    useSubscriptionCounterUpdateMock.mockResolvedValue(undefined);
  });

  it('returns null when onboarding is disabled', () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: false });
    useSubscriptionMock.mockReturnValue(null);

    expect(() => render(<ProtectedStripeOnboarding />)).toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects when subscription already connected', async () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: true,
      connectAccountId: 'acct_1',
    });

    expect(() => render(<ProtectedStripeOnboarding />)).toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
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
    await expect(loadConnectMock.mock.calls[0][0].fetchClientSecret()).resolves.toBe('secret');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Stripe onboarding' })
    ).toBeInTheDocument();
    const backButton = screen.getByRole('button', { name: 'Back' });
    const heading = screen.getByRole('heading', { level: 1, name: 'Stripe onboarding' });
    expect(backButton.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tax business details' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tax registrations' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('connect-provider')).toBeInTheDocument();
    expect(screen.getByTestId('connect-onboarding')).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(backMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Exit onboarding' }));
    await waitFor(() => expect(useSubscriptionCounterUpdateMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith('/dashboard');

    fireEvent.click(screen.getByRole('button', { name: 'Auth step' }));
    await waitFor(() => expect(useSubscriptionCounterUpdateMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Business step' }));
    expect(useSubscriptionCounterUpdateMock).toHaveBeenCalledTimes(2);
  });

  it('shows a retryable alert when account creation fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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
    loadConnectMock.mockReturnValue({});
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(createAccountMock.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByTestId('connect-provider')).toBeInTheDocument());
    consoleSpy.mockRestore();
  });

  it('redirects when required onboarding inputs are missing', async () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: false,
      connectAccountId: '',
    });
    mockOrgIdFromQuery = null;

    expect(() => render(<ProtectedStripeOnboarding />)).toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');

    redirectMock.mockClear();
    mockOrgIdFromQuery = 'org-1';
    useSubscriptionMock.mockReturnValue(null);

    expect(() => render(<ProtectedStripeOnboarding />)).toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects when account creation returns no account id', async () => {
    useStripeOnboardingMock.mockReturnValue({ onboard: true });
    useSubscriptionMock.mockReturnValue({
      connectChargesEnabled: false,
      connectAccountId: '',
    });
    createAccountMock.mockResolvedValue('');

    render(<ProtectedStripeOnboarding />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
    });
  });
});
