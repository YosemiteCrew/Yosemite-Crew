'use client';

import { useEffect, useState } from 'react';
import {
  getJsonStorageItem,
  getStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/app/lib/browserStorage';
import { http } from '@/app/services/http';
import { GITHUB_API_REPO } from './assets';

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
const REPO_STATS_SUMMARY =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';
const DISCORD_MEMBERS_ENDPOINT = `${process.env.NEXT_PUBLIC_BASE_URL}v1/marketing/discord-members`;
const CONTRIBUTORS_API = `${GITHUB_API_REPO}/contributors?per_page=1&anon=true`;

const formatCompact = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);

const fetchJson = async (url: string, accept?: string): Promise<unknown> => {
  try {
    const res = await fetch(url, accept ? { headers: { Accept: accept } } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const readSelfHostersTotal = (summary: unknown): number | null => {
  if (!summary || typeof summary !== 'object') return null;
  const data = summary as {
    clones?: { total?: number };
    charts?: Record<string, { datasets?: Record<string, Array<{ clones_total?: number }>> }>;
  };
  if (typeof data.clones?.total === 'number') return data.clones.total;
  const dataset = data.charts?.['#clones_total']?.datasets;
  if (dataset) {
    const series = Object.values(dataset)[0];
    if (Array.isArray(series)) {
      return series.reduce((sum, point) => sum + (point.clones_total ?? 0), 0);
    }
  }
  return null;
};

const fetchStars = async (): Promise<Partial<GithubStats>> => {
  const repo = (await fetchJson(GITHUB_API_REPO)) as { stargazers_count?: number } | null;
  if (typeof repo?.stargazers_count !== 'number') return {};
  return {
    stars: formatCompact(repo.stargazers_count),
    starsFull: repo.stargazers_count.toLocaleString('en-US'),
  };
};

const fetchSelfHosters = async (): Promise<Partial<GithubStats>> => {
  const summary = await fetchJson(REPO_STATS_SUMMARY);
  const total = readSelfHostersTotal(summary);
  // Contribute nothing on failure (like the other fetchers), so a transient outage
  // keeps the cached value for cached consumers and shows the loading placeholder on
  // the live Insights surface -- never a hard-coded number presented as live/uncached.
  if (total === null) return {};
  return { selfHosters: total.toLocaleString('en-US') };
};

const fetchContributors = async (): Promise<Partial<GithubStats>> => {
  try {
    const res = await fetch(CONTRIBUTORS_API);
    if (!res.ok) return {};
    const link = res.headers.get('Link') ?? '';
    const match = /[?&]page=(\d+)>; rel="last"/.exec(link);
    if (!match) return {};
    return { contributors: Number.parseInt(match[1], 10).toLocaleString('en-US') };
  } catch {
    return {};
  }
};

const fetchDiscord = async (): Promise<Partial<GithubStats>> => {
  try {
    const response = await http.get<{ discordMembers: string | null }>(DISCORD_MEMBERS_ENDPOINT);
    if (typeof response.data.discordMembers !== 'string') return {};
    return { discord: response.data.discordMembers };
  } catch {
    return {};
  }
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
  const parts = await Promise.all([
    fetchStars(),
    fetchSelfHosters(),
    fetchContributors(),
    fetchDiscord(),
  ]);
  const fresh = parts.reduce<Partial<GithubStats>>((acc, part) => ({ ...acc, ...part }), {});
  const cached = getJsonStorageItem<Partial<GithubStats>>('session', STATS_CACHE_KEY) ?? {};
  setJsonStorageItem('session', STATS_CACHE_KEY, { ...EMPTY_STATS, ...cached, ...fresh });
  setStorageItem('session', STATS_TS_KEY, String(Date.now()));
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
  const [stats, setStats] = useState<GithubStats>(EMPTY_STATS);

  useEffect(() => {
    let active = true;
    // Seed from the session cache after mount, not in the useState initializer:
    // reading storage during render makes the client's first paint diverge from the
    // server HTML (which has no storage) and triggers a hydration mismatch. Live
    // mode skips the seed so a stale value is never painted under the "no cache" copy.
    if (!live) {
      const cached = getJsonStorageItem<Partial<GithubStats>>('session', STATS_CACHE_KEY);
      if (cached) setStats({ ...EMPTY_STATS, ...cached });
    }
    const cached = getJsonStorageItem<Partial<GithubStats>>('session', STATS_CACHE_KEY);
    const needsDiscordRefresh = typeof cached?.discord !== 'string';
    if (live || !isStatsCacheFresh() || needsDiscordRefresh) {
      void (async () => {
        const fresh = await loadGithubStats();
        if (!active) return;
        // Live: publish ONLY this-pass fields, so a failed fetcher stays as the
        // loading placeholder rather than a stale cached value under the "no cache"
        // copy. Cached: keep last-known values for any field this pass did not return.
        setStats((prev) => (live ? { ...EMPTY_STATS, ...fresh } : { ...prev, ...fresh }));
      })();
    }
    return () => {
      active = false;
    };
  }, [live]);

  return stats;
}

export interface ReleaseInfo {
  /** Cleaned tag, e.g. 'v2.0.0-beta' with any 'backend-'/'mobile-' prefix stripped. */
  tag: string | null;
  /** Localized publish date, e.g. 'Jul 2, 2026'. */
  date: string | null;
  url: string | null;
}

const EMPTY_RELEASE: ReleaseInfo = { tag: null, date: null, url: null };

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
  const [release, setRelease] = useState<ReleaseInfo>(EMPTY_RELEASE);

  useEffect(() => {
    let active = true;
    const cached = getJsonStorageItem<ReleaseInfo>('session', cacheKey);
    if (cached) setRelease(cached);
    void (async () => {
      const list = (await fetchJson(
        `${GITHUB_API_REPO}/releases?per_page=30`,
        'application/vnd.github+json'
      )) as RawRelease[] | null;
      if (!active || !Array.isArray(list)) return;
      const match = list.find((entry) => matchesTag((entry.tag_name ?? '').toLowerCase()));
      if (!match?.html_url) return;
      const next = toReleaseInfo(match);
      setRelease(next);
      setJsonStorageItem('session', cacheKey, next);
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
  const [release, setRelease] = useState<ReleaseInfo>(EMPTY_RELEASE);

  useEffect(() => {
    let active = true;
    if (!live) {
      const cached = getJsonStorageItem<ReleaseInfo>('session', cacheKey);
      if (cached) setRelease(cached);
    }
    void (async () => {
      const json = (await fetchJson(
        `${GITHUB_API_REPO}/releases/latest`,
        'application/vnd.github+json'
      )) as RawRelease | null;
      if (!active || !json?.tag_name) return;
      const next = toReleaseInfo(json);
      setRelease(next);
      setJsonStorageItem('session', cacheKey, next);
    })();
    return () => {
      active = false;
    };
  }, [live]);

  return release;
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
