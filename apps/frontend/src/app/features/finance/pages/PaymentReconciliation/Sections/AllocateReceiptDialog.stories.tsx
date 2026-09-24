import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Invoice } from '@yosemite-crew/types';

import AllocateReceiptDialog from './AllocateReceiptDialog';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';

const receipt = (over: Partial<ProviderReceipt> = {}): ProviderReceipt => ({
  id: 'rec-unallocated',
  provider: 'STRIPE',
  merchantAccountRef: 'acct_harbourside',
  paymentRef: 'pi_3QhZ2mUnallocated',
  organisationId: 'org-1',
  invoiceId: null,
  appointmentId: 'apt-4821',
  amount: 132.5,
  currency: 'GBP',
  capturedAt: '2026-09-12T10:41:00.000Z',
  status: 'UNALLOCATED',
  reason: 'The appointment already has a settled invoice',
  refundedAmount: 0,
  allocatedAmount: 0,
  version: 4,
  createdAt: '2026-09-12T10:41:04.000Z',
  ...over,
});

const invoice = (number: string, balance: number, over: Record<string, unknown> = {}): Invoice =>
  ({
    id: `inv-${number}`,
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
    metadata: { invoiceNumber: number },
    ...over,
  }) as unknown as Invoice;

const INVOICES: Invoice[] = [
  invoice('7714', 92.5),
  invoice('7702', 60),
  // Filtered out by the picker, for the three reasons the route refuses a line.
  invoice('7690', 40, { currency: 'EUR' }),
  invoice('7655', 120, { status: 'CANCELLED' }),
  invoice('7640', 0, { settlementSummary: { balance: 0 } }),
];

const meta = {
  title: 'Finance/Payment reconciliation/Apply captured payment',
  component: AllocateReceiptDialog,
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/payment-reconciliation' } },
    docs: {
      description: {
        component:
          'The action the reconciliation queue leads to. The endpoint behind it had ' +
          'existed for some time with no caller in the product, so an operator could see ' +
          'an unapplied capture and still needed an API client to do anything about it.\n\n' +
          'The picker offers only invoices the endpoint would accept - same currency as ' +
          'the capture, not a closed document, something still owed - so the list cannot ' +
          'contain a row the write will refuse. Five invoices are passed in below and two ' +
          'are offered.\n\n' +
          'Every figure in the summary after a successful write comes from the response, ' +
          'never from the form: a server that applied less than was asked for, because an ' +
          'invoice was part-paid in between, is reported at what it actually applied.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    receipt: receipt(),
    organisationId: 'org-1',
    invoices: INVOICES,
    invoicesLoading: false,
    onClose: fn(),
    onAllocated: fn(),
    onRequestReload: fn(),
  },
} satisfies Meta<typeof AllocateReceiptDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The panel as it opens, drawn rather than left behind a trigger.
 *
 * `ModalBase` portals to `document.body`, so the dialog is searched for on the
 * page rather than inside the canvas element.
 */
export const Open: Story = {
  name: 'Choosing where the money goes',
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));

    await expect(dialog.getByText('#7714')).toBeVisible();
    await expect(dialog.getByText('#7702')).toBeVisible();
    await expect(dialog.queryByText('#7690')).not.toBeInTheDocument();
    await expect(dialog.queryByText('#7655')).not.toBeInTheDocument();
    await expect(dialog.queryByText('#7640')).not.toBeInTheDocument();
    await expect(dialog.getByText(/£132\.50 of this capture is unapplied/)).toBeVisible();
  },
};

/** Ticking an invoice seeds the largest figure valid against both limits. */
export const WithALineChosen: Story = {
  name: 'A line chosen, and the residual it would leave',
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));

    await userEvent.click(dialog.getByRole('checkbox', { name: /#7714/ }));

    await expect(dialog.getByLabelText('Amount to apply to #7714')).toHaveValue('92.50');
    await waitFor(() => expect(dialog.getByText(/£92\.50 selected/)).toBeVisible());
    await expect(dialog.getByText(/£40\.00 would remain unapplied/)).toBeVisible();
  },
};

/** The one figure the whole screen is decided from, on a part-settled capture. */
export const PartlySettled: Story = {
  name: 'A capture already part refunded and part applied',
  args: {
    receipt: receipt({ status: 'PARTIALLY_REFUNDED', refundedAmount: 32.5, allocatedAmount: 60 }),
  },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByText(/£40\.00 of this capture is unapplied/)).toBeVisible();
  },
};

/**
 * Nothing to apply to is a fact about the invoices, not an empty list.
 *
 * A picker rendered empty reads as a screen that failed to load; this says
 * which condition no invoice met.
 */
export const NothingEligible: Story = {
  name: 'No invoice can take this capture',
  args: { invoices: [] },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByText(/No open invoice in GBP/)).toBeVisible();
  },
};

/** Still arriving is a different state from none, and says so. */
export const InvoicesLoading: Story = {
  name: 'Waiting for the invoices',
  args: { invoices: [], invoicesLoading: true },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByText('Loading invoices...')).toBeVisible();
    await expect(dialog.queryByText(/No open invoice/)).not.toBeInTheDocument();
  },
};

/**
 * A capture the route would refuse is refused here instead of being offered a
 * form. The queue does not render the action on one of these; the panel says
 * why in case it is reached any other way.
 */
export const NotAttributed: Story = {
  name: 'A capture nobody owns yet',
  args: { receipt: receipt({ organisationId: null, status: 'UNATTRIBUTED' }) },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByRole('alert')).toHaveTextContent(/not been attributed/i);
  },
};
