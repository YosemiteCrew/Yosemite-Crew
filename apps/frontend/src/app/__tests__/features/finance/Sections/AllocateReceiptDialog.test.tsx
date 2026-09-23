import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { Invoice } from '@yosemite-crew/types';

const allocateProviderReceipt = jest.fn();

/*
 * The error class is defined inside the factory and imported back out below.
 * A class declared beside the mock cannot be referenced from it - the factory
 * runs when the component first requires the module, which is before this
 * file's own bindings exist - and requiring the real service here would build
 * the shared axios client for a suite that never makes a request.
 */
jest.mock('@/app/features/finance/services/providerReceiptService', () => {
  class ProviderReceiptAllocationError extends Error {
    readonly failure: { code: string; message: string };

    constructor(failure: { code: string; message: string }) {
      super(failure.message);
      this.name = 'ProviderReceiptAllocationError';
      this.failure = failure;
    }
  }

  return {
    __esModule: true,
    allocateProviderReceipt: (...args: unknown[]) => allocateProviderReceipt(...args),
    ProviderReceiptAllocationError,
  };
});

import { ProviderReceiptAllocationError } from '@/app/features/finance/services/providerReceiptService';
import AllocateReceiptDialog from '@/app/features/finance/pages/PaymentReconciliation/Sections/AllocateReceiptDialog';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';

const receipt = (over: Partial<ProviderReceipt> = {}): ProviderReceipt => ({
  id: 'rec-1',
  provider: 'STRIPE',
  merchantAccountRef: 'acct_1',
  paymentRef: 'pi_abcdefghijklmnop',
  organisationId: 'org-1',
  invoiceId: null,
  appointmentId: null,
  amount: 100,
  currency: 'GBP',
  capturedAt: '2026-09-12T14:03:00.000Z',
  status: 'UNALLOCATED',
  reason: null,
  refundedAmount: 0,
  allocatedAmount: 0,
  version: 4,
  createdAt: '2026-09-12T14:03:05.000Z',
  ...over,
});

const invoice = (id: string, balance: number, over: Record<string, unknown> = {}): Invoice =>
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
    ...over,
  }) as unknown as Invoice;

type Overrides = Partial<React.ComponentProps<typeof AllocateReceiptDialog>>;

const onClose = jest.fn();
const onAllocated = jest.fn();
const onRequestReload = jest.fn();

const renderDialog = (over: Overrides = {}) =>
  render(
    <AllocateReceiptDialog
      receipt={receipt()}
      organisationId="org-1"
      invoices={[invoice('7701', 40), invoice('7702', 90)]}
      invoicesLoading={false}
      onClose={onClose}
      onAllocated={onAllocated}
      onRequestReload={onRequestReload}
      {...over}
    />
  );

const amountBox = (label: string) => screen.getByLabelText(`Amount to apply to #${label}`);

beforeEach(() => {
  allocateProviderReceipt.mockReset();
  onClose.mockReset();
  onAllocated.mockReset();
  onRequestReload.mockReset();
});

describe('AllocateReceiptDialog', () => {
  it('names itself by its own heading', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Apply captured payment' })).toBeInTheDocument();
  });

  it('offers only the invoices the route would accept', () => {
    renderDialog({
      invoices: [
        invoice('7701', 40),
        invoice('7702', 50, { currency: 'EUR' }),
        invoice('7703', 50, { status: 'CANCELLED' }),
        invoice('7704', 0, { settlementSummary: { balance: 0 } }),
      ],
    });

    expect(screen.getByText('#7701')).toBeInTheDocument();
    ['#7702', '#7703', '#7704'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  it('says there is nothing to apply to rather than showing an empty picker', () => {
    renderDialog({ invoices: [] });

    expect(screen.getByText(/no open invoice in GBP/i)).toBeInTheDocument();
  });

  it('tells a reader that the invoices are still arriving', () => {
    renderDialog({ invoices: [], invoicesLoading: true });

    expect(screen.getByText('Loading invoices...')).toBeInTheDocument();
    expect(screen.queryByText(/no open invoice/i)).not.toBeInTheDocument();
  });

  it('refuses to open on a capture the route would refuse, and says why', () => {
    renderDialog({ receipt: receipt({ organisationId: null, status: 'UNATTRIBUTED' }) });

    expect(screen.getByRole('alert')).toHaveTextContent(/not been attributed/i);
    expect(screen.queryByRole('button', { name: /apply this captured payment/i })).toBeNull();
  });

  it('seeds a ticked invoice with the most that is valid on both counts', async () => {
    const user = userEvent.setup();
    renderDialog({
      receipt: receipt({ amount: 60 }),
      invoices: [invoice('7701', 40), invoice('7702', 90)],
    });

    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    expect(amountBox('7701')).toHaveValue('40.00');

    // 60 captured less the 40 now claimed leaves 20, which is less than 7702 owes.
    await user.click(screen.getByRole('checkbox', { name: /#7702/ }));
    expect(amountBox('7702')).toHaveValue('20.00');
  });

  it('previews what the capture would have left before anything is committed', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));

    expect(screen.getByText(/£40\.00 selected\./)).toBeInTheDocument();
    expect(screen.getByText(/£60\.00 would remain unapplied\./)).toBeInTheDocument();
    expect(allocateProviderReceipt).not.toHaveBeenCalled();
  });

  it('holds the submit shut while a line is over the invoice it names', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.clear(amountBox('7701'));
    await user.type(amountBox('7701'), '41');

    expect(amountBox('7701')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /apply this captured payment/i })).toHaveClass(
      'pointer-events-none'
    );
  });

  it('posts the version it read and a key of its own, then reads the receipt back', async () => {
    const user = userEvent.setup();
    const stored = receipt({ status: 'ALLOCATED', allocatedAmount: 40, version: 5 });
    allocateProviderReceipt.mockResolvedValue({
      receipt: stored,
      remainingAmount: 60,
      allocations: [{ invoiceId: '7701', amount: 40 }],
      replayed: false,
    });

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    await waitFor(() => expect(onAllocated).toHaveBeenCalledWith(stored));
    const [org, receiptId, body] = allocateProviderReceipt.mock.calls[0];
    expect(org).toBe('org-1');
    expect(receiptId).toBe('rec-1');
    expect(body.expectedVersion).toBe(4);
    expect(body.idempotencyKey).toEqual(expect.any(String));
    expect(body.idempotencyKey.length).toBeGreaterThan(0);
    expect(body.allocations).toEqual([{ invoiceId: '7701', amount: 40 }]);

    expect(screen.getByRole('status')).toHaveTextContent('Payment applied.');
    expect(screen.getByText(/£60\.00 of this capture is still unapplied/)).toBeInTheDocument();
  });

  /*
   * The readback is rendered from the response, so a server that applied less
   * than was asked for - an invoice part-paid between the preview and the
   * write - is reported at what it actually applied.
   */
  it('reports what the server applied rather than what was requested', async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockResolvedValue({
      receipt: receipt({ allocatedAmount: 25 }),
      remainingAmount: 75,
      allocations: [{ invoiceId: '7701', amount: 25 }],
      replayed: false,
    });

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    await waitFor(() => expect(screen.getByText('£25.00 applied')).toBeInTheDocument());
    expect(screen.queryByText('£40.00 applied')).not.toBeInTheDocument();
  });

  it('reports a replay as a success and says nothing was posted twice', async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockResolvedValue({
      receipt: receipt(),
      remainingAmount: 60,
      allocations: [{ invoiceId: '7701', amount: 40 }],
      replayed: true,
    });

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/had already been applied/i)
    );
  });

  it("shows the server's own sentence when it refuses", async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockRejectedValue(
      new ProviderReceiptAllocationError({
        code: 'ACCOUNT_MISMATCH',
        message: "The money for this capture is not held in this organisation's connected account.",
      })
    );

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    await waitFor(() =>
      expect(screen.getByText(/not held in this organisation/i)).toBeInTheDocument()
    );
    expect(onAllocated).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers a reload rather than a retry when the row it read has moved', async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockRejectedValue(
      new ProviderReceiptAllocationError({
        code: 'VERSION_CONFLICT',
        message:
          'The receipt changed since it was read. Reload it and submit the allocation again.',
      })
    );

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    const reload = await screen.findByRole('button', {
      name: /reload the reconciliation queue/i,
    });
    await user.click(reload);
    expect(onRequestReload).toHaveBeenCalledTimes(1);
  });

  it('does not offer a reload for a refusal a reload cannot fix', async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockRejectedValue(
      new ProviderReceiptAllocationError({ code: 'ACCOUNT_MISMATCH', message: 'Wrong account.' })
    );

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    await waitFor(() => expect(screen.getByText('Wrong account.')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /reload the reconciliation queue/i })).toBeNull();
  });

  /*
   * The whole point of the key. A retry of the SAME decision must be
   * recognisable as one, or a request whose answer was lost is posted twice.
   */
  it('retries a failed submit under the same idempotency key', async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockRejectedValueOnce(new Error('network down'));
    allocateProviderReceipt.mockResolvedValueOnce({
      receipt: receipt(),
      remainingAmount: 60,
      allocations: [],
      replayed: true,
    });

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    const apply = screen.getByRole('button', { name: /apply this captured payment/i });
    await user.click(apply);
    await waitFor(() => expect(screen.getByText(/unable to apply/i)).toBeInTheDocument());

    await user.click(apply);
    await waitFor(() => expect(allocateProviderReceipt).toHaveBeenCalledTimes(2));

    const [first, second] = allocateProviderReceipt.mock.calls;
    expect(second[2].idempotencyKey).toBe(first[2].idempotencyKey);
  });

  it('mints a new key once the operator changes what they are asking for', async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockRejectedValueOnce(new Error('network down'));
    allocateProviderReceipt.mockResolvedValueOnce({
      receipt: receipt(),
      remainingAmount: 70,
      allocations: [],
      replayed: false,
    });

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    const apply = screen.getByRole('button', { name: /apply this captured payment/i });
    await user.click(apply);
    await waitFor(() => expect(screen.getByText(/unable to apply/i)).toBeInTheDocument());

    await user.clear(amountBox('7701'));
    await user.type(amountBox('7701'), '30');
    await user.click(apply);
    await waitFor(() => expect(allocateProviderReceipt).toHaveBeenCalledTimes(2));

    const [first, second] = allocateProviderReceipt.mock.calls;
    expect(second[2].idempotencyKey).not.toBe(first[2].idempotencyKey);
    expect(second[2].allocations).toEqual([{ invoiceId: '7701', amount: 30 }]);
  });

  it('refuses to dismiss while a request is in flight', async () => {
    const user = userEvent.setup();
    let settle: (value: unknown) => void = () => {};
    allocateProviderReceipt.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    expect(screen.getByRole('button', { name: /^Cancel$/ })).toHaveClass('pointer-events-none');
    expect(amountBox('7701')).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    /*
     * Escape and a backdrop click reach the dialog shell rather than the form,
     * so a guard that only disabled the Cancel button would still let the
     * dialog be dismissed out from under a request already on the wire.
     */
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    settle({ receipt: receipt(), remainingAmount: 60, allocations: [], replayed: false });
    await waitFor(() => expect(onAllocated).toHaveBeenCalled());
  });

  it('closes from the readback rather than leaving the operator in the form', async () => {
    const user = userEvent.setup();
    allocateProviderReceipt.mockResolvedValue({
      receipt: receipt(),
      remainingAmount: 0,
      allocations: [{ invoiceId: '7701', amount: 40 }],
      replayed: false,
    });

    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    await user.click(screen.getByRole('button', { name: /apply this captured payment/i }));

    const done = await screen.findByRole('button', { name: /close the applied payment summary/i });
    await user.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while no capture is chosen', () => {
    renderDialog({ receipt: null });

    expect(screen.queryByText('Apply captured payment')).toBeNull();
  });

  it('measures the draft against the residual of a partly settled capture', async () => {
    const user = userEvent.setup();
    renderDialog({
      receipt: receipt({ status: 'PARTIALLY_REFUNDED', refundedAmount: 30, allocatedAmount: 40 }),
    });

    expect(screen.getByText(/£30\.00 of this capture is unapplied/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /#7702/ }));
    expect(amountBox('7702')).toHaveValue('30.00');

    await user.clear(amountBox('7702'));
    await user.type(amountBox('7702'), '31');
    const alerts = screen.getAllByRole('alert').map((node) => node.textContent ?? '');
    expect(alerts.join(' ')).toContain('more than this capture has left to apply');
  });

  it('untickes a line back out of the total', async () => {
    const user = userEvent.setup();
    renderDialog();

    const box = screen.getByRole('checkbox', { name: /#7701/ });
    await user.click(box);
    expect(screen.getByText(/£40\.00 selected\./)).toBeInTheDocument();

    await user.click(box);
    expect(screen.getByText(/£0\.00 selected\./)).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount to apply to #7701')).toBeNull();
  });

  it('keeps each capture inside its own form', async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /#7701/ }));
    expect(amountBox('7701')).toHaveValue('40.00');

    rerender(
      <AllocateReceiptDialog
        receipt={receipt({ id: 'rec-2', paymentRef: 'pi_second' })}
        organisationId="org-1"
        invoices={[invoice('7701', 40), invoice('7702', 90)]}
        invoicesLoading={false}
        onClose={onClose}
        onAllocated={onAllocated}
        onRequestReload={onRequestReload}
      />
    );

    expect(screen.getByRole('checkbox', { name: /#7701/ })).not.toBeChecked();
    expect(screen.queryByLabelText('Amount to apply to #7701')).toBeNull();
  });

  it('labels the header with the capture it is about', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Apply captured payment' });
    expect(within(dialog).getByText(/12 Sep 2026, 14:03 UTC/)).toBeInTheDocument();
  });

  it('dismisses on Escape while nothing is in flight', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
