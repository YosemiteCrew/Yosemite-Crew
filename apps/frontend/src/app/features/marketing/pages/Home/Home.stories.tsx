import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

/* Only `(routes)/(public)/layout.tsx` loads this sheet, and without it the front door is
   not merely unstyled - the top of it is blank. Every word of the h1 ships with an inline
   `opacity: 0` and gets it back from the `ycWord` keyframes in here; the release strip,
   the subtitle, both CTA rows and the social-proof line ride `ycHeroUp` the same way. The
   `[data-reveal]` states every section below the hero animates through, and the
   `[data-grid-1-m]` / `[data-grid-2-m]` / `[data-stack-m]` / `[data-hide-m]` /
   `[data-order-first-m]` phone helpers this page hangs its responsive layout on, are all
   defined here too. */
import '@/app/features/marketing/site/marketing.css';
import { GITHUB_REPO_URL, HERO_VIDEOS } from '@/app/features/marketing/site';

import { Home } from './Home';

/* ------------------------------------------------------------------ fixtures */

/** The one session-cache key `useReleaseLanes` owns. */
const LANES_CACHE_KEY = 'yc_marketing_release_lanes_v1';
/** The pair `useGithubStats` renders from, and the timestamp that decides its 5 minute TTL. */
const STATS_CACHE_KEY = 'yc_marketing_stats_v2';
const STATS_TS_KEY = 'yc_marketing_stats_ts_v2';

/** U+00B7 middle dot: what a lane with no release and a stat with no number both show. */
const PLACEHOLDER = '·';

interface RawRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
}

/**
 * Local-time Date, not a `...T00:00:00Z` literal. Both release formatters run
 * `toLocaleDateString` in the runner's zone, so a UTC midnight literal lands on a
 * different day either side of Greenwich - and the lane's accessible name carries the
 * date, so it would pass in Berlin and fail in California.
 */
const release = (tag: string, year: number, monthIndex: number, day: number): RawRelease => ({
  tag_name: tag,
  published_at: new Date(year, monthIndex, day, 12, 0).toISOString(),
  html_url: `${GITHUB_REPO_URL}/releases/tag/${tag}`,
});

const THIS_YEAR = new Date().getFullYear();

const PIMS_RELEASE = release('pims-v2.3.0-beta', THIS_YEAR, 7, 19);
const MOBILE_RELEASE = release('mobile-v1.4.2', THIS_YEAR, 7, 11);
const BACKEND_RELEASE = release('backend-v3.1.0', THIS_YEAR, 7, 5);
/* Bare semver, because electron-updater ignores a tag that is not valid semver - so
   desktop is the one lane matched by shape rather than by prefix, and the first to break
   if the lane order is ever rearranged. */
const DESKTOP_RELEASE = release('v0.9.4', THIS_YEAR, 6, 28);

/** Newest first, the order the API returns and the order the lane bucketing relies on. */
const RELEASE_FEED: RawRelease[] = [PIMS_RELEASE, MOBILE_RELEASE, BACKEND_RELEASE, DESKTOP_RELEASE];

/**
 * A full stats payload, including the compact `stars` the page must NOT use. Both it and
 * `starsFull` read perfectly well under "Repo stars", so the wrong one is invisible in a
 * screenshot - and `2.4k` parses to 2, so a swap would count up to "2k" under a sizer
 * still reserving the width of "2.4k".
 */
const CACHED_STATS = {
  stars: '2.4k',
  starsFull: '2,431',
  repositoryClones: '67,134',
  contributors: '38',
  discord: '1,204',
};

/* --------------------------------------------------------------- environment */

const jsonReply = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Seeds both session caches and answers every request the page makes.
 *
 * The two live surfaces resolve differently and both are easy to story wrongly.
 * `useGithubStats` renders straight from the session cache through
 * `useSyncExternalStore` and skips the network entirely while that cache is inside its
 * TTL and already holds a Discord string, so "the stats resolved" is a seeded cache with
 * no request to intercept. `useReleaseLanes` refetches on mount regardless of what is
 * cached, so the lanes need the endpoint served AND the stale cache cleared - otherwise
 * the unresolved story happily paints whatever a previous story left behind and proves
 * nothing.
 *
 * Everything is restored on unmount. The stats cache in particular has to be: a failed
 * stats pass WRITES an all-null snapshot with a fresh timestamp, so a story that left it
 * behind would hand the next one a poisoned cache that looks perfectly fresh.
 */
const withHomeData = (releases: RawRelease[] | null, stats: typeof CACHED_STATS | null) => () => {
  const previous = new Map<string, string | null>(
    [LANES_CACHE_KEY, STATS_CACHE_KEY, STATS_TS_KEY].map((key) => [
      key,
      globalThis.sessionStorage.getItem(key),
    ])
  );

  globalThis.sessionStorage.removeItem(LANES_CACHE_KEY);
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
    if (url.includes('/api/community/github-releases')) {
      return Promise.resolve(releases ? jsonReply(releases) : new Response('', { status: 503 }));
    }
    // The stats hook talks to same-origin route handlers that do not exist in
    // Storybook. Answering them here keeps the failure deliberate rather than leaving
    // it to whatever the dev server returns for an unknown path.
    if (url.includes('/api/community/')) {
      return Promise.resolve(new Response('upstream unavailable', { status: 503 }));
    }
    return originalFetch.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of previous) {
      if (value === null) globalThis.sessionStorage.removeItem(key);
      else globalThis.sessionStorage.setItem(key, value);
    }
  };
};

/**
 * Flips the JS-side reduced-motion read only.
 *
 * `useReducedMotion` goes through `window.matchMedia('(prefers-reduced-motion: reduce)')`,
 * and that one read gates `HeroVideo`, `useParallax`, `useMagnet`, `Spotlight`,
 * `InkAnnotate` and `CountUp`. Every other query is delegated to the real implementation
 * so the viewport addon keeps working.
 *
 * What this canNOT reach is the CSS half: the `@media (prefers-reduced-motion: reduce)`
 * blocks in globals.css and marketing.css are evaluated by the engine, not by this stub,
 * so the ycWord/ycHeroUp entrances still play here at full length.
 */
const withReducedMotion = () => () => {
  const original = globalThis.window.matchMedia;
  globalThis.window.matchMedia = ((query: string) => {
    if (!query.includes('prefers-reduced-motion')) {
      return original.call(globalThis.window, query);
    }
    return {
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof globalThis.window.matchMedia;
  return () => {
    globalThis.window.matchMedia = original;
  };
};

/* ------------------------------------------------------------------ accessors */

/** The seven section headings, in the order the page composes them. */
const SECTION_SPINE = [
  'Canine, equine, feline. One record for each.',
  'Run the practice, not the software.',
  'The whole story, in your pocket.',
  'Build on an open spine.',
  'Anyone can say the words. We made them cost something.',
  'Our numbers are public. Hiding them only delays fixing them.',
  'Start tonight. Leave whenever.',
];

/** The four structural promises, in grid order. */
const PRINCIPLES = [
  'Leaving is free.',
  'No toll booth.',
  'Built for the worst afternoon.',
  'Your data answers to your flag.',
];

const STAT_LABELS = ['Repository clones', 'Contributors', 'Discord members', 'Repo stars'];

/** Every link the page owns, plus the four release lanes in the hero. */
const TOTAL_LINKS = 13;

const flatten = (node: Element | null): string =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

const trackCount = (element: HTMLElement): number =>
  getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;

const headingsOf = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => flatten(heading));

const heroOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-hero]') as HTMLElement;

const heroWordsOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-hero] h1 > *'));

const laneSegmentsOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLAnchorElement>('[data-yc-lane]'));

/** Each lane segment is `label`, `version` and - only when a date resolved - `date`. */
const laneVersionsOf = (canvasElement: HTMLElement) =>
  laneSegmentsOf(canvasElement).map((segment) => segment.children[1]?.textContent ?? '');

/** Every ambient glow layer `useParallax` drives; all three live in the hero. */
const depthLayersOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-depth]'));

/**
 * Every `CountUp` on the page, found by the shape it renders rather than by position: an
 * invisible sizer holding the final string (it reserves the settled width so the number
 * does not reflow its neighbours while counting) and an absolutely positioned overlay
 * holding whatever the animation is showing right now, both inside one span.
 */
const countUpsIn = (scope: HTMLElement): HTMLElement[] =>
  Array.from(scope.querySelectorAll<HTMLElement>('span > span[aria-hidden="true"]'))
    .filter((sizer) => getComputedStyle(sizer).visibility === 'hidden')
    .map((sizer) => sizer.parentElement as HTMLElement);

const reservedValue = (countUp: HTMLElement) => countUp.children[0]?.textContent ?? '';
const shownValue = (countUp: HTMLElement) => countUp.children[1]?.textContent ?? '';

/* Scoped by label rather than by index: all four tiles are the same markup, and an index
   would keep passing after two of them swapped places. */
const metricCountUp = (canvasElement: HTMLElement, label: string): HTMLElement => {
  const tile = within(canvasElement).getByText(label).parentElement as HTMLElement;
  return tile.firstElementChild as HTMLElement;
};

const metricSource = (canvasElement: HTMLElement, label: string): string =>
  flatten((within(canvasElement).getByText(label).parentElement as HTMLElement).lastElementChild);

const inkPathOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-hero] h1 svg[data-ink] path') as SVGPathElement | null;

/* ---------------------------------------------------------------------- meta */

const meta = {
  title: 'Marketing/Home',
  component: Home,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview decorator stamps on every other
    // story. PIMS scopes its darker faint inks to that marker because public marketing
    // pages need the lighter values for their always-dark --spot panels, and the
    // manifesto band here is exactly one of those.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The site front door: hero with the four-lane release strip, an ambient loop and live ' +
          'clone count, the companion trio, the dark manifesto band, the three pillars (pet ' +
          'businesses, pet parents, developers), the four structural principles, the ' +
          '"building in public" metric row and the closing CTA.\n\n' +
          'The page holds no state of its own. What it is made of is two live reads and a pile ' +
          'of motion primitives, and each of those is easy to story wrongly.\n\n' +
          '**The two live reads resolve differently.** `useGithubStats` renders from the ' +
          '`yc_marketing_stats_v2` session cache through `useSyncExternalStore` and only goes ' +
          'to the network when that cache is stale or has no Discord number, so "the stats ' +
          'resolved" is a seeded cache with no request to intercept. `useReleaseLanes` ' +
          'refetches on mount whatever is cached, so the lanes need both the endpoint served ' +
          'and the stale cache cleared. Left unstubbed, both endpoints 404 in Storybook and ' +
          'every story would quietly be the placeholder branch.\n\n' +
          '**The numbers are IntersectionObserver-gated.** `CountUp` only starts once its ' +
          'element is 35% in view, and the metric row sits several screens down, so on a ' +
          'canvas that never scrolls the count-up never runs and the tile shows its final ' +
          'string from first paint. The default story scrolls the row into view on purpose, ' +
          'because the run is where the `stars` / `starsFull` mix-up shows itself: `2.4k` ' +
          'parses to 2 and settles on "2k" under a sizer still reserving "2.4k".\n\n' +
          '**Reduced motion is a real branch, not a screenshot variant.** `HeroVideo` returns ' +
          '`null` outright, so the loop and its scrim leave the DOM; `useParallax` and ' +
          '`useMagnet` never attach; `InkAnnotate` draws its encircle complete instead of ' +
          'animating it.\n\n' +
          'The hero loop streams from the marketing CDN and `HeroVideo` unmounts itself on a ' +
          'load error, so the default story asserting the `<video>` is present is also, ' +
          'unavoidably, asserting that the CDN answered.',
      },
    },
  },
  tags: ['autodocs'],
  /* Pinned rather than inherited: the pillar splits, the three-across companion row and
     the four-across metric band asserted below are all decided by a viewport media query,
     so leaving the width to the project default would make those assertions hostage to a
     change in `.storybook/preview.ts`. */
  globals: { viewport: { value: 'laptop', isRotated: false } },
  beforeEach: withHomeData(RELEASE_FEED, CACHED_STATS),
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------- stories */

export const Default: Story = {
  name: 'Lanes and numbers resolved',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The ambient loop first, before anything slow: `HeroVideo` unmounts itself the moment
       the element reports a load error, so a later read can find the layer gone for a
       network reason and report it as a missing feature. It is decorative, so the whole
       layer sits behind one aria-hidden wrapper rather than putting the attribute on the
       (focusable) <video> itself, and each landing page passes its own asset - a
       copy-paste that swaps in the pet-parents loop changes nothing else on the page. */
    const video = canvasElement.querySelector('video[data-hero-video]') as HTMLVideoElement;
    await expect(video).toBeTruthy();
    await expect(video.closest('[aria-hidden="true"]')).toBeTruthy();
    await expect(video.querySelector('source')).toHaveAttribute('src', HERO_VIDEOS.home);
    await expect(video.muted).toBe(true);
    await expect(video.autoplay).toBe(true);
    await expect(video.loop).toBe(true);
    // The scrim is what keeps the headline legible over the footage; it only ever renders
    // beside the video, and marketing.css hides the pair together.
    await expect(canvasElement.querySelector('[data-hero-scrim]')).toBeTruthy();

    /* The headline is four separately animated fragments with NO whitespace between them
       in the markup - the gaps come from `column-gap: 0.24em` on the h1 - so it is
       asserted as a list of words rather than as one accessible name. Drop the
       `display: flex` and the line reads "Seethewholeanimal." with nothing in the DOM to
       show for it, which is why both halves are checked together. */
    const words = heroWordsOf(canvasElement);
    await expect(words.map((word) => word.textContent)).toEqual(['See', 'the', 'whole', 'animal.']);
    const heading = canvasElement.querySelector('[data-hero] h1') as HTMLElement;
    const headingStyle = getComputedStyle(heading);
    await expect(headingStyle.display).toBe('flex');
    await expect(Number.parseFloat(headingStyle.columnGap)).toBeGreaterThan(0);

    /* Every word ships with an inline `opacity: 0` and gets it back only from `ycWord`, so
       three separate things have to hold or the hero is simply blank while every text
       query above still passes: the sheet has to be loaded, the animation has to be wired,
       and it has to be `both` - lose the fill and each word fades in and then drops back
       to 0 as it finishes, which is a page that goes blank a second after it paints. */
    for (const word of words) {
      const wordStyle = getComputedStyle(word);
      await expect(wordStyle.animationName).toBe('ycWord');
      await expect(wordStyle.animationFillMode).toBe('both');
    }
    /* The sheet probe. `[data-reveal]` is the only thing that sets a filter on these
       sections, so without marketing.css the computed value is `none` - and every section
       below the hero would then be permanently invisible with its text still findable. */
    const revealed = canvasElement.querySelector('[data-reveal]') as HTMLElement;
    await expect(getComputedStyle(revealed).filter).not.toBe('none');

    /* Four lanes, and the one lane matched by SHAPE rather than prefix resolves too.
       Desktop's tag is bare semver, so it is the lane that breaks first if the matching
       order is rearranged - and a bar that quietly rendered three segments would read as
       "Mobile has no releases" to anyone who does not know it should be there. Polled
       because the values arrive from the refresh effect, a tick after mount. */
    await waitFor(async () => {
      await expect(laneVersionsOf(canvasElement)).toEqual([
        'v2.3.0-beta',
        'v0.9.4',
        'v1.4.2',
        'v3.1.0',
      ]);
    });
    const lanes = laneSegmentsOf(canvasElement);
    await expect(lanes[0]).toHaveAttribute('href', PIMS_RELEASE.html_url);
    await expect(lanes[1]).toHaveAttribute('href', DESKTOP_RELEASE.html_url);
    /* One row. The bar is a wrapping flex container, so "four lanes" and "one strip" are
       separate claims: comparing the tops is what keeps a segment that has grown too wide
       from dropping onto a second line unnoticed on the widest surface on the site. */
    await expect(new Set(lanes.map((lane) => lane.getBoundingClientRect().top)).size).toBe(1);

    // The section spine. Level 2 skips the sr-only h1 the preview decorator injects.
    await expect(headingsOf(canvasElement)).toEqual(SECTION_SPINE);
    await expect(
      canvas.getAllByRole('heading', { level: 3 }).map((heading) => flatten(heading))
    ).toEqual(PRINCIPLES);

    /* The whole link inventory, so a pillar that lost its way out of the page fails here
       rather than in a screenshot nobody reads. The hero CTA and the closing CTA are two
       separate copies of the same "Get started free" link with nothing coupling them, so
       one can drift while the other stays right and the page still reads perfectly. */
    await expect(canvas.getAllByRole('link')).toHaveLength(TOTAL_LINKS);
    const started = canvas.getAllByRole('link', { name: 'Get started free' });
    await expect(started).toHaveLength(2);
    for (const link of started) await expect(link).toHaveAttribute('href', '/signup');
    for (const [name, href] of [
      ['Explore the practice suite', '/pet-businesses'],
      ['See the companion app', '/pet-parents'],
      ['Read the developer docs', '/developers'],
      ['See all insights', '/insights'],
      ['Talk to us', '/contact-us'],
    ] as const) {
      await expect(canvas.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    /* Both cross-origin links, checked together because a half-written `rel` looks
       identical on screen and in review while handing the opened tab a handle on this
       window. */
    for (const name of ['Star on GitHub', 'Read it on GitHub']) {
      const external = canvas.getByRole('link', { name });
      await expect(external).toHaveAttribute('href', GITHUB_REPO_URL);
      await expect(external).toHaveAttribute('target', '_blank');
      await expect(external.getAttribute('rel')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['noopener', 'noreferrer'])
      );
    }

    /* Real alt text on both photo sets. The three companion cards are the page's claim
       that this is not dogs-only software, and the species is carried by the alt rather
       than by the label beside it. */
    await expect(canvas.getAllByAltText('A companion cared for with Yosemite Crew')).toHaveLength(
      3
    );
    for (const alt of ['A canine companion', 'An equine companion', 'A feline companion']) {
      await expect(canvas.getByAltText(alt)).toBeInTheDocument();
    }

    /* Motion is live: the control for the ReducedMotion story below. `useMagnet` writes
       its transition on mount and its transform on the first mousemove, and that same
       mousemove bubbles to the window listener `useParallax` installed, so all three glow
       layers drift. They are inline styles nobody looks at, and this is the only place
       they are checked. */
    await expect(started[0].style.transition).toMatch(/transform/);
    await userEvent.hover(started[0]);
    await expect(started[0].style.transform).toMatch(/^translate\(/);
    const layers = depthLayersOf(canvasElement);
    await expect(layers).toHaveLength(3);
    for (const layer of layers) await expect(layer.style.transform).toMatch(/^translate3d\(/);

    /* Five live numbers: the hero clone count and the four metric tiles. Which cached
       field feeds which tile is the assertion that matters - `stars` ('2.4k') and
       `starsFull` ('2,431') are both in the same payload and both read perfectly well
       under "Repo stars". */
    await expect(countUpsIn(canvasElement)).toHaveLength(5);
    await expect(reservedValue(countUpsIn(heroOf(canvasElement))[0])).toBe(
      CACHED_STATS.repositoryClones
    );
    for (const [label, value] of [
      ['Repository clones', CACHED_STATS.repositoryClones],
      ['Contributors', CACHED_STATS.contributors],
      ['Discord members', CACHED_STATS.discord],
      ['Repo stars', CACHED_STATS.starsFull],
    ] as const) {
      await expect(reservedValue(metricCountUp(canvasElement, label))).toBe(value);
    }
    /* The source line is hand-written per tile, so the Discord row is the one that drifts
       into "live via GitHub" on a copy-paste - and then states something false on a
       section whose whole argument is that its numbers are honest. */
    await expect(metricSource(canvasElement, 'Discord members')).toBe('live via Discord');
    await expect(metricSource(canvasElement, 'Repo stars')).toBe('live via GitHub');

    /* Now run the count-up. It is gated at 35% visibility and the metric band is several
       screens down, so nothing above has actually exercised it: the tile shows its final
       string from first paint because that is `display`'s initial state. Scrolling the row
       in is what makes the two halves of the assertion mean something - the overlay drops
       to a counting value, and it comes back to EXACTLY the string the sizer reserved. A
       tile fed the compact `2.4k` passes every assertion above and then settles on "2k". */
    const clones = metricCountUp(canvasElement, 'Repository clones');
    metricCountUp(canvasElement, 'Repo stars').scrollIntoView({ block: 'center' });
    await waitFor(async () => {
      await expect(shownValue(clones)).not.toBe(CACHED_STATS.repositoryClones);
    });
    for (const [label, value] of [
      ['Repository clones', CACHED_STATS.repositoryClones],
      ['Contributors', CACHED_STATS.contributors],
      ['Discord members', CACHED_STATS.discord],
      ['Repo stars', CACHED_STATS.starsFull],
    ] as const) {
      await waitFor(
        async () => {
          await expect(shownValue(metricCountUp(canvasElement, label))).toBe(value);
        },
        { timeout: 5000 }
      );
    }

    /* The encircle under "whole" is built imperatively after `document.fonts.ready`, so it
       leaves no JSX behind and would stop drawing without a single test noticing. A
       numeric stroke-dasharray is the animated branch specifically - the reduced-motion
       story asserts its absence - and 2.4 is the circle weight rather than the 3.4
       underline, which is the one prop this call passes that changes the drawing. */
    await waitFor(async () => await expect(inkPathOf(canvasElement)).toBeTruthy(), {
      timeout: 8000,
    });
    const ink = inkPathOf(canvasElement) as SVGPathElement;
    await expect(ink.ownerSVGElement).toHaveAttribute('aria-hidden', 'true');
    await expect(ink).toHaveAttribute('stroke-width', '2.4');
    await expect(Number.parseFloat(ink.style.strokeDasharray)).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday page: a seeded stats cache fills the hero clone count and all four ' +
          'metric tiles, and the releases endpoint returns one release per lane. The feed is ' +
          'deliberately led by the PIMS tag with the bare-semver desktop tag last, so the lane ' +
          'matched by shape rather than by prefix has to be found at the bottom of the list.',
      },
    },
  },
};

export const NothingResolved: Story = {
  name: 'Neither the lanes nor the numbers came back',
  beforeEach: withHomeData(null, null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Four lanes, still, and each one still goes somewhere useful. The absent state is
       where a bar that dropped its empty segments would look completely fine and quietly
       under-report what the project ships. A placeholder rather than a hard-coded literal:
       a stale version presented as live is worse than an empty slot, and it would poison
       the shared session cache for every other page too. */
    const lanes = laneSegmentsOf(canvasElement);
    await expect(lanes).toHaveLength(4);
    await expect(laneVersionsOf(canvasElement)).toEqual(Array(4).fill(PLACEHOLDER));
    for (const lane of lanes) {
      await expect(lane).toHaveAttribute('href', `${GITHUB_REPO_URL}/releases`);
      // Announces what it does, rather than reading out a bare middle dot.
      await expect(lane.getAttribute('aria-label')).toMatch(/ releases on GitHub$/);
    }

    /* Every number falls back to the same middle dot - never a zero, which would be a
       false claim on a page arguing that its numbers are public, and never a blank, which
       collapses the tile. `CountUp` renders non-numeric text verbatim, so this is also the
       branch where its animation must not run at all. */
    const counters = countUpsIn(canvasElement);
    await expect(counters).toHaveLength(5);
    for (const counter of counters) {
      await expect(reservedValue(counter)).toBe(PLACEHOLDER);
      await expect(shownValue(counter)).toBe(PLACEHOLDER);
    }
    // The labels stay: an empty tile still has to say WHICH number is missing.
    for (const label of STAT_LABELS) await expect(canvas.getByText(label)).toBeInTheDocument();

    // Two failed reads cost the reader nothing else on the page.
    await expect(headingsOf(canvasElement)).toEqual(SECTION_SPINE);
    await expect(canvas.getAllByRole('link')).toHaveLength(TOTAL_LINKS);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both endpoints answer 503 and both session caches are cold, which is also the first ' +
          'paint of a perfectly healthy load and the state every unstubbed story is quietly ' +
          'in. Four lanes and five numbers, all showing the middle-dot placeholder.',
      },
    },
  },
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (loop dropped, cursor effects inert)',
  beforeEach: withReducedMotion(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `HeroVideo` returns null rather than hiding the element, because `display: none`
       does not stop playback - a hidden loop would keep decoding and keep pulling a
       multi-megabyte file down for a reader who asked for less motion. The scrim goes with
       it: it exists to hold contrast over the footage, so on its own it would just darken
       the hero for no reason. */
    await expect(canvasElement.querySelector('video[data-hero-video]')).toBeNull();
    await expect(canvasElement.querySelector('[data-hero-scrim]')).toBeNull();

    /* `useMagnet` never attaches, so the CTA does not chase the pointer away from itself.
       The link carries no inline transition of its own, so an empty string is the proof
       the effect never ran - its first act is to write one. */
    const primary = canvas.getAllByRole('link', { name: 'Get started free' })[0];
    await expect(primary.style.transition).toBe('');
    await userEvent.hover(primary);
    await expect(primary.style.transform).toBe('');

    // Same for the glow layers: the window listener is never installed, so the mousemove
    // that drifted all three in the Default story leaves them exactly where they are.
    const layers = depthLayersOf(canvasElement);
    await expect(layers).toHaveLength(3);
    for (const layer of layers) await expect(layer.style.transform).toBe('');

    /* The ink mark still exists and is still drawn - it is content, not decoration the
       reader can be denied. What changes is that it is drawn complete: no dash array, so
       there is nothing for a stroke-dashoffset transition to animate and no
       IntersectionObserver replaying the whole encircle on every scroll past. */
    await waitFor(async () => await expect(inkPathOf(canvasElement)).toBeTruthy(), {
      timeout: 8000,
    });
    const ink = inkPathOf(canvasElement) as SVGPathElement;
    await expect(ink.style.strokeDasharray).toBe('');
    await expect(ink.style.strokeDashoffset).toBe('');

    // None of that costs the reader any content.
    await expect(headingsOf(canvasElement)).toEqual(SECTION_SPINE);
    await expect(canvas.getAllByRole('link')).toHaveLength(TOTAL_LINKS);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A `window.matchMedia` stub, so this is the JS half of the preference: `HeroVideo`, ' +
          '`useParallax`, `useMagnet`, `Spotlight`, `InkAnnotate` and `CountUp` all read it ' +
          'through `useReducedMotion`. The CSS half - the blanket `animation-duration: 0.01ms` ' +
          'guard in globals.css, the settled `[data-reveal]` block and the `[data-hero-video]` ' +
          'display rule in marketing.css - is media-query driven and cannot be reached from a ' +
          'stub, so the hero word entrances still run here at full length.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (hero and pillars stack)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const all = (selector: string) =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>(selector));

    /* Every collapse on this page is decided by a VIEWPORT media query in marketing.css,
       so the expected layout is read off the queries themselves rather than hard-coded to
       375. The viewport global pins the canvas in the Storybook UI, but it is inert when
       the story is rendered by loading `iframe.html` directly - which is what the
       verification harness does, at 1280. Asserting "one column" flat would be asserting
       something the runner cannot produce; asserting the COUPLING holds at either width
       and still fails the moment a query stops matching its rule. */
    const phoneHelpers = globalThis.matchMedia('(max-width: 900px)').matches;
    const phoneStack = globalThis.matchMedia('(max-width: 700px)').matches;

    /* The inventory first. These are untyped strings in the markup with nothing checking
       them: misspell one and the section keeps its desktop grid on a 375px screen, with no
       error anywhere. The five single-column grids are the companion row, the three
       pillars and the principles wall; the wide one is the metric band; the two stacks are
       the hero CTA row and the closing CTA pair; the hidden layer is the four floating
       hero cards. */
    const oneColumn = all('[data-grid-1-m]');
    const twoColumn = all('[data-grid-2-m]');
    const stacks = all('[data-stack-m]');
    const hidden = all('[data-hide-m]');
    await expect(oneColumn).toHaveLength(5);
    await expect(twoColumn).toHaveLength(1);
    await expect(stacks).toHaveLength(2);
    await expect(hidden).toHaveLength(1);
    await expect(all('[data-order-first-m]')).toHaveLength(1);

    /* Each helper silently depends on the box it lands on. `grid-template-columns: 1fr`
       does nothing to a flex row and `flex-direction: column` does nothing to a grid, so
       an element restyled out from under its attribute keeps the attribute, passes review,
       and ships a 1240px two-column section to a phone. */
    for (const grid of [...oneColumn, ...twoColumn]) {
      await expect(getComputedStyle(grid).display).toBe('grid');
    }
    for (const row of stacks) {
      await expect(getComputedStyle(row).display).toBe('flex');
      await expect(getComputedStyle(row).flexDirection).toBe(phoneStack ? 'column' : 'row');
    }

    /* The companion row goes three-across to one, each pillar goes from its lopsided
       two-column split to one, the principles wall from 2x2 to a single stack - and the
       metric band uses the other helper because four across becomes 2x2 rather than one
       tall column of enormous numbers. */
    await expect(oneColumn.map(trackCount)).toEqual(
      phoneHelpers ? [1, 1, 1, 1, 1] : [3, 2, 2, 2, 2]
    );
    await expect(trackCount(twoColumn[0])).toBe(phoneHelpers ? 2 : 4);

    /* The four floating glass cards are absolutely positioned against the hero at
       percentage offsets, so on a phone they land on top of the headline. `display: none`
       is the only thing keeping them off it. */
    await expect(getComputedStyle(hidden[0]).display).toBe(phoneHelpers ? 'none' : 'block');

    /* `order: -1` only means anything to a flex/grid child, and it is doing real work
       here: the pet-parents copy is SECOND in the DOM so the phone mockup takes the left
       column on a wide screen, and on a phone the reader must meet the argument before the
       picture of it. Lose the attribute and the section opens with an unexplained phone. */
    const copy = canvasElement.querySelector('[data-order-first-m]') as HTMLElement;
    const mockup = (copy.parentElement as HTMLElement).firstElementChild as HTMLElement;
    if (phoneHelpers) {
      await expect(copy.getBoundingClientRect().top).toBeLessThan(
        mockup.getBoundingClientRect().top
      );
    } else {
      await expect(copy.getBoundingClientRect().left).toBeGreaterThan(
        mockup.getBoundingClientRect().left
      );
    }

    /* Nothing pushes the page sideways. The hero glows are wider than the viewport and the
       floating cards hang off both edges, so both rely on `overflow: hidden` on their
       section - which is exactly the kind of thing a refactor drops. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pinned to the `mobile` (375) viewport. The hero drops its four floating cards and ' +
          'stacks its CTA pair full width, the companion trio and all three pillars fall to a ' +
          'single column with the pet-parents copy lifted above its phone mockup, the ' +
          'principles wall unstacks to four full-width cells, and the metric band goes to 2x2.',
      },
    },
  },
};
