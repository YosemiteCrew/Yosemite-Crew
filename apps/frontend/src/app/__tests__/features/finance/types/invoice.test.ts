import { InvoiceStatusFilters, InvoiceStatusOptions } from '@/app/features/finance/types/invoice';

describe('invoice types', () => {
  it('keeps the invoice status option list', () => {
    expect(InvoiceStatusOptions).toEqual([
      'PENDING',
      'AWAITING_PAYMENT',
      'PAID',
      'FAILED',
      'CANCELLED',
      'REFUNDED',
    ]);
  });

  it('keeps the exact status filter pills with their pill tokens and dropdown text', () => {
    expect(InvoiceStatusFilters).toEqual([
      {
        name: 'All',
        key: 'all',
        bg: 'var(--color-pill-neutral-bg)',
        text: 'var(--color-pill-neutral-text)',
        border: 'var(--color-pill-neutral-border)',
        dropdownText: 'var(--color-pill-neutral-text)',
      },
      {
        name: 'Pending',
        key: 'pending',
        bg: 'var(--color-pill-neutral-bg)',
        text: 'var(--color-pill-neutral-text)',
        border: 'var(--color-pill-neutral-border)',
        dropdownText: 'var(--color-pill-neutral-text)',
      },
      {
        name: 'Awaiting payment',
        key: 'awaiting_payment',
        bg: 'var(--color-pill-info-bg)',
        text: 'var(--color-pill-info-text)',
        border: 'var(--color-pill-info-border)',
        dropdownText: 'var(--color-pill-info-text)',
      },
      {
        name: 'Paid',
        key: 'paid',
        bg: 'var(--color-pill-success-bg)',
        text: 'var(--color-pill-success-text)',
        border: 'var(--color-pill-success-border)',
        dropdownText: 'var(--color-pill-success-text)',
      },
      {
        name: 'Failed',
        key: 'failed',
        bg: 'var(--color-pill-warning-bg)',
        text: 'var(--color-pill-warning-text)',
        border: 'var(--color-pill-warning-border)',
        dropdownText: 'var(--color-pill-warning-text)',
      },
      {
        name: 'Cancelled',
        key: 'cancelled',
        bg: 'var(--color-pill-warning-bg)',
        text: 'var(--color-pill-warning-text)',
        border: 'var(--color-pill-warning-border)',
        dropdownText: 'var(--color-pill-warning-text)',
      },
      {
        name: 'Refunded',
        key: 'refunded',
        bg: 'var(--color-pill-progress-bg)',
        text: 'var(--color-pill-progress-text)',
        border: 'var(--color-pill-progress-border)',
        dropdownText: 'var(--color-pill-progress-text)',
      },
    ]);
  });
});
