import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/services/developerBilling', () => ({
  getSubscription: jest.fn(),
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
}));

jest.mock('@/app/services/developerUsage', () => ({
  getUsage: jest.fn(),
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
import { getUsage } from '@/app/services/developerUsage';

const getSubscriptionMock = getSubscription as jest.Mock;
const createCheckoutMock = createCheckoutSession as jest.Mock;
const createPortalMock = createPortalSession as jest.Mock;
const getUsageMock = getUsage as jest.Mock;

const freeUsage = { billingPeriod: '2026-08', callCount: 120, limit: 1000 };
const meteredUsage = { billingPeriod: '2026-08', callCount: 48_250, limit: null };

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
  getUsageMock.mockResolvedValue(freeUsage);
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

  /* No click-through test for Enterprise's "Contact us": it assigns a `mailto:`
     to window.location, jsdom reports that as "Not implemented: navigation", and
     jest.setup.ts turns any console.error into a failure. Weakening that guard
     for two lines of a mailto handler is a bad trade. */

  it('disables Upgrade to Pro when already on Pro', async () => {
    getSubscriptionMock.mockResolvedValue(proSub);
    render(<DeveloperBilling />);
    await screen.findByTestId('billing-plan-meta');
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });

  describe('usage meter', () => {
    it('shows calls used against the included allowance', async () => {
      render(<DeveloperBilling />);
      const meter = await screen.findByTestId('billing-usage');
      expect(meter.textContent).toContain('120');
      expect(meter.textContent).toContain('1,000');
      expect(meter.textContent).toContain('2026-08');
    });

    it('fills the progress bar in proportion to calls used', async () => {
      render(<DeveloperBilling />);
      await screen.findByTestId('billing-usage');
      // A native <progress>, so value/max carry the semantics rather than
      // hand-written aria-value* attributes.
      const bar = screen.getByRole('progressbar') as HTMLProgressElement;
      expect(bar.value).toBe(120);
      expect(bar.max).toBe(1000);
    });

    it('warns that calls now 429 once the allowance is spent', async () => {
      getUsageMock.mockResolvedValue({ ...freeUsage, callCount: 1000 });
      render(<DeveloperBilling />);
      expect(await screen.findByText(/used your monthly allowance/)).toBeInTheDocument();
    });

    it('does not warn while the allowance still has room', async () => {
      render(<DeveloperBilling />);
      await screen.findByTestId('billing-usage');
      expect(screen.queryByText(/used your monthly allowance/)).not.toBeInTheDocument();
    });

    it('caps the bar at 100% rather than overflowing when calls exceed the limit', async () => {
      getUsageMock.mockResolvedValue({ ...freeUsage, callCount: 4000 });
      render(<DeveloperBilling />);
      await screen.findByTestId('billing-usage');
      const bar = screen.getByRole('progressbar') as HTMLProgressElement;
      // clamped, so the bar cannot report more progress than its own maximum
      expect(bar.value).toBe(1000);
      expect(bar.max).toBe(1000);
    });

    it('renders no bar for a zero limit rather than a NaN width', async () => {
      getUsageMock.mockResolvedValue({ ...freeUsage, callCount: 0, limit: 0 });
      render(<DeveloperBilling />);
      const meter = await screen.findByTestId('billing-usage');

      // A zero max would make <progress> indeterminate rather than empty.
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(meter.innerHTML).not.toContain('NaN');
    });

    it('shows a bare count with no bar on a metered plan', async () => {
      getSubscriptionMock.mockResolvedValue(proSub);
      getUsageMock.mockResolvedValue(meteredUsage);
      render(<DeveloperBilling />);
      const meter = await screen.findByTestId('billing-usage');
      expect(meter.textContent).toContain('48,250');
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.getByText(/Metered — billed at the end/)).toBeInTheDocument();
    });

    it('hides the meter but keeps the plan cards when usage fails to load', async () => {
      getUsageMock.mockRejectedValue(new Error('network'));
      render(<DeveloperBilling />);
      expect(await screen.findByTestId('plan-card-free')).toBeInTheDocument();
      expect(screen.queryByTestId('billing-usage')).not.toBeInTheDocument();
      // the subscription loaded fine, so no page-level error should appear
      expect(screen.queryByText(/Could not load your subscription/)).not.toBeInTheDocument();
    });

    it('still shows the subscription error when only the subscription fails', async () => {
      getSubscriptionMock.mockRejectedValue(new Error('network'));
      render(<DeveloperBilling />);
      expect(await screen.findByText(/Could not load your subscription/)).toBeInTheDocument();
      // usage resolved, so the meter is still rendered
      expect(screen.getByTestId('billing-usage')).toBeInTheDocument();
    });
  });
});
