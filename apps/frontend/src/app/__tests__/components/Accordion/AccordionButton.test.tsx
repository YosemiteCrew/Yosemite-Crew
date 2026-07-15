import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';

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

describe('AccordionButton Component', () => {
  const mockButtonClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCan.mockReturnValue(false);
    mockGetStripeBillingPortal.mockResolvedValue('https://billing.stripe.com/session');
  });

  it('renders closed by default and toggles content on click', () => {
    render(
      <AccordionButton title="Test Accordion" buttonTitle="Action" buttonClick={mockButtonClick}>
        <div data-testid="content">Hidden Content</div>
      </AccordionButton>
    );

    expect(screen.getByText('Test Accordion')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();

    const toggleButton = screen.getByText('Test Accordion').closest('button');
    const icon = toggleButton?.querySelector('svg');
    expect(icon).toHaveClass('-rotate-90');

    fireEvent.click(toggleButton!);

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(icon).toHaveClass('rotate-0');

    fireEvent.click(toggleButton!);
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('renders open initially when defaultOpen is true', () => {
    render(
      <AccordionButton title="Open Accordion" defaultOpen={true}>
        <div data-testid="content">Visible Content</div>
      </AccordionButton>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders the action button and handles clicks correctly', () => {
    render(
      <AccordionButton
        title="With Button"
        buttonTitle="Click Me"
        buttonClick={mockButtonClick}
        showButton={true}
      />
    );

    const actionButton = screen.getByText('Click Me');
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);

    expect(mockButtonClick).toHaveBeenCalledTimes(1);
    expect(mockButtonClick).toHaveBeenCalledWith(true);
  });

  it('does not render the action button when showButton is false', () => {
    render(<AccordionButton title="No Button" buttonTitle="Click Me" showButton={false} />);

    expect(screen.queryByText('Click Me')).not.toBeInTheDocument();
  });

  it('opens a closed accordion when clicking the toggle button', () => {
    render(
      <AccordionButton title="Container Click">
        <div data-testid="content">Hidden Content</div>
      </AccordionButton>
    );

    expect(screen.queryByTestId('content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Container Click' }));

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('closes an open accordion when clicking the toggle button', () => {
    render(
      <AccordionButton title="Container Close" defaultOpen>
        <div data-testid="content">Visible Content</div>
      </AccordionButton>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Container Close' }));

    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('does not close the accordion when clicking inside its content', () => {
    render(
      <AccordionButton title="Content Guard" defaultOpen>
        <button type="button">Nested action</button>
        <div data-testid="content">Visible Content</div>
      </AccordionButton>
    );

    fireEvent.click(screen.getByTestId('content'));
    fireEvent.click(screen.getByText('Nested action'));

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('does not open the accordion when clicking its action button', () => {
    render(
      <AccordionButton
        title="Action Guard"
        buttonTitle="Click Me"
        buttonClick={mockButtonClick}
        showButton={true}
      >
        <div data-testid="content">Hidden Content</div>
      </AccordionButton>
    );

    fireEvent.click(screen.getByText('Click Me'));

    expect(mockButtonClick).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('opens billing portal in a new tab for subscription editors', async () => {
    mockCan.mockReturnValue(true);
    const openSpy = jest.spyOn(globalThis, 'open').mockImplementation(() => null);

    render(<AccordionButton title="Payment" finance showButton={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Billing portal' }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://billing.stripe.com/session',
        '_blank',
        'noopener,noreferrer'
      );
    });

    openSpy.mockRestore();
  });
});
