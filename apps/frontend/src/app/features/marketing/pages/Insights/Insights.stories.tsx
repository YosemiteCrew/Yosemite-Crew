import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

/* Only `(routes)/(public)/layout.tsx` loads this sheet in the app, and three things
   asserted below come from nowhere else: the `[data-reveal]` states every card
   animates through, the `[data-grid-1-m]` / `[data-grid-2-m]` / `[data-stack-m]`
   helpers the whole responsive layout hangs on, and the `[data-hero-float]` rule
   that hides the console badge under 1080px. The `ycBeat` keyframes the last
   heartbeat bar rides are in here too. */
import '@/app/features/marketing/site/marketing.css';
import { GITHUB_API_REPO, GITHUB_REPO_URL } from '@/app/features/marketing/site';

import { Insights } from './Insights';
import { STATS_CACHE_KEY, STATS_TS_KEY } from '@/app/features/marketing/site/useGithubStats';

/* ------------------------------------------------------------------ endpoints */

/**
 * Every request this page makes, and the eight it must make exactly once.
 *
 * `useRepoInsights` talks to api.github.com directly and keeps NO cache at all -
 * that is the whole point of the page - so there is nothing to seed and every
 * story has to answer the network. `useGithubStats` and `useLatestRelease` go
 * through same-origin route handlers that do not exist in Storybook, so leaving
 * them unstubbed is a 404 and a permanently placeholdered card.
 */
type Endpoint =
  'repo' | 'languages' | 'commits' | 'contributors' | 'heartbeat' | 'stats' | 'discord' | 'release';

const ENDPOINTS: Endpoint[] = [
  'repo',
  'languages',
  'commits',
  'contributors',
  'heartbeat',
  'stats',
  'discord',
  'release',
];

const endpointOf = (url: string): Endpoint | null => {
  if (url.includes('/api/community/github-stats')) return 'stats';
  if (url.includes('/api/community/discord-members')) return 'discord';
  if (url.includes('/api/community/github-releases')) return 'release';
  if (!url.includes(GITHUB_API_REPO)) return null;
  // Ordered longest-path-first: every one of these also contains the bare repo URL.
  if (url.includes('/stats/commit_activity')) return 'heartbeat';
  if (url.includes('/languages')) return 'languages';
  if (url.includes('/commits')) return 'commits';
  if (url.includes('/contributors')) return 'contributors';
  return 'repo';
};

/* ------------------------------------------------------------------- fixtures */

/** Timestamps are built relative to now so `timeAgo` lands on a fixed string. */
const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

/* `subscribers_count` is over a thousand on purpose: `compact()` switches to the
   '1.2k' form at exactly 1000 and the other three counts sit below it, so one
   payload covers both halves of the formatter. */
const repoPayload = () => ({
  forks_count: 128,
  open_issues_count: 46,
  subscribers_count: 1200,
  pushed_at: minutesAgo(5 * 60),
  license: { spdx_id: 'AGPL-3.0', name: 'GNU Affero General Public License v3.0' },
});

const FACT_VALUES = ['128', '46', '1.2k', 'AGPL-3.0', '5h ago'];
const FACT_LABELS = ['Forks', 'Open issues & PRs', 'Watching', 'License', 'Last push'];

/* Seven languages for six slots, so the 'Other' remainder row is real, and the
   bytes total exactly 1,000,000 so every percentage below is exact rather than
   whatever rounding happened to produce. 'Makefile' is deliberately NOT in the
   hook's colour table: it is the fifth entry, so it takes LANG_FALLBACK[4 % 3]. */
const languagesPayload = () => ({
  TypeScript: 800_000,
  CSS: 120_000,
  JavaScript: 40_000,
  Shell: 20_000,
  Makefile: 12_000,
  HTML: 5_000,
  Python: 3_000,
});

const LANGUAGE_LEGEND = [
  'TypeScript 80.0%',
  'CSS 12.0%',
  'JavaScript 4.0%',
  'Shell 2.0%',
  'Makefile 1.2%',
  'HTML 0.5%',
  'Other 0.3%',
];

/** `#a9a39e`, the second fallback swatch, for the one language with no entry. */
const FALLBACK_LANGUAGE_COLOUR = 'rgb(169, 163, 158)';

interface CommitFixture {
  sha: string;
  minutes: number;
  /** What `timeAgo` renders for `minutes`, kept beside it so the two cannot drift. */
  when: string;
  message: string;
  /** The git author name - all a commit carries when its email is unlinked. */
  name: string;
  /** Absent when no GitHub account is attached to the commit email. */
  login?: string;
  avatar?: string;
}

/* Six commits for five rows. GitHub is asked for `per_page=6` and the parser slices
   to 5, so the sixth existing is what proves the slice is still there. */
const COMMITS: CommitFixture[] = [
  {
    sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    minutes: 25,
    when: '25m ago',
    message: 'fix(frontend): keep the heartbeat from blocking the other insight cards',
    name: 'Ankit Upadhyay',
    login: 'aupyay',
    avatar: '/images/marketing/hero-av-1.png',
  },
  {
    // Two lines. Only the subject may reach the row; the body must be dropped.
    sha: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890',
    minutes: 3 * 60,
    when: '3h ago',
    message: 'feat(backend): publish clone traffic totals\n\nRefs #2481',
    name: 'Harshvardhan Parmar',
    login: 'harshvardhan-parmar',
    avatar: '/images/marketing/hero-av-2.png',
  },
  {
    // No `author` block: an unlinked commit email. Falls back to the git name and
    // an initial, because there is no avatar to show.
    sha: 'c3d4e5f60718293a4b5c6d7e8f90123456789012',
    minutes: 2 * 24 * 60,
    when: '2d ago',
    message: 'chore(repo): pin the release workflow to Node 22',
    name: 'Nikita Sharma',
  },
  {
    sha: 'd4e5f60718293a4b5c6d7e8f9012345678901234',
    minutes: 9 * 24 * 60,
    when: '9d ago',
    message: 'docs(frontend): write down the insights endpoints',
    name: 'Ankit Upadhyay',
    login: 'aupyay',
    avatar: '/images/marketing/hero-av-3.png',
  },
  {
    sha: 'e5f60718293a4b5c6d7e8f901234567890123456',
    minutes: 20 * 24 * 60,
    when: '20d ago',
    message: 'refactor(lib): fold the compact formatter into one helper',
    name: 'Harshvardhan Parmar',
    login: 'harshvardhan-parmar',
    avatar: '/images/marketing/hero-av-1.png',
  },
  {
    sha: 'f60718293a4b5c6d7e8f9012345678901234567a',
    minutes: 40 * 24 * 60,
    when: '1mo ago',
    message: 'style(frontend): tidy the insights card padding',
    name: 'Ankit Upadhyay',
    login: 'aupyay',
    avatar: '/images/marketing/hero-av-2.png',
  },
];

const SIXTH_COMMIT_MESSAGE = COMMITS[5].message;

const commitsPayload = () =>
  COMMITS.map((commit) => ({
    sha: commit.sha,
    html_url: `${GITHUB_REPO_URL}/commit/${commit.sha}`,
    commit: {
      message: commit.message,
      author: { name: commit.name, date: minutesAgo(commit.minutes) },
    },
    ...(commit.login ? { author: { login: commit.login, avatar_url: commit.avatar } } : {}),
  }));

/* Ten humans for nine avatar slots. The tenth is what proves `slice(0, 9)`; the bot
   and the anonymous row (no login at all) are what prove the filter runs first,
   since dropping it would push two of the humans out of the visible nine. */
const CONTRIBUTOR_LOGINS = [
  'aupyay',
  'harshvardhan-parmar',
  'nikita-lab',
  'ravi-p',
  'sanya-k',
  'tom-l',
  'mira-b',
  'deepak-s',
  'jules-w',
  'omar-h',
];

const SHOWN_CONTRIBUTORS = CONTRIBUTOR_LOGINS.slice(0, 9);
const HIDDEN_CONTRIBUTOR = CONTRIBUTOR_LOGINS[9];
const BOT_LOGIN = 'dependabot[bot]';

const human = (login: string, index: number) => ({
  login,
  avatar_url: `/images/marketing/hero-av-${(index % 3) + 1}.png`,
  html_url: `https://github.com/${login}`,
  type: 'User',
});

const contributorsPayload = () => {
  const people = CONTRIBUTOR_LOGINS.map(human);
  return [
    people[0],
    people[1],
    {
      login: BOT_LOGIN,
      avatar_url: '',
      html_url: 'https://github.com/apps/dependabot',
      type: 'Bot',
    },
    people[2],
    people[3],
    { avatar_url: '', html_url: '', type: 'Anonymous' },
    ...people.slice(4),
  ];
};

/* 52 weeks. Week 0 is silent, which is the only case where the `Math.max(5, ...)`
   floor decides whether the bar is visible at all; week 30 is the sole maximum, so
   exactly one bar is full height. */
const HEARTBEAT_TOTALS = Array.from({ length: 52 }, (_, week) => {
  if (week === 0) return 0;
  if (week === 30) return 80;
  return 8 + (week % 12);
});

const heartbeatPayload = () => HEARTBEAT_TOTALS.map((total) => ({ total }));

/* `stars` (compact) and `starsFull` arrive in the same payload and the page uses
   each in a different place, so they are deliberately different strings.
   `contributors` differs from the fork count for the same reason: the console
   prints the two side by side out of two different hooks. */
const statsPayload = () => ({
  stars: '2.4k',
  starsFull: '2,431',
  repositoryClones: '67,134',
  contributors: '38',
});

const discordPayload = () => ({ discordMembers: '3,182' });

/* Midday local, not a `...T00:00:00Z` literal: the card formats with
   `toLocaleDateString`, so a UTC literal reads as the previous day anywhere west
   of Greenwich and the assertion below would pass or fail by timezone. */
const RELEASE_PUBLISHED = new Date(2026, 6, 2, 12, 0);
const RELEASE_DATE = RELEASE_PUBLISHED.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
/** The raw tag, and what must be left of it after the area prefix is stripped. */
const RELEASE_RAW_TAG = 'pims-v2.4.0-beta';
const RELEASE_TAG = 'v2.4.0-beta';
const RELEASE_URL = `${GITHUB_REPO_URL}/releases/tag/${RELEASE_RAW_TAG}`;

const releasePayload = () => ({
  tag_name: RELEASE_RAW_TAG,
  published_at: RELEASE_PUBLISHED.toISOString(),
  html_url: RELEASE_URL,
});

const bodyFor = (endpoint: Endpoint): unknown => {
  switch (endpoint) {
    case 'repo':
      return repoPayload();
    case 'languages':
      return languagesPayload();
    case 'commits':
      return commitsPayload();
    case 'contributors':
      return contributorsPayload();
    case 'heartbeat':
      return heartbeatPayload();
    case 'stats':
      return statsPayload();
    case 'discord':
      return discordPayload();
    default:
      return releasePayload();
  }
};

/* ------------------------------------------------------- session cache (stale) */

/** Keys owned by `useGithubStats` / `useLatestRelease`, module-private there. */
const RELEASE_CACHE_KEY = 'yc_rel_platform_v1';
const SESSION_KEYS = [STATS_CACHE_KEY, STATS_TS_KEY, RELEASE_CACHE_KEY];

/* Values a repeat visitor would already have in session storage, chosen so that
   every one of them is a string that appears nowhere else on the page. */
const STALE_STATS = {
  stars: '9.9k',
  starsFull: '9,999',
  repositoryClones: '111,111',
  contributors: '404',
  discord: '505',
};
const STALE_RELEASE = { tag: 'v0.0.9-stale', date: 'Jan 1, 2020', url: 'https://example.invalid' };
const STALE_STRINGS = [...Object.values(STALE_STATS), STALE_RELEASE.tag];

/* ---------------------------------------------------------------- environment */

/** Endpoints that have been asked for, in call order. */
let requested: Endpoint[] = [];
/** Answers parked until a play function calls `releaseHeld`. */
let held: Array<() => void> = [];

const releaseHeld = () => {
  const queued = held;
  held = [];
  for (const settle of queued) settle();
};

interface FixtureOptions {
  /** Answered only once the play function releases them. */
  hold?: Endpoint[] | 'all';
  /** Answered with a 503 instead of a fixture. */
  fail?: 'all';
  /** Write a repeat visitor's session cache before mounting. */
  stale?: boolean;
}

/**
 * Answers all eight endpoints, and restores both `fetch` and the session cache on
 * unmount.
 *
 * The cache has to be put back rather than merely cleared: a failing stats pass
 * WRITES an all-null snapshot with a fresh timestamp, so a story that left it
 * behind would hand the next one a poisoned cache that looks perfectly warm.
 */
const withInsightsData =
  (options: FixtureOptions = {}) =>
  () => {
    const isHeld = (endpoint: Endpoint) =>
      options.hold === 'all' || (Array.isArray(options.hold) && options.hold.includes(endpoint));

    requested = [];
    held = [];

    const previous = SESSION_KEYS.map(
      (key) => [key, globalThis.sessionStorage.getItem(key)] as const
    );
    for (const [key] of previous) globalThis.sessionStorage.removeItem(key);
    if (options.stale) {
      globalThis.sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(STALE_STATS));
      globalThis.sessionStorage.setItem(STATS_TS_KEY, String(Date.now()));
      globalThis.sessionStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify(STALE_RELEASE));
    }

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const endpoint = endpointOf(String(input));
      if (!endpoint) return originalFetch.call(globalThis, input, init);
      requested.push(endpoint);
      const answer = () =>
        options.fail === 'all'
          ? new Response('upstream unavailable', { status: 503 })
          : new Response(JSON.stringify(bodyFor(endpoint)), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
      if (!isHeld(endpoint)) return Promise.resolve(answer());
      return new Promise<Response>((resolve) => {
        held.push(() => resolve(answer()));
      });
    }) as typeof globalThis.fetch;

    return () => {
      globalThis.fetch = originalFetch;
      /* Safety net. `useRepoInsights` and `useGithubStats` each dedupe through a
       module-level in-flight promise that only clears when the request settles,
       and the Storybook iframe is not reloaded between stories. A play function
       that threw before releasing would leave that promise pending forever, and
       every card in the NEXT story would sit on a placeholder with no failing
       request anywhere to explain it. */
      releaseHeld();
      for (const [key, value] of previous) {
        if (value === null) globalThis.sessionStorage.removeItem(key);
        else globalThis.sessionStorage.setItem(key, value);
      }
    };
  };

/* ------------------------------------------------------------------ accessors */

const flatten = (node: Element | null | undefined): string =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** U+2014, what every unresolved number falls back to. Not a hyphen, not a zero. */
const PLACEHOLDER = '—';

/* The hero console is four stacked blocks with no test ids, so it is walked from
   the one piece of copy that is unique to it. */
const commitActivityRow = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText('Commit activity').parentElement as HTMLElement;
const heartbeatRow = (canvasElement: HTMLElement) =>
  commitActivityRow(canvasElement).nextElementSibling as HTMLElement;
const heartbeatBars = (canvasElement: HTMLElement) =>
  Array.from(heartbeatRow(canvasElement).children) as HTMLElement[];
const consoleStats = (canvasElement: HTMLElement) =>
  heartbeatRow(canvasElement).nextElementSibling as HTMLElement;
const consoleLastCommit = (canvasElement: HTMLElement) =>
  consoleStats(canvasElement).nextElementSibling as HTMLElement;

/* Scoped: 'Stars', 'Forks' and 'Contributors' all appear a second time further
   down the page, out of a different hook. */
const consoleStat = (canvasElement: HTMLElement, label: string) =>
  flatten(within(consoleStats(canvasElement)).getByText(label).parentElement?.firstElementChild);

const bandTiles = (canvasElement: HTMLElement) =>
  Array.from(
    (canvasElement.querySelector('[data-grid-2-m]') as HTMLElement).children
  ) as HTMLElement[];

/* `CountUp` renders its value twice: an invisible sizer holding the final string
   (it reserves the settled width so the number does not reflow its neighbours
   while counting), and an absolutely positioned overlay holding whatever the
   animation is showing this frame. The sizer is the one that always reads the
   string the page handed down, with no rAF loop to wait out. */
const reservedValue = (tile: HTMLElement) => flatten(tile.firstElementChild?.firstElementChild);
const bandLabel = (tile: HTMLElement) => flatten(tile.children[1]);

const cardByHeading = (canvasElement: HTMLElement, heading: string) =>
  within(canvasElement).getByText(heading).closest('[data-reveal], div') as HTMLElement;

const languagesCard = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText('What it is written in').closest('[data-reveal]') as HTMLElement;
const languageSegments = (canvasElement: HTMLElement) =>
  Array.from(languagesCard(canvasElement).children[1].children) as HTMLElement[];
const languageLegend = (canvasElement: HTMLElement) =>
  Array.from(languagesCard(canvasElement).children[2].children) as HTMLElement[];

const commitsCard = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText('Latest commits').closest('[data-reveal]') as HTMLElement;
const commitRows = (canvasElement: HTMLElement) =>
  Array.from(commitsCard(canvasElement).lastElementChild?.children ?? []) as HTMLElement[];

/* The subject line and the `login · when` line are two block spans inside one
   wrapper, and `textContent` runs them together with no separator, so they are
   read apart rather than as one string. */
const commitSubject = (row: HTMLElement) => flatten(row.children[1]?.children[0]);
const commitMeta = (row: HTMLElement) => flatten(row.children[1]?.children[1]);

const factRows = (canvasElement: HTMLElement) =>
  Array.from(
    cardByHeading(canvasElement, 'Repository facts').lastElementChild?.children ?? []
  ) as HTMLElement[];

const peopleCard = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText('The people').parentElement as HTMLElement;

const releaseCard = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText('Latest release').closest('a') as HTMLAnchorElement;

const trackCount = (element: HTMLElement) =>
  getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;

/** Every placeholder on the page, one per independent stream. */
const PLACEHOLDER_COPY = [
  'Reading the repository...',
  'Reading languages...',
  'Reading recent commits...',
  'Reading repository...',
  'Loading contributors...',
];

const expectEveryCardResolved = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await waitFor(async () => {
    await expect(commitRows(canvasElement)).toHaveLength(5);
    await expect(factRows(canvasElement)).toHaveLength(5);
    await expect(within(peopleCard(canvasElement)).getAllByRole('link')).toHaveLength(9);
    await expect(languageLegend(canvasElement)).toHaveLength(7);
    await expect(heartbeatBars(canvasElement)).toHaveLength(52);
    await expect(reservedValue(bandTiles(canvasElement)[0])).toBe('67,134');
    await expect(canvas.getByText(RELEASE_TAG)).toBeInTheDocument();
  });
};

/* ---------------------------------------------------------------------- meta */

const meta = {
  title: 'Marketing/Insights',
  component: Insights,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview decorator stamps on every
    // other story: PIMS scopes its darker faint inks to that marker, and this page
    // is drawn against the lighter marketing values on two always-dark bands.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The `/insights` "building in public" page: hero with a live GitHub console, the ' +
          'four-stat band, the manifesto, the repository pulse (languages, latest release, ' +
          'commits, facts, contributors), three principles and the closing CTA.\n\n' +
          'It is the most state-heavy marketing page in the app, and almost none of that state ' +
          'is visible in a screenshot of the settled page.\n\n' +
          '**Eight requests, four independent streams, five different placeholders.** ' +
          '`useRepoInsights` fans out to five api.github.com endpoints and keeps NO cache by ' +
          'design, `useGithubStats({ live: true })` and `useLatestRelease({ live: true })` go to ' +
          'same-origin route handlers that 404 in Storybook. Every story here answers all eight ' +
          'and one holds them open, because the loading branch is not a flag anywhere - it is ' +
          'just each card rendering its own string while its own stream is null.\n\n' +
          '**The commit-activity heartbeat is a separate stream on purpose.** GitHub serves it ' +
          'with a 202 and a warm-up retry loop that can take seconds, so folding it back into ' +
          'the core `Promise.all` would hold facts, languages, commits and contributors on ' +
          'their placeholders until that one slow stat landed. "Heartbeat still pending" is ' +
          'the story that fails if anyone does.\n\n' +
          '**`live: true` is the page\'s whole promise.** The copy says "nothing is cached, ' +
          'pulled on every visit", so both live hooks skip the session cache seed and paint a ' +
          'placeholder until the fresh value arrives. Drop the flag and a repeat visitor gets ' +
          "yesterday's numbers under that sentence, with nothing on screen to give it away - " +
          'which is what "Live mode refuses the session cache" pins down.\n\n' +
          'Two traps for anyone extending these. The stat band renders through `CountUp`, so ' +
          'every value is in the DOM twice (an invisible width sizer plus the animating ' +
          'overlay) and the assertions read the sizer. And a story that holds requests open ' +
          'must release them before it ends: both hooks dedupe through a module-level in-flight ' +
          'promise that never clears if the request never settles, and the iframe is not ' +
          'reloaded between stories.',
      },
    },
  },
  tags: ['autodocs'],
  /* Pinned rather than inherited: the four-across stat band and the two-column
     pulse grids asserted below are decided by a media query, and leaving the width
     to the project default would make those assertions hostage to `preview.ts`. */
  globals: { viewport: { value: 'laptop', isRotated: false } },
  beforeEach: withInsightsData(),
} satisfies Meta<typeof Insights>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------- stories */

export const Default: Story = {
  name: 'Every stream resolved',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectEveryCardResolved(canvasElement);

    /* One request per endpoint and no more. `useRepoInsights` and `useGithubStats`
       are each mounted TWICE here (the hero console, then the sections below), and
       only the shared in-flight promise inside each hook stops that from doubling
       every call against the unauthenticated GitHub quota. Lose the dedup and the
       page renders identically. */
    await expect(requested).toHaveLength(ENDPOINTS.length);
    await expect([...requested].sort()).toEqual([...ENDPOINTS].sort());

    // Level 2 skips the sr-only h1 the preview decorator injects above the story.
    await expect(canvas.getAllByRole('heading', { level: 2 }).map(flatten)).toEqual([
      'The repository, in real time.',
      'Transparency is a habit, not a page.',
      'Read the numbers. Then read the code.',
    ]);
    await expect(flatten(canvasElement.querySelector('section h1'))).toBe(
      'We build in the open. Numbers included.'
    );

    /* The band takes `starsFull` while the console two sections above takes the
       compact `stars`, out of the SAME payload. Swapping them looks entirely
       plausible on screen, which is why both are pinned. `Forks` is the other
       neighbour worth pinning: it is the one console figure that comes from the
       repo-insights stream rather than the stats stream. */
    await expect(bandTiles(canvasElement).map(bandLabel)).toEqual([
      'Repository clones',
      'Contributors',
      'Discord members',
      'GitHub stars',
    ]);
    await expect(bandTiles(canvasElement).map(reservedValue)).toEqual([
      '67,134',
      '38',
      '3,182',
      '2,431',
    ]);
    await expect(consoleStat(canvasElement, 'Stars')).toBe('2.4k');
    await expect(consoleStat(canvasElement, 'Forks')).toBe('128');
    await expect(consoleStat(canvasElement, 'Contributors')).toBe('38');

    /* The heartbeat. A quiet week has to stay visible - `Math.max(5, ...)` is the
       only thing standing between a zero and a bar of no height at all - and
       exactly one week may be full height, or the scaling is not relative to the
       maximum. `ycBeat` belongs to the newest week only; put it on all 52 and the
       console pulses like a fairground. */
    const bars = heartbeatBars(canvasElement);
    const barHeight = (bar: HTMLElement) => bar.getBoundingClientRect().height;
    await expect(Math.round(barHeight(bars[30]))).toBe(66);
    await expect(barHeight(bars[0])).toBeGreaterThan(1);
    await expect(barHeight(bars[0])).toBeLessThan(barHeight(bars[51]));
    await expect(getComputedStyle(bars[51]).animationName).toBe('ycBeat');
    await expect(getComputedStyle(bars[0]).animationName).toBe('none');

    /* Seven languages for six slots, so the remainder row has to be computed
       rather than dropped, and the percentages still have to total 100 - a bar
       that adds up to 97 leaves a visible gap of unexplained background. */
    await expect(languageLegend(canvasElement).map(flatten)).toEqual(LANGUAGE_LEGEND);
    const segments = languageSegments(canvasElement);
    const widths = segments.map((segment) => Number.parseFloat(segment.style.width));
    await expect(Math.round(widths.reduce((sum, width) => sum + width, 0))).toBe(100);
    await expect(segments.map((segment) => segment.getAttribute('title'))).toEqual(
      LANGUAGE_LEGEND.map((entry) => entry.split(' ')[0])
    );
    /* Six languages, six distinct colours, and the one with no entry in the table
       falls through to the rotating fallback rather than to `undefined` - which
       renders as a transparent slice indistinguishable from the track behind it. */
    const colours = segments
      .slice(0, 6)
      .map((segment) => getComputedStyle(segment).backgroundColor);
    await expect(new Set(colours).size).toBe(6);
    await expect(colours[4]).toBe(FALLBACK_LANGUAGE_COLOUR);

    /* Five rows out of six commits, and the two rows that are not a plain
       login-plus-avatar. A commit whose email is not linked to a GitHub account
       has no `author` block at all, so the row falls back to the git name and
       draws an initial; and a commit body must never reach the row, which is a
       single-line ellipsised span that would silently swallow it. */
    const rows = commitRows(canvasElement);
    await expect(canvas.queryByText(SIXTH_COMMIT_MESSAGE)).toBeNull();
    await expect(commitSubject(rows[0])).toBe(COMMITS[0].message);
    await expect(commitMeta(rows[0])).toBe(`${COMMITS[0].login} · ${COMMITS[0].when}`);
    await expect(rows[0].firstElementChild?.tagName).toBe('IMG');
    await expect(commitSubject(rows[1])).toBe('feat(backend): publish clone traffic totals');
    await expect(commitSubject(rows[2])).toBe(COMMITS[2].message);
    await expect(commitMeta(rows[2])).toBe(`${COMMITS[2].name} · ${COMMITS[2].when}`);
    await expect(rows[2].firstElementChild?.tagName).toBe('SPAN');
    await expect(flatten(rows[2].firstElementChild)).toBe('N');
    await expect(rows.map((row) => flatten(row.lastElementChild))).toEqual(
      COMMITS.slice(0, 5).map((commit) => commit.sha.slice(0, 7))
    );
    await expect(rows[0]).toHaveAttribute('href', `${GITHUB_REPO_URL}/commit/${COMMITS[0].sha}`);

    // The facts panel, in the order the page hard-codes it.
    await expect(factRows(canvasElement).map((row) => flatten(row.firstElementChild))).toEqual(
      FACT_LABELS
    );
    await expect(factRows(canvasElement).map((row) => flatten(row.lastElementChild))).toEqual(
      FACT_VALUES
    );

    /* Nine faces out of ten humans, and the bot dropped before the slice - filter
       after slicing and two real contributors fall off the end instead. Every
       avatar is a link, so the accessible name is the only thing distinguishing
       one 38px circle from the next. */
    const faces = within(peopleCard(canvasElement)).getAllByRole('link');
    await expect(faces.map((face) => face.getAttribute('title'))).toEqual(SHOWN_CONTRIBUTORS);
    await expect(canvas.queryByTitle(BOT_LOGIN)).toBeNull();
    await expect(canvas.queryByTitle(HIDDEN_CONTRIBUTOR)).toBeNull();

    /* The release card shows the git TAG with its area prefix stripped, never the
       raw tag and never the release title. */
    const release = releaseCard(canvasElement);
    await expect(release).toHaveAttribute('href', RELEASE_URL);
    await expect(canvas.queryByText(RELEASE_RAW_TAG)).toBeNull();
    await expect(
      within(release).getByText(`Published ${RELEASE_DATE} on GitHub Releases.`)
    ).toBeInTheDocument();

    /* Both CTA pairs are separate copies of the same two destinations - nothing
       couples them, so one can drift while the other stays right and the page
       still reads perfectly. Every outbound link opens a new tab, and a
       half-written `rel` looks identical on screen and in review. */
    const signup = canvas.getAllByRole('link', { name: /Create free account/ });
    await expect(signup).toHaveLength(2);
    for (const link of signup) await expect(link).toHaveAttribute('href', '/signup');
    for (const name of [/View the repo/, /Star on GitHub/]) {
      const outbound = canvas.getByRole('link', { name });
      await expect(outbound).toHaveAttribute('href', GITHUB_REPO_URL);
      await expect(outbound).toHaveAttribute('target', '_blank');
      await expect(outbound.getAttribute('rel')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['noopener', 'noreferrer'])
      );
    }
    await expect(canvas.getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      `${GITHUB_REPO_URL}/commits`
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'All eight endpoints answer at once. Worth reading for the pairs that are easy to ' +
          'cross: the console prints the compact star count and the band the full one, and the ' +
          'console prints Forks (repo insights) next to Contributors (community stats), which ' +
          'are two different hooks one row apart.',
      },
    },
  },
};

export const EveryCardWaiting: Story = {
  name: 'Every card still waiting',
  beforeEach: withInsightsData({ hold: 'all' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Nothing can have resolved: every answer is parked until this function
       releases it, so these reads are not racing a network reply. */
    for (const copy of PLACEHOLDER_COPY) {
      await expect(canvas.getByText(copy)).toBeInTheDocument();
    }
    await expect(flatten(consoleLastCommit(canvasElement))).toBe('Fetching the latest commit...');
    await expect(canvas.getByText('Loading...')).toBeInTheDocument();
    await expect(canvas.getByText('Tagged and published on GitHub Releases.')).toBeInTheDocument();
    await expect(heartbeatBars(canvasElement)).toHaveLength(1);

    /* Five separate strings, one per stream, because there is no single loading
       flag anywhere - each card renders its own copy while its own slice is null.
       Every number falls back to an em dash rather than a zero: a zero here is a
       claim, and a wrong one. */
    await expect(bandTiles(canvasElement).map(reservedValue)).toEqual(Array(4).fill(PLACEHOLDER));
    for (const label of ['Stars', 'Forks', 'Contributors']) {
      await expect(consoleStat(canvasElement, label)).toBe(PLACEHOLDER);
    }

    /* Let them all answer. Asserting the transition is what proves each
       placeholder is wired to the stream it is standing in for - a card left
       reading someone else's null would look correct in both static states. */
    releaseHeld();
    await expectEveryCardResolved(canvasElement);
    for (const copy of PLACEHOLDER_COPY) {
      await expect(canvas.queryByText(copy)).toBeNull();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'First paint, and what a cold or slow GitHub looks like: five different placeholder ' +
          'strings and an em dash in every numeric slot. The play function then lets the ' +
          'parked answers through and watches each card swap, which is the only way to prove a ' +
          'placeholder belongs to the stream it is covering for.',
      },
    },
  },
};

export const HeartbeatPending: Story = {
  name: 'Heartbeat still pending',
  beforeEach: withInsightsData({ hold: ['heartbeat'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The point of the story: the four core cards land while commit-activity is
       still open. GitHub answers `/stats/commit_activity` with a 202 and a warm-up
       loop that can run for seconds, so if it is ever folded back into the core
       `Promise.all` this wait times out and every card below sits on a placeholder
       waiting for the slowest stat on the page. */
    await waitFor(async () => {
      await expect(commitRows(canvasElement)).toHaveLength(5);
      await expect(factRows(canvasElement)).toHaveLength(5);
      await expect(languageLegend(canvasElement)).toHaveLength(7);
      await expect(within(peopleCard(canvasElement)).getAllByRole('link')).toHaveLength(9);
    });
    await expect(canvas.getByText('Reading the repository...')).toBeInTheDocument();
    await expect(heartbeatBars(canvasElement)).toHaveLength(1);
    // The rest of the console is resolved around the empty sparkline.
    await expect(consoleStat(canvasElement, 'Forks')).toBe('128');
    await expect(flatten(consoleLastCommit(canvasElement))).toBe(
      `${COMMITS[0].message} · ${COMMITS[0].when}`
    );

    releaseHeld();
    await waitFor(async () => {
      await expect(heartbeatBars(canvasElement)).toHaveLength(52);
    });
    await expect(canvas.queryByText('Reading the repository...')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The partially resolved page, which is what a real cold visit looks like for a second ' +
          'or two: facts, languages, commits and contributors are all in, and only the ' +
          'sparkline is still reading. Merge the heartbeat back into the core request and this ' +
          'story is the one that fails.',
      },
    },
  },
};

export const GithubUnreachable: Story = {
  name: 'GitHub unreachable',
  beforeEach: withInsightsData({ fail: 'all' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Gated on the requests rather than on the DOM. Failure degrades to exactly
       the same markup as first paint, so without waiting for all eight to have
       been asked and refused, this story would pass while proving nothing at all. */
    await waitFor(async () => {
      await expect(requested).toHaveLength(ENDPOINTS.length);
    });
    await expect([...requested].sort()).toEqual([...ENDPOINTS].sort());

    /* Every card degrades to its placeholder. No error banner, no empty gap and -
       the part worth guarding - no zeros: `compact()` returns an em dash for a
       missing count, and a 0 published under "the numbers, right now" would be a
       false claim rather than a missing one. */
    for (const copy of PLACEHOLDER_COPY) {
      await expect(canvas.getByText(copy)).toBeInTheDocument();
    }
    await expect(bandTiles(canvasElement).map(reservedValue)).toEqual(Array(4).fill(PLACEHOLDER));
    for (const label of ['Stars', 'Forks', 'Contributors']) {
      await expect(consoleStat(canvasElement, label)).toBe(PLACEHOLDER);
    }

    /* The release card is a link first and a version second, so with no release to
       point at it still has to reach the releases index rather than going dead. */
    await expect(releaseCard(canvasElement)).toHaveAttribute(
      'href',
      `${GITHUB_REPO_URL}/releases/latest`
    );
    await expect(canvas.getByText('Loading...')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every endpoint answers 503 - a rate-limited GitHub, an outage, or a reader behind a ' +
          'filter. The page degrades to the same placeholders it paints on first load, which is ' +
          'deliberate: there is nothing a visitor can do about it and a row of error banners ' +
          'would be worse than a row of dashes.',
      },
    },
  },
};

export const LiveModeRefusesCache: Story = {
  name: 'Live mode refuses the session cache',
  beforeEach: withInsightsData({ hold: ['stats', 'discord', 'release'], stale: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A repeat visitor inside the 5 minute TTL: `yc_marketing_stats_v2` and
       `yc_rel_platform_v1` are both seeded and both fresh. `{ live: true }` is the
       only reason none of it reaches the screen. Drop the flag and this page shows
       a cached snapshot directly under copy that says nothing is cached - a lie
       with nothing on screen to give it away, which is why it is asserted here
       rather than left to review. */
    await waitFor(async () => {
      await expect(commitRows(canvasElement)).toHaveLength(5);
    });
    await expect(bandTiles(canvasElement).map(reservedValue)).toEqual(Array(4).fill(PLACEHOLDER));
    await expect(consoleStat(canvasElement, 'Stars')).toBe(PLACEHOLDER);
    await expect(canvas.getByText('Loading...')).toBeInTheDocument();
    for (const stale of STALE_STRINGS) {
      await expect(canvas.queryByText(stale)).toBeNull();
    }
    // The repo-insights stream keeps no cache at all, so it is already resolved
    // beside the placeholders - the two halves of the console are independent.
    await expect(consoleStat(canvasElement, 'Forks')).toBe('128');

    releaseHeld();
    await waitFor(async () => {
      await expect(reservedValue(bandTiles(canvasElement)[0])).toBe('67,134');
      await expect(canvas.getByText(RELEASE_TAG)).toBeInTheDocument();
    });
    // The live values replaced the placeholders; the cached ones never appeared.
    for (const stale of STALE_STRINGS) {
      await expect(canvas.queryByText(stale)).toBeNull();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'A repeat visit with a warm, in-TTL session cache holding different numbers. The ' +
          'stat band and the release card must show their placeholders until the live values ' +
          'land, never the cached ones - that is the whole difference between this page and ' +
          'every other surface that mounts the same two hooks.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (every grid collapses)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expectEveryCardResolved(canvasElement);

    /* Read off the media queries rather than hard-coded to 375. The viewport
       global pins the canvas in the Storybook UI but is inert when the story is
       rendered by loading `iframe.html` directly, which is what the verification
       harness does, at 1280. Asserting the COUPLING holds at either width and
       still fails the moment a helper attribute stops matching its rule. */
    const helpersApply = globalThis.matchMedia('(max-width: 900px)').matches;
    const stackApplies = globalThis.matchMedia('(max-width: 700px)').matches;
    const floatHidden = globalThis.matchMedia('(max-width: 1080px)').matches;

    /* Four grids share one helper and three different desktop shapes.
       `data-grid-1-m` is a bare untyped string repeated four times in the markup:
       misspell it on any one of them and that section keeps two (or three) columns
       on a 375px screen, with nothing anywhere to complain. */
    const stacking = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-grid-1-m]'));
    await expect(stacking.map(trackCount)).toEqual(helpersApply ? [1, 1, 1, 1] : [2, 2, 2, 3]);

    // The stat band is the only `data-grid-2-m` here: four across, two on a phone.
    const band = canvasElement.querySelector('[data-grid-2-m]') as HTMLElement;
    await expect(trackCount(band)).toBe(helpersApply ? 2 : 4);

    // Both CTA pairs stack, at a different breakpoint from the grids.
    const ctaRows = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-stack-m]'));
    await expect(ctaRows).toHaveLength(2);
    for (const row of ctaRows) {
      await expect(getComputedStyle(row).flexDirection).toBe(stackApplies ? 'column' : 'row');
    }

    /* The floating "No cache" badge is absolutely positioned 28px OUTSIDE the
       console's left edge, so it is the one element on the page that pushes the
       document sideways once the hero column narrows. Its own breakpoint is 1080,
       not 900, which is why it is asserted separately from the grids. */
    const floatBadge = canvasElement.querySelector('[data-hero-float]') as HTMLElement;
    await expect(getComputedStyle(floatBadge).display).toBe(floatHidden ? 'none' : 'flex');

    /* Nothing pushes the page sideways. Five `HeroGlow` layers overhang their
       sections by up to 220px and only their parents' `overflow: hidden` keeps
       them in. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'At 375 the hero, both pulse rows and the principles drop to a single column, the ' +
          'stat band goes from four across to two, both CTA pairs stack full width, and the ' +
          'floating "No cache" badge - which overhangs the console by 28px and would otherwise ' +
          'push the document sideways - is removed at 1080 rather than at 900.',
      },
    },
  },
};
