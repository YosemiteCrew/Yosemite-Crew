import { InvoiceStatus } from '@yosemite-crew/types';
import {
  StatusOption,
  dropdownStatusFromToken,
} from '@/app/features/companions/pages/Companions/types';

export const InvoiceStatusOptions: InvoiceStatus[] = [
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
];

export const InvoiceStatusFilters: StatusOption[] = [
  dropdownStatusFromToken('All', 'all', 'color-pill-neutral'),
  dropdownStatusFromToken('Pending', 'pending', 'color-pill-neutral'),
  dropdownStatusFromToken('Awaiting payment', 'awaiting_payment', 'color-pill-info'),
  dropdownStatusFromToken('Paid', 'paid', 'color-pill-success'),
  dropdownStatusFromToken('Failed', 'failed', 'color-pill-warning'),
  dropdownStatusFromToken('Cancelled', 'cancelled', 'color-pill-warning'),
  dropdownStatusFromToken('Refunded', 'refunded', 'color-pill-progress'),
];
