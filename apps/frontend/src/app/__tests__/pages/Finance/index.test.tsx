import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedFinance from '@/app/features/finance/pages/Finance';

// Toggled on by the loading-fallback test so the dynamic() mock renders the
// component's `loading` option instead of the resolved chunk.
let mockForceDynamicLoading = false;

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>, options?: { loading?: () => React.ReactNode }) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (mockForceDynamicLoading && options?.loading) {
        return options.loading();
      }
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
  useCurrencyForPrimaryOrg: () => 'USD',
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
  Secondary: ({ href, text, ariaLabel }: any) => (
    <a href={href} aria-label={ariaLabel}>
      {text}
    </a>
  ),
}));

jest.mock('@/app/ui/filters/Filters', () => (props: any) => (
  <button type="button" data-testid="filters" onClick={() => props.setActiveStatus('paid')}>
    filters
  </button>
));

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
    mockForceDynamicLoading = false;
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

  it('links to the Discounts page — Finance has no tab structure, so this is the entry point', () => {
    render(<ProtectedFinance />);

    expect(screen.getByRole('link', { name: 'Manage discounts' })).toHaveAttribute(
      'href',
      '/finance/discounts'
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

  it('renders the collected-this-week and outstanding metrics subtitle', () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    useInvoicesMock.mockReturnValue([
      {
        id: 'inv-1',
        status: 'PAID',
        appointmentId: 'a1',
        totalAmount: 4820,
        paidAt: new Date(),
        items: [],
      },
      { id: 'inv-2', status: 'PENDING', appointmentId: 'a2', totalAmount: 214, items: [] },
    ]);

    render(<ProtectedFinance />);

    expect(screen.getByText(/collected this week/)).toHaveTextContent(
      '$4,820 collected this week · $214 outstanding'
    );
  });

  it('falls back to the first invoice when the previously active one is removed from the list', async () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    const { rerender } = render(<ProtectedFinance />);

    // Initially active invoice is inv-1. Replace the list so inv-1 no longer
    // exists — the effect's `invoices.find` returns undefined and the updater
    // falls through to `return invoices[0]`.
    useInvoicesMock.mockReturnValue([{ id: 'inv-9', status: 'paid', appointmentId: 'appt-9' }]);

    await act(async () => {
      rerender(<ProtectedFinance />);
      await Promise.resolve();
    });

    expect(invoiceInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeInvoice: expect.objectContaining({ id: 'inv-9' }) })
    );
  });

  it('selects the first invoice when the active invoice has no id', () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    // No `id` on the invoice, so the effect skips the `prev?.id` lookup entirely
    // and takes the `return invoices[0]` fallback.
    useInvoicesMock.mockReturnValue([{ status: 'paid', appointmentId: 'appt-noid' }]);

    render(<ProtectedFinance />);

    expect(invoiceInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        activeInvoice: expect.objectContaining({ appointmentId: 'appt-noid' }),
      })
    );
  });

  it('does not re-handle the deep link once it has already been opened', async () => {
    useInvoicesMock.mockReturnValue([{ id: 'inv-deep', status: 'paid', appointmentId: 'appt-x' }]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'invoiceId' ? 'inv-deep' : null),
    });

    const { rerender } = render(<ProtectedFinance />);

    // The first effect run handled the deep link and stored inv-deep in the ref.
    // Re-trigger the effect (invoices dep changes) while searchParams still
    // returns inv-deep, so `handledDeepLinkRef.current === invoiceId` returns early.
    useInvoicesMock.mockReturnValue([
      { id: 'inv-deep', status: 'paid', appointmentId: 'appt-x' },
      { id: 'inv-2', status: 'pending', appointmentId: 'appt-2' },
    ]);

    await act(async () => {
      rerender(<ProtectedFinance />);
      await Promise.resolve();
    });

    expect(invoiceInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        showModal: true,
        activeInvoice: expect.objectContaining({ id: 'inv-deep' }),
      })
    );
  });

  it('filters the invoice list by the selected status', async () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    useInvoicesMock.mockReturnValue([
      { id: 'inv-1', status: 'paid', appointmentId: 'appt-1' },
      { id: 'inv-2', status: 'pending', appointmentId: 'appt-2' },
    ]);

    render(<ProtectedFinance />);

    invoiceTableSpy.mockClear();
    // The mocked Filters triggers setActiveStatus('paid'); the memo then evaluates
    // `status === statusWanted` for each invoice (the previously-uncovered branch).
    await act(async () => {
      fireEvent.click(screen.getByTestId('filters'));
      await Promise.resolve();
    });

    expect(invoiceTableSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ id: 'inv-1', status: 'paid' })],
      })
    );
  });

  it('renders the section skeleton while the invoice table chunk is loading', () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    mockForceDynamicLoading = true;

    const { container } = render(<ProtectedFinance />);

    const skeleton = container.querySelector('.animate-pulse.bg-card-hover');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    // The resolved table is not rendered while the loading fallback is showing.
    expect(screen.queryByTestId('invoice-table')).not.toBeInTheDocument();
  });
});
