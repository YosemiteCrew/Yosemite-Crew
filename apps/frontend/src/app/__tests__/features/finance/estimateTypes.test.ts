import {
  ESTIMATE_STATUSES,
  EstimateStatusFilters,
  canApprove,
  canConvert,
  canDecline,
  canSend,
  estimateStatusBadge,
} from '@/app/features/finance/types/estimate';
import type { EstimateStatus } from '@/app/features/finance/types/estimate';

type Lifecycle = {
  send: boolean;
  approve: boolean;
  decline: boolean;
  convert: boolean;
};

/**
 * What `EstimateService` in `apps/backend/src/services/estimate.service.ts`
 * actually accepts, read off the guards themselves:
 *
 *   markSent (~451)  `existing.status !== "DRAFT"` -> 409
 *   approve  (~277)  `existing.status !== "SENT" && existing.status !== "DRAFT"` -> 409
 *   decline  (~413)  `existing.status !== "SENT" && existing.status !== "DRAFT"` -> 409
 *   convert  (~323)  `existing.status !== "APPROVED"` -> 409
 *
 * The predicates exist so the UI disables an action instead of offering it and
 * letting the request 409, so a predicate that is more permissive than the row
 * below is a button that always fails, and one that is stricter is a lifecycle
 * step the user can no longer reach.
 */
const BACKEND_ACCEPTS: Record<EstimateStatus, Lifecycle> = {
  DRAFT: { send: true, approve: true, decline: true, convert: false },
  SENT: { send: false, approve: true, decline: true, convert: false },
  APPROVED: { send: false, approve: false, decline: false, convert: true },
  DECLINED: { send: false, approve: false, decline: false, convert: false },
  EXPIRED: { send: false, approve: false, decline: false, convert: false },
  CONVERTED: { send: false, approve: false, decline: false, convert: false },
};

/** The shape `dropdownStatusFromToken` builds, spelled out so the test pins the tokens. */
const pill = (name: string, key: string, prefix: string) => ({
  name,
  key,
  bg: `var(--${prefix}-bg)`,
  text: `var(--${prefix}-text)`,
  border: `var(--${prefix}-border)`,
  dropdownText: `var(--${prefix}-text)`,
});

describe('ESTIMATE_STATUSES', () => {
  it('lists the six statuses in lifecycle order', () => {
    expect(ESTIMATE_STATUSES).toEqual([
      'DRAFT',
      'SENT',
      'APPROVED',
      'DECLINED',
      'EXPIRED',
      'CONVERTED',
    ]);
  });

  it('covers every status the guard table below asserts on', () => {
    expect(Object.keys(BACKEND_ACCEPTS).sort()).toEqual([...ESTIMATE_STATUSES].sort());
  });
});

describe('lifecycle predicates', () => {
  it.each([...ESTIMATE_STATUSES])(
    'gates %s exactly as the service does',
    (status: EstimateStatus) => {
      const expected = BACKEND_ACCEPTS[status];

      expect({
        send: canSend(status),
        approve: canApprove(status),
        decline: canDecline(status),
        convert: canConvert(status),
      }).toEqual(expected);
    }
  );

  it('only lets a DRAFT be sent', () => {
    expect(canSend('DRAFT')).toBe(true);
    expect(canSend('SENT')).toBe(false);
    expect(canSend('APPROVED')).toBe(false);
    expect(canSend('DECLINED')).toBe(false);
    expect(canSend('EXPIRED')).toBe(false);
    expect(canSend('CONVERTED')).toBe(false);
  });

  it('lets a DRAFT or a SENT estimate be approved', () => {
    expect(canApprove('DRAFT')).toBe(true);
    expect(canApprove('SENT')).toBe(true);
    expect(canApprove('APPROVED')).toBe(false);
    expect(canApprove('DECLINED')).toBe(false);
    expect(canApprove('EXPIRED')).toBe(false);
    expect(canApprove('CONVERTED')).toBe(false);
  });

  it('lets a DRAFT or a SENT estimate be declined', () => {
    expect(canDecline('DRAFT')).toBe(true);
    expect(canDecline('SENT')).toBe(true);
    expect(canDecline('APPROVED')).toBe(false);
    expect(canDecline('DECLINED')).toBe(false);
    expect(canDecline('EXPIRED')).toBe(false);
    expect(canDecline('CONVERTED')).toBe(false);
  });

  it('only lets an APPROVED estimate be converted', () => {
    expect(canConvert('APPROVED')).toBe(true);
    expect(canConvert('DRAFT')).toBe(false);
    expect(canConvert('SENT')).toBe(false);
    expect(canConvert('DECLINED')).toBe(false);
    expect(canConvert('EXPIRED')).toBe(false);
    // CONVERTED is false on purpose: `convert` short-circuits an already
    // converted estimate back to the caller, so re-offering the button would
    // only ever be a no-op the user cannot tell from a fresh conversion.
    expect(canConvert('CONVERTED')).toBe(false);
  });

  it('approves and declines on the same set of statuses', () => {
    ESTIMATE_STATUSES.forEach((status) => {
      expect(canApprove(status)).toBe(canDecline(status));
    });
  });

  it('offers no action at all on the three terminal statuses', () => {
    (['DECLINED', 'EXPIRED', 'CONVERTED'] as const).forEach((status) => {
      expect([canSend(status), canApprove(status), canDecline(status), canConvert(status)]).toEqual(
        [false, false, false, false]
      );
    });
  });
});

describe('EstimateStatusFilters', () => {
  it('leads with All and then follows the lifecycle', () => {
    expect(EstimateStatusFilters.map((option) => option.key)).toEqual([
      'all',
      'DRAFT',
      'SENT',
      'APPROVED',
      'CONVERTED',
      'DECLINED',
      'EXPIRED',
    ]);
  });

  it('gives All the neutral pill tokens', () => {
    expect(EstimateStatusFilters[0]).toEqual(pill('All', 'all', 'color-pill-neutral'));
  });
});

describe('estimateStatusBadge', () => {
  it.each([
    ['DRAFT', 'Draft', 'color-pill-neutral'],
    ['SENT', 'Sent', 'color-pill-info'],
    ['APPROVED', 'Approved', 'color-pill-progress'],
    ['CONVERTED', 'Converted', 'color-pill-success'],
    ['DECLINED', 'Declined', 'color-pill-warning'],
    ['EXPIRED', 'Expired', 'color-pill-warning'],
  ])('returns the %s badge', (status, label, prefix) => {
    expect(estimateStatusBadge(status as EstimateStatus)).toEqual({
      label,
      bg: `var(--${prefix}-bg)`,
      text: `var(--${prefix}-text)`,
      border: `var(--${prefix}-border)`,
    });
  });

  it('has a badge for every status, with no undefined field', () => {
    ESTIMATE_STATUSES.forEach((status) => {
      const badge = estimateStatusBadge(status);
      expect(Object.values(badge).every((value) => typeof value === 'string')).toBe(true);
    });
  });

  it('agrees with the filter pill for the same status', () => {
    // The badge and the filter row must never drift. Both derive from the same
    // token map, and this pins that: for every status, the badge's tokens equal
    // the pill's, and its label equals the pill's name.
    ESTIMATE_STATUSES.forEach((status) => {
      const option = EstimateStatusFilters.find((entry) => entry.key === status);
      const badge = estimateStatusBadge(status);
      expect(option).toBeDefined();
      expect(badge.label).toBe(option?.name);
      expect(badge.bg).toBe(option?.bg);
      expect(badge.text).toBe(option?.text);
      expect(badge.border).toBe(option?.border);
    });
  });
});
