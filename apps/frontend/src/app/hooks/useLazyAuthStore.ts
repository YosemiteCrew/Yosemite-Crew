'use client';

import { useEffect, useRef, useState } from 'react';
import type { AuthStore } from '@/app/stores/authStore';

// Importing the auth store pulls in the whole authenticated-app stack: six
// SuperTokens recipes, the axios instance and the org store behind it. Public
// pages need almost none of that - the marketing nav only wants to know whether
// to say "Sign in" or "Go to app" - but a static import puts it in their entry
// bundle anyway.
//
// These helpers load the store after hydration instead, so public routes ship
// without it and fetch it in parallel with the session check it triggers. The
// type import above is erased at build time and adds nothing to the bundle.
let storeModulePromise: Promise<typeof import('@/app/stores/authStore')> | null = null;

const loadAuthStoreModule = () => {
  // On failure the cached promise is cleared, so a later subscription or session
  // check retries. Caching a rejected promise would strand an authenticated
  // visitor on the signed-out UI for the life of the page after one flaky chunk
  // fetch or a deploy that moved the file.
  storeModulePromise ??= import('@/app/stores/authStore').catch((error) => {
    storeModulePromise = null;
    throw error;
  });
  return storeModulePromise;
};

/**
 * Subscribe to the lazily loaded auth store.
 *
 * Returns the unsubscribe straight away, before the chunk has resolved: calling
 * it cancels the pending subscription instead. The store is only reachable
 * after an await, so keeping the whole load-then-subscribe dance here lets the
 * effect below hand its cleanup straight back to React.
 */
const subscribeToAuthStore = (onChange: (state: AuthStore) => void): (() => void) => {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;

  loadAuthStoreModule()
    .then(({ useAuthStore }) => {
      if (cancelled) return;
      const read = () => onChange(useAuthStore.getState());

      read();
      unsubscribe = useAuthStore.subscribe(read);
    })
    // A failed chunk fetch leaves the caller on its fallback, which is the
    // signed-out affordance - degraded but correct. Swallowing it here is what
    // keeps it from surfacing as an unhandled rejection; loadAuthStoreModule
    // has already dropped the cached promise, so the next mount or `enabled`
    // flip fetches again rather than replaying the failure.
    .catch(() => {});

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
};

/**
 * Subscribe to a slice of the auth store without importing it eagerly.
 *
 * Returns `initial` until the store chunk has loaded, then the selected slice,
 * re-rendering only when `isEqual` says the slice actually changed.
 */
export function useLazyAuthSlice<T>(
  select: (state: AuthStore) => T,
  initial: T,
  isEqual: (a: T, b: T) => boolean = Object.is,
  // Loading the store is the expensive part, so a caller that cannot use the
  // value yet should not trigger it. Passing false keeps the fallback and fetches
  // nothing; flipping it to true subscribes then.
  enabled = true
): T {
  const [value, setValue] = useState<T>(initial);
  const selectRef = useRef(select);
  const isEqualRef = useRef(isEqual);
  const initialRef = useRef(initial);

  // No dep array: refresh the closures after every render, before the
  // subscribing effect below (declaration order) ever reads them.
  useEffect(() => {
    selectRef.current = select;
    isEqualRef.current = isEqual;
    initialRef.current = initial;
  });

  useEffect(() => {
    if (!enabled) {
      // Drop back to the fallback rather than keeping the last slice read. A
      // caller disables this hook because it is no longer entitled to the value
      // - PostHogUserSync does it when analytics consent is revoked - and
      // retaining it would hand back the previous session's auth state. If the
      // user then signs out and re-consents, the stale value would identify
      // analytics events to the account that just left.
      setValue(initialRef.current);
      return undefined;
    }

    return subscribeToAuthStore((state) =>
      setValue((previous) => {
        const next = selectRef.current(state);
        return isEqualRef.current(previous, next) ? previous : next;
      })
    );
  }, [enabled]);

  return value;
}

/**
 * Kick off the SuperTokens session check if nothing has done so yet.
 *
 * Public pages do not otherwise bootstrap it, so an already authenticated
 * visitor would keep being shown the signed-out affordances.
 *
 * Best-effort, and never rejects: every caller is fire-and-forget (`void
 * ensureSessionChecked()`), so a rejection here would be unhandled. If the chunk
 * or the session check fails the visitor keeps the signed-out affordances, and
 * the cleared module cache means the next caller retries.
 */
export const ensureSessionChecked = async (): Promise<void> => {
  try {
    const { useAuthStore } = await loadAuthStoreModule();
    if (useAuthStore.getState().status !== 'idle') return;
    await useAuthStore.getState().checkSession();
  } catch {
    // Intentionally swallowed - see the contract above.
  }
};

// Test seam: the cached module promise is module-level state that a jest
// module-registry reset does not clear.
export const resetLazyAuthStoreForTests = (): void => {
  storeModulePromise = null;
};
