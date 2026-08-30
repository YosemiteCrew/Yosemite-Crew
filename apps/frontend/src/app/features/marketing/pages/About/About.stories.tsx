import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

/* Only `(routes)/(public)/layout.tsx` loads this sheet, and without it the About page
   is not merely unstyled - large parts of it are invisible. Every word of the hero
   headline carries `opacity: 0` INLINE and only gets it back from the `ycWord`
   keyframes here; `[data-reveal]`, which every belief card, stat tile and crew card
   passes through, and the `[data-grid-2-m]` / `[data-grid-1-m]` / `[data-stack-m]`
   phone helpers the page hangs its whole responsive layout on, are all defined here
   too. The assertions below fail loudly if this import ever goes. */
import '@/app/features/marketing/site/marketing.css';
import { About } from './About';

/* ------------------------------------------------------------------ fixtures */

/** The raw GitHub REST shape, which is what `useGithubContributors` parses. */
type GithubContributorPayload = {
  login?: string;
  avatar_url?: string;
  html_url?: string;
  type?: string;
};

/* Avatars point at the local `/images/marketing` statics rather than at
   avatars.githubusercontent.com. `next/image` treats the two identically, and the
   roster then renders the same with the network unplugged - which matters because
   the only thing separating the loaded state from the loading state here is whether
   a third-party request came back. */
const CONTRIBUTOR_PAYLOAD: GithubContributorPayload[] = [
  {
    login: 'aupyay',
    avatar_url: '/images/marketing/hero-av-1.png',
    html_url: 'https://github.com/aupyay',
    type: 'User',
  },
  {
    login: 'harshvardhan-parmar',
    avatar_url: '/images/marketing/hero-av-2.png',
    html_url: 'https://github.com/harshvardhan-parmar',
    type: 'User',
  },
  {
    login: 'nikita-lab',
    avatar_url: '/images/marketing/hero-av-3.png',
    html_url: 'https://github.com/nikita-lab',
    type: 'User',
  },
  // Declares itself a Bot, so the `type` check catches it.
  {
    login: 'dependabot[bot]',
    avatar_url: '/images/marketing/hero-av-1.png',
    html_url: 'https://github.com/apps/dependabot',
    type: 'Bot',
  },
  // Declares itself a *User*, which is exactly why the hook also matches on the
  // login. Drop the name test and this scaffold bot appears as a human face.
  {
    login: 'turbobot-temp',
    avatar_url: '/images/marketing/hero-av-2.png',
    html_url: 'https://github.com/turbobot-temp',
    type: 'User',
  },
  // `?anon=true` is in the request URL, and anonymous rows carry no login at all.
  { type: 'Anonymous', avatar_url: '', html_url: '' },
];

const HUMAN_LOGINS = ['aupyay', 'harshvardhan-parmar', 'nikita-lab'];

/** Derived, so it cannot drift out of step with the payload above. */
const NON_HUMAN_PAYLOAD = CONTRIBUTOR_PAYLOAD.filter(
  (contributor) => !HUMAN_LOGINS.includes(contributor.login ?? '')
);

/* `useGithubStats` reads the session cache through `useSyncExternalStore`, and skips
   the network entirely while the cache is inside its 5 minute TTL and already holds
   a Discord string. Seeding both keys is therefore the whole of "the stats
   resolved", with no request to intercept. */
const STATS_CACHE_KEY = 'yc_marketing_stats_v2';
const STATS_TS_KEY = 'yc_marketing_stats_ts_v2';

const CACHED_STATS = {
  stars: '2.4k',
  starsFull: '2,431',
  repositoryClones: '67,134',
  contributors: '38',
  discord: '1,204',
};

/** What a missing number falls back to: U+00B7 middle dot, not a dash or a zero. */
const PLACEHOLDER = '·';

/* --------------------------------------------------------------- environment */

const jsonReply = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const restoreSessionKey = (key: string, value: string | null) => {
  if (value === null) globalThis.sessionStorage.removeItem(key);
  else globalThis.sessionStorage.setItem(key, value);
};

type ContributorsReply = GithubContributorPayload[] | 'pending';

/**
 * Seeds the stats session cache and answers every request the page makes.
 *
 * Both halves are restored on unmount. The session cache in particular has to be
 * put back: a failing stats pass WRITES an all-null snapshot into it, so a story
 * that left it behind would hand the next story a poisoned cache that looks fresh.
 */
const withAboutData =
  (stats: typeof CACHED_STATS | null, contributors: ContributorsReply) => () => {
    const previousCache = globalThis.sessionStorage.getItem(STATS_CACHE_KEY);
    const previousTs = globalThis.sessionStorage.getItem(STATS_TS_KEY);
    if (stats) {
      globalThis.sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(stats));
      globalThis.sessionStorage.setItem(STATS_TS_KEY, String(Date.now()));
    } else {
      globalThis.sessionStorage.removeItem(STATS_CACHE_KEY);
      globalThis.sessionStorage.removeItem(STATS_TS_KEY);
    }

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('api.github.com') && url.includes('/contributors')) {
        // A promise that never settles leaves the hook on its initial `null`, which
        // is the loading branch - there is no separate loading flag to set.
        if (contributors === 'pending') return new Promise<Response>(() => {});
        return Promise.resolve(jsonReply(contributors));
      }
      // The stats hook talks to same-origin route handlers, which do not exist in
      // Storybook. Answering them here keeps the failure deliberate rather than
      // leaving it to whatever the dev server returns for an unknown path.
      if (url.includes('/api/community/')) {
        return Promise.resolve(new Response('upstream unavailable', { status: 503 }));
      }
      return originalFetch.call(globalThis, input, init);
    }) as typeof globalThis.fetch;

    return () => {
      globalThis.fetch = originalFetch;
      restoreSessionKey(STATS_CACHE_KEY, previousCache);
      restoreSessionKey(STATS_TS_KEY, previousTs);
    };
  };

/* ------------------------------------------------------------------ accessors */

/* Four grids carry `data-grid-2-m`, in this order down the page. Indexing them is
   what lets the loading and empty stories use the same accessor as the populated
   one - there is no card text to find the live grid by when it is empty - and
   `gridAt` asserts the count first, so inserting a fifth grid fails here rather
   than silently making every story assert the wrong section. */
const BELIEFS_GRID = 0;
const STATS_GRID = 1;
const CORE_TEAM_GRID = 2;
const LIVE_GRID = 3;

const gridsOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-grid-2-m]'));

const gridAt = (canvasElement: HTMLElement, index: number) => {
  const grids = gridsOf(canvasElement);
  expect(grids).toHaveLength(4);
  return grids[index];
};

const heroWordsOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-hero] h1 > *'));

const crewCardsIn = (grid: HTMLElement) =>
  Array.from(grid.querySelectorAll<HTMLAnchorElement>('a.yc-crew-card'));

const labelsOf = (cards: HTMLAnchorElement[]) =>
  cards.map((card) => card.getAttribute('aria-label'));

const trackCount = (element: HTMLElement) =>
  getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;

/* Scoped to the stats grid on purpose: 'Contributors' is also most of the eyebrow
   above the crew section and most of a core-team role, and an unscoped text query
   would resolve differently depending on which of those changed. */
const statTile = (canvasElement: HTMLElement, label: string) =>
  within(gridAt(canvasElement, STATS_GRID))
    .getByText(label)
    .closest('[data-reveal]') as HTMLElement;

/* `CountUp` renders its value twice inside the tile's first child: an invisible
   sizer holding the final string (it reserves the settled width so the number does
   not reflow its neighbours while counting), and an absolutely positioned overlay
   holding whatever the animation is currently showing. The sizer is the one that
   always reads the string About handed down, with no animation to wait out. */
const reservedValue = (tile: HTMLElement) => tile.firstElementChild?.firstElementChild?.textContent;
const shownValue = (tile: HTMLElement) => tile.firstElementChild?.children[1]?.textContent;

const STAT_LABELS = ['Repository clones', 'Contributors', 'Discord members', 'Repo stars'];

/* ---------------------------------------------------------------------- meta */

const meta = {
  title: 'Marketing/About',
  component: About,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview decorator stamps on every
    // other story: PIMS scopes its darker faint inks to that marker, and this is a
    // public marketing surface drawn against the lighter marketing values.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The public About page: hero, the origin story on a dark spotlight band, six belief ' +
          'cards, the live "building in public" stat row, the crew section, the company facts ' +
          'panel and the closing CTA.\n\n' +
          'Almost all of it is static, and the two parts that are not are the whole reason ' +
          'these stories exist.\n\n' +
          '**The stat row reads a cache, not a request.** `useGithubStats` renders from a ' +
          '`sessionStorage` snapshot through `useSyncExternalStore` and only goes to the ' +
          'network when that snapshot is stale or has no Discord number, so "the stats ' +
          'resolved" is seeded by writing `yc_marketing_stats_v2` plus its timestamp - there ' +
          'is no request to intercept. Every tile falls back to a middle dot, and the page ' +
          'picks `starsFull` for "Repo stars" while `stars` (the compact `2.4k`) sits unused ' +
          'in the same payload, so the stories pin the exact string per tile.\n\n' +
          '**The contributor roster has three outcomes, not two.** `useGithubContributors` ' +
          'starts at `null`, which is the loading branch and the only one with any copy of its ' +
          'own; a parsed response becomes an array; and an array that filtered down to nothing ' +
          '(bots, or anonymous rows with no login) is *not* null, so it renders an empty grid ' +
          'under a heading still promising a roster. Each of those is a story here.\n\n' +
          'Two traps are worth naming for anyone extending these. The hero headline is five ' +
          'separately animated fragments with no whitespace between them - JSX drops it, the ' +
          'gaps are a `column-gap` - so it is asserted as a list of words rather than as one ' +
          'accessible name. And the phone story reads its expected layout off `matchMedia` ' +
          'rather than hard-coding 375, because the viewport global pins the Storybook canvas ' +
          'but is inert when the story is rendered by loading `iframe.html` directly.',
      },
    },
  },
  tags: ['autodocs'],
  /* Pinned rather than inherited: the four-track stat and crew grids asserted below
     are decided by a viewport media query, and leaving the width to the project
     default would make those assertions hostage to a change in `preview.ts`. */
  globals: { viewport: { value: 'laptop', isRotated: false } },
} satisfies Meta<typeof About>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------- stories */

export const Default: Story = {
  name: 'Contributors and stats resolved',
  beforeEach: withAboutData(CACHED_STATS, CONTRIBUTOR_PAYLOAD),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The headline is four spans and an italic `<em>`, each carrying `opacity: 0`
       inline and each getting it back from a `ycWord` run in marketing.css. Two
       failures hide behind a passing text query: a dropped word (they are five
       separate nodes with no separators, so nothing reads oddly), and a missing
       stylesheet, which leaves the entire hero at opacity 0 while every string is
       still perfectly findable in the DOM.

       Re-queried on every poll rather than captured once. Storybook can remount the
       story after the play has started, and `getComputedStyle` on a node that has
       been detached answers '' for every property for ever - so a captured node
       turns a passing assertion into a six second hang and then `expected '' to be
       '1'`, which reads like a broken keyframe rather than a stale reference. */
    await waitFor(
      () => {
        const words = heroWordsOf(canvasElement);
        expect(words.map((word) => word.textContent)).toEqual([
          'We',
          'build',
          'the',
          'layer',
          'underneath.',
        ]);
        expect(getComputedStyle(words[0]).opacity).toBe('1');
      },
      { timeout: 8000 }
    );

    // The one image on the page with real alt text; the crew avatars are decorative.
    await expect(canvas.getByAltText('A clinic team caring for a companion')).toBeInTheDocument();

    const live = () => gridAt(canvasElement, LIVE_GRID);
    await waitFor(() => expect(crewCardsIn(live())).toHaveLength(3));
    await expect(canvas.queryByText('Loading contributors...')).not.toBeInTheDocument();

    /* Order and exact aria-labels in one assertion, because it pins three things
       that each fail invisibly. Both bots are dropped - dependabot by its `type`,
       turbobot-temp by its login, since GitHub calls that one a User. The anonymous
       row with no login is dropped. And every card announces who it is: the avatar
       is decorative and the login appears nowhere else in the accessible name, so a
       lost `ariaLabel` leaves a screen reader with a bare URL. */
    await expect(labelsOf(crewCardsIn(live()))).toEqual([
      'aupyay, GitHub contributor, on GitHub',
      'harshvardhan-parmar, GitHub contributor, on GitHub',
      'nikita-lab, GitHub contributor, on GitHub',
    ]);

    for (const card of crewCardsIn(live())) {
      /* Cross-origin profile links. Losing `noopener` hands the opened tab a handle
         on this window and changes nothing anyone can see. */
      await expect(card).toHaveAttribute('target', '_blank');
      await expect(card).toHaveAttribute('rel', 'noopener noreferrer');
      /* Decorative by contract: the anchor already carries the name, so a non-empty
         alt here makes every card announce its login twice. */
      const avatar = card.querySelector('img');
      await expect(avatar).not.toBeNull();
      await expect(avatar).toHaveAttribute('alt', '');
    }

    /* The live roster is appended below the founding pair, never a replacement for
       it. Both grids exist independently and both must be populated. */
    await expect(labelsOf(crewCardsIn(gridAt(canvasElement, CORE_TEAM_GRID)))).toEqual([
      'Ankit Upadhyay, Founder and contributor, on LinkedIn',
      'Harshvardhan Parmar, Contributor, on LinkedIn',
    ]);

    /* Four tracks at laptop width, so three contributors leave the fourth slot empty
       rather than stretching to fill the band, and all three sit on one row at one
       width. An `auto-fit` here instead would look fine in a screenshot and quietly
       widen the cards every time someone leaves the project. */
    await expect(trackCount(live())).toBe(4);
    const boxes = crewCardsIn(live()).map((card) => card.getBoundingClientRect());
    await expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
    const widths = boxes.map((box) => box.width);
    await expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);

    /* Which cached field feeds which tile. `stars` ('2.4k') and `starsFull`
       ('2,431') are both in the same payload and both read perfectly well under
       "Repo stars", so swapping them is invisible without the exact string. */
    await expect(reservedValue(statTile(canvasElement, 'Repository clones'))).toBe('67,134');
    await expect(reservedValue(statTile(canvasElement, 'Contributors'))).toBe('38');
    await expect(reservedValue(statTile(canvasElement, 'Discord members'))).toBe('1,204');
    await expect(reservedValue(statTile(canvasElement, 'Repo stars'))).toBe('2,431');

    /* The source line is hand-written per tile, so the Discord row is the one that
       drifts into "live via GitHub" on a copy-paste and then states something false
       on a page whose whole argument is that its numbers are honest. */
    await expect(
      within(statTile(canvasElement, 'Discord members')).getByText('live via Discord')
    ).toBeInTheDocument();
    await expect(
      within(statTile(canvasElement, 'Repo stars')).getByText('live via GitHub')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday page: a seeded stats cache fills all four tiles and the GitHub ' +
          'contributors call returns six rows, three of which are people. The payload ' +
          'deliberately includes both kinds of bot the hook filters - one that declares ' +
          'itself a Bot and one that does not - plus an anonymous row with no login.',
      },
    },
  },
};

export const LoadingContributors: Story = {
  name: 'Contributors still loading',
  beforeEach: withAboutData(CACHED_STATS, 'pending'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const live = () => gridAt(canvasElement, LIVE_GRID);

    /* `useGithubContributors` has no loading flag: it starts at `null` and leaves it
       only when a response parses, so this is both the slow-GitHub state and the
       first paint of a perfectly healthy load. */
    await expect(canvas.getByText('Loading contributors...')).toBeInTheDocument();
    await expect(crewCardsIn(live())).toHaveLength(0);
    /* The placeholder sits INSIDE the grid, in the slot the first card will take.
       Lift it out of the ternary and it renders above a four-track grid instead. */
    await expect(live().children).toHaveLength(1);

    /* The null branch guards the live roster and nothing else: the founding pair,
       the section heading and its explanatory line all sit outside the ternary and
       must still be on the page while GitHub is unreachable. */
    await expect(crewCardsIn(gridAt(canvasElement, CORE_TEAM_GRID))).toHaveLength(2);
    await expect(canvas.getByText('Live GitHub contributors')).toBeInTheDocument();

    /* The two data sources are independent - the stats come from the session cache,
       not from this request - so a stalled roster must not empty the stat row. */
    await expect(reservedValue(statTile(canvasElement, 'Contributors'))).toBe('38');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The contributors request never settles, so the hook stays on its initial `null` and ' +
          'the grid shows its one line of copy. Everything else on the page is unaffected.',
      },
    },
  },
};

export const NoContributorsReturned: Story = {
  name: 'Every contributor filtered out',
  beforeEach: withAboutData(CACHED_STATS, NON_HUMAN_PAYLOAD),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const live = () => gridAt(canvasElement, LIVE_GRID);

    /* An empty array is not null, so the loading line going away is the only signal
       that the request finished - which is why it is the thing polled on. */
    await waitFor(() =>
      expect(canvas.queryByText('Loading contributors...')).not.toBeInTheDocument()
    );
    await expect(crewCardsIn(live())).toHaveLength(0);
    await expect(live().children).toHaveLength(0);

    /* And this is the shape of that outcome: the band above still says the roster
       loads from GitHub, and underneath it there is nothing at all. There is no
       empty-state copy in the component to assert, so the assertion is the absence -
       if one is ever added, this line is where it gets noticed. */
    await expect(canvas.getByText('Live GitHub contributors')).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'This list loads directly from GitHub, so the roster stays current as the project grows.'
      )
    ).toBeInTheDocument();
    await expect(crewCardsIn(gridAt(canvasElement, CORE_TEAM_GRID))).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'GitHub answers, but every row is a bot or an anonymous entry, so the parsed list is ' +
          'an empty array. That reads as "loaded" to the component: the loading line goes away ' +
          'and the grid renders zero cards under a heading that still promises a live roster. ' +
          'Worth looking at whenever the filter in `useGithubContributors` is widened.',
      },
    },
  },
};

export const StatsUnavailable: Story = {
  name: 'Stats unavailable',
  beforeEach: withAboutData(null, CONTRIBUTOR_PAYLOAD),
  play: async ({ canvasElement }) => {
    /* No session cache, so the hook fetches, and both community endpoints answer
       503. The failed pass still writes a snapshot back into the cache, and waiting
       on that write is what makes this "after the request failed" rather than "on
       the first tick, before anything happened". */
    await waitFor(() => expect(globalThis.sessionStorage.getItem(STATS_CACHE_KEY)).not.toBeNull());

    for (const label of STAT_LABELS) {
      const tile = statTile(canvasElement, label);
      /* Both halves of CountUp, because they fail differently. The sizer proves
         About passed the fallback down at all; the overlay proves CountUp treated
         a non-numeric value as text and left it alone rather than parsing it to
         NaN and counting up to '0' - which is the one wrong number this page must
         never show, since it would read as a real measurement. */
      await expect(reservedValue(tile)).toBe(PLACEHOLDER);
      await expect(shownValue(tile)).toBe(PLACEHOLDER);
    }

    /* The row keeps its labels and its sources, so the section degrades to four
       captioned dots rather than to a blank band. */
    for (const label of STAT_LABELS) {
      await expect(within(gridAt(canvasElement, STATS_GRID)).getByText(label)).toBeInTheDocument();
    }

    /* The roster is fed by a different request and must survive a stats outage. */
    await waitFor(() => expect(crewCardsIn(gridAt(canvasElement, LIVE_GRID))).toHaveLength(3));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Nothing cached and both `/api/community/*` handlers failing, which is what a first ' +
          'visit during a GitHub or Discord outage looks like. Every tile holds a middle dot ' +
          'under its label, and the contributor roster - a separate request - is unaffected.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (every grid halves)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withAboutData(CACHED_STATS, CONTRIBUTOR_PAYLOAD),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(crewCardsIn(gridAt(canvasElement, LIVE_GRID))).toHaveLength(3));

    /* Read off the media queries rather than hard-coded to 375. The viewport global
       pins the canvas in the Storybook UI but is inert when the story is rendered by
       loading `iframe.html` directly, which is what the verification harness does,
       at 1280. Asserting the COUPLING holds at either width and still fails the
       moment a helper attribute stops matching its rule. */
    const helpersApply = globalThis.matchMedia('(max-width: 900px)').matches;
    const stackApplies = globalThis.matchMedia('(max-width: 700px)').matches;

    /* Four grids, three different desktop shapes, one shared collapse. `data-grid-2-m`
       is a bare untyped string repeated four times in the markup: misspell it on any
       one of them and that section keeps four 80px columns on a 375px screen, with
       nothing anywhere to complain. The expected desktop row is spelled out so a
       change to a section's column count has to be made deliberately here too. */
    await expect(gridsOf(canvasElement).map(trackCount)).toEqual(
      helpersApply ? [2, 2, 2, 2] : [3, 4, 4, 4]
    );
    // Named so the row above is readable: beliefs is the three-column one.
    await expect(trackCount(gridAt(canvasElement, BELIEFS_GRID))).toBe(helpersApply ? 2 : 3);

    /* The company facts band and the closing CTA pair collapse through two different
       helpers at two different breakpoints, so they are asserted separately. */
    const companyBand = canvasElement.querySelector('[data-grid-1-m]') as HTMLElement;
    await expect(trackCount(companyBand)).toBe(helpersApply ? 1 : 2);
    const ctaRow = canvasElement.querySelector('[data-stack-m]') as HTMLElement;
    await expect(getComputedStyle(ctaRow).flexDirection).toBe(stackApplies ? 'column' : 'row');

    /* Nothing pushes the page sideways. Three `HeroGlow` layers overhang their
       sections by up to 200px and only their parents' `overflow: hidden` keeps them
       in; the crew cards' 40px shadows are the other candidate. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'At 375 the belief cards drop from three columns to two, and the stat row and both ' +
          'crew grids drop from four to two - all four through the same `data-grid-2-m` helper. ' +
          'The company band goes to a single column and the closing CTA pair stacks full width.',
      },
    },
  },
};
