import { computeFinanceMetrics, getInvoiceOutstanding } from '@/app/lib/financeMetrics';
import { Invoice } from '@yosemite-crew/types';

const makeInvoice = (overrides: Partial<Invoice>): Invoice =>
  ({
    id: 'inv',
    items: [],
    subtotal: 0,
    totalAmount: 0,
    status: 'PENDING',
    currency: 'USD',
    paymentCollectionMethod: 'PAYMENT_INTENT',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Invoice;

describe('getInvoiceOutstanding', () => {
  it('returns 0 for a nullish invoice', () => {
    expect(getInvoiceOutstanding(null)).toBe(0);
    expect(getInvoiceOutstanding(undefined)).toBe(0);
  });

  it('prefers the settlement summary balance', () => {
    const invoice = makeInvoice({
      totalAmount: 100,
      settlementSummary: { balance: 30 } as Invoice['settlementSummary'],
    });
    expect(getInvoiceOutstanding(invoice)).toBe(30);
  });

  it('clamps a negative settlement balance to 0', () => {
    const invoice = makeInvoice({
      settlementSummary: { balance: -5 } as Invoice['settlementSummary'],
    });
    expect(getInvoiceOutstanding(invoice)).toBe(0);
  });

  it('returns 0 for settled statuses', () => {
    expect(getInvoiceOutstanding(makeInvoice({ status: 'PAID', totalAmount: 80 }))).toBe(0);
    expect(getInvoiceOutstanding(makeInvoice({ status: 'REFUNDED', totalAmount: 80 }))).toBe(0);
    expect(getInvoiceOutstanding(makeInvoice({ status: 'CANCELLED', totalAmount: 80 }))).toBe(0);
  });

  it('subtracts a collected deposit from the total for unsettled invoices', () => {
    const invoice = makeInvoice({
      status: 'AWAITING_PAYMENT',
      totalAmount: 100,
      depositCollectedAmount: 20,
    });
    expect(getInvoiceOutstanding(invoice)).toBe(80);
  });

  it('never returns a negative outstanding when deposit exceeds total', () => {
    const invoice = makeInvoice({
      status: 'PENDING',
      totalAmount: 10,
      depositCollectedAmount: 40,
    });
    expect(getInvoiceOutstanding(invoice)).toBe(0);
  });
});

describe('computeFinanceMetrics', () => {
  const NOW = new Date('2026-07-09T12:00:00.000Z').getTime();

  it('returns zeros for an empty list', () => {
    expect(computeFinanceMetrics([], NOW)).toEqual({ collectedThisWeek: 0, outstanding: 0 });
  });

  it('sums paid invoices within the trailing week using paidAt', () => {
    const invoices = [
      makeInvoice({ status: 'PAID', totalAmount: 4820, paidAt: new Date(NOW - 2 * 86400000) }),
      makeInvoice({ status: 'PAID', totalAmount: 500, paidAt: new Date(NOW - 30 * 86400000) }),
    ];
    expect(computeFinanceMetrics(invoices, NOW).collectedThisWeek).toBe(4820);
  });

  it('falls back to createdAt when paidAt is absent', () => {
    const invoices = [
      makeInvoice({
        status: 'PAID',
        totalAmount: 200,
        paidAt: undefined,
        createdAt: new Date(NOW),
      }),
    ];
    expect(computeFinanceMetrics(invoices, NOW).collectedThisWeek).toBe(200);
  });

  it('skips paid invoices with an unparseable timestamp', () => {
    const invoices = [
      makeInvoice({
        status: 'PAID',
        totalAmount: 999,
        paidAt: undefined,
        createdAt: 'not-a-date' as unknown as Date,
      }),
    ];
    expect(computeFinanceMetrics(invoices, NOW).collectedThisWeek).toBe(0);
  });

  it('accumulates outstanding across unsettled invoices', () => {
    const invoices = [
      makeInvoice({ status: 'PENDING', totalAmount: 214 }),
      makeInvoice({ status: 'PAID', totalAmount: 100, paidAt: new Date(NOW) }),
    ];
    expect(computeFinanceMetrics(invoices, NOW)).toEqual({
      collectedThisWeek: 100,
      outstanding: 214,
    });
  });
});
