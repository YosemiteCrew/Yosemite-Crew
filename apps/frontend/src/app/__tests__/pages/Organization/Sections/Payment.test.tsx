import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Payment from '@/app/features/organization/pages/Organization/Sections/Payment';

const mockUseSubscriptionForPrimaryOrg = jest.fn();
const mockCan = jest.fn();

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => mockUseSubscriptionForPrimaryOrg(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: mockCan }),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Payment organization section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockUseSubscriptionForPrimaryOrg.mockReturnValue({
      orgId: 'org-1',
      connectChargesEnabled: true,
      connectPayoutsEnabled: true,
    });
  });

  it('renders the connected Stripe status card with a Manage link', () => {
    render(<Payment />);

    expect(screen.getByText('Payments · Stripe')).toBeInTheDocument();
    expect(screen.getByText('Charges enabled · payouts weekly')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/stripe-onboarding?orgId=org-1'
    );
  });

  it('drops the payouts phrase when payouts are not yet enabled', () => {
    mockUseSubscriptionForPrimaryOrg.mockReturnValue({
      orgId: 'org-1',
      connectChargesEnabled: true,
      connectPayoutsEnabled: false,
    });
    render(<Payment />);

    expect(screen.getByText('Charges enabled')).toBeInTheDocument();
  });

  it('shows the not-connected state with a Connect link', () => {
    mockUseSubscriptionForPrimaryOrg.mockReturnValue({
      orgId: 'org-1',
      connectChargesEnabled: false,
    });
    render(<Payment />);

    expect(screen.getByText('Not connected yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect' })).toHaveAttribute(
      'href',
      '/stripe-onboarding?orgId=org-1'
    );
  });

  it('hides the manage link when the user cannot manage stripe', () => {
    mockCan.mockReturnValue(false);
    render(<Payment />);

    expect(screen.getByText('Payments · Stripe')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a neutral card and no link when there is no subscription', () => {
    mockUseSubscriptionForPrimaryOrg.mockReturnValue(null);
    render(<Payment />);

    expect(screen.getByText('Not connected yet')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
