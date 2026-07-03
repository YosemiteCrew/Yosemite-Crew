import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedFinance from '@/app/features/finance/pages/Finance';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('ui/tables/InvoiceTable')) {
        const MockInvoiceTable = jest.requireMock('@/app/ui/tables/InvoiceTable') as React.FC<
          Record<string, unknown>
        >;
        return <MockInvoiceTable {...props} />;
      }

      if (source.includes('Sections/InvoiceInfo')) {
        const MockInvoiceInfo = jest.requireMock(
          '@/app/features/finance/pages/Finance/Sections/InvoiceInfo'
        ) as React.FC<Record<string, unknown>>;
        return <MockInvoiceInfo {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

const useInvoicesMock = jest.fn();
const useLoadInvoicesMock = jest.fn();
const useSearchStoreMock = jest.fn();
const useSearchParamsMock = jest.fn();
const useSubscriptionMock = jest.fn();
const invoiceTableSpy = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

const mockSearchParamsGet = jest.fn(() => null);

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => useSubscriptionMock(),
}));

jest.mock('@/app/hooks/usePlannerLayout', () => ({
  usePlannerAutoLock: () => ({ plannerSectionRef: { current: null } }),
  getPlannerLayoutClassNames: () => ({
    wrapperClassName: 'wrapper',
    plannerSectionClassName: 'planner',
  }),
}));

jest.mock('@/app/ui/layout/MobileSearchBar/MobileSearchBar', () => () => (
  <div data-testid="mobile-search-bar" />
));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('react-icons/io5', () => ({
  IoInformationCircleOutline: () => <span data-testid="info-icon" />,
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrg: () => useInvoicesMock(),
  useLoadInvoicesForPrimaryOrg: () => useLoadInvoicesMock(),
}));

jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ href, text, ariaLabel }: any) => (
    <a href={href} aria-label={ariaLabel}>
      {text}
    </a>
  ),
}));

jest.mock('@/app/ui/filters/Filters', () => () => <div data-testid="filters" />);

jest.mock('@/app/features/billing/components/StripeSettingsButton', () => ({
  __esModule: true,
  default: () => <a href="/stripe-onboarding?orgId=org-1">Settings</a>,
}));

jest.mock('@/app/ui/tables/InvoiceTable', () => (props: any) => {
  invoiceTableSpy(props);
  return <div data-testid="invoice-table" />;
});

const invoiceInfoSpy = jest.fn();
jest.mock('@/app/features/finance/pages/Finance/Sections/InvoiceInfo', () => (props: any) => {
  invoiceInfoSpy(props);
  return <div data-testid="invoice-info" />;
});

describe('Finance page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    useSearchParamsMock.mockReturnValue({ get: mockSearchParamsGet });
    useLoadInvoicesMock.mockReturnValue(undefined);
    useSubscriptionMock.mockReturnValue(null);
    useInvoicesMock.mockReturnValue([
      { id: 'inv-1', status: 'paid', appointmentId: 'appt-1' },
      { id: 'inv-2', status: 'pending', appointmentId: 'appt-2' },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: 'appt-1' }));
  });

  it('renders filtered invoices and table', () => {
    render(<ProtectedFinance />);

    expect(screen.getByRole('heading', { level: 1, name: /Finance/ })).toBeInTheDocument();
    expect(screen.getByTestId('invoice-table')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/stripe-onboarding?orgId=org-1'
    );
    expect(invoiceTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ id: 'inv-1' })],
      })
    );
  });

  it('shows InvoiceInfo when an invoice is present', () => {
    render(<ProtectedFinance />);
    expect(screen.getByTestId('invoice-info')).toBeInTheDocument();
    expect(invoiceInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeInvoice: expect.objectContaining({ id: 'inv-1' }) })
    );
  });

  it('does not show InvoiceInfo when invoice list is empty', async () => {
    useInvoicesMock.mockReturnValue([]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await act(async () => {
      render(<ProtectedFinance />);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('invoice-info')).not.toBeInTheDocument();
  });

  it('shows stripe connect banner when subscription cannot accept payments', () => {
    useSubscriptionMock.mockReturnValue({ orgId: 'org-1', canAcceptPayments: false });

    render(<ProtectedFinance />);

    expect(screen.getByText('Connect Stripe account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect Stripe account' })).toHaveAttribute(
      'href',
      '/stripe-onboarding?orgId=org-1'
    );
  });

  it('does not show stripe banner when subscription can accept payments', () => {
    useSubscriptionMock.mockReturnValue({ orgId: 'org-1', canAcceptPayments: true });

    render(<ProtectedFinance />);

    expect(screen.queryByText('Connect Stripe account')).not.toBeInTheDocument();
  });

  it('deep link: opens InvoiceInfo when invoiceId matches', async () => {
    useInvoicesMock.mockReturnValue([{ id: 'inv-deep', status: 'paid', appointmentId: 'appt-x' }]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'invoiceId' ? 'inv-deep' : null),
    });

    await act(async () => {
      render(<ProtectedFinance />);
      await Promise.resolve();
    });

    expect(invoiceInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        showModal: true,
        activeInvoice: expect.objectContaining({ id: 'inv-deep' }),
      })
    );
  });

  it('does not trigger deep link when invoiceId does not match any invoice', async () => {
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'invoiceId' ? 'no-match' : null),
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await act(async () => {
      render(<ProtectedFinance />);
      await Promise.resolve();
    });

    expect(invoiceInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: false }));
  });

  it('activeInvoice updates when invoices list changes', async () => {
    const { rerender } = render(<ProtectedFinance />);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    useInvoicesMock.mockReturnValue([
      { id: 'inv-1', status: 'paid', appointmentId: 'appt-1-updated' },
    ]);

    await act(async () => {
      rerender(<ProtectedFinance />);
      await Promise.resolve();
    });

    expect(invoiceInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        activeInvoice: expect.objectContaining({ appointmentId: 'appt-1-updated' }),
      })
    );
  });

  it('shows invoice count in heading', () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    render(<ProtectedFinance />);
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });
});
