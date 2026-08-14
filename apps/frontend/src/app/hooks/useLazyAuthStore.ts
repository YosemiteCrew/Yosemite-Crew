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

  // No dep array: refresh the closures after every render, before the
  // subscribing effect below (declaration order) ever reads them.
  useEffect(() => {
    selectRef.current = select;
    isEqualRef.current = isEqual;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void loadAuthStoreModule().then(({ useAuthStore }) => {
      if (!active) return;
      const read = () =>
        setValue((previous) => {
          const next = selectRef.current(useAuthStore.getState());
          return isEqualRef.current(previous, next) ? previous : next;
        });

      read();
      unsubscribe = useAuthStore.subscribe(read);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [enabled]);

  return value;
}

/**
 * Kick off the SuperTokens session check if nothing has done so yet.
 *
 * Public pages do not otherwise bootstrap it, so an already authenticated
 * visitor would keep being shown the signed-out affordances.
 */
export const ensureSessionChecked = async (): Promise<void> => {
  const { useAuthStore } = await loadAuthStoreModule();
  if (useAuthStore.getState().status !== 'idle') return;
  await useAuthStore.getState().checkSession();
};

// Test seam: the cached module promise is module-level state that a jest
// module-registry reset does not clear.
export const resetLazyAuthStoreForTests = (): void => {
  storeModulePromise = null;
};
