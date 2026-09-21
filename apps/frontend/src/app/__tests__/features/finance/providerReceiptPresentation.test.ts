import {
  ALL_STATUSES_KEY,
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
