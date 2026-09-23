import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

// Renders children so the page body is exercised; PermissionGate's own tests
// cover the permission logic.
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

/*
 * Every icon in the set, not just the one the header uses: GenericTable's empty
 * state reaches for its own icon, and a mock that names a single export made
 * that render as `undefined`.
 */
jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (target: Record<string, unknown>, name: string) =>
          name in target ? target[name] : () => <span data-testid={`icon-${name}`} />,
      }
    )
);

// Both variants, defined inside the factory: a mock naming only `Secondary`
// renders `Primary` as `undefined`, and React reports that as an invalid
// element type from whichever component happened to use it.
jest.mock('@/app/ui/primitives/Buttons', () => {
  const Button = ({ href, text, ariaLabel, onClick, isDisabled }: any) =>
    href ? (
      <a href={href} aria-label={ariaLabel}>
        {text}
      </a>
    ) : (
      <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
        {text}
      </button>
    );

  return { Secondary: Button, Primary: Button };
});

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const orgStoreState = { primaryOrgId: 'org-1' as string | null };
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(orgStoreState),
}));

// The transport is mocked, not the hook: the page's real load, filter, paginate
// and error paths run against it.
const listProviderReceipts = jest.fn();
const allocateProviderReceipt = jest.fn();
jest.mock('@/app/features/finance/services/providerReceiptService', () => {
  class ProviderReceiptAllocationError extends Error {
    readonly failure: { code: string; message: string };

    constructor(failure: { code: string; message: string }) {
      super(failure.message);
      this.failure = failure;
    }
  }

  return {
    listProviderReceipts: (...args: unknown[]) => listProviderReceipts(...args),
    allocateProviderReceipt: (...args: unknown[]) => allocateProviderReceipt(...args),
    ProviderReceiptAllocationError,
    getProviderReceiptErrorMessage: (error: unknown, fallback: string) => {
      const body = (error as { response?: { data?: { message?: string } } })?.response?.data;
      if (body?.message) return body.message;
      if (error instanceof Error) return error.message;
      return fallback;
    },
  };
});

/*
 * The action is gated on `billing:edit:any`, the permission the route it calls
 * requires. The screen itself only needs `billing:view:any`, so the two are
 * driven separately here rather than through one allow-everything stub.
 */
const permission = { allowed: false };
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => permission.allowed, isLoading: false }),
}));

const loadInvoices = jest.fn();
const orgInvoices: unknown[] = [];
jest.mock('@/app/hooks/useInvoices', () => ({
  useLoadInvoicesForPrimaryOrg: () => loadInvoices(),
  useInvoicesForPrimaryOrg: () => orgInvoices,
}));

const invoiceStoreState = { status: 'loaded' as string };
jest.mock('@/app/stores/invoiceStore', () => ({
  useInvoiceStore: (selector: any) => selector(invoiceStoreState),
}));

import ProtectedPaymentReconciliation from '@/app/features/finance/pages/PaymentReconciliation';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';

const receipt = (over: Partial<ProviderReceipt> = {}): ProviderReceipt => ({
  id: 'rec-1',
  provider: 'STRIPE',
  merchantAccountRef: 'acct_1',
  paymentRef: 'pi_abcdefghijklmnop',
  organisationId: 'org-1',
  invoiceId: 'inv-1',
  appointmentId: 'apt-1',
  amount: 120,
  currency: 'GBP',
  capturedAt: '2026-09-12T14:03:00.000Z',
  status: 'UNALLOCATED',
  reason: 'No invoice found for this capture',
  refundedAmount: 0,
  allocatedAmount: 0,
  version: 1,
  createdAt: '2026-09-12T14:03:05.000Z',
  ...over,
});

const page = (receipts: ProviderReceipt[], nextCursor: string | null = null) => ({
  receipts,
  nextCursor,
  hasMore: nextCursor !== null,
  limit: 50,
});

const renderScreen = () => render(<ProtectedPaymentReconciliation />);

const lastCall = () => listProviderReceipts.mock.calls.at(-1);

/*
 * Scoped to the table on purpose. Every state name also appears as a filter
 * chip, so a bare `getByText('Unallocated')` matches the toolbar as readily as
 * the row - and would still pass if the row stopped rendering entirely.
 */
const rows = async () => within(await screen.findByRole('table'));

const invoice = (id: string, balance: number) =>
  ({
    id,
    organisationId: 'org-1',
    items: [],
    subtotal: balance,
    totalAmount: balance,
    paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
    currency: 'GBP',
    status: 'UNPAID',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    settlementSummary: { balance },
    metadata: { invoiceNumber: id },
  }) as unknown;

beforeEach(() => {
  listProviderReceipts.mockReset();
  allocateProviderReceipt.mockReset();
  loadInvoices.mockReset();
  orgStoreState.primaryOrgId = 'org-1';
  permission.allowed = false;
  invoiceStoreState.status = 'loaded';
  orgInvoices.length = 0;
});

describe('Payment reconciliation screen', () => {
  it('shows a loading state before the first page arrives', async () => {
    let resolvePage: (value: unknown) => void = () => {};
    listProviderReceipts.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      })
    );

    renderScreen();

    expect(screen.getByText('Loading captured payments...')).toBeInTheDocument();

    resolvePage(page([receipt()]));
    await waitFor(() =>
      expect(screen.queryByText('Loading captured payments...')).not.toBeInTheDocument()
    );
  });

  it('renders a capture with its instant, amount, state, reference and source links', async () => {
    listProviderReceipts.mockResolvedValue(page([receipt()]));

    renderScreen();

    const row = await rows();
    expect(row.getByText('12 Sep 2026, 14:03 UTC')).toBeInTheDocument();
    expect(row.getByText('£120.00')).toBeInTheDocument();
    expect(row.getByText('Unallocated')).toBeInTheDocument();
    expect(row.getByText('Stripe')).toBeInTheDocument();

    const reference = row.getByText('pi_abcdefghi...');
    expect(reference).toHaveAttribute('title', 'pi_abcdefghijklmnop');

    expect(screen.getByRole('link', { name: 'Open invoice' })).toHaveAttribute(
      'href',
      '/finance?invoiceId=inv-1'
    );
    expect(screen.getByRole('link', { name: 'Open appointment' })).toHaveAttribute(
      'href',
      '/appointments?appointmentId=apt-1'
    );
    expect(screen.getByText('No invoice found for this capture')).toBeInTheDocument();
  });

  it('says a capture is not linked rather than rendering a dead link', async () => {
    listProviderReceipts.mockResolvedValue(
      page([receipt({ invoiceId: null, appointmentId: null, status: 'UNATTRIBUTED' })])
    );

    renderScreen();

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open appointment' })).not.toBeInTheDocument();
  });

  it('shows what is left of a partly refunded capture beside its captured amount', async () => {
    listProviderReceipts.mockResolvedValue(
      page([receipt({ amount: 120, refundedAmount: 20, status: 'PARTIALLY_REFUNDED' })])
    );

    renderScreen();

    const row = await rows();
    expect(row.getByText('£120.00')).toBeInTheDocument();
    expect(row.getByText('£100.00 after £20.00 refunded')).toBeInTheDocument();
  });

  it('shows no residual line when nothing has been refunded', async () => {
    listProviderReceipts.mockResolvedValue(page([receipt({ refundedAmount: 0 })]));

    renderScreen();

    const row = await rows();
    expect(row.getByText('£120.00')).toBeInTheDocument();
    expect(row.queryByText(/refunded$/)).not.toBeInTheDocument();
  });

  it('distinguishes an empty queue from a filter that matches nothing', async () => {
    listProviderReceipts.mockResolvedValue(page([]));

    renderScreen();

    expect(await screen.findByText('No captured payments yet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Unattributed' }));

    expect(await screen.findByText('No captured payments match these filters')).toBeInTheDocument();
  });

  it('asks for one state when a filter chip is pressed, and starts a new list', async () => {
    listProviderReceipts.mockResolvedValueOnce(page([receipt({ id: 'rec-1' })]));
    listProviderReceipts.mockResolvedValueOnce(
      page([receipt({ id: 'rec-2', paymentRef: 'pi_second', status: 'UNATTRIBUTED' })])
    );

    renderScreen();
    expect((await rows()).getByText('Unallocated')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Unattributed' }));

    await waitFor(() =>
      expect(lastCall()).toEqual([
        'org-1',
        { status: 'UNATTRIBUTED', capturedFrom: undefined, capturedTo: undefined },
      ])
    );
    expect(await screen.findByText('pi_second')).toBeInTheDocument();
    // The previous state's row is gone - the new filter is a new list.
    expect(screen.queryByText('pi_abcdefghi...')).not.toBeInTheDocument();
  });

  it('clears the old rows the moment a filter changes, not when the answer lands', async () => {
    let resolveFiltered: (value: unknown) => void = () => {};
    listProviderReceipts.mockResolvedValueOnce(page([receipt({ id: 'rec-1' })]));
    listProviderReceipts.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFiltered = resolve;
      })
    );

    renderScreen();
    expect((await rows()).getByText('Unallocated')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Unattributed' }));

    // Mid-flight: rows selected by the PREVIOUS filter must already be gone,
    // or the screen shows money under a heading that excludes it.
    expect(screen.getByText('Loading captured payments...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('pi_abcdefghi...')).not.toBeInTheDocument();

    resolveFiltered(page([receipt({ id: 'rec-3', paymentRef: 'pi_filtered' })]));
    expect(await screen.findByText('pi_filtered')).toBeInTheDocument();
  });

  it('sends whole UTC days for the captured window, never a device-local boundary', async () => {
    listProviderReceipts.mockResolvedValue(page([]));

    renderScreen();
    await screen.findByText('No captured payments yet');

    await userEvent.type(screen.getByLabelText('Captured from (UTC)'), '2026-09-01');
    await userEvent.type(screen.getByLabelText('Captured to (UTC)'), '2026-09-30');

    await waitFor(() =>
      expect(lastCall()).toEqual([
        'org-1',
        {
          status: undefined,
          capturedFrom: '2026-09-01T00:00:00.000Z',
          capturedTo: '2026-09-30T23:59:59.999Z',
        },
      ])
    );
  });

  it('appends the next page with the cursor the previous one returned', async () => {
    listProviderReceipts.mockResolvedValueOnce(page([receipt({ id: 'rec-1' })], 'cur-2'));
    listProviderReceipts.mockResolvedValueOnce(
      page([receipt({ id: 'rec-2', paymentRef: 'pi_second' })])
    );

    renderScreen();

    const loadMore = await screen.findByRole('button', { name: 'Load more captured payments' });
    await userEvent.click(loadMore);

    await waitFor(() =>
      expect(lastCall()).toEqual([
        'org-1',
        { status: undefined, capturedFrom: undefined, capturedTo: undefined },
        'cur-2',
      ])
    );

    expect(await screen.findByText('pi_second')).toBeInTheDocument();
    // The first page is still there: a queue is worked down, not restarted.
    expect(screen.getByText('pi_abcdefghi...')).toBeInTheDocument();
  });

  it('opens only the source a capture actually has', async () => {
    listProviderReceipts.mockResolvedValue(
      page([
        receipt({ id: 'rec-invoice-only', paymentRef: 'pi_invoice', appointmentId: null }),
        receipt({ id: 'rec-appt-only', paymentRef: 'pi_appt', invoiceId: null }),
      ])
    );

    renderScreen();

    const row = await rows();
    expect(row.getByRole('link', { name: 'Open invoice' })).toHaveAttribute(
      'href',
      '/finance?invoiceId=inv-1'
    );
    expect(row.getByRole('link', { name: 'Open appointment' })).toHaveAttribute(
      'href',
      '/appointments?appointmentId=apt-1'
    );
    // One of each, not two of either: each row rendered only the link it has.
    expect(row.getAllByRole('link', { name: 'Open invoice' })).toHaveLength(1);
    expect(row.getAllByRole('link', { name: 'Open appointment' })).toHaveLength(1);
  });

  it('encodes an id that would otherwise change the link target', async () => {
    listProviderReceipts.mockResolvedValue(
      page([receipt({ invoiceId: 'inv 1&x=2', appointmentId: null })])
    );

    renderScreen();

    expect((await rows()).getByRole('link', { name: 'Open invoice' })).toHaveAttribute(
      'href',
      '/finance?invoiceId=inv%201%26x%3D2'
    );
  });

  it('reports a failure to read the next page without losing the pages already read', async () => {
    listProviderReceipts.mockResolvedValueOnce(page([receipt({ id: 'rec-1' })], 'cur-2'));
    listProviderReceipts.mockRejectedValueOnce({
      response: { data: { message: 'The queue is unavailable.' } },
    });

    renderScreen();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Load more captured payments' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('The queue is unavailable.');
    // The first page is still on screen - a failed page two is not a lost page one.
    expect((await rows()).getByText('pi_abcdefghi...')).toBeInTheDocument();
  });

  it('will not queue a second page request while the first is still in flight', async () => {
    let resolveSecond: (value: unknown) => void = () => {};
    listProviderReceipts.mockResolvedValueOnce(page([receipt({ id: 'rec-1' })], 'cur-2'));
    listProviderReceipts.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecond = resolve;
      })
    );

    renderScreen();

    const loadMore = await screen.findByRole('button', { name: 'Load more captured payments' });
    await userEvent.click(loadMore);
    await waitFor(() => expect(loadMore).toBeDisabled());
    await userEvent.click(loadMore);

    expect(listProviderReceipts).toHaveBeenCalledTimes(2);

    resolveSecond(page([receipt({ id: 'rec-2', paymentRef: 'pi_second' })]));
    expect(await screen.findByText('pi_second')).toBeInTheDocument();
  });

  it('discards a page that arrives after the filters have moved on', async () => {
    let resolveSecond: (value: unknown) => void = () => {};
    listProviderReceipts.mockResolvedValueOnce(page([receipt({ id: 'rec-1' })], 'cur-2'));
    listProviderReceipts.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecond = resolve;
      })
    );
    listProviderReceipts.mockResolvedValueOnce(
      page([receipt({ id: 'rec-3', paymentRef: 'pi_filtered', status: 'UNATTRIBUTED' })])
    );

    renderScreen();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Load more captured payments' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Unattributed' }));

    expect(await screen.findByText('pi_filtered')).toBeInTheDocument();

    // The page-two answer to the question nobody is asking any more.
    resolveSecond(page([receipt({ id: 'rec-2', paymentRef: 'pi_stale' })]));

    await waitFor(() => expect(screen.getByText('pi_filtered')).toBeInTheDocument());
    expect(screen.queryByText('pi_stale')).not.toBeInTheDocument();
  });

  it('shows a dash where a capture carries no reason, not an empty cell', async () => {
    listProviderReceipts.mockResolvedValue(page([receipt({ reason: null, status: 'ALLOCATED' })]));

    renderScreen();

    expect((await rows()).getByText('—')).toBeInTheDocument();
  });

  it('drops a first page that arrives after the screen is gone', async () => {
    let resolvePage: (value: unknown) => void = () => {};
    listProviderReceipts.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      })
    );

    const { unmount } = renderScreen();
    await screen.findByText('Loading captured payments...');
    unmount();

    // Resolving into an unmounted tree must not touch state; the setup file
    // turns any React warning about it into a failure.
    resolvePage(page([receipt()]));
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
  });

  it('drops a first-page failure that arrives after the screen is gone', async () => {
    let rejectPage: (reason: unknown) => void = () => {};
    listProviderReceipts.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPage = reject;
      })
    );

    const { unmount } = renderScreen();
    await screen.findByText('Loading captured payments...');
    unmount();

    rejectPage(new Error('too late'));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('discards a failed page that arrives after the filters have moved on', async () => {
    let rejectSecond: (reason: unknown) => void = () => {};
    listProviderReceipts.mockResolvedValueOnce(page([receipt({ id: 'rec-1' })], 'cur-2'));
    listProviderReceipts.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectSecond = reject;
      })
    );
    listProviderReceipts.mockResolvedValueOnce(
      page([receipt({ id: 'rec-3', paymentRef: 'pi_filtered', status: 'UNATTRIBUTED' })])
    );

    renderScreen();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Load more captured payments' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Unattributed' }));
    expect(await screen.findByText('pi_filtered')).toBeInTheDocument();

    rejectSecond(new Error('the question nobody is asking any more'));

    // No alert: a failure belonging to a retired query is not this query news.
    await waitFor(() => expect(screen.getByText('pi_filtered')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers no load-more when the response says there is nothing after this page', async () => {
    listProviderReceipts.mockResolvedValue(page([receipt()]));

    renderScreen();
    expect((await rows()).getByText('Unallocated')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'Load more captured payments' })
    ).not.toBeInTheDocument();
  });

  it('reports a failure and retries from the beginning', async () => {
    listProviderReceipts.mockRejectedValueOnce({
      response: { data: { message: 'Invalid reconciliation filter.' } },
    });
    listProviderReceipts.mockResolvedValueOnce(page([receipt()]));

    renderScreen();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid reconciliation filter.');

    await userEvent.click(
      screen.getByRole('button', { name: 'Retry loading the reconciliation queue' })
    );

    expect((await rows()).getByText('Unallocated')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('requests nothing when no organisation is selected', async () => {
    orgStoreState.primaryOrgId = null;
    listProviderReceipts.mockResolvedValue(page([]));

    renderScreen();

    await screen.findByText('No captured payments yet');
    expect(listProviderReceipts).not.toHaveBeenCalled();
  });

  it('links back to the invoice list from the header', async () => {
    listProviderReceipts.mockResolvedValue(page([]));

    renderScreen();

    const header = await screen.findByRole('link', { name: 'Back to invoices' });
    expect(header).toHaveAttribute('href', '/finance');
  });

  it('names every state in the filter row using words, not enum values', async () => {
    listProviderReceipts.mockResolvedValue(page([]));

    renderScreen();
    await screen.findByText('No captured payments yet');

    const filters = screen.getByRole('group', { name: 'Filter captured payments by state' });
    ['All', 'Unattributed', 'Unallocated', 'Partly refunded', 'Allocated', 'Refunded'].forEach(
      (label) => {
        expect(within(filters).getByRole('button', { name: label })).toBeInTheDocument();
      }
    );
  });
});

describe('applying a captured payment from the queue', () => {
  const openDialog = async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Apply the payment captured/ }));
    return user;
  };

  it('offers no action, and fetches no invoices, for a reader who may only view', async () => {
    listProviderReceipts.mockResolvedValue(page([receipt()]));

    renderScreen();
    await rows();

    expect(screen.queryByRole('button', { name: /^Apply the payment captured/ })).toBeNull();
    expect(loadInvoices).not.toHaveBeenCalled();
  });

  /*
   * The fetch is mounted with the dialog rather than with the screen: pulling
   * every invoice in the practice on first paint, for a queue most readers only
   * look at, is a cost the action should charge to the action.
   */
  it('asks for the invoices only once a capture has been chosen', async () => {
    permission.allowed = true;
    listProviderReceipts.mockResolvedValue(page([receipt()]));

    renderScreen();
    await rows();
    expect(loadInvoices).not.toHaveBeenCalled();

    await openDialog();
    expect(loadInvoices).toHaveBeenCalled();
  });

  it('applies the payment and puts the stored receipt back on the row', async () => {
    permission.allowed = true;
    orgInvoices.push(invoice('7701', 40));
    listProviderReceipts.mockResolvedValue(page([receipt({ amount: 120 })]));
    allocateProviderReceipt.mockResolvedValue({
      receipt: receipt({ amount: 120, allocatedAmount: 40, status: 'PARTIALLY_REFUNDED' }),
      remainingAmount: 80,
      allocations: [{ invoiceId: '7701', amount: 40 }],
      replayed: false,
    });

    renderScreen();
    const user = await openDialog();

    await user.click(await screen.findByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Payment applied.'));
    await user.click(screen.getByRole('button', { name: /close the applied payment summary/i }));

    // The row carries the readback, and the queue was not refetched to get it.
    expect((await rows()).getByText('£80.00 unapplied')).toBeInTheDocument();
    expect(listProviderReceipts).toHaveBeenCalledTimes(1);
  });

  it('starts the queue again when the row it read has moved underneath it', async () => {
    permission.allowed = true;
    orgInvoices.push(invoice('7701', 40));
    listProviderReceipts.mockResolvedValue(page([receipt()]));
    const { ProviderReceiptAllocationError } = jest.requireMock(
      '@/app/features/finance/services/providerReceiptService'
    );
    allocateProviderReceipt.mockRejectedValue(
      new ProviderReceiptAllocationError({
        code: 'VERSION_CONFLICT',
        message: 'The receipt changed since it was read.',
      })
    );

    renderScreen();
    const user = await openDialog();
    await user.click(await screen.findByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    await user.click(
      await screen.findByRole('button', { name: /reload the reconciliation queue/i })
    );

    await waitFor(() => expect(listProviderReceipts).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes without applying anything', async () => {
    permission.allowed = true;
    orgInvoices.push(invoice('7701', 40));
    listProviderReceipts.mockResolvedValue(page([receipt()]));

    renderScreen();
    const user = await openDialog();
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(allocateProviderReceipt).not.toHaveBeenCalled();
  });
});
