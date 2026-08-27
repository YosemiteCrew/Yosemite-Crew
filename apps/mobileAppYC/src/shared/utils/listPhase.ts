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
 *    'ready' therefore does double duty for "fresh" and "stale, because the
 *    last refresh failed". The failure is NOT discarded: `isListStale` below
 *    reports it so a screen can show a non-blocking staleness affordance
 *    alongside content the user can still read.
 *
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

/**
 * A refresh failed while there is still content on screen.
 *
 * This is the other half of the ordering above. `resolveListPhase` keeps a
 * readable list readable rather than replacing it with an error, which is the
 * right call, but on its own it makes a failed refresh completely silent: the
 * user goes on reading a medication schedule or an appointment time with no
 * sign it may be out of date, and under a dead session every refresh fails, so
 * the staleness is permanent rather than transient.
 *
 * Deliberately a separate predicate rather than a fifth ListPhase value. Screens
 * branch on `phase === 'ready'` to render their list, and a 'stale' phase would
 * silently stop that list rendering at every one of those call sites.
 */
export const isListStale = ({
  loadError = null,
  itemCount,
}: Pick<ListPhaseInput, 'loadError' | 'itemCount'>): boolean =>
  Boolean(loadError) && itemCount > 0;
