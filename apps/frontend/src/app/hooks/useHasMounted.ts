'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Returns `true` once the component has mounted on the client, `false` during
 * SSR/the first client render. Uses useSyncExternalStore instead of a
 * useEffect(() => setMounted(true), []) so React can flag it as hydration
 * state up front rather than flashing a stale value after mount.
 */
export const useHasMounted = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
