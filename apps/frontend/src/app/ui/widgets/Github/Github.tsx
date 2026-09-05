'use client';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { IoCloseSharp } from 'react-icons/io5';
import { usePathname } from 'next/navigation';
import { Icon } from '@/app/ui/icons/Icon';
import { publicRoutes } from '@/app/lib/const';
import { getJsonStorageItem, setJsonStorageItem } from '@/app/lib/browserStorage';

const owner = 'YosemiteCrew';
const repo = 'Yosemite-Crew';

const CACHE_TTL_MS = 60 * 60 * 1000;
const cacheKey = (o: string, r: string) => `gh:stars:${o}/${r}`;

type CacheShape = { value: number; ts: number };

const readCache = (o: string, r: string): number | null => {
  const parsed = getJsonStorageItem<CacheShape>('local', cacheKey(o, r));
  if (!parsed) return null;
  if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
  return typeof parsed.value === 'number' ? parsed.value : null;
};

const writeCache = (o: string, r: string, value: number) => {
  const payload: CacheShape = { value, ts: Date.now() };
  setJsonStorageItem('local', cacheKey(o, r), payload);
};

const formatStars = (n: number) =>
  Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);

type StarsStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number | null;
  getServerSnapshot: () => number | null;
  publish: (value: number) => void;
};

// The star count lives in an external store rather than component state so the
// cached value is available on the very first client render (no mount effect,
// no extra render) while the server snapshot stays null — localStorage is
// client-only, and `useSyncExternalStore` keeps hydration consistent for us.
const createStarsStore = (o: string, r: string): StarsStore => {
  const listeners = new Set<() => void>();
  // The snapshot is memoised (read from cache exactly once, as the previous
  // mount effect did) so getSnapshot stays stable across renders.
  let snapshot: number | null = null;
  let snapshotRead = false;

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => {
      if (!snapshotRead) {
        snapshot = readCache(o, r);
        snapshotRead = true;
      }
      return snapshot;
    },
    getServerSnapshot: () => null,
    publish: (value) => {
      snapshot = value;
      snapshotRead = true;
      writeCache(o, r, value);
      for (const listener of listeners) listener();
    },
  };
};

const IDLE_FALLBACK_MS = 1000;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

// Defer the third-party GitHub API call off the critical load path, then refresh
// every 15 minutes while the banner is mounted. Firing it synchronously on mount
// keeps the network busy and prevents `networkidle` from settling (which flakes
// the Playwright a11y run); the star count is non-essential chrome, so let the
// page reach idle first, then fetch. Returns the disposer for both timers.
const scheduleStarRefresh = (run: () => void): (() => void) => {
  const idleWindow = globalThis.window as
    | (Window & {
        requestIdleCallback?: (cb: () => void) => number;
        cancelIdleCallback?: (handle: number) => void;
      })
    | undefined;
  let idleHandle: number | undefined;
  let idleTimeout: ReturnType<typeof setTimeout> | undefined;
  if (idleWindow?.requestIdleCallback) {
    idleHandle = idleWindow.requestIdleCallback(() => run());
  } else {
    idleTimeout = setTimeout(run, IDLE_FALLBACK_MS);
  }
  const intervalId = setInterval(run, REFRESH_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    if (idleHandle !== undefined) idleWindow?.cancelIdleCallback?.(idleHandle);
    if (idleTimeout !== undefined) clearTimeout(idleTimeout);
  };
};

const Github = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [starsStore] = useState(() => createStarsStore(owner, repo));
  const stars = useSyncExternalStore(
    starsStore.subscribe,
    starsStore.getSnapshot,
    starsStore.getServerSnapshot
  );
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const onClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    // The 10s fetch-abort timer is tracked at effect scope and cleared in a
    // `finally`. Previously `clearTimeout` sat on the resolved path only, so a
    // fetch that rejected (offline, abort) - or an unmount mid-request - left
    // the timer pending until it fired.
    let abortTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadStars() {
      setError(null);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      abortTimer = t;
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          signal: ctrl.signal,
          headers: {
            // These headers are optional but nice to include
            Accept: 'application/vnd.github+json',
          },
        });

        if (!res.ok) {
          // If we’re rate-limited or offline, keep cached value if present
          if (!cancelled) setError('—');
          return;
        }

        const data = await res.json();
        const count = Number(data?.stargazers_count ?? 0);

        if (!Number.isFinite(count)) throw new Error('Bad star count');

        if (!cancelled) starsStore.publish(count);
      } catch {
        if (!cancelled) setError('—');
      } finally {
        clearTimeout(t);
      }
    }
    const stopRefresh = scheduleStarRefresh(() => void loadStars());

    return () => {
      cancelled = true;
      stopRefresh();
      // Cancels an abort timer still in flight at unmount; clearing an already
      // cleared id is a no-op.
      if (abortTimer !== undefined) clearTimeout(abortTimer);
    };
  }, [starsStore]);

  if (!isOpen) return null;

  return (
    <aside
      aria-label="GitHub repository"
      className={`${publicRoutes.has(pathname) ? 'flex!' : 'hidden!'} fixed left-0 bottom-7.5 z-9999 flex items-center justify-center w-full pointer-events-none`}
    >
      <div className="px-6 py-3 flex items-center justify-center gap-2 bg-[var(--ink-fixed)] pointer-events-auto rounded-2xl">
        <div className="text-body-2 text-white">Star us on Github</div>
        <a
          href="https://github.com/YosemiteCrew/Yosemite-Crew"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl cursor-pointer bg-white px-2"
        >
          <div className="flex items-center gap-1">
            <Icon icon="mdi:github" width="28" height="28" color="var(--color-neutral-900)" />
            <div className="text-caption-1 text-[var(--ink-fixed)]">Stars</div>
          </div>
          <div className="h-3.75 w-px bg-[var(--color-neutral-300)]"></div>
          <div className="text-caption-1 text-[var(--ink-fixed)]">
            {error ?? (stars === null ? '…' : formatStars(stars))}
          </div>
        </a>
        <button
          className="border-none bg-[var(--ink-fixed)]"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <IoCloseSharp color="var(--white-text)" size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Github;
