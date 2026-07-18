'use client';

import { useEffect, useState } from 'react';
import {
  getJsonStorageItem,
  getStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/app/lib/browserStorage';
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
const SELF_HOSTERS_FALLBACK = 67100;

const EMPTY_STATS: GithubStats = {
  stars: null,
  starsFull: null,
  selfHosters: null,
  contributors: null,
  discord: null,
};
const REPO_STATS_SUMMARY =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';
const DISCORD_INVITE_API = 'https://discord.com/api/v9/invites/yosemitecrew?with_counts=true';
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
  const total = readSelfHostersTotal(summary) ?? SELF_HOSTERS_FALLBACK;
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
  const invite = (await fetchJson(DISCORD_INVITE_API)) as {
    approximate_member_count?: number;
  } | null;
  if (typeof invite?.approximate_member_count !== 'number') return {};
  return { discord: invite.approximate_member_count.toLocaleString('en-US') };
};

/**
 * Shared in-flight fetch. The stats hook is mounted by several components at once
 * (nav, footer, auth shell, stats sections), so without this every mount would
 * fire its own copy of all four requests and burn the unauthenticated GitHub quota.
 * Every instance that mounts while a fetch is running awaits this same promise.
 */
let inFlight: Promise<GithubStats> | null = null;

const runGithubStatsFetch = async (): Promise<GithubStats> => {
  const parts = await Promise.all([
    fetchStars(),
    fetchSelfHosters(),
    fetchContributors(),
    fetchDiscord(),
  ]);
  const cached = getJsonStorageItem<Partial<GithubStats>>('session', STATS_CACHE_KEY);
  const base: GithubStats = { ...EMPTY_STATS, ...cached };
  const merged = parts.reduce<GithubStats>((acc, part) => ({ ...acc, ...part }), base);
  setJsonStorageItem('session', STATS_CACHE_KEY, merged);
  setStorageItem('session', STATS_TS_KEY, String(Date.now()));
  return merged;
};

const loadGithubStats = (): Promise<GithubStats> => {
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
    if (live || !isStatsCacheFresh()) {
      void (async () => {
        const merged = await loadGithubStats();
        if (active) setStats(merged);
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
      )) as { tag_name?: string; published_at?: string; html_url?: string } | null;
      if (!active || !json?.tag_name) return;
      const next: ReleaseInfo = {
        // Derive the version from tag_name (the git tag), never the release `name`:
        // GitHub release names are free-form titles and would land in the version slot.
        tag: json.tag_name.replace(/^[a-z]+-(?=v?\d)/i, ''),
        date: formatReleaseDate(json.published_at),
        url: json.html_url ?? null,
      };
      setRelease(next);
      setJsonStorageItem('session', cacheKey, next);
    })();
    return () => {
      active = false;
    };
  }, [live]);

  return release;
}

/** Newest mobile-tagged GitHub release. Used by the Pet Parents hero pill. */
export function useMobileRelease(): ReleaseInfo {
  const cacheKey = 'yc_rel_mobile_v1';
  const [release, setRelease] = useState<ReleaseInfo>(EMPTY_RELEASE);

  useEffect(() => {
    let active = true;
    const cached = getJsonStorageItem<ReleaseInfo>('session', cacheKey);
    if (cached) setRelease(cached);
    void (async () => {
      const list = (await fetchJson(
        `${GITHUB_API_REPO}/releases?per_page=30`,
        'application/vnd.github+json'
      )) as Array<{
        tag_name?: string;
        published_at?: string;
        html_url?: string;
      }> | null;
      if (!active || !Array.isArray(list)) return;
      // Match on the release TAG only (not the free-text title), so a platform or
      // backend release whose notes merely mention "mobile" is not mistaken for the
      // mobile app release.
      const isMobileTag = (x: { tag_name?: string }) =>
        /mobile|ios|android|app-v|expo/.test((x.tag_name ?? '').toLowerCase());
      const mobile = list.find(isMobileTag);
      if (!mobile?.html_url) return;
      const next: ReleaseInfo = {
        // tag_name only: the release `name` is a free-form title, not a version.
        tag: (mobile.tag_name ?? '').replace(/^[a-z]+-(?=v?\d)/i, '') || null,
        date: formatReleaseDate(mobile.published_at),
        url: mobile.html_url,
      };
      setRelease(next);
      setJsonStorageItem('session', cacheKey, next);
    })();
    return () => {
      active = false;
    };
  }, []);

  return release;
}
