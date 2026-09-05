/**
 * The three network reads behind the overview widgets, kept in their own module so
 * the hook holds render logic only and this can be exercised without a component.
 */

const SUMMARY_URL =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';
const GITHUB_REPO_URL = 'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew';
const GITHUB_CONTRIBUTORS_URL =
  'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew/contributors?per_page=100&anon=true';

export type OverviewSources = {
  /** The repo-stats summary report the charts are built from. */
  json: any;
  /** GitHub's repository record, or `null` when that read was refused. */
  repoJson: any;
  /** GitHub's contributor list, or `[]` when that read was refused. */
  contributorsJson: any;
};

/**
 * Rejects when the summary read fails, because every chart depends on it. The two
 * GitHub reads degrade to `null`/`[]` instead: they are anonymous, so their rate
 * limit is routinely hit and the page is still worth rendering without them.
 */
export const fetchOverviewSources = async (): Promise<OverviewSources> => {
  const [summaryRes, repoRes, contributorsRes] = await Promise.all([
    fetch(`${SUMMARY_URL}?t=${Date.now()}`, { cache: 'no-store' }),
    fetch(GITHUB_REPO_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    }),
    fetch(GITHUB_CONTRIBUTORS_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    }),
  ]);

  if (!summaryRes.ok) throw new Error('Failed to load repo stats');

  return {
    json: await summaryRes.json(),
    repoJson: repoRes.ok ? await repoRes.json() : null,
    contributorsJson: contributorsRes.ok ? await contributorsRes.json() : [],
  };
};
