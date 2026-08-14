import { NextResponse } from 'next/server';
import {
  CACHED_HEADERS,
  UNCACHED_HEADERS,
  rejectUnexpectedParams,
} from '@/app/api/community/publicProxy';

/**
 * Public GitHub-derived stats for the marketing surfaces (nav star count,
 * Insights, About).
 *
 * These were fetched from the browser, which meant three third-party requests
 * from a statically prerendered page: two to api.github.com and one to
 * raw.githubusercontent.com. That is slow (three cross-origin round trips on
 * first paint), fragile (the unauthenticated GitHub quota is per client IP, so a
 * clinic behind one NAT burns it collectively) and leaks every visitor's IP to
 * GitHub.
 *
 * Moving them here follows the same reasoning as the Discord route next door:
 * same-origin, already allowed by `connect-src 'self'`, no credentials, and the
 * lookup is made by the server so visitors' IPs stay with us. It also means one
 * request from the browser instead of three, and the result is cached at the CDN
 * for every visitor rather than per browser.
 */

const GITHUB_API_REPO = 'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew';
const CONTRIBUTORS_API = `${GITHUB_API_REPO}/contributors?per_page=1&anon=true`;
const REPO_STATS_SUMMARY =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';

// GitHub asks for a descriptive User-Agent and throttles generic ones.
const GITHUB_USER_AGENT = 'YosemiteCrew-Web (https://www.yosemitecrew.com, 1.0)';

export interface GithubStatsResponse {
  /** Compact star count, e.g. '2.4k'. Null when the lookup failed. */
  stars: string | null;
  /** Full star count, e.g. '2,431'. */
  starsFull: string | null;
  /** Clone-traffic total. */
  selfHosters: string | null;
  contributors: string | null;
}

const EMPTY: GithubStatsResponse = {
  stars: null,
  starsFull: null,
  selfHosters: null,
  contributors: null,
};

const formatCompact = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);

// Uncached at the fetch layer for the same reason as the Discord route: Next's
// data cache keys on the request, not the outcome, so a 200 carrying no usable
// value would be replayed for the whole TTL. Only a parsed result is cached, via
// the response header below.
const githubFetch = (url: string) =>
  fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': GITHUB_USER_AGENT },
    cache: 'no-store',
  });

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

const fetchStars = async (): Promise<Pick<GithubStatsResponse, 'stars' | 'starsFull'>> => {
  try {
    const res = await githubFetch(GITHUB_API_REPO);
    if (!res.ok) return { stars: null, starsFull: null };
    const repo = (await res.json()) as { stargazers_count?: number };
    if (typeof repo?.stargazers_count !== 'number') return { stars: null, starsFull: null };
    return {
      stars: formatCompact(repo.stargazers_count),
      starsFull: repo.stargazers_count.toLocaleString('en-US'),
    };
  } catch {
    return { stars: null, starsFull: null };
  }
};

const fetchSelfHosters = async (): Promise<string | null> => {
  try {
    const res = await githubFetch(REPO_STATS_SUMMARY);
    if (!res.ok) return null;
    const total = readSelfHostersTotal(await res.json());
    return total === null ? null : total.toLocaleString('en-US');
  } catch {
    return null;
  }
};

// The count is the number of the last page, read from the Link header, which is
// why this reads headers rather than the body.
const fetchContributors = async (): Promise<string | null> => {
  try {
    const res = await githubFetch(CONTRIBUTORS_API);
    if (!res.ok) return null;
    const match = /[?&]page=(\d+)>; rel="last"/.exec(res.headers.get('Link') ?? '');
    if (!match) return null;
    return Number.parseInt(match[1], 10).toLocaleString('en-US');
  } catch {
    return null;
  }
};

export async function GET(request: Request): Promise<NextResponse> {
  // No parameters are supported, so anything present is a cache-busting variant.
  const rejected = rejectUnexpectedParams(request, []);
  if (rejected) return rejected;

  const [starCounts, selfHosters, contributors] = await Promise.all([
    fetchStars(),
    fetchSelfHosters(),
    fetchContributors(),
  ]);

  const stats: GithubStatsResponse = { ...starCounts, selfHosters, contributors };

  // Cache only when something resolved, so a GitHub outage is retried on the next
  // request rather than pinned as nulls for the whole TTL.
  const hasAnyValue = Object.values(stats).some((value) => value !== null);

  return NextResponse.json(hasAnyValue ? stats : EMPTY, {
    headers: hasAnyValue ? CACHED_HEADERS : UNCACHED_HEADERS,
  });
}
