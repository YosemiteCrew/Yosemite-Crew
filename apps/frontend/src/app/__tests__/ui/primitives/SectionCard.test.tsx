import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SectionCard from '@/app/ui/primitives/SectionCard/SectionCard';

const mockGetStripeBillingPortal = jest.fn();
const mockCan = jest.fn();

jest.mock('@/app/features/billing/services/billingService', () => ({
  getStripeBillingPortal: () => mockGetStripeBillingPortal(),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeStripeRedirectUrl: (url: string) => url,
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => ({
    plan: 'business',
    stripeCustomerId: 'cus_123',
  }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: mockCan }),
}));

jest.mock('@/app/ui/widgets/Upgrade', () => ({
  __esModule: true,
  default: () => <span>Upgrade</span>,
}));

describe('SectionCard', () => {
  const mockButtonClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCan.mockReturnValue(false);
    mockGetStripeBillingPortal.mockResolvedValue('https://billing.stripe.com/session');
  });

  it('renders its content without any toggle to collapse it', () => {
    render(
      <SectionCard title="Documents" showButton={false}>
        <p>Section body</p>
      </SectionCard>
    );

    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByText('Section body')).toBeInTheDocument();
    // The section is flat: nothing announces an expanded/collapsed state.
    expect(screen.queryByRole('button', { name: 'Documents' })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-expanded]')).toBeNull();
  });

  it('renders the action button and forwards its click', () => {
    render(
      <SectionCard title="Rooms" buttonTitle="Add room" buttonClick={mockButtonClick}>
        <p>Body</p>
      </SectionCard>
    );

    fireEvent.click(screen.getByText('Add room'));
    expect(mockButtonClick).toHaveBeenCalledWith(true);
  });

  it('hides the action button when showButton is false', () => {
    render(
      <SectionCard title="Rooms" buttonTitle="Add room" showButton={false}>
        <p>Body</p>
      </SectionCard>
    );

    expect(screen.queryByText('Add room')).not.toBeInTheDocument();
  });

  it('renders a custom actions slot', () => {
    render(
      <SectionCard title="Devices" showButton={false} actions={<button>Refresh</button>}>
        <p>Body</p>
      </SectionCard>
    );

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('opens the billing portal from the finance action', async () => {
    mockCan.mockReturnValue(true);
    const openSpy = jest.spyOn(globalThis, 'open').mockImplementation(() => null);

    render(
      <SectionCard title="Payment" showButton={false} finance>
        <p>Body</p>
      </SectionCard>
    );

    fireEvent.click(screen.getByText('Billing portal'));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://billing.stripe.com/session',
        '_blank',
        'noopener,noreferrer'
      );
    });
    openSpy.mockRestore();
  });

  it('surfaces a billing portal failure', async () => {
    mockCan.mockReturnValue(true);
    mockGetStripeBillingPortal.mockRejectedValue(new Error('Portal down'));

    render(
      <SectionCard title="Payment" showButton={false} finance>
        <p>Body</p>
      </SectionCard>
    );

    fireEvent.click(screen.getByText('Billing portal'));

    expect(await screen.findByText('Portal down')).toBeInTheDocument();
  });
});
