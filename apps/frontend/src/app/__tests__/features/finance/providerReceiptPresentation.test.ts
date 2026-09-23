import type { Invoice } from '@yosemite-crew/types';
import {
  ALL_STATUSES_KEY,
  allocatableInvoices,
  allocatedInvoiceLabel,
  allocatableResidual,
  allocationBlockedReason,
  canAllocate,
  RECONCILIATION_STATUS_FILTERS,
  formatCapturedAt,
  netCaptured,
  providerLabel,
  statusLabel,
  statusTone,
  toStatusFilter,
  truncateReference,
  utcDayEnd,
  utcDayStart,
} from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import { PROVIDER_RECEIPT_STATUSES } from '@/app/features/finance/types/providerReceipt';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';

describe('status presentation', () => {
  it('never renders a raw enum for any state the journal can hold', () => {
    PROVIDER_RECEIPT_STATUSES.forEach((status) => {
      const label = statusLabel(status);
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/_/);
      expect(label).not.toBe(status);
    });
  });

  it('colours unattributed money as the state that cannot be left alone', () => {
    expect(statusTone('UNATTRIBUTED')).toBe('danger');
    expect(statusTone('UNALLOCATED')).toBe('warning');
    expect(statusTone('PARTIALLY_REFUNDED')).toBe('warning');
    expect(statusTone('ALLOCATED')).toBe('success');
    expect(statusTone('REFUNDED')).toBe('neutral');
  });

  it('offers All first and then every state, in queue-working order', () => {
    expect(RECONCILIATION_STATUS_FILTERS[0]).toEqual({ key: ALL_STATUSES_KEY, name: 'All' });
    expect(RECONCILIATION_STATUS_FILTERS.slice(1).map((option) => option.key)).toEqual([
      ...PROVIDER_RECEIPT_STATUSES,
    ]);
  });

  it('maps the All key to no filter, and a state key to itself', () => {
    expect(toStatusFilter(ALL_STATUSES_KEY)).toBeUndefined();
    expect(toStatusFilter('UNATTRIBUTED')).toBe('UNATTRIBUTED');
  });

  it('title-cases the provider rather than showing the wire value', () => {
    expect(providerLabel('STRIPE')).toBe('Stripe');
    expect(providerLabel('')).toBe('Unknown');
  });
});

describe('the reconciliation window', () => {
  it('pins a picked day to whole UTC boundaries, not the device timezone', () => {
    expect(utcDayStart('2026-09-12')).toBe('2026-09-12T00:00:00.000Z');
    expect(utcDayEnd('2026-09-12')).toBe('2026-09-12T23:59:59.999Z');
  });

  it('sends nothing at all for an empty or half-typed date', () => {
    expect(utcDayStart('')).toBeUndefined();
    expect(utcDayEnd('')).toBeUndefined();
    expect(utcDayStart('2026-09')).toBeUndefined();
    expect(utcDayEnd('12/09/2026')).toBeUndefined();
  });

  it('formats a capture time in UTC and says so', () => {
    expect(formatCapturedAt('2026-09-12T14:03:00.000Z')).toBe('12 Sep 2026, 14:03 UTC');
  });

  it('formats the same instant identically whichever offset states it', () => {
    expect(formatCapturedAt('2026-09-12T16:03:00.000+02:00')).toBe(
      formatCapturedAt('2026-09-12T14:03:00.000Z')
    );
  });

  /*
   * The property is that the column does not move with the reader's device.
   * A string assertion cannot show that: CI runs in UTC, where a local-time
   * implementation prints exactly the same thing, and `process.env.TZ` does
   * not take effect inside a jest worker (measured: a Kiritimati override
   * still reported the UTC day). What is observable is which accessors the
   * formatter reads, so that is what is asserted.
   */
  it('reads the instant through UTC accessors only, never the local ones', () => {
    const localAccessors = [
      'getDate',
      'getHours',
      'getMinutes',
      'getFullYear',
      'getMonth',
    ] as const;
    const spies = localAccessors.map((name) => jest.spyOn(Date.prototype, name));

    expect(formatCapturedAt('2026-09-12T14:03:00.000Z')).toBe('12 Sep 2026, 14:03 UTC');

    localAccessors.forEach((name, index) => {
      expect({ [name]: spies[index].mock.calls.length }).toEqual({ [name]: 0 });
    });
    spies.forEach((spy) => spy.mockRestore());
  });

  it('says Unknown for a missing or unparseable instant', () => {
    expect(formatCapturedAt('')).toBe('Unknown');
    expect(formatCapturedAt('not-a-date')).toBe('Unknown');
  });
});

const receipt = (over: Partial<ProviderReceipt>): ProviderReceipt =>
  ({ amount: 100, refundedAmount: 0, ...over }) as ProviderReceipt;

describe('money and references', () => {
  it('nets a refund off the captured amount', () => {
    expect(netCaptured(receipt({ amount: 100, refundedAmount: 25 }))).toBe(75);
    expect(netCaptured(receipt({ amount: 100, refundedAmount: 0 }))).toBe(100);
    expect(netCaptured(receipt({ amount: 100, refundedAmount: 100 }))).toBe(0);
  });

  it('marks a truncated reference as truncated, and leaves a short one whole', () => {
    expect(truncateReference('pi_abcdefghijklmnop')).toBe('pi_abcdefghi...');
    expect(truncateReference('pi_short')).toBe('pi_short');
    expect(truncateReference('')).toBe('Unknown');
  });

  it('does not truncate a reference exactly at the keep length', () => {
    expect(truncateReference('123456789012')).toBe('123456789012');
    expect(truncateReference('1234567890123')).toBe('123456789012...');
  });
});

/*
 * The allocate action's own preconditions.
 *
 * Three of the route's refusals are knowable from the row, and each of these
 * mirrors one of them. They are asserted against the route's behaviour rather
 * than against each other: the value of mirroring a rule is that the operator
 * is not offered an action already known to be refused, and that is only true
 * while the two agree.
 */

const allocatable = (over: Partial<ProviderReceipt> = {}): ProviderReceipt => ({
  id: 'rec-1',
  provider: 'STRIPE',
  merchantAccountRef: 'acct_1',
  paymentRef: 'pi_1',
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
  version: 1,
  createdAt: '2026-09-12T14:03:05.000Z',
  ...over,
});

const asInvoice = (over: Partial<Invoice> = {}): Invoice =>
  ({
    id: 'inv-1',
    organisationId: 'org-1',
    items: [],
    subtotal: 40,
    totalAmount: 40,
    paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
    currency: 'GBP',
    status: 'UNPAID',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    settlementSummary: { balance: 40 },
    ...over,
  }) as unknown as Invoice;

describe('allocatableResidual', () => {
  it('subtracts what was refunded and what was already applied', () => {
    expect(allocatableResidual(allocatable({ refundedAmount: 30, allocatedAmount: 25 }))).toBe(45);
  });

  it('never reports a negative residual', () => {
    expect(allocatableResidual(allocatable({ refundedAmount: 80, allocatedAmount: 40 }))).toBe(0);
  });

  it('rounds at the scale the wire uses', () => {
    expect(
      allocatableResidual(allocatable({ amount: 0.3, refundedAmount: 0.1, allocatedAmount: 0 }))
    ).toBe(0.2);
  });
});

describe('canAllocate', () => {
  it('allows a capture this organisation owns with something left', () => {
    expect(canAllocate(allocatable())).toBe(true);
    expect(allocationBlockedReason(allocatable())).toBeNull();
  });

  it('refuses a capture nobody owns yet, as the route does', () => {
    const orphan = allocatable({ organisationId: null, status: 'UNATTRIBUTED' });
    expect(canAllocate(orphan)).toBe(false);
    expect(allocationBlockedReason(orphan)).toMatch(/not been attributed/i);
  });

  it('refuses a capture refunded in full', () => {
    const refunded = allocatable({ status: 'REFUNDED', refundedAmount: 100 });
    expect(canAllocate(refunded)).toBe(false);
    expect(allocationBlockedReason(refunded)).toMatch(/refunded in full/i);
  });

  it('refuses a capture with nothing left to apply', () => {
    const spent = allocatable({ status: 'ALLOCATED', allocatedAmount: 100 });
    expect(canAllocate(spent)).toBe(false);
    expect(allocationBlockedReason(spent)).toMatch(/already been applied/i);
  });

  it('allows a partly refunded capture that still has a residual', () => {
    expect(canAllocate(allocatable({ status: 'PARTIALLY_REFUNDED', refundedAmount: 40 }))).toBe(
      true
    );
  });

  it('says something exactly when it refuses', () => {
    const cases = [
      allocatable(),
      allocatable({ organisationId: null }),
      allocatable({ status: 'REFUNDED' }),
      allocatable({ allocatedAmount: 100 }),
    ];
    cases.forEach((row) => {
      expect(allocationBlockedReason(row) === null).toBe(canAllocate(row));
    });
  });
});

describe('allocatableInvoices', () => {
  it('offers an open invoice in the capture currency with a balance', () => {
    const offered = allocatableInvoices([asInvoice()], allocatable());

    expect(offered).toEqual([
      expect.objectContaining({ id: 'inv-1', currency: 'GBP', balance: 40 }),
    ]);
  });

  it('drops an invoice in another currency', () => {
    expect(allocatableInvoices([asInvoice({ currency: 'EUR' })], allocatable())).toEqual([]);
  });

  /*
   * The case that makes the status check load-bearing rather than redundant.
   * A cancelled invoice can still carry an outstanding settlement balance, so
   * a filter written on the balance alone would offer it - and the route
   * refuses it as INVOICE_CLOSED.
   */
  it('drops a cancelled invoice that still shows an outstanding balance', () => {
    const cancelled = asInvoice({ status: 'CANCELLED' } as Partial<Invoice>);
    expect(allocatableInvoices([cancelled], allocatable())).toEqual([]);
  });

  it('drops a refunded invoice on the same reasoning', () => {
    const refunded = asInvoice({ status: 'REFUNDED' } as Partial<Invoice>);
    expect(allocatableInvoices([refunded], allocatable())).toEqual([]);
  });

  it('drops an invoice with nothing owed', () => {
    const settled = asInvoice({ settlementSummary: { balance: 0 } } as Partial<Invoice>);
    expect(allocatableInvoices([settled], allocatable())).toEqual([]);
  });

  it('drops a record with no id, which cannot be named in an allocation', () => {
    expect(allocatableInvoices([asInvoice({ id: undefined })], allocatable())).toEqual([]);
  });
});

describe('allocatedInvoiceLabel', () => {
  it('reads an applied line under the invoice number the practice issued', () => {
    const numbered = asInvoice({
      metadata: { invoiceNumber: 'INV-2026-0042' },
    } as Partial<Invoice>);

    expect(allocatedInvoiceLabel('inv-1', [numbered])).toBe('#INV-2026-0042');
  });

  /*
   * The case the picker cannot answer: a replay names the invoice the earlier
   * decision closed, and a closed invoice is not allocatable.
   */
  it('names an invoice that is no longer allocatable', () => {
    const settled = asInvoice({
      status: 'PAID',
      settlementSummary: { balance: 0 },
    } as Partial<Invoice>);

    expect(allocatableInvoices([settled], allocatable())).toEqual([]);
    expect(allocatedInvoiceLabel('inv-1', [settled])).toBe('#inv-1');
  });

  it('derives a code from the id when the store never loaded the invoice', () => {
    expect(allocatedInvoiceLabel('c93099a27f4b41d2ae51b8ca0f3d7e61', [asInvoice()])).toBe(
      '#CA0F3D7E61'
    );
  });

  it('falls back to a word rather than an empty label', () => {
    expect(allocatedInvoiceLabel('', [asInvoice()])).toBe('Invoice');
  });
});
