'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getJsonStorageItem,
  getStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/app/lib/browserStorage';

export interface GithubStats {
  /** Compact star count, e.g. '2.4k'. */
  stars: string | null;
  /** Full star count, e.g. '2,431'. */
  starsFull: string | null;
  /** Flagship proof stat: clone-traffic total, e.g. '67,134'. */
  selfHosters: string | null;
  contributors: string | null;
  discord: string | null;
}

const STATS_CACHE_KEY = 'yc_marketing_stats_v1';
const STATS_TS_KEY = 'yc_marketing_stats_ts_v1';
const STATS_TTL_MS = 5 * 60 * 1000;

const EMPTY_STATS: GithubStats = {
  stars: null,
  starsFull: null,
  selfHosters: null,
  contributors: null,
  discord: null,
};

/**
 * Session-cache subscription for useSyncExternalStore. The session cache is the
 * external store the cached (non-live) hooks render from: the effects below refresh
 * it over the network, every write emits, and each subscribed instance re-reads.
 * Snapshots are memoized on the raw JSON so getSnapshot returns a stable reference
 * until the underlying entry actually changes.
 */
const cacheListeners = new Set<() => void>();

const subscribeToSessionCache = (onStoreChange: () => void): (() => void) => {
  cacheListeners.add(onStoreChange);
  return () => {
    cacheListeners.delete(onStoreChange);
  };
};

const emitSessionCacheChange = (): void => {
  for (const listener of cacheListeners) listener();
};

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

let statsSnapshotRaw: string | null = null;
let statsSnapshot: GithubStats = EMPTY_STATS;

const getStatsSnapshot = (): GithubStats => {
  const raw = getStorageItem('session', STATS_CACHE_KEY);
  if (raw !== statsSnapshotRaw) {
    statsSnapshotRaw = raw;
    const cached = parseJson<Partial<GithubStats>>(raw);
    statsSnapshot = cached ? { ...EMPTY_STATS, ...cached } : EMPTY_STATS;
  }
  return statsSnapshot;
};

/** SSR (and the hydrating first client render) always shows the loading placeholders. */
const getServerStats = (): GithubStats => EMPTY_STATS;
// Same-origin route handlers, not the third-party APIs directly: see the comments
// on those routes for why reading them across origins kept breaking, and why the
// lookups belong on the server.
const DISCORD_MEMBERS_ENDPOINT = '/api/community/discord-members';
const GITHUB_STATS_ENDPOINT = '/api/community/github-stats';
const GITHUB_RELEASES_ENDPOINT = '/api/community/github-releases';

const fetchJson = async (url: string, accept?: string): Promise<unknown> => {
  try {
    const res = await fetch(url, accept ? { headers: { Accept: accept } } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const fetchGithubStats = async (): Promise<Partial<GithubStats>> => {
  const json = (await fetchJson(GITHUB_STATS_ENDPOINT)) as Partial<GithubStats> | null;
  if (!json) return {};
  // Only contribute keys that actually resolved, so a partial upstream failure
  // leaves the previously cached values in place rather than blanking them.
  return Object.fromEntries(
    Object.entries(json).filter(([, value]) => typeof value === 'string')
  ) as Partial<GithubStats>;
};

const fetchDiscord = async (): Promise<Partial<GithubStats>> => {
  const json = (await fetchJson(DISCORD_MEMBERS_ENDPOINT)) as {
    discordMembers?: string | null;
  } | null;
  if (typeof json?.discordMembers !== 'string') return {};
  return { discord: json.discordMembers };
};

/**
 * Shared in-flight fetch. The stats hook is mounted by several components at once
 * (nav, footer, auth shell, stats sections), so without this every mount would
 * fire its own copy of all four requests and burn the unauthenticated GitHub quota.
 * Every instance that mounts while a fetch is running awaits this same promise.
 *
 * The loader returns ONLY the fields fetched in this pass (a fetcher that fails or
 * gets a non-OK response contributes nothing). That lets a live consumer publish
 * exactly this-pass data (a failed field stays as its loading placeholder, never a
 * stale cached value) while a cached consumer merges it over its last-known snapshot.
 * The session cache is refreshed by merging the fresh fields OVER the previous cache,
 * so a transient failure never wipes a good cached value.
 */
let inFlight: Promise<Partial<GithubStats>> | null = null;

const runGithubStatsFetch = async (): Promise<Partial<GithubStats>> => {
  const parts = await Promise.all([fetchGithubStats(), fetchDiscord()]);
  const fresh = parts.reduce<Partial<GithubStats>>((acc, part) => ({ ...acc, ...part }), {});
  const cached = getJsonStorageItem<Partial<GithubStats>>('session', STATS_CACHE_KEY) ?? {};
  setJsonStorageItem('session', STATS_CACHE_KEY, { ...EMPTY_STATS, ...cached, ...fresh });
  setStorageItem('session', STATS_TS_KEY, String(Date.now()));
  emitSessionCacheChange();
  return fresh;
};

const loadGithubStats = (): Promise<Partial<GithubStats>> => {
  inFlight ??= runGithubStatsFetch().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

/** True when the session cache was refreshed within the TTL, so no network is needed. */
const isStatsCacheFresh = (): boolean => {
  const raw = getStorageItem('session', STATS_TS_KEY);
  if (!raw) return false;
  const savedAt = Number.parseInt(raw, 10);
  return Number.isFinite(savedAt) && Date.now() - savedAt < STATS_TTL_MS;
};

export interface LiveFetchOptions {
  /**
   * Bypass the session cache/TTL and always refetch on mount, WITHOUT first
   * painting a cached value. The Insights page passes this so its "no cache,
   * pulled on every visit, right now" copy stays truthful even for a repeat
   * visitor inside the normal cache window: the surface shows its loading
   * placeholder until the live value resolves rather than a stale cached one.
   */
  live?: boolean;
}

/**
 * Live community metrics from GitHub + Discord. Seeds from the session cache, then
 * refreshes through a single shared loader that is deduplicated across concurrent
 * hook instances. By default the refresh is skipped while the cached snapshot is
 * still fresh; pass `{ live: true }` to always refetch AND skip the cached seed
 * (used by the Insights page, whose copy explicitly promises uncached numbers).
 */
export function useGithubStats(options?: LiveFetchOptions): GithubStats {
  const live = options?.live ?? false;
  // Cached consumers render straight from the session cache (the external store):
  // the server snapshot and the hydrating first paint are both the empty
  // placeholders, so there is no hydration mismatch, and the cached value appears
  // once hydration completes. Refreshes rewrite the cache, which emits.
  const cachedStats = useSyncExternalStore(
    subscribeToSessionCache,
    getStatsSnapshot,
    getServerStats
  );
  // Live mode never paints the cache under the "no cache" copy, so it keeps its
  // own state fed exclusively from this-pass fetch results.
  const [liveStats, setLiveStats] = useState<GithubStats>(EMPTY_STATS);

  useEffect(() => {
    let active = true;
    const cached = getJsonStorageItem<Partial<GithubStats>>('session', STATS_CACHE_KEY);
    const needsDiscordRefresh = typeof cached?.discord !== 'string';
    if (live || !isStatsCacheFresh() || needsDiscordRefresh) {
      void (async () => {
        const fresh = await loadGithubStats();
        if (!active) return;
        // Live: publish ONLY this-pass fields, so a failed fetcher stays as the
        // loading placeholder rather than a stale cached value under the "no cache"
        // copy. Cached consumers pick up the merged refresh via the cache emit.
        if (live) setLiveStats({ ...EMPTY_STATS, ...fresh });
      })();
    }
    return () => {
      active = false;
    };
  }, [live]);

  return live ? liveStats : cachedStats;
}

export interface ReleaseInfo {
  /** Cleaned tag, e.g. 'v2.0.0-beta' with any 'backend-'/'mobile-' prefix stripped. */
  tag: string | null;
  /** Localized publish date, e.g. 'Jul 2, 2026'. */
  date: string | null;
  url: string | null;
}

const EMPTY_RELEASE: ReleaseInfo = { tag: null, date: null, url: null };

// Raw-string-memoized release snapshots per cache key (same contract as getStatsSnapshot).
const releaseSnapshots = new Map<string, { raw: string | null; value: ReleaseInfo }>();

const getReleaseSnapshot = (cacheKey: string): ReleaseInfo => {
  const raw = getStorageItem('session', cacheKey);
  const memo = releaseSnapshots.get(cacheKey);
  if (memo && memo.raw === raw) return memo.value;
  const value = parseJson<ReleaseInfo>(raw) ?? EMPTY_RELEASE;
  releaseSnapshots.set(cacheKey, { raw, value });
  return value;
};

/** SSR (and the hydrating first client render) always shows the loading placeholder. */
const getServerRelease = (): ReleaseInfo => EMPTY_RELEASE;

const formatReleaseDate = (iso?: string): string | null => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
};

type RawRelease = { tag_name?: string; published_at?: string; html_url?: string };

/**
 * Shape a raw GitHub release into ReleaseInfo. The version comes from tag_name (the git tag),
 * never the release `name` (a free-form title): strip a leading area prefix (backend-/mobile-/
 * pims-/...) so only the version remains.
 */
const toReleaseInfo = (raw: RawRelease): ReleaseInfo => ({
  tag: (raw.tag_name ?? '').replace(/^[a-z]+-(?=v?\d)/i, '') || null,
  date: formatReleaseDate(raw.published_at),
  url: raw.html_url ?? null,
});

// Tag predicates (module-level so the reference stays stable across renders, keeping the
// useTaggedReleaseFromList effect from re-firing). Inputs are already lower-cased.
const matchesMobileTag = (tag: string): boolean => /mobile|ios|android|app-v|expo/.test(tag);
const matchesPlatformTag = (tag: string): boolean => /^(pims|pms)[-_]/.test(tag);

/**
 * Newest release from the repo's releases list whose TAG matches `matchesTag`. Matching on the tag
 * (not the free-text title) keeps e.g. a backend release that merely mentions "mobile" from being
 * picked; the list is newest-first, so the first match is the latest. Shared by useMobileRelease
 * and usePlatformRelease, which differ only in their cache key and tag predicate.
 */
const useTaggedReleaseFromList = (
  cacheKey: string,
  matchesTag: (tag: string) => boolean
): ReleaseInfo => {
  // Rendered straight from the session cache (the external store): the cached seed
  // appears once hydration completes, and the refresh below rewrites the cache,
  // which emits to every subscribed instance.
  const release = useSyncExternalStore(
    subscribeToSessionCache,
    () => getReleaseSnapshot(cacheKey),
    getServerRelease
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const list = (await fetchJson(`${GITHUB_RELEASES_ENDPOINT}?list=1`)) as RawRelease[] | null;
      if (!active || !Array.isArray(list)) return;
      const match = list.find((entry) => matchesTag((entry.tag_name ?? '').toLowerCase()));
      if (!match?.html_url) return;
      setJsonStorageItem('session', cacheKey, toReleaseInfo(match));
      emitSessionCacheChange();
    })();
    return () => {
      active = false;
    };
  }, [cacheKey, matchesTag]);

  return release;
};

/**
 * Latest GitHub release (platform). Used by the Home chip and Pet Businesses hero
 * pill (cached) and the Insights latest-release card. Pass `{ live: true }` on the
 * Insights page so the "nothing is cached" copy is honest: live mode always
 * refetches and skips the cached seed, showing a loading placeholder (never a stale
 * cached release) until the fresh value resolves.
 */
export function useLatestRelease(options?: LiveFetchOptions): ReleaseInfo {
  const live = options?.live ?? false;
  const cacheKey = 'yc_rel_platform_v1';
  // Cached consumers render straight from the session cache (see useTaggedReleaseFromList);
  // live mode never paints the cache, so it keeps its own fetch-fed state.
  const cachedRelease = useSyncExternalStore(
    subscribeToSessionCache,
    () => getReleaseSnapshot(cacheKey),
    getServerRelease
  );
  const [liveRelease, setLiveRelease] = useState<ReleaseInfo>(EMPTY_RELEASE);

  useEffect(() => {
    let active = true;
    void (async () => {
      const json = (await fetchJson(GITHUB_RELEASES_ENDPOINT)) as RawRelease | null;
      if (!active || !json?.tag_name) return;
      const next = toReleaseInfo(json);
      setLiveRelease(next);
      setJsonStorageItem('session', cacheKey, next);
      emitSessionCacheChange();
    })();
    return () => {
      active = false;
    };
  }, [live]);

  return live ? liveRelease : cachedRelease;
}

/**
 * Newest platform (PIMS) GitHub release. Used by the Pet Businesses hero pill. The repo's
 * `/releases/latest` is a desktop build, so the platform pill must not borrow it; instead pick the
 * newest release whose TAG is a platform tag (`pims-`/`pms-`), which carries the real PIMS version
 * and publish date and links to that release.
 */
export function usePlatformRelease(): ReleaseInfo {
  return useTaggedReleaseFromList('yc_rel_pims_v1', matchesPlatformTag);
}

/** Newest mobile-tagged GitHub release. Used by the Pet Parents hero pill. */
export function useMobileRelease(): ReleaseInfo {
  return useTaggedReleaseFromList('yc_rel_mobile_v1', matchesMobileTag);
}
