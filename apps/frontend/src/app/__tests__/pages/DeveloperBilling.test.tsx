import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/services/developerBilling', () => ({
  getSubscription: jest.fn(),
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
}));

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dev-guard">{children}</div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import DeveloperBilling from '@/app/features/developers/pages/DeveloperBilling/DeveloperBilling';
import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
} from '@/app/services/developerBilling';

const getSubscriptionMock = getSubscription as jest.Mock;
const createCheckoutMock = createCheckoutSession as jest.Mock;
const createPortalMock = createPortalSession as jest.Mock;

const freeSub = {
  id: null,
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

const proSub = {
  ...freeSub,
  id: 's1',
  plan: 'pro',
  status: 'active',
  stripeSubscriptionItemId: 'si_abc',
  currentPeriodStart: '2026-06-01T00:00:00.000Z',
  currentPeriodEnd: '2026-07-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  getSubscriptionMock.mockResolvedValue(freeSub);
});

describe('DeveloperBilling page', () => {
  it('renders all three plan cards', async () => {
    render(<DeveloperBilling />);
    expect(await screen.findByTestId('plan-card-free')).toBeInTheDocument();
    expect(screen.getByTestId('plan-card-pro')).toBeInTheDocument();
    expect(screen.getByTestId('plan-card-enterprise')).toBeInTheDocument();
  });

  it('shows Free badge when on the free plan', async () => {
    render(<DeveloperBilling />);
    expect(await screen.findByText('You are on the Free plan.')).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    getSubscriptionMock.mockRejectedValue(new Error('network'));
    render(<DeveloperBilling />);
    expect(await screen.findByText(/Could not load your subscription/)).toBeInTheDocument();
  });

  it('shows Pro badge and metered billing info when on Pro', async () => {
    getSubscriptionMock.mockResolvedValue(proSub);
    render(<DeveloperBilling />);
    const meta = await screen.findByTestId('billing-plan-meta');
    expect(meta.textContent).toMatch(/Metered billing/);
  });

  it('shows billing period dates when on Pro', async () => {
    getSubscriptionMock.mockResolvedValue(proSub);
    render(<DeveloperBilling />);
    const meta = await screen.findByTestId('billing-plan-meta');
    expect(meta.textContent).toMatch(/2026/);
  });

  it('shows Manage billing button when on Pro', async () => {
    getSubscriptionMock.mockResolvedValue(proSub);
    render(<DeveloperBilling />);
    expect(await screen.findByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
  });

  it('shows per-call pricing in the Pro plan card', async () => {
    render(<DeveloperBilling />);
    await screen.findByTestId('plan-card-pro');
    expect(screen.getByText(/\$0\.002 per API call/)).toBeInTheDocument();
  });

  it('calls createCheckoutSession with successUrl and cancelUrl on Upgrade click', async () => {
    const user = userEvent.setup();
    createCheckoutMock.mockResolvedValue('https://checkout.stripe.com/test');
    render(<DeveloperBilling />);
    await screen.findByTestId('plan-card-pro');

    await user.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    await waitFor(() =>
      expect(createCheckoutMock).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: expect.stringContaining('/developers/billing'),
          cancelUrl: expect.stringContaining('/developers/billing'),
        })
      )
    );
  });

  it('shows an error when checkout creation fails', async () => {
    const user = userEvent.setup();
    createCheckoutMock.mockRejectedValue(new Error('fail'));
    render(<DeveloperBilling />);
    await screen.findByTestId('plan-card-pro');

    await user.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    expect(await screen.findByText(/Could not start the upgrade flow/)).toBeInTheDocument();
  });

  it('calls createPortalSession on Manage billing click', async () => {
    const user = userEvent.setup();
    getSubscriptionMock.mockResolvedValue(proSub);
    createPortalMock.mockResolvedValue('https://billing.stripe.com/p');
    render(<DeveloperBilling />);
    await screen.findByText('Manage billing');

    await user.click(screen.getByRole('button', { name: 'Manage billing' }));
    await waitFor(() =>
      expect(createPortalMock).toHaveBeenCalledWith(expect.stringContaining('/developers/billing'))
    );
  });

  it('shows an error when portal creation fails', async () => {
    const user = userEvent.setup();
    getSubscriptionMock.mockResolvedValue(proSub);
    createPortalMock.mockRejectedValue(new Error('fail'));
    render(<DeveloperBilling />);
    await screen.findByText('Manage billing');

    await user.click(screen.getByRole('button', { name: 'Manage billing' }));
    expect(await screen.findByText(/Could not open the billing portal/)).toBeInTheDocument();
  });

  it('shows Past due badge when status is past_due', async () => {
    getSubscriptionMock.mockResolvedValue({ ...proSub, status: 'past_due' });
    render(<DeveloperBilling />);
    expect(await screen.findByText('Past due')).toBeInTheDocument();
  });

  it('shows cancelAtPeriodEnd notice when true', async () => {
    getSubscriptionMock.mockResolvedValue({ ...proSub, cancelAtPeriodEnd: true });
    render(<DeveloperBilling />);
    const meta = await screen.findByTestId('billing-plan-meta');
    expect(meta.textContent).toContain('Cancels at period end');
  });

  it('disables Upgrade to Pro when already on Pro', async () => {
    getSubscriptionMock.mockResolvedValue(proSub);
    render(<DeveloperBilling />);
    await screen.findByTestId('billing-plan-meta');
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });
});
