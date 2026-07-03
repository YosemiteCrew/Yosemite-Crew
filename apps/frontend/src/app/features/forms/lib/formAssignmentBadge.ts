import type { FormAssignmentLifecycleStatus } from '@/app/features/forms/types/forms';

/**
 * The coarse buckets the /forms assignments view renders. SENT/VIEWED/SUBMITTED
 * collapse into a single "pending" badge; SIGNED is its own state; EXPIRED and
 * CANCELLED are surfaced separately so they read as terminal, non-actionable.
 */
export type FormAssignmentBadgeCategory = 'pending' | 'signed' | 'expired' | 'cancelled';

export type FormAssignmentBadgeTone = 'warning' | 'success' | 'danger' | 'neutral';

export interface FormAssignmentBadge {
  category: FormAssignmentBadgeCategory;
  label: string;
  tone: FormAssignmentBadgeTone;
}

const BADGE_BY_STATUS: Record<FormAssignmentLifecycleStatus, FormAssignmentBadge> = {
  SENT: { category: 'pending', label: 'Pending', tone: 'warning' },
  VIEWED: { category: 'pending', label: 'Pending', tone: 'warning' },
  SUBMITTED: { category: 'pending', label: 'Pending', tone: 'warning' },
  SIGNED: { category: 'signed', label: 'Signed', tone: 'success' },
  EXPIRED: { category: 'expired', label: 'Expired', tone: 'danger' },
  CANCELLED: { category: 'cancelled', label: 'Cancelled', tone: 'neutral' },
};

const FALLBACK_BADGE: FormAssignmentBadge = {
  category: 'pending',
  label: 'Pending',
  tone: 'warning',
};

/**
 * Map a lifecycle status to its display badge. Falls back to "pending" for any
 * unexpected status so an unknown backend value never renders a blank badge.
 */
export const getFormAssignmentBadge = (
  status: FormAssignmentLifecycleStatus
): FormAssignmentBadge => BADGE_BY_STATUS[status] ?? FALLBACK_BADGE;
