import {
  StatusOption,
  dropdownStatusFromToken,
} from '@/app/features/companions/pages/Companions/types';

/**
 * Insurance claim shapes as the backend returns them.
 *
 * These live here rather than in `@yosemite-crew/types` because the
 * insurance-claim endpoints reply with the raw Prisma selection
 * (`insurance-claim.service.ts` `claimSelect`), not a DTO, and no other
 * workspace consumes them yet. Money columns are plain floats in major units -
 * `submittedAmount: 45.5` is £45.50 - so they format straight through
 * `formatMoneyPrecise` with no minor-unit conversion.
 */
export type InsuranceClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'CANCELLED';

export type InsuranceClaim = {
  id: string;
  organisationId: string;
  patientId: string;
  invoiceId: string | null;
  encounterId: string | null;
  insurerName: string;
  policyNumber: string;
  claimNumber: string | null;
  submittedAmount: number;
  approvedAmount: number | null;
  paidAmount: number | null;
  currency: string;
  status: InsuranceClaimStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  externalClaimRef: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The body the create endpoint accepts (`CreateBodySchema`). */
export type CreateInsuranceClaimInput = {
  patientId: string;
  invoiceId?: string;
  encounterId?: string;
  insurerName: string;
  policyNumber: string;
  submittedAmount: number;
  currency?: string;
  notes?: string;
};

/** The body the status endpoint accepts (`UpdateStatusBodySchema`). */
export type UpdateClaimStatusInput = {
  status: InsuranceClaimStatus;
  approvedAmount?: number;
  paidAmount?: number;
  rejectionReason?: string;
  claimNumber?: string;
  externalClaimRef?: string;
};

/**
 * The status transitions the service will accept, mirroring
 * `CLAIM_STATUS_TRANSITIONS` in insurance-claim.service.ts. Keeping this next to
 * the type means the UI offers a transition rather than letting the request 409.
 */
const CLAIM_STATUS_TRANSITIONS: Record<InsuranceClaimStatus, readonly InsuranceClaimStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED'],
  PARTIALLY_APPROVED: ['PAID', 'CANCELLED'],
  REJECTED: [],
  PAID: [],
  CANCELLED: [],
};

/** A DRAFT is submitted through the dedicated `/submit` endpoint. */
export const canSubmit = (status: InsuranceClaimStatus): boolean => status === 'DRAFT';

/**
 * Whether the dedicated `/cancel` endpoint will accept the claim. That guard is
 * broader than the transition map: cancel only refuses a claim that is already
 * CANCELLED or already PAID, so a REJECTED claim can still be cancelled.
 */
export const canCancel = (status: InsuranceClaimStatus): boolean =>
  status !== 'CANCELLED' && status !== 'PAID';

/** Only a DRAFT can be edited (the service's `update` rejects any other). */
export const canEditClaim = (status: InsuranceClaimStatus): boolean => status === 'DRAFT';

/**
 * The statuses the `/status` endpoint will move this claim to, excluding
 * CANCELLED (handled by the dedicated Cancel button) and SUBMITTED (handled by
 * the dedicated Submit button on a DRAFT). Empty for a DRAFT and for any
 * terminal status, so the caller can hide the picker entirely.
 */
export const nextReviewStatuses = (status: InsuranceClaimStatus): readonly InsuranceClaimStatus[] =>
  CLAIM_STATUS_TRANSITIONS[status].filter((next) => next !== 'CANCELLED' && next !== 'SUBMITTED');

/** Moving to these statuses requires an approved amount (`assertClaimAmountsCoherent`). */
export const statusNeedsApprovedAmount = (status: InsuranceClaimStatus): boolean =>
  status === 'APPROVED' || status === 'PARTIALLY_APPROVED';

/** Moving to PAID requires a paid amount. */
export const statusNeedsPaidAmount = (status: InsuranceClaimStatus): boolean => status === 'PAID';

/**
 * The pill token prefix per status, in lifecycle order. One map feeds both the
 * filter row and the row badge, so the two can never drift apart. Neutral while
 * the claim is still being prepared, info/progress/accent through review,
 * success for a paid claim, danger for a rejection and warning for a
 * cancellation - the same family the estimate and invoice pills use.
 */
const CLAIM_STATUS_TOKEN: Record<InsuranceClaimStatus, string> = {
  DRAFT: 'color-pill-neutral',
  SUBMITTED: 'color-pill-info',
  UNDER_REVIEW: 'color-pill-progress',
  APPROVED: 'color-pill-progress',
  PARTIALLY_APPROVED: 'color-pill-accent',
  PAID: 'color-pill-success',
  REJECTED: 'color-pill-danger',
  CANCELLED: 'color-pill-warning',
};

const CLAIM_STATUS_LABEL: Record<InsuranceClaimStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  PARTIALLY_APPROVED: 'Partially approved',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/** The human label for a status, used wherever the raw enum would read badly. */
export const claimStatusLabel = (status: InsuranceClaimStatus): string =>
  CLAIM_STATUS_LABEL[status];

/**
 * Filter order, following the claim's normal path first - draft, submitted,
 * under review, approved, partially approved, paid - with the two dead ends
 * (rejected, cancelled) after it rather than stranded in the enum's order.
 */
const CLAIM_FILTER_ORDER: readonly InsuranceClaimStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'PAID',
  'REJECTED',
  'CANCELLED',
];

/** Filter pills, with "All" first. */
export const InsuranceClaimStatusFilters: StatusOption[] = [
  dropdownStatusFromToken('All', 'all', 'color-pill-neutral'),
  ...CLAIM_FILTER_ORDER.map((status) =>
    dropdownStatusFromToken(CLAIM_STATUS_LABEL[status], status, CLAIM_STATUS_TOKEN[status])
  ),
];

/**
 * The badge tokens and label for one status. Returns every field, so the badge
 * needs no `??` fallbacks: the record is keyed by the union, and an unmapped
 * status is a type error rather than a runtime branch nothing can reach.
 */
export const claimStatusBadge = (
  status: InsuranceClaimStatus
): { label: string; bg: string; text: string; border: string } => {
  const prefix = CLAIM_STATUS_TOKEN[status];
  return {
    label: CLAIM_STATUS_LABEL[status],
    bg: `var(--${prefix}-bg)`,
    text: `var(--${prefix}-text)`,
    border: `var(--${prefix}-border)`,
  };
};
