import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import type { AuthUser } from '@/app/stores/authStore';
import { useAuthStore } from '@/app/stores/authStore';

import OverviewPage from './OverviewPage';

/**
 * The eight days the fixtures cover. Deliberately straddling a month boundary so
 * `generateFullTrafficHistory` produces two period keys and the chart's Prev/Next
 * rail exists at all - with a single month `buildNavigationConfig` returns null and
 * the footer disappears.
 *
 * UTC literals are correct HERE, unlike most fixtures in this repo: every date in
 * `useOverviewStats` and `CommunityStats` is read through `getUTC*` or an
 * `Intl.DateTimeFormat` pinned to `timeZone: 'UTC'`, so these do not slide with the
 * runner's offset.
 */
const TRAFFIC_DAYS = [
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
  '2026-08-03',
  '2026-08-04',
];

/**
 * `extractChartData` takes the FIRST key under `datasets`, whatever it is called, so
 * the dataset names below are arbitrary - only the chart keys (`#clones_total` and
 * friends) and the per-point field names matter.
 *
 * `stars_cumulative` ends at 770 on purpose. The hook seeds `totalStars` from this
 * series and then overwrites it with `stargazers_count` off the repo API, so a story
 * whose two numbers agreed could not tell which one the page is showing.
 */
const buildSummary = (dailyClones: number[]) => ({
  charts: {
    '#clones_total': {
      datasets: {
        clones_total: TRAFFIC_DAYS.map((day, index) => ({
          time: `${day}T00:00:00Z`,
          clones_total: dailyClones[index],
        })),
      },
    },
    '#clones_unique': {
      datasets: {
        clones_unique: TRAFFIC_DAYS.map((day, index) => ({
          time: `${day}T00:00:00Z`,
          clones_unique: Math.round(dailyClones[index] / 2),
        })),
      },
    },
    '#forks': {
      datasets: {
        forks: TRAFFIC_DAYS.map((day, index) => ({
          time: `${day}T00:00:00Z`,
          forks_cumulative: 10 + index,
        })),
      },
    },
    '#stargazers': {
      datasets: {
        stargazers: TRAFFIC_DAYS.map((day, index) => ({
          time: `${day}T00:00:00Z`,
          stars_cumulative: 700 + index * 10,
        })),
      },
    },
  },
});

const buildContributors = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ login: `contributor-${index}` }));

const SUMMARY_HOST = 'raw.githubusercontent.com';
const REPO_URL = 'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew';
const CONTRIBUTORS_PATH = '/contributors';
const STATUS_HOST = 'api.openstatus.dev';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

type StatsFixture = {
  dailyClones: number[];
  /** What the repo API reports. This is the number the page actually shows. */
  stargazers: number;
  contributors: number;
};

/**
 * On mount the page fires three requests at GitHub (the stats branch's
 * `summary.json`, the repo, and the contributor list) and the footer fires a fourth
 * at openstatus. Left alone that makes every render here depend on GitHub being up
 * and on an unauthenticated rate limit that CI shares with every other job on the
 * runner - and a rejected request lands in the hook's `console.error`, which the
 * story verifier counts as a failure.
 *
 * So all four are answered from fixtures and the real `fetch` is put back on unmount.
 * Pass `'never-resolves'` to hold the page in its loading state.
 */
const withGithubStats = (fixture: StatsFixture | 'never-resolves') => () => {
  const original = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(STATUS_HOST)) {
      return Promise.resolve(jsonResponse({ status: 'operational' }));
    }

    // The summary URL carries a `?t=` cache-buster, so match on the host.
    const isStatsRequest = url.includes(SUMMARY_HOST) || url.startsWith(REPO_URL);
    if (!isStatsRequest) {
      return original.call(globalThis, input, init);
    }

    if (fixture === 'never-resolves') {
      return new Promise<Response>(() => {});
    }
    if (url.includes(SUMMARY_HOST)) {
      return Promise.resolve(jsonResponse(buildSummary(fixture.dailyClones)));
    }
    // Checked before the repo URL: the contributors endpoint is a path under it.
    if (url.includes(CONTRIBUTORS_PATH)) {
      return Promise.resolve(jsonResponse(buildContributors(fixture.contributors)));
    }
    return Promise.resolve(jsonResponse({ stargazers_count: fixture.stargazers }));
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

const SMALL_NUMBERS: StatsFixture = {
  dailyClones: [60, 70, 80, 90, 110, 120, 130, 140], // 800
  stargazers: 812,
  contributors: 42,
};

const BIG_NUMBERS: StatsFixture = {
  dailyClones: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3300], // 24300
  stargazers: 1000,
  contributors: 1200,
};

const SIGNED_IN_USER: AuthUser = {
  userId: 'user-overview-story',
  email: 'alina@sunrisevet.example',
  authProfile: null,
  loginMethod: 'emailpassword',
  emailVerified: true,
  getUsername: () => 'user-overview-story',
};

/**
 * Mirrors the private storage key in `lib/defaultOpenScreen`. `getCtaHref` routes a
 * signed-in non-developer through `resolveDefaultOpenScreenRoute`, which prefers a
 * SAVED route over the role default - so a value another story left behind in
 * localStorage would silently decide this page's CTA. Cleared here and restored on
 * unmount.
 */
const DEFAULT_OPEN_SCREEN_KEY = 'yc_default_open_screen';

const withAuth = (user: AuthUser | null, role: string | null) => () => {
  const snapshot = useAuthStore.getState();
  const savedRoute = globalThis.localStorage.getItem(DEFAULT_OPEN_SCREEN_KEY);
  globalThis.localStorage.removeItem(DEFAULT_OPEN_SCREEN_KEY);

  useAuthStore.setState({
    user,
    role,
    status: user ? 'authenticated' : 'unauthenticated',
  });

  return () => {
    useAuthStore.setState(snapshot);
    if (savedRoute === null) {
      globalThis.localStorage.removeItem(DEFAULT_OPEN_SCREEN_KEY);
    } else {
      globalThis.localStorage.setItem(DEFAULT_OPEN_SCREEN_KEY, savedRoute);
    }
  };
};

/**
 * Label -> number for the four hero stats, read as PAIRS.
 *
 * The row is four sibling divs with no relationship in the markup beyond their
 * order, so swapping two of them - or wiring `totalContributors` into the stars
 * slot - changes nothing a text assertion would notice. "Repo Stars" carrying the
 * contributor count still renders four plausible numbers.
 */
const readStats = (canvasElement: HTMLElement): Record<string, string> =>
  Object.fromEntries(
    Array.from(canvasElement.querySelectorAll('.StatItem')).map((item) => [
      item.querySelector('.StatLabel')?.textContent ?? '',
      item.querySelector('.StatNumber')?.textContent ?? '',
    ])
  );

const meta = {
  title: 'Marketing/OverviewPage',
  component: OverviewPage,
  parameters: {
    layout: 'fullscreen',
    // Public page, so it opts out of the `data-yc-app` marker the preview stamps on
    // every other story - PIMS scopes its darker faint inks to that marker and this
    // surface needs the marketing values.
    surface: 'marketing',
    nextjs: { appDirectory: true, navigation: { pathname: '/overview' } },
    docs: {
      description: {
        component:
          'The public "Building in Public" page at `/overview`: a hero with four live community ' +
          'numbers, the CloudFront hero image, a CTA, and the community chart, over the shared ' +
          'marketing footer.\n\n' +
          'Everything above the chart comes from `useOverviewStats`, which fetches the stats ' +
          "branch's `summary.json` plus two api.github.com endpoints on mount, so every story " +
          'here answers those from fixtures rather than depending on GitHub and its ' +
          'unauthenticated rate limit.\n\n' +
          'Three things in here are branches rather than styling. Until all three requests ' +
          'settle every stat renders a dash, not a zero. `formatStat` switches to "24.3k" at ' +
          '1000 and prints the raw integer below it. And the CTA href forks three ways on the ' +
          'auth store: `/signup` signed out, `/developers/home` for a developer, and the ' +
          "role's default open screen for everyone else. Discord is the odd one out - it is a " +
          'hard-coded 169 in the hook, not a fetched number, so it cannot vary between stories.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withGithubStats(SMALL_NUMBERS),
} satisfies Meta<typeof OverviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Signed out, three-digit stats',
  beforeEach: withAuth(null, null),
  parameters: {
    docs: {
      description: {
        story:
          'The everyday public view. Repo Stars reads 812 - the repo API count - and not the 770 ' +
          'the summary series ends on, which is the order the hook applies them in.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(async () => {
      await expect(readStats(canvasElement)).toEqual({
        'Repository clones': '800',
        Contributors: '42',
        'Discord Members': '169',
        'Repo Stars': '812',
      });
    });

    // Signed out the CTA is a link to sign-up, not the app.
    const cta = canvas.getByRole('link', { name: 'Go to App' });
    await expect(cta).toHaveAttribute('href', '/signup');

    /* One row, not two. The desktop rule is an 80px-gap flex row with `flex-wrap`
       on, so the four stats silently reflow to two rows as soon as a label grows or
       the gap does - and a wrapped row on a page whose whole point is the numbers
       reads as a layout bug rather than a wide one. */
    const itemTops = new Set(
      Array.from(canvasElement.querySelectorAll<HTMLElement>('.StatItem')).map((item) =>
        Math.round(item.getBoundingClientRect().top)
      )
    );
    await expect(itemTops.size).toBe(1);
  },
};

export const Loading: Story = {
  name: 'Stats still loading',
  beforeEach: [withGithubStats('never-resolves'), withAuth(null, null)],
  parameters: {
    docs: {
      description: {
        story:
          'First paint, held open. All three requests are in flight, so every stat is a dash and ' +
          'the chart is replaced by its loading line. A zero here would be a claim - "nobody has ' +
          'cloned this" - that the page has not earned yet.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(readStats(canvasElement)).toEqual({
      'Repository clones': '-',
      Contributors: '-',
      'Discord Members': '-',
      'Repo Stars': '-',
    });

    // Discord is a constant in the hook, so it is the one number that COULD be shown
    // while loading. It is not - the loading flag covers all four.
    await expect(canvas.queryByText('169')).toBeNull();
    await expect(canvas.getByText('Loading Repository Data…')).toBeInTheDocument();
  },
};

export const Thousands: Story = {
  name: 'Four figures collapse to "k"',
  beforeEach: [withGithubStats(BIG_NUMBERS), withAuth(null, null)],
  parameters: {
    docs: {
      description: {
        story:
          'Repo Stars is exactly 1000, which is the boundary `formatStat` switches on (`>= 1000`), ' +
          'so it renders "1.0k" rather than "1000". Discord stays a bare 169 in the same row, ' +
          'which is what makes a mixed row worth looking at.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(readStats(canvasElement)).toEqual({
        'Repository clones': '24.3k',
        Contributors: '1.2k',
        'Discord Members': '169',
        'Repo Stars': '1.0k',
      });
    });
  },
};

export const SignedInDeveloper: Story = {
  name: 'Signed in as a developer',
  beforeEach: withAuth(SIGNED_IN_USER, 'developer'),
  parameters: {
    docs: {
      description: {
        story:
          'A developer is sent to the developer portal, not to PIMS. Note the label also changes ' +
          'case between the two branches - "Go to app" here against "Go to App" signed out - ' +
          'which is a copy inconsistency in the page, not in this story.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const cta = canvas.getByRole('link', { name: 'Go to app' });
    await expect(cta).toHaveAttribute('href', '/developers/home');

    // The signed-out CTA must be gone rather than merely re-pointed: two CTAs on the
    // page would still satisfy an href assertion on the first one found.
    await expect(canvas.queryByRole('link', { name: 'Go to App' })).toBeNull();
  },
};

export const SignedInOwner: Story = {
  name: 'Signed in as an owner',
  beforeEach: withAuth(SIGNED_IN_USER, 'owner'),
  parameters: {
    docs: {
      description: {
        story:
          'Owners land on the dashboard. This is the role branch of ' +
          '`resolveDefaultOpenScreenRoute`, reached only because the saved-route key is cleared ' +
          'first - a member who has set their own default open screen overrides it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const cta = within(canvasElement).getByRole('link', { name: 'Go to app' });
    await expect(cta).toHaveAttribute('href', '/dashboard');
  },
};

export const SignedInStaff: Story = {
  name: 'Signed in as clinical staff',
  beforeEach: withAuth(SIGNED_IN_USER, 'vet'),
  parameters: {
    docs: {
      description: {
        story:
          'Every non-owner, non-developer role defaults to the appointments board. The role string ' +
          'is compared case-insensitively after trimming, so "vet", "Vet" and "VET" all land here.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const cta = within(canvasElement).getByRole('link', { name: 'Go to app' });
    await expect(cta).toHaveAttribute('href', '/appointments');
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  beforeEach: withAuth(null, null),
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below 768px the stats row stops being a flex row and becomes a two-column grid capped ' +
          'at 420px, so the four numbers land as a 2x2 block and the 4rem figures drop to 2rem ' +
          '(1.7rem below 480). The chart header stacks its three groups instead of laying them ' +
          'out as `auto 1fr auto`, and both toggle pills go full width.',
      },
    },
  },
};

export const Tablet: Story = {
  name: 'Tablet (768)',
  beforeEach: withAuth(null, null),
  globals: { viewport: { value: 'tablet', isRotated: false } },
  parameters: {
    chromatic: { viewports: [768] },
    docs: {
      description: {
        story:
          'The 768 preset sits exactly on the phone breakpoint. `max-width: 768px` is inclusive, ' +
          'so a tablet held portrait gets the phone treatment - the 2x2 grid and the stacked ' +
          'chart header - and the widest layout the row is ever laid out as a single line at is ' +
          '769px and up. That boundary is the whole reason this story exists.',
      },
    },
  },
};
