// src/shared/utils/listPhase.ts
//
// One place to answer "what should this list render right now", so eight
// screens stop each inventing their own two-way `items.length === 0` guess.
//
// The bug this closes: every list screen collapsed four situations into two.
// Loading, failed, never-fetched and genuinely-empty all arrived as an empty
// array, so all four rendered "add your first X". A failed fetch was
// indistinguishable from a new account, which is why a broken session looked
// like an onboarding screen instead of an error.

export type ListPhase = 'loading' | 'error' | 'empty' | 'ready';

export interface ListPhaseInput {
  /** A fetch is currently in flight. */
  loading?: boolean;
  /** The last fetch failed. Any truthy message means failure. */
  loadError?: string | null;
  /** A fetch has completed successfully at least once. */
  hasLoaded?: boolean;
  /** How many items are available to render right now. */
  itemCount: number;
}

/**
 * Resolve which of the four states a list is in.
 *
 * Ordering matters and is deliberate:
 *  - Anything already on screen wins. Showing a full-screen spinner or error
 *    over a list the user can still read is worse than a quiet background
 *    refresh, so a non-empty list is always 'ready'.
 *
 *    KNOWN LIMIT of that choice: 'ready' therefore does double duty for "fresh"
 *    and "stale, because the last refresh failed". A failed refresh over a
 *    populated list is currently SILENT - the failure is recorded in the slice
 *    and then discarded here. That is the same collapse this module exists to
 *    undo, one state over, and it matters in an app that shows medication
 *    schedules and appointment times. The fix is not to promote the error over
 *    the content; it is a non-blocking staleness affordance alongside it, which
 *    is UI work rather than a change to this resolver's ordering.
 *  - A failure outranks loading, so a retry that fails again does not flash
 *    back to a spinner and strand the user without a retry control.
 *  - 'empty' requires proof: a successful fetch. Without it the honest answer
 *    is 'loading', not "you have nothing".
 */
export const resolveListPhase = ({
  loading = false,
  loadError = null,
  hasLoaded = false,
  itemCount,
}: ListPhaseInput): ListPhase => {
  if (itemCount > 0) {
    return 'ready';
  }

  if (loadError) {
    return 'error';
  }

  if (loading) {
    return 'loading';
  }

  return hasLoaded ? 'empty' : 'loading';
};
