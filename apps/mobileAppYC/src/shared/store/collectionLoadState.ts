// src/shared/store/collectionLoadState.ts
//
// Every companion-scoped list slice already tracked "did this collection ever
// arrive" (`hydratedCompanions`) but had nowhere to record "the fetch failed".
// A rejected fetch left the flag false and the item list empty, which every
// screen then rendered as the new-user empty state: "add your first task",
// "add your first expense". A failure and a genuinely empty account looked
// identical, so an outage read as an onboarding prompt.
//
// These helpers give the two states separate homes and keep them mutually
// exclusive, so a slice cannot drift into claiming both at once.

export interface CollectionLoadState {
  hydratedCompanions: Record<string, boolean>;
  failedCompanions: Record<string, string>;
  /**
   * requestId of the newest in-flight fetch per companion, so a rejection that
   * arrives after a NEWER request already succeeded can be discarded.
   *
   * Several screens dispatch the same fetch twice on a focused mount (a
   * hydration effect plus useFocusEffect, or a tab press plus its active-index
   * effect). Without this, an older request rejecting after a newer one
   * returned an empty list would record a failure over a successful hydration,
   * and the screen would replace a correct empty state with an error.
   */
  activeRequests: Record<string, string>;
}

/** The single, canonical fallback message for a failed collection fetch. */
export const DEFAULT_COLLECTION_LOAD_ERROR = 'Failed to load';

/**
 * Every slice using these helpers is in the redux-persist whitelist, so state
 * rehydrated from a build that predates `failedCompanions` arrives without it.
 * Writing through a missing map would throw on the first fetch after an
 * upgrade, which is a launch-path crash, not a cosmetic bug. The store
 * migration fills these in too; this is the belt to that pair of braces.
 */
const ensureMaps = (state: Partial<CollectionLoadState>): void => {
  state.hydratedCompanions = state.hydratedCompanions ?? {};
  state.failedCompanions = state.failedCompanions ?? {};
  state.activeRequests = state.activeRequests ?? {};
};

/**
 * Companion ids reach these helpers as a thunk argument, so they are a
 * caller-supplied key on an object write. `__proto__` and friends would reach
 * Object.prototype rather than the map, so they are refused outright: no real
 * companion id looks like this, and a silently ignored key is better than a
 * polluted prototype.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const usableKey = (companionId: string | null | undefined): string | null =>
  companionId && !UNSAFE_KEYS.has(companionId) ? companionId : null;

/**
 * A fetch is in flight. Clears any previous failure so a retry does not keep
 * showing the error it is currently retrying.
 */
export const markCollectionPending = (
  state: CollectionLoadState,
  companionId: string | null | undefined,
  requestId?: string,
): void => {
  ensureMaps(state);
  const key = usableKey(companionId);
  if (!key) {
    return;
  }
  delete state.failedCompanions[key];
  if (requestId) {
    state.activeRequests[key] = requestId;
  }
};

/** The collection arrived. It is now hydrated and, by definition, not failed. */
export const markCollectionHydrated = (
  state: CollectionLoadState,
  companionId: string | null | undefined,
): void => {
  ensureMaps(state);
  const key = usableKey(companionId);
  if (!key) {
    return;
  }
  state.hydratedCompanions[key] = true;
  delete state.failedCompanions[key];
  // Success closes the round: any rejection still in flight is now stale.
  delete state.activeRequests[key];
};

/**
 * The fetch failed. Recorded separately from `hydratedCompanions` so a screen
 * can tell "loaded and empty" from "never arrived".
 */
export const markCollectionFailed = (
  state: CollectionLoadState,
  companionId: string | null | undefined,
  message?: string | null,
  requestId?: string,
): void => {
  ensureMaps(state);
  const key = usableKey(companionId);
  if (!key) {
    return;
  }

  // Only the newest request may report a failure.
  //
  // Three cases, and the third is why this is not a bare equality check:
  //  - the entry names THIS request: it is the newest, record the failure.
  //  - the entry names a DIFFERENT request: a newer one is still running, so
  //    this rejection is stale.
  //  - there is no entry at all: either a newer request already succeeded and
  //    cleared it, or we never saw a pending for this fetch. Those are
  //    indistinguishable from the map alone, so fall back to the hydration
  //    flag - a hydrated collection means a success cleared it and this is
  //    stale, while an unhydrated one means we have no evidence of a newer
  //    request and dropping a real failure would be worse than keeping it.
  // The entry is deliberately LEFT in place after a match rather than cleared:
  // it marks "this round already reported", so a second, older rejection cannot
  // fall through the no-entry branch below and overwrite the newer message. The
  // next pending overwrites it anyway.
  if (requestId) {
    const active = state.activeRequests[key];
    if (active !== requestId) {
      if (active !== undefined || state.hydratedCompanions[key]) {
        return;
      }
    }
  }

  state.failedCompanions[key] = message || DEFAULT_COLLECTION_LOAD_ERROR;
};

/**
 * The failure message for a companion's collection, or `undefined` when the
 * last attempt did not fail.
 */
export const selectCollectionFailure = (
  state: Partial<CollectionLoadState> | undefined,
  companionId: string | null | undefined,
): string | undefined => {
  const key = usableKey(companionId);
  if (!key) {
    return undefined;
  }
  // Check the value's TYPE rather than its provenance. An inherited member such
  // as `toString` reads back as a function, never a string, so it can never be
  // mistaken for a real failure message and pin a list into its error state.
  const message = state?.failedCompanions?.[key];
  return typeof message === 'string' ? message : undefined;
};

/**
 * Whether a companion's collection has ever been successfully fetched. Screens
 * use this to avoid showing "you have nothing" before anything was asked for.
 */
export const selectCollectionHydrated = (
  state: Partial<CollectionLoadState> | undefined,
  companionId: string | null | undefined,
): boolean => {
  const key = usableKey(companionId);
  if (!key) {
    return false;
  }
  // Strict `=== true` for the same reason: an inherited member is an object or
  // a function, never the literal true this map stores.
  return state?.hydratedCompanions?.[key] === true;
};
