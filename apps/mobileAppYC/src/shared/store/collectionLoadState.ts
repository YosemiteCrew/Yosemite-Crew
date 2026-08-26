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
};

/**
 * A fetch is in flight. Clears any previous failure so a retry does not keep
 * showing the error it is currently retrying.
 */
export const markCollectionPending = (
  state: CollectionLoadState,
  companionId: string | null | undefined,
): void => {
  ensureMaps(state);
  if (!companionId) {
    return;
  }
  delete state.failedCompanions[companionId];
};

/** The collection arrived. It is now hydrated and, by definition, not failed. */
export const markCollectionHydrated = (
  state: CollectionLoadState,
  companionId: string | null | undefined,
): void => {
  ensureMaps(state);
  if (!companionId) {
    return;
  }
  state.hydratedCompanions[companionId] = true;
  delete state.failedCompanions[companionId];
};

/**
 * The fetch failed. Recorded separately from `hydratedCompanions` so a screen
 * can tell "loaded and empty" from "never arrived".
 */
export const markCollectionFailed = (
  state: CollectionLoadState,
  companionId: string | null | undefined,
  message?: string | null,
): void => {
  ensureMaps(state);
  if (!companionId) {
    return;
  }
  state.failedCompanions[companionId] =
    message || DEFAULT_COLLECTION_LOAD_ERROR;
};

/**
 * The failure message for a companion's collection, or `undefined` when the
 * last attempt did not fail.
 */
export const selectCollectionFailure = (
  state: Partial<CollectionLoadState> | undefined,
  companionId: string | null | undefined,
): string | undefined => {
  if (!companionId) {
    return undefined;
  }
  return state?.failedCompanions?.[companionId];
};

/**
 * Whether a companion's collection has ever been successfully fetched. Screens
 * use this to avoid showing "you have nothing" before anything was asked for.
 */
export const selectCollectionHydrated = (
  state: Partial<CollectionLoadState> | undefined,
  companionId: string | null | undefined,
): boolean => {
  if (!companionId) {
    return false;
  }
  return Boolean(state?.hydratedCompanions?.[companionId]);
};
