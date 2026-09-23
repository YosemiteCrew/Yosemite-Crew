import {
  MAX_ALLOCATION_LINES,
  parseAmount,
  reviewAllocationDraft,
  suggestedAmount,
} from '@/app/features/finance/pages/PaymentReconciliation/allocationDraft';
import type { AllocatableInvoice } from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';

/*
 * The rules an operator is shown before they commit money, driven directly.
 *
 * Reaching them only through the dialog would mean every one of them is
 * asserted through a render that also has to be correct, and a preview that
 * silently disagrees with what the endpoint does is exactly the failure this
 * screen exists to avoid.
 */

const receipt = (over: Partial<ProviderReceipt> = {}): ProviderReceipt => ({
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

const invoice = (id: string, balance: number): AllocatableInvoice => ({
  id,
  label: `#${id}`,
  currency: 'GBP',
  balance,
  createdAt: '2026-09-01T00:00:00.000Z',
});

describe('parseAmount', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12.50', 12.5],
    ['0.01', 0.01],
    ['  7.25  ', 7.25],
  ])('reads %s as money', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  /*
   * Every one of these is a value `<input type="number">` would have handed
   * over as a number. Rejecting them here is what makes "what did they type"
   * answerable rather than inferred.
   */
  it.each(['', '  ', 'abc', '-5', '1e3', '1.005', '.5', '5.', '1,50', 'Infinity', 'NaN'])(
    'refuses %p rather than guessing at it',
    (text) => {
      expect(parseAmount(text)).toBeNull();
    }
  );
});

describe('reviewAllocationDraft', () => {
  it('asks for a choice before it asks for anything else', () => {
    const review = reviewAllocationDraft(receipt(), [invoice('a', 50)], [], {});

    expect(review.canSubmit).toBe(false);
    expect(review.formError).toMatch(/at least one invoice/i);
    expect(review.total).toBe(0);
    expect(review.residualAfter).toBe(100);
  });

  it('accepts a draft within the residual and every balance', () => {
    const review = reviewAllocationDraft(
      receipt(),
      [invoice('a', 50), invoice('b', 80)],
      ['a', 'b'],
      { a: '50', b: '30' }
    );

    expect(review.canSubmit).toBe(true);
    expect(review.formError).toBeNull();
    expect(review.total).toBe(80);
    expect(review.residualAfter).toBe(20);
    expect(review.lines.map((line) => line.error)).toEqual([null, null]);
  });

  it('measures the draft against the residual, not the captured amount', () => {
    // 100 captured, 30 given back and 40 already applied leaves 30.
    const partly = receipt({ refundedAmount: 30, allocatedAmount: 40 });

    const review = reviewAllocationDraft(partly, [invoice('a', 500)], ['a'], { a: '31' });

    expect(review.residual).toBe(30);
    expect(review.canSubmit).toBe(false);
    expect(review.formError).toContain('more than this capture has left to apply');
  });

  it('names the shortfall in money rather than saying only that it is too much', () => {
    const review = reviewAllocationDraft(receipt({ amount: 10 }), [invoice('a', 500)], ['a'], {
      a: '10.25',
    });

    expect(review.formError).toContain('£0.25');
  });

  it('refuses a line larger than the invoice it names, even inside the residual', () => {
    const review = reviewAllocationDraft(receipt(), [invoice('a', 20)], ['a'], { a: '25' });

    expect(review.canSubmit).toBe(false);
    expect(review.formError).toBeNull();
    expect(review.lines[0].error).toContain('£20.00');
  });

  it('holds an unfinished line open rather than submitting without it', () => {
    const review = reviewAllocationDraft(
      receipt(),
      [invoice('a', 20), invoice('b', 20)],
      ['a', 'b'],
      {
        a: '10',
        b: '',
      }
    );

    expect(review.canSubmit).toBe(false);
    expect(review.lines[1].error).toMatch(/two decimal places/i);
    // The unfinished line contributes nothing, so the preview cannot claim
    // money the operator has not yet named.
    expect(review.total).toBe(10);
  });

  it('refuses a zero line as a different operation rather than a small one', () => {
    const review = reviewAllocationDraft(receipt(), [invoice('a', 20)], ['a'], { a: '0' });

    expect(review.canSubmit).toBe(false);
    expect(review.lines[0].error).toMatch(/greater than zero/i);
  });

  it('bounds the draft at the number of lines the route accepts', () => {
    const invoices = Array.from({ length: MAX_ALLOCATION_LINES + 1 }, (_, i) =>
      invoice(`inv-${i}`, 1)
    );
    const draft = Object.fromEntries(invoices.map((row) => [row.id, '1']));

    const review = reviewAllocationDraft(
      receipt({ amount: 100 }),
      invoices,
      invoices.map((row) => row.id),
      draft
    );

    expect(review.canSubmit).toBe(false);
    expect(review.formError).toContain(String(MAX_ALLOCATION_LINES));
  });

  it('ignores a selection for an invoice that is no longer offered', () => {
    const review = reviewAllocationDraft(receipt(), [invoice('a', 50)], ['a', 'gone'], {
      a: '10',
      gone: '10',
    });

    expect(review.lines).toHaveLength(1);
    expect(review.total).toBe(10);
  });

  it('rounds the total at the scale the wire uses', () => {
    const review = reviewAllocationDraft(
      receipt(),
      [invoice('a', 1), invoice('b', 1)],
      ['a', 'b'],
      { a: '0.10', b: '0.20' }
    );

    expect(review.total).toBe(0.3);
    expect(review.residualAfter).toBe(99.7);
  });
});

describe('suggestedAmount', () => {
  it('offers the smaller of what is left and what the invoice owes', () => {
    expect(suggestedAmount(invoice('a', 40), 100)).toBe('40.00');
    expect(suggestedAmount(invoice('a', 400), 62.5)).toBe('62.50');
  });

  it('offers nothing once the other lines have claimed the whole residual', () => {
    expect(suggestedAmount(invoice('a', 40), 0)).toBe('');
    expect(suggestedAmount(invoice('a', 40), -5)).toBe('');
  });
});
