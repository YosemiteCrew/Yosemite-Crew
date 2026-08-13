import { NextResponse } from 'next/server';

/**
 * Public release metadata for the marketing release pill.
 *
 * Same reasoning as the sibling github-stats and discord-members routes: these
 * were two api.github.com calls made from the browser on statically prerendered
 * pages. On a live trace the `releases/latest` call alone took 1.2s, and the
 * unauthenticated GitHub quota is counted per client IP, so a clinic behind one
 * NAT burns it collectively.
 *
 * `?list=1` returns the recent releases the platform pill filters by tag;
 * without it, just the latest release.
 */

const GITHUB_API_REPO = 'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew';
const GITHUB_USER_AGENT = 'YosemiteCrew-Web (https://www.yosemitecrew.com, 1.0)';
const CACHE_TTL_SECONDS = 300;
const RELEASE_PAGE_SIZE = 30;

export interface GithubRelease {
  tag_name?: string;
  html_url?: string;
  name?: string;
  published_at?: string;
}

const githubFetch = (url: string) =>
  fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': GITHUB_USER_AGENT },
    // Outcome-keyed caching only, via the response header below.
    cache: 'no-store',
  });

// The pill needs only these fields; returning the raw GitHub payload would ship a
// large object to every visitor and couple the client to GitHub's response shape.
const pickReleaseFields = (release: GithubRelease): GithubRelease => ({
  tag_name: release.tag_name,
  html_url: release.html_url,
  name: release.name,
  published_at: release.published_at,
});

export async function GET(request: Request): Promise<NextResponse> {
  const wantsList = new URL(request.url).searchParams.get('list') === '1';
  const target = wantsList
    ? `${GITHUB_API_REPO}/releases?per_page=${RELEASE_PAGE_SIZE}`
    : `${GITHUB_API_REPO}/releases/latest`;

  const cached = {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
  };

  try {
    const res = await githubFetch(target);
    if (!res.ok) {
      return NextResponse.json(wantsList ? [] : null, { headers: { 'Cache-Control': 'no-store' } });
    }
    const json = (await res.json()) as GithubRelease | GithubRelease[];

    if (wantsList) {
      const list = Array.isArray(json) ? json.map((entry) => pickReleaseFields(entry)) : [];
      return NextResponse.json(list, {
        headers: list.length > 0 ? cached : { 'Cache-Control': 'no-store' },
      });
    }

    const release = json as GithubRelease;
    if (!release?.tag_name) {
      return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(pickReleaseFields(release), { headers: cached });
  } catch {
    return NextResponse.json(wantsList ? [] : null, { headers: { 'Cache-Control': 'no-store' } });
  }
}
