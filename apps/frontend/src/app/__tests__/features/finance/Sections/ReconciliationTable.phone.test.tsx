import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

const isPhone = { value: false };
jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  useIsPhone: () => isPhone.value,
}));

import ReconciliationTable from '@/app/features/finance/pages/PaymentReconciliation/Sections/ReconciliationTable';
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
  version: 1,
  createdAt: '2026-09-12T14:03:05.000Z',
  ...over,
});

const renderTable = (props: Partial<React.ComponentProps<typeof ReconciliationTable>> = {}) =>
  render(
    <ReconciliationTable
      receipts={[receipt()]}
      loading={false}
      loadingMore={false}
      hasMore={false}
      isFiltered={false}
      onLoadMore={jest.fn()}
      {...props}
    />
  );

beforeEach(() => {
  isPhone.value = false;
});

describe('ReconciliationTable at the phone breakpoint', () => {
  it('swaps the six-column table for cards, because the columns do not fit', () => {
    isPhone.value = true;
    renderTable();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = within(
      screen.getByRole('list', {
        name: 'Captured payments and how far each one has been reconciled',
      })
    );
    // Every field the table shows is still readable, which is the whole point.
    expect(cards.getByText('12 Sep 2026, 14:03 UTC')).toBeInTheDocument();
    expect(cards.getByText('Unallocated')).toBeInTheDocument();
    expect(cards.getByText('pi_abcdefghi...')).toBeInTheDocument();
    expect(cards.getByRole('link', { name: 'Open invoice' })).toBeInTheDocument();
  });

  it('keeps the table above the phone breakpoint', () => {
    renderTable();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.queryByRole('list', {
        name: 'Captured payments and how far each one has been reconciled',
      })
    ).not.toBeInTheDocument();
  });

  it('describes an empty queue with the same words at both widths', () => {
    const { unmount } = renderTable({ receipts: [] });
    const desktopTitle = screen.getByText('No captured payments yet');
    const desktopSubtitle = screen.getByText(
      'Card payments are journalled here as soon as the provider captures them.'
    );
    expect(desktopTitle).toBeInTheDocument();
    expect(desktopSubtitle).toBeInTheDocument();
    unmount();

    isPhone.value = true;
    renderTable({ receipts: [] });

    expect(screen.getByText('No captured payments yet')).toBeInTheDocument();
    expect(
      screen.getByText('Card payments are journalled here as soon as the provider captures them.')
    ).toBeInTheDocument();
  });

  it('distinguishes a filter that matches nothing on a phone too', () => {
    isPhone.value = true;
    renderTable({ receipts: [], isFiltered: true });

    expect(screen.getByText('No captured payments match these filters')).toBeInTheDocument();
    expect(
      screen.getByText('Widen the date range, or choose a different state.')
    ).toBeInTheDocument();
  });

  it('still offers the next page on a phone', () => {
    isPhone.value = true;
    const onLoadMore = jest.fn();
    renderTable({ hasMore: true, onLoadMore });

    screen.getByRole('button', { name: 'Load more captured payments' }).click();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows the loading state at both widths before any rows exist', () => {
    isPhone.value = true;
    renderTable({ receipts: [], loading: true });

    expect(screen.getByText('Loading captured payments...')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
