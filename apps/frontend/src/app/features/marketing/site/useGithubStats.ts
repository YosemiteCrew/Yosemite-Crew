'use client';

import { useEffect, useState } from 'react';
import { getJsonStorageItem, setJsonStorageItem } from '@/app/lib/browserStorage';
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
const SELF_HOSTERS_FALLBACK = 67100;
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

/**
 * Live community metrics from GitHub + Discord, matching the marketing prototype's
 * fetchMetrics. Reads a session cache first, then refreshes each source independently.
 */
export function useGithubStats(): GithubStats {
  const [stats, setStats] = useState<GithubStats>(() => ({
    stars: null,
    starsFull: null,
    selfHosters: null,
    contributors: null,
    discord: null,
    ...(getJsonStorageItem<Partial<GithubStats>>('session', STATS_CACHE_KEY) ?? {}),
  }));

  useEffect(() => {
    let active = true;
    const merge = (partial: Partial<GithubStats>) => {
      if (!active) return;
      setStats((prev) => {
        const next = { ...prev, ...partial };
        setJsonStorageItem('session', STATS_CACHE_KEY, next);
        return next;
      });
    };

    void (async () => {
      const repo = (await fetchJson(GITHUB_API_REPO)) as { stargazers_count?: number } | null;
      if (typeof repo?.stargazers_count === 'number') {
        merge({
          stars: formatCompact(repo.stargazers_count),
          starsFull: repo.stargazers_count.toLocaleString('en-US'),
        });
      }
    })();

    void (async () => {
      const summary = await fetchJson(REPO_STATS_SUMMARY);
      const total = readSelfHostersTotal(summary) ?? SELF_HOSTERS_FALLBACK;
      merge({ selfHosters: total.toLocaleString('en-US') });
    })();

    void (async () => {
      try {
        const res = await fetch(CONTRIBUTORS_API);
        if (!res.ok) return;
        const link = res.headers.get('Link') ?? '';
        const match = /[?&]page=(\d+)>; rel="last"/.exec(link);
        if (match) merge({ contributors: parseInt(match[1], 10).toLocaleString('en-US') });
      } catch {
        /* offline: leave contributors unresolved */
      }
    })();

    void (async () => {
      const invite = (await fetchJson(DISCORD_INVITE_API)) as {
        approximate_member_count?: number;
      } | null;
      if (typeof invite?.approximate_member_count === 'number') {
        merge({ discord: invite.approximate_member_count.toLocaleString('en-US') });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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

/** Latest GitHub release (platform). Used by the Home chip and Pet Businesses hero pill. */
export function useLatestRelease(): ReleaseInfo {
  const cacheKey = 'yc_rel_platform_v1';
  const [release, setRelease] = useState<ReleaseInfo>(
    () => getJsonStorageItem<ReleaseInfo>('session', cacheKey) ?? EMPTY_RELEASE
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const json = (await fetchJson(
        `${GITHUB_API_REPO}/releases/latest`,
        'application/vnd.github+json'
      )) as { tag_name?: string; name?: string; published_at?: string; html_url?: string } | null;
      if (!active || !json?.tag_name) return;
      const rawTag = json.name ?? json.tag_name;
      const next: ReleaseInfo = {
        tag: rawTag.replace(/^[a-z]+-(?=v?\d)/i, ''),
        date: formatReleaseDate(json.published_at),
        url: json.html_url ?? null,
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

/** Newest mobile-tagged GitHub release. Used by the Pet Parents hero pill. */
export function useMobileRelease(): ReleaseInfo {
  const cacheKey = 'yc_rel_mobile_v1';
  const [release, setRelease] = useState<ReleaseInfo>(
    () => getJsonStorageItem<ReleaseInfo>('session', cacheKey) ?? EMPTY_RELEASE
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const list = (await fetchJson(
        `${GITHUB_API_REPO}/releases?per_page=30`,
        'application/vnd.github+json'
      )) as Array<{
        tag_name?: string;
        name?: string;
        published_at?: string;
        html_url?: string;
      }> | null;
      if (!active || !Array.isArray(list)) return;
      const tagOf = (x: { tag_name?: string; name?: string }) =>
        `${x.tag_name ?? ''} ${x.name ?? ''}`.toLowerCase();
      const isMobile = (x: { tag_name?: string; name?: string }) =>
        /mobile|ios|android|app-v|-app|expo/.test(tagOf(x));
      const mobile = list.find((x) => isMobile(x) && /1\.2/.test(tagOf(x))) ?? list.find(isMobile);
      if (!mobile?.html_url) return;
      const next: ReleaseInfo = {
        tag: (mobile.name ?? mobile.tag_name ?? '').replace(/^[a-z]+-(?=v?\d)/i, '') || null,
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
