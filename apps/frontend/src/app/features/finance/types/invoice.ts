import { InvoiceStatus } from '@yosemite-crew/types';
import { StatusOption, status } from '@/app/features/companions/pages/Companions/types';

export const InvoiceStatusOptions: InvoiceStatus[] = [
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
];

export const InvoiceStatusFilters: StatusOption[] = [
  status(
    'All',
    'all',
    'var(--color-pill-neutral-bg)',
    'var(--color-pill-neutral-text)',
    'var(--color-pill-neutral-border)',
    'var(--color-pill-neutral-text)'
  ),
  status(
    'Pending',
    'pending',
    'var(--color-pill-neutral-bg)',
    'var(--color-pill-neutral-text)',
    'var(--color-pill-neutral-border)',
    'var(--color-pill-neutral-text)'
  ),
  status(
    'Awaiting payment',
    'awaiting_payment',
    'var(--color-pill-info-bg)',
    'var(--color-pill-info-text)',
    'var(--color-pill-info-border)',
    'var(--color-pill-info-text)'
  ),
  status(
    'Paid',
    'paid',
    'var(--color-pill-success-bg)',
    'var(--color-pill-success-text)',
    'var(--color-pill-success-border)',
    'var(--color-pill-success-text)'
  ),
  status(
    'Failed',
    'failed',
    'var(--color-pill-warning-bg)',
    'var(--color-pill-warning-text)',
    'var(--color-pill-warning-border)',
    'var(--color-pill-warning-text)'
  ),
  status(
    'Cancelled',
    'cancelled',
    'var(--color-pill-warning-bg)',
    'var(--color-pill-warning-text)',
    'var(--color-pill-warning-border)',
    'var(--color-pill-warning-text)'
  ),
  status(
    'Refunded',
    'refunded',
    'var(--color-pill-progress-bg)',
    'var(--color-pill-progress-text)',
    'var(--color-pill-progress-border)',
    'var(--color-pill-progress-text)'
  ),
];
