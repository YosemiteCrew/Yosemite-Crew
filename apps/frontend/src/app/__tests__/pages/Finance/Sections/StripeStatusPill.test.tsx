import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StripeStatusPill from '@/app/features/finance/pages/Finance/Sections/StripeStatusPill';

const useSubscriptionMock = jest.fn();
const canMock = jest.fn();

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => useSubscriptionMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: canMock }),
}));

describe('StripeStatusPill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    canMock.mockReturnValue(true);
  });

  it('renders nothing when there is no subscription', () => {
    useSubscriptionMock.mockReturnValue(null);
    const { container } = render(<StripeStatusPill />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when charges are not enabled', () => {
    useSubscriptionMock.mockReturnValue({ orgId: 'org-1', connectChargesEnabled: false });
    const { container } = render(<StripeStatusPill />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a settings link when connected and manageable', () => {
    useSubscriptionMock.mockReturnValue({ orgId: 'org-1', connectChargesEnabled: true });
    render(<StripeStatusPill />);

    const link = screen.getByRole('link', { name: 'Stripe settings' });
    expect(link).toHaveAttribute('href', '/stripe-onboarding?orgId=org-1');
    expect(link).toHaveTextContent('Stripe · settings');
    expect(screen.getByText('Stripe · settings')).toHaveClass(
      'rounded-full!',
      'text-[10px]',
      'font-bold',
      'uppercase'
    );
  });

  it('renders a plain connected pill when the viewer cannot manage billing', () => {
    useSubscriptionMock.mockReturnValue({ orgId: 'org-1', connectChargesEnabled: true });
    canMock.mockReturnValue(false);
    render(<StripeStatusPill />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const pill = screen.getByText('Stripe · connected');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass('rounded-full!', 'text-[10px]', 'font-bold', 'uppercase');
  });
});
