import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StripeSettingsButton from '@/app/features/billing/components/StripeSettingsButton';

const mockUseSubscriptionForPrimaryOrg = jest.fn();
const mockCan = jest.fn();

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => mockUseSubscriptionForPrimaryOrg(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: mockCan }),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ href, text, ariaLabel }: any) => (
    <a href={href} aria-label={ariaLabel}>
      {text}
    </a>
  ),
}));

describe('StripeSettingsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSubscriptionForPrimaryOrg.mockReturnValue({
      orgId: 'org-1',
      connectChargesEnabled: false,
    });
    mockCan.mockReturnValue(true);
  });

  it('links to Stripe onboarding when the user can manage Stripe settings', () => {
    render(<StripeSettingsButton />);

    expect(screen.getByRole('link', { name: 'Stripe settings' })).toHaveAttribute(
      'href',
      '/stripe-onboarding?orgId=org-1'
    );
    expect(mockCan).toHaveBeenCalledWith({
      allOf: ['org:edit', 'subscription:edit:any'],
    });
  });

  it('hides when the user lacks Stripe management permissions', () => {
    mockCan.mockReturnValue(false);

    const { container } = render(<StripeSettingsButton />);

    expect(container.firstChild).toBeNull();
  });

  it('hides when no subscription org id is available', () => {
    mockUseSubscriptionForPrimaryOrg.mockReturnValue(null);

    const { container } = render(<StripeSettingsButton />);

    expect(container.firstChild).toBeNull();
  });

  it('hides when the Stripe account is already connected', () => {
    mockUseSubscriptionForPrimaryOrg.mockReturnValue({
      orgId: 'org-1',
      connectChargesEnabled: true,
    });

    const { container } = render(<StripeSettingsButton />);

    expect(container.firstChild).toBeNull();
  });
});
