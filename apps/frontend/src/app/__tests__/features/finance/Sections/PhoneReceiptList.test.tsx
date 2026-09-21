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

import PhoneReceiptList from '@/app/features/finance/pages/PaymentReconciliation/Sections/PhoneReceiptList';
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

const list = () =>
  screen.getByRole('list', {
    name: 'Captured payments and how far each one has been reconciled',
  });

describe('PhoneReceiptList', () => {
  it('carries every field the table shows, since none of them fit as columns', () => {
    render(<PhoneReceiptList receipts={[receipt()]} />);

    const card = within(list());
    expect(card.getByText('12 Sep 2026, 14:03 UTC')).toBeInTheDocument();
    expect(card.getByText('£120.00')).toBeInTheDocument();
    expect(card.getByText('Unallocated')).toBeInTheDocument();
    expect(card.getByText('Stripe')).toBeInTheDocument();
    expect(card.getByText('pi_abcdefghi...')).toHaveAttribute('title', 'pi_abcdefghijklmnop');
    expect(card.getByRole('link', { name: 'Open invoice' })).toHaveAttribute(
      'href',
      '/finance?invoiceId=inv-1'
    );
    expect(card.getByRole('link', { name: 'Open appointment' })).toHaveAttribute(
      'href',
      '/appointments?appointmentId=apt-1'
    );
    expect(card.getByText('No invoice found for this capture')).toBeInTheDocument();
  });

  it('shows what is left of a partly refunded capture', () => {
    render(
      <PhoneReceiptList
        receipts={[receipt({ amount: 120, refundedAmount: 20, status: 'PARTIALLY_REFUNDED' })]}
      />
    );

    const card = within(list());
    expect(card.getByText('£120.00')).toBeInTheDocument();
    expect(card.getByText('£100.00 after £20.00 refunded')).toBeInTheDocument();
  });

  it('omits the residual line when nothing has been refunded', () => {
    render(<PhoneReceiptList receipts={[receipt({ refundedAmount: 0 })]} />);

    expect(within(list()).queryByText(/refunded$/)).not.toBeInTheDocument();
  });

  it('says a capture is not linked rather than rendering a dead link', () => {
    render(
      <PhoneReceiptList
        receipts={[receipt({ invoiceId: null, appointmentId: null, status: 'UNATTRIBUTED' })]}
      />
    );

    const card = within(list());
    expect(card.getByText('Not linked')).toBeInTheDocument();
    expect(card.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders only the source a capture actually has', () => {
    render(
      <PhoneReceiptList
        receipts={[
          receipt({ id: 'a', paymentRef: 'pi_invoice_only', appointmentId: null }),
          receipt({ id: 'b', paymentRef: 'pi_appointment_only', invoiceId: null }),
        ]}
      />
    );

    const card = within(list());
    expect(card.getAllByRole('link', { name: 'Open invoice' })).toHaveLength(1);
    expect(card.getAllByRole('link', { name: 'Open appointment' })).toHaveLength(1);
  });

  it('leaves the reason out entirely when a capture carries none', () => {
    render(<PhoneReceiptList receipts={[receipt({ reason: null, status: 'ALLOCATED' })]} />);

    // A dash is a table affordance - it keeps a column aligned. A card has no
    // column, so an absent reason is absent rather than punctuated.
    expect(within(list()).queryByText('—')).not.toBeInTheDocument();
    expect(within(list()).getByText('Allocated')).toBeInTheDocument();
  });

  it('renders one card per capture', () => {
    render(
      <PhoneReceiptList
        receipts={[receipt({ id: 'a' }), receipt({ id: 'b' }), receipt({ id: 'c' })]}
      />
    );

    expect(within(list()).getAllByRole('listitem')).toHaveLength(3);
  });
});
