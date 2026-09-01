import {
  StatusOption,
  dropdownStatusFromToken,
} from '@/app/features/companions/pages/Companions/types';

/**
 * Estimate shapes as the backend returns them.
 *
 * These live here rather than in `@yosemite-crew/types` because the estimate
 * endpoints reply with the raw Prisma selection (`estimate.service.ts`
 * `estimateSelect`), not a DTO, and no other workspace consumes them yet.
 */

export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'CONVERTED';

export const ESTIMATE_STATUSES: readonly EstimateStatus[] = [
  'DRAFT',
  'SENT',
  'APPROVED',
  'DECLINED',
  'EXPIRED',
  'CONVERTED',
] as const;

export type EstimateItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  notes: string | null;
};

export type Estimate = {
  id: string;
  organisationId: string;
  patientId: string;
  encounterId: string | null;
  status: EstimateStatus;
  validUntil: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  convertedToInvoiceId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: EstimateItem[];
};

/** One line as the create/update endpoints accept it. */
export type EstimateItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  notes?: string;
};

export type CreateEstimateInput = {
  patientId: string;
  encounterId?: string;
  validUntil?: string;
  currency?: string;
  notes?: string;
  items: EstimateItemInput[];
};

/**
 * Which lifecycle actions the backend will accept for a given status.
 *
 * Mirrors the guards in `EstimateService`: only a DRAFT can be sent, only a
 * DRAFT or SENT can be approved or declined, and only an APPROVED estimate can
 * be converted. Keeping this next to the type means the UI disables an action
 * rather than offering it and letting the request fail.
 */
export const canSend = (status: EstimateStatus): boolean => status === 'DRAFT';
export const canApprove = (status: EstimateStatus): boolean =>
  status === 'DRAFT' || status === 'SENT';
export const canDecline = (status: EstimateStatus): boolean =>
  status === 'DRAFT' || status === 'SENT';
export const canConvert = (status: EstimateStatus): boolean => status === 'APPROVED';

/**
 * The pill token prefix per status, in lifecycle order. One map feeds both the
 * filter row and the row badge, so the two can never drift apart.
 *
 * Colours follow the invoice pills so the two finance lists read as one family:
 * neutral while the estimate is still in play, success for the terminal happy
 * path, warning for declined and expired.
 */
const ESTIMATE_STATUS_TOKEN: Record<EstimateStatus, string> = {
  DRAFT: 'color-pill-neutral',
  SENT: 'color-pill-info',
  APPROVED: 'color-pill-progress',
  CONVERTED: 'color-pill-success',
  DECLINED: 'color-pill-warning',
  EXPIRED: 'color-pill-warning',
};

const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  APPROVED: 'Approved',
  CONVERTED: 'Converted',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
};

/**
 * Filter order, which is deliberately not the Prisma enum order.
 *
 * The enum ends DECLINED, EXPIRED, CONVERTED. Reading left to right a clinic
 * should see the estimate travel its normal path first - draft, sent, approved,
 * converted - with the two dead ends after it, rather than converted stranded
 * behind them.
 */
const ESTIMATE_FILTER_ORDER: readonly EstimateStatus[] = [
  'DRAFT',
  'SENT',
  'APPROVED',
  'CONVERTED',
  'DECLINED',
  'EXPIRED',
];

/** Filter pills, with "All" first. */
export const EstimateStatusFilters: StatusOption[] = [
  dropdownStatusFromToken('All', 'all', 'color-pill-neutral'),
  ...ESTIMATE_FILTER_ORDER.map((status) =>
    dropdownStatusFromToken(ESTIMATE_STATUS_LABEL[status], status, ESTIMATE_STATUS_TOKEN[status])
  ),
];

/**
 * The badge tokens and label for one status.
 *
 * Returns every field, so the badge needs no `??` fallbacks: the record is keyed
 * by the union, and an unmapped status is a type error rather than a runtime
 * branch nothing can reach.
 */
export const estimateStatusBadge = (
  status: EstimateStatus
): { label: string; bg: string; text: string; border: string } => {
  const prefix = ESTIMATE_STATUS_TOKEN[status];
  return {
    label: ESTIMATE_STATUS_LABEL[status],
    bg: `var(--${prefix}-bg)`,
    text: `var(--${prefix}-text)`,
    border: `var(--${prefix}-border)`,
  };
};
