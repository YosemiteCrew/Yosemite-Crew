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
// anon=true is deliberate: our two most prolific contributors committed under
// emails never linked to their GitHub accounts, and omitting them would erase
// more than 2,000 commits of real human work. per_page=100 returns the whole
// list in one request so bot accounts can be filtered out of the count.
const CONTRIBUTORS_API = `${GITHUB_API_REPO}/contributors?per_page=100&anon=true`;
const REPO_STATS_SUMMARY =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';

// GitHub asks for a descriptive User-Agent and throttles generic ones.
const GITHUB_USER_AGENT = 'YosemiteCrew-Web (https://www.yosemitecrew.com, 1.0)';

export interface GithubStatsResponse {
  /** Compact star count, e.g. '2.4k'. Null when the lookup failed. */
  stars: string | null;
  /** Full star count, e.g. '2,431'. */
  starsFull: string | null;
  /**
   * Cumulative repository clone EVENTS since the stats branch began collecting,
   * straight from GitHub's traffic API. Not a user count and not an install
   * count: one machine cloning ten times is ten, and CI runners clone on every
   * workflow job. Label it as clones wherever it is rendered.
   */
  repositoryClones: string | null;
  contributors: string | null;
}

const EMPTY: GithubStatsResponse = {
  stars: null,
  starsFull: null,
  repositoryClones: null,
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

/**
 * The stats branch is refreshed by the daily `repo-stats` workflow, and when that
 * workflow stops running `summary.json` does not start failing - it keeps being
 * served with a 200 and a valid integer. That makes the clone count the one metric
 * on this route that can fail without looking like a failure: stars, contributors
 * and releases all go null and render as a placeholder, while a frozen clone total
 * renders exactly like a live one. In August 2026 the workflow's token lost the
 * traffic-API permission and the number sat unchanged for thirteen days, cached at
 * the CDN as healthy the whole time.
 *
 * The report already stamps itself, so the check needs no credential, no extra
 * request and no new workflow. Past the threshold the count is dropped to null,
 * which is the same degraded state a failed lookup already produces and which the
 * marketing surfaces already render as a loading placeholder.
 *
 * Three days rather than one: the workflow runs daily, so this tolerates two missed
 * runs before calling the number stale.
 */
const SUMMARY_MAX_AGE_MS = 72 * 60 * 60 * 1000;

/**
 * `generated_at_utc` is written as `2026-08-24 23:06 UTC`, which is NOT ISO 8601 -
 * so `Date.parse` accepting it is a V8 choice, not a language guarantee. Parsing it
 * explicitly avoids depending on that, and every rejected form counts as STALE.
 *
 * Failing closed is the whole point. If an unreadable stamp produced NaN and were
 * compared numerically, `NaN < threshold` is false, the count would be published as
 * fresh forever, and the check would certify a frozen number as live - which is the
 * exact defect it exists to catch. The bounds are in the pattern rather than left to
 * `Date.UTC` because that function rolls a month of `13` forward into the next year,
 * turning a malformed stamp into a future date that reads as fresh.
 */
const SUMMARY_STAMP =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[ T]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(?:UTC|Z)$/;

const summaryGeneratedAt = (summary: unknown): number | null => {
  if (!summary || typeof summary !== 'object') return null;
  const stamp = (summary as { generated_at_utc?: unknown }).generated_at_utc;
  if (typeof stamp !== 'string') return null;
  const parts = SUMMARY_STAMP.exec(stamp.trim());
  if (!parts) return null;
  return Date.UTC(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    Number(parts[4]),
    Number(parts[5]),
    parts[6] ? Number(parts[6]) : 0
  );
};

/** True only for a report that stamps itself and is inside the freshness window. */
const isSummaryFresh = (summary: unknown, now: number): boolean => {
  const generatedAt = summaryGeneratedAt(summary);
  return generatedAt !== null && now - generatedAt < SUMMARY_MAX_AGE_MS;
};

const readRepositoryClonesTotal = (summary: unknown): number | null => {
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

const fetchRepositoryClones = async (now: number): Promise<string | null> => {
  try {
    const res = await githubFetch(REPO_STATS_SUMMARY);
    if (!res.ok) return null;
    const summary = await res.json();
    // A stale report is dropped rather than published: the surfaces that render
    // this advertise a live number, and a wrong live number is worse than none.
    if (!isSummaryFresh(summary, now)) return null;
    const total = readRepositoryClonesTotal(summary);
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
    const list = (await res.json()) as Array<{ type?: string }>;
    if (!Array.isArray(list)) return null;
    // Bots are not people. dependabot and the Aikido autofix account both appear
    // on the contributor graph and would otherwise inflate the headline figure.
    return list.filter((c) => c.type !== 'Bot').length.toLocaleString('en-US');
  } catch {
    return null;
  }
};

export async function GET(request: Request): Promise<NextResponse> {
  // No parameters are supported, so anything present is a cache-busting variant.
  const rejected = rejectUnexpectedParams(request, {});
  if (rejected) return rejected;

  // One instant for the whole response, so the freshness verdict cannot straddle
  // the threshold mid-request.
  const now = Date.now();
  const [starCounts, repositoryClones, contributors] = await Promise.all([
    fetchStars(),
    fetchRepositoryClones(now),
    fetchContributors(),
  ]);

  const stats: GithubStatsResponse = { ...starCounts, repositoryClones, contributors };

  // Cache only when something resolved, so a GitHub outage is retried on the next
  // request rather than pinned as nulls for the whole TTL.
  const hasAnyValue = Object.values(stats).some((value) => value !== null);

  return NextResponse.json(hasAnyValue ? stats : EMPTY, {
    headers: hasAnyValue ? CACHED_HEADERS : UNCACHED_HEADERS,
  });
}
