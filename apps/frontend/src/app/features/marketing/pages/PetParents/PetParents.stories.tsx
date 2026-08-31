import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

/* Only `(routes)/(public)/layout.tsx` loads this sheet, and without it the page is not
   merely unstyled - the hero is blank. All four headline fragments ship with an inline
   `opacity: 0` and an `animation: ycWord ... both`, as do the subheading, the CTA row and
   the phone mock, so the keyframes in here are the only thing that ever makes them
   visible. The `[data-reveal]` states the nine feature cards animate through, the
   `[data-grid-1-m]` / `[data-stack-m]` phone helpers, and the reduced-motion rule that
   hides the ambient hero loop all live here too. */
import '@/app/features/marketing/site/marketing.css';
import { APP_STORE_URL, GITHUB_REPO_URL, PLAY_STORE_URL } from '@/app/features/marketing/site';

import { PetParents } from './PetParents';

/**
 * Same-origin route handler behind `useMobileRelease` - the pill never reaches
 * api.github.com itself. `?list=1` is the form the mobile variant uses.
 */
const RELEASES_ENDPOINT = '/api/community/github-releases';

/** Session-cache key `useMobileRelease` renders from before any request resolves. */
const MOBILE_CACHE_KEY = 'yc_rel_mobile_v1';

interface RawRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
}

const RELEASE_YEAR = new Date().getFullYear();

/**
 * Built from a LOCAL-time Date, never a `...T00:00:00Z` literal: `formatReleaseDate`
 * runs `toLocaleDateString` in the runner's zone, so a UTC literal near midnight
 * formats as a different day depending on where this runs - and the day is on screen.
 */
const release = (tag: string, monthIndex: number, day: number): RawRelease => ({
  tag_name: tag,
  published_at: new Date(RELEASE_YEAR, monthIndex, day, 12, 0).toISOString(),
  html_url: `${GITHUB_REPO_URL}/releases/tag/${tag}`,
});

/* Newest first, the order the API returns and the order the hook depends on. The PIMS
   release sits ABOVE the mobile one on purpose: this hero must pick the mobile tag out
   of a list it does not lead. */
const PIMS_RELEASE = release('pims-v2.3.0-beta', 7, 19);
const MOBILE_RELEASE = release('mobile-v1.4.2', 7, 11);
const RELEASE_LIST: RawRelease[] = [PIMS_RELEASE, MOBILE_RELEASE];

/** An older mobile release already sitting in the session cache from a previous visit. */
const STALE_CACHED_RELEASE = {
  tag: 'v1.3.0',
  date: null,
  url: `${GITHUB_REPO_URL}/releases/tag/mobile-v1.3.0`,
};

/** ` · Aug 11, 2026` - the publish date, rendered only once a live release resolves. */
const TRAILING_DATE = /·\s[A-Z][a-z]{2} \d{1,2}, \d{4}$/;

interface Scene {
  /** What the stubbed `?list=1` endpoint answers with. `null` makes it fail with a 503. */
  releases?: RawRelease[] | null;
  /** Pre-seeded session cache, i.e. what a repeat visitor paints before the refresh lands. */
  cached?: typeof STALE_CACHED_RELEASE | null;
  reducedMotion?: boolean;
}

/**
 * One setup per story, because a story may need any two of these three at once and
 * Storybook takes a single `beforeEach` per level. Stacking a meta-level stub under a
 * story-level one would also make the restore order load-bearing: the inner cleanup
 * would put the OUTER stub back as if it were the real `fetch` and leak it into the
 * next story.
 *
 * The session cache is cleared rather than left alone, because sessionStorage survives
 * the iframe reload between stories - without this the fallback story would keep
 * painting whatever the resolved story cached and would silently stop testing anything.
 *
 * The matchMedia stub moves the JS side of reduced motion only. `@media
 * (prefers-reduced-motion: reduce)` in marketing.css is evaluated by the engine, not by
 * this stub, so the entrance animations still play under it; what it does reach is
 * `useReducedMotion`, which is what unmounts HeroVideo and disarms `useMagnet`,
 * `useParallax`, `Spotlight` and `InkAnnotate`.
 */
const withScene =
  ({ releases = RELEASE_LIST, cached = null, reducedMotion = false }: Scene = {}) =>
  () => {
    const previousCache = globalThis.sessionStorage.getItem(MOBILE_CACHE_KEY);
    if (cached) {
      globalThis.sessionStorage.setItem(MOBILE_CACHE_KEY, JSON.stringify(cached));
    } else {
      globalThis.sessionStorage.removeItem(MOBILE_CACHE_KEY);
    }

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes(RELEASES_ENDPOINT)) {
        if (!releases) return Promise.resolve(new Response(null, { status: 503 }));
        return Promise.resolve(
          new Response(JSON.stringify(releases), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        );
      }
      return originalFetch.call(globalThis, input, init);
    }) as typeof globalThis.fetch;

    const originalMatchMedia = globalThis.window.matchMedia;
    if (reducedMotion) {
      globalThis.window.matchMedia = ((query: string) => {
        // Every other query is delegated, so nothing else in the preview changes behaviour.
        if (!query.includes('prefers-reduced-motion')) {
          return originalMatchMedia.call(globalThis.window, query);
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
    }

    return () => {
      globalThis.fetch = originalFetch;
      globalThis.window.matchMedia = originalMatchMedia;
      if (previousCache === null) {
        globalThis.sessionStorage.removeItem(MOBILE_CACHE_KEY);
      } else {
        globalThis.sessionStorage.setItem(MOBILE_CACHE_KEY, previousCache);
      }
    };
  };

const heroOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-hero]') as HTMLElement;

const featureGridOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-grid-2-m]') as HTMLElement;

/** The dark migration-story band. Found by the only `--spot` background on the page. */
const spotlightOf = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .getByText('Whose history is it, anyway')
    .closest('div[style*="--spot"]') as HTMLElement;

const trackCount = (element: HTMLElement) =>
  getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;

/** Two frames, enough for a stubbed response to have landed and re-rendered. */
const responseSettled = () =>
  new Promise<void>((resolve) => {
    globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()));
  });

const meta = {
  title: 'Marketing/PetParents',
  component: PetParents,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview decorator stamps on every other
    // story: PIMS scopes its darker faint inks to that marker, and this is a public
    // marketing surface drawn against the lighter marketing values.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The `/pet-parents` landing page: hero with the live mobile release pill and a phone ' +
          'mock, the dark migration story, nine feature cards and the closing CTA.\n\n' +
          'Almost all of it is fixed copy, so the stories here are about the three things that ' +
          'are not.\n\n' +
          '**The release pill is live.** It is the `mobile` variant, so it pulls the releases ' +
          'list and shows the newest `mobile-` tag with its publish date; the hard-coded ' +
          '`v1.2 beta` is only the fallback for a failed or unresolved request. The pill fetches ' +
          'through a same-origin route handler and caches into sessionStorage, so every story ' +
          'below stubs `fetch` and clears that key - left alone, this page would ask GitHub for ' +
          'a release on every render of every story.\n\n' +
          '**The hero video is a real branch, not a screenshot variant.** `HeroVideo` unmounts ' +
          'under `prefers-reduced-motion`, and this page is the reason `marketing.css` scopes ' +
          'its hiding rule to `[data-hero-video] + [data-hero-scrim]`: PetParents places a ' +
          'SECOND, standalone `[data-hero-scrim]` as the readability wash its headline sits on, ' +
          'and that one has to keep painting for reduced-motion readers. The pair of stories ' +
          'here is what stops those two scrims being treated as one.\n\n' +
          '**The phone layout is entirely helper attributes.** `[data-grid-1-m]`, ' +
          '`[data-grid-2-m]`, `[data-center-m]` and `[data-stack-m]` are untyped strings in the ' +
          'markup matched by media queries in another file, so a typo or a restyled container ' +
          'ships the two-column hero to a 375px screen with nothing to show for it.\n\n' +
          'Worth knowing while reading the a11y panel: the nine feature titles are styled ' +
          '`div`s, not headings, so the page offers a screen reader exactly two level-2 ' +
          'headings for its whole body.',
      },
    },
  },
  tags: ['autodocs'],
  /* Pinned rather than inherited: the float cards, the hero grid and the feature grid are
     all asserted against viewport media queries below, and leaving the width to the
     project default would make those assertions hostage to `.storybook/preview.ts`. */
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta<typeof PetParents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Release resolved, motion live',
  beforeEach: withScene({ releases: RELEASE_LIST, cached: STALE_CACHED_RELEASE }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hero = heroOf(canvasElement);

    /* The headline is four separately animated fragments with NO whitespace between them
       in the markup - the gaps are `column-gap: 0.24em` on the h1 itself. Drop the flex
       and the copy reads "Yourcompanion'swholestory." with nothing in the DOM to show for
       it, which is why both halves are asserted together. */
    const headline = hero.querySelector('h1') as HTMLElement;
    await expect((headline.textContent ?? '').replace(/\s/g, '')).toBe(
      "Yourcompanion'swholestory."
    );
    const headlineStyle = getComputedStyle(headline);
    await expect(headlineStyle.display).toBe('flex');
    await expect(Number.parseFloat(headlineStyle.columnGap)).toBeGreaterThan(0);

    /* Every fragment carries inline `opacity: 0` and gets it back only from `ycWord`.
       Asked through the Web Animations API rather than by waiting out the 1.56s stagger:
       a missing keyframes rule produces no animation object at all, so this is the
       load-bearing check that marketing.css reached the story, and finishing each one
       proves the rule ENDS at opacity 1 rather than merely existing. */
    const words = Array.from(headline.querySelectorAll<HTMLElement>(':scope > span, :scope > em'));
    await expect(words).toHaveLength(4);
    for (const word of words) {
      const [entrance] = word.getAnimations();
      await expect(entrance).toBeDefined();
      entrance.finish();
    }
    await waitFor(() => {
      for (const word of words) expect(getComputedStyle(word).opacity).toBe('1');
    });

    /* The pill is the `mobile` variant, so the newest mobile-tagged release replaces the
       hard-coded copy and the link deep-links that release. */
    const pill = canvas.getByRole('link', { name: /^Mobile app/ });
    await waitFor(() => {
      expect(pill.textContent).toContain('v1.4.2');
      expect(pill).toHaveAttribute('href', MOBILE_RELEASE.html_url);
    });
    await expect(pill.textContent).toMatch(TRAILING_DATE);
    /* A STALE release was seeded into the session cache above - that is the paint a
       repeat visitor gets first. Ending on the fetched tag is the assertion: when the
       refresh stops reaching the pill, the hero advertises an old build forever and
       looks perfectly healthy doing it. */
    await expect(pill.textContent).not.toContain('v1.3.0');
    /* Matched on the mobile TAG, not the title. The PIMS release leads the same list, so
       a looser match hands the pet-parent hero the platform version. */
    await expect(pill.textContent).not.toContain('v2.3.0-beta');
    await expect(pill.textContent).not.toContain('v1.2 beta');

    const video = hero.querySelector('video[data-hero-video]') as HTMLVideoElement;
    await expect(video).toBeTruthy();
    // `muted` is what makes the autoplay legal at all; without it the loop never starts.
    await expect(video.muted).toBe(true);
    await expect(video.loop).toBe(true);
    await expect(video.autoplay).toBe(true);
    /* Decorative, and hidden from assistive tech by the WRAPPER on purpose - aria-hidden
       belongs off the <video> itself, which is focusable. */
    await expect(video.getAttribute('aria-hidden')).toBeNull();
    await expect(video.parentElement).toHaveAttribute('aria-hidden', 'true');

    /* That wrapper is deliberately unpositioned, so the video's containing block is the
       hero section. Give the wrapper a `position` and the video collapses into a
       zero-height box against a parent that has no size of its own: invisible in review,
       and it takes the entire ambient loop with it. */
    const heroBox = hero.getBoundingClientRect();
    const videoBox = video.getBoundingClientRect();
    await expect(Math.round(videoBox.width)).toBe(Math.round(heroBox.width));
    await expect(Math.round(videoBox.height)).toBe(Math.round(heroBox.height));

    /* Two scrims, and only one of them belongs to the video. marketing.css hides the
       reduced-motion loop through `[data-hero-video] + [data-hero-scrim]`, so that pair
       has to stay ADJACENT SIBLINGS; wrap either one and the scrim survives a preference
       the video honours. The other scrim is the page's own readability wash. */
    const scrims = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-hero-scrim]'));
    await expect(scrims).toHaveLength(2);
    await expect(video.nextElementSibling?.hasAttribute('data-hero-scrim')).toBe(true);

    // Video behind the wash, wash behind the copy. A hero loop over the headline is the
    // failure this ordering exists to prevent, and all three z-indexes are inline.
    const pageScrim = scrims.find((scrim) => scrim.parentElement === hero) as HTMLElement;
    const grid = canvasElement.querySelector('[data-grid-1-m]') as HTMLElement;
    const depth = (element: HTMLElement) => Number(getComputedStyle(element).zIndex);
    await expect(depth(video)).toBeLessThan(depth(pageScrim));
    await expect(depth(pageScrim)).toBeLessThan(depth(grid));

    /* The two store badges are structurally identical - same wrapper, same style object,
       only an icon and two strings differ - so an Apple badge wired to Google Play is
       invisible in review and in a screenshot. */
    const badges = Array.from(canvasElement.querySelectorAll<HTMLAnchorElement>('[data-appbadge]'));
    await expect(badges).toHaveLength(2);
    await expect(badges[0].textContent).toContain('App Store');
    await expect(badges[0]).toHaveAttribute('href', APP_STORE_URL);
    await expect(badges[1].textContent).toContain('Google Play');
    await expect(badges[1]).toHaveAttribute('href', PLAY_STORE_URL);
    for (const badge of badges) {
      // Both open a store in a new tab, so neither may keep a handle on this window.
      await expect(badge).toHaveAttribute('target', '_blank');
      await expect(badge).toHaveAttribute('rel', 'noopener noreferrer');
    }

    // The page's only internal navigation, and the two links sit side by side.
    await expect(canvas.getByRole('link', { name: 'Get the app' })).toHaveAttribute(
      'href',
      '/signup'
    );
    await expect(canvas.getByRole('link', { name: 'I run a clinic' })).toHaveAttribute(
      'href',
      '/pet-businesses'
    );

    await expect(canvas.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Less chasing. More knowing.',
      'Get the app. Keep the record.',
    ]);
    await expect(featureGridOf(canvasElement).children).toHaveLength(9);

    /* Motion is live: the control for the ReducedMotion story. At the element's centre
       the magnet's pull is near zero, but the inline transform is written, which is the
       whole difference from inert. */
    await userEvent.hover(badges[0]);
    await expect(badges[0].style.transform).toMatch(/^translate\(/);

    // And the dark band lights its glow under the cursor.
    const spotlight = spotlightOf(canvasElement);
    await userEvent.hover(spotlight);
    await expect((spotlight.firstElementChild as HTMLElement).style.opacity).toBe('1');
  },
};

export const ReleaseUnavailable: Story = {
  name: 'Release request failed',
  beforeEach: withScene({ releases: null }),
  play: async ({ canvasElement }) => {
    const pill = within(canvasElement).getByRole('link', { name: /^Mobile app/ });

    /* The request went out and came back 503. Settled first, so this is genuinely "the
       failed response did not change it" rather than a read taken before the answer
       arrived - the same paint every visitor gets before the release resolves. */
    await responseSettled();
    await expect(pill.textContent).toContain('v1.2 beta');

    /* The releases INDEX, never `/releases/latest`: for this repo that redirects to
       whatever desktop build is newest, which would put a desktop version under a
       "Mobile app" label. */
    await expect(pill).toHaveAttribute('href', `${GITHUB_REPO_URL}/releases`);
    // No date, because there is no release to have published one.
    await expect(pill.textContent).not.toMatch(TRAILING_DATE);

    // The fallback is the only branch that keeps the hero eyebrow from being an empty
    // pill, so the rest of the hero has to be untouched by the failure.
    await expect(canvasElement.querySelector('video[data-hero-video]')).toBeTruthy();
    await expect(canvasElement.querySelectorAll('[data-appbadge]')).toHaveLength(2);
  },
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (loop gone, wash stays)',
  beforeEach: withScene({ releases: RELEASE_LIST, reducedMotion: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* HeroVideo unmounts rather than hiding: `display: none` alone leaves the loop
       decoding and downloading, so removing the element is what actually stops playback.
       The CSS rule only covers the first paint, before hydration can decide. */
    await expect(canvasElement.querySelector('[data-hero-video]')).toBeNull();

    /* Exactly ONE scrim survives, and it is the page's own. The attribute is not
       exclusive: this page places a standalone `[data-hero-scrim]` as the readability
       wash the headline sits on over two unconditional glow layers, and dropping it
       alongside the video would leave the hero copy on bare gradient in both themes.
       That is precisely why the marketing.css rule is scoped to the adjacent sibling. */
    const scrims = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-hero-scrim]'));
    await expect(scrims).toHaveLength(1);
    await expect(scrims[0].parentElement).toBe(heroOf(canvasElement));

    // useMagnet never attaches its listeners, so the store badges do not chase the
    // pointer away from themselves.
    const badge = canvasElement.querySelector('[data-appbadge]') as HTMLAnchorElement;
    await userEvent.hover(badge);
    await expect(badge.style.transform).toBe('');

    // ...and the dark band stays dark under the cursor, against a lit glow in Default.
    const spotlight = spotlightOf(canvasElement);
    await userEvent.hover(spotlight);
    await expect((spotlight.firstElementChild as HTMLElement).style.opacity).toBe('0');

    // None of that costs the reader any content.
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    await expect(featureGridOf(canvasElement).children).toHaveLength(9);
    await waitFor(() => {
      expect(canvas.getByRole('link', { name: /^Mobile app/ }).textContent).toContain('v1.4.2');
    });
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withScene({ releases: RELEASE_LIST }),
  play: async ({ canvasElement }) => {
    /* Every collapse on this page is decided by a VIEWPORT media query, and the viewport
       global is inert when the story is rendered by loading `iframe.html` directly -
       which is what the verification harness does, at 1280. So the expectation is read
       off the queries themselves: what is asserted is the COUPLING between each helper
       attribute and its rule, which still fails if a rule stops matching or an attribute
       lands on a box that cannot use it. */
    const phoneHelpers = globalThis.matchMedia('(max-width: 900px)').matches;
    const phoneStack = globalThis.matchMedia('(max-width: 700px)').matches;
    const floatsHidden = globalThis.matchMedia('(max-width: 1080px)').matches;

    const count = (selector: string) => canvasElement.querySelectorAll(selector).length;
    await expect(count('[data-grid-1-m]')).toBe(1);
    await expect(count('[data-grid-2-m]')).toBe(1);
    await expect(count('[data-center-m]')).toBe(1);
    await expect(count('[data-stack-m]')).toBe(2);

    /* `grid-template-columns: 1fr !important` does nothing to a flex row and
       `flex-direction: column` does nothing to a grid. An element restyled out from under
       its attribute keeps the attribute, passes review, and ships a 1200px two-column
       hero to a 375px screen. */
    const heroGrid = canvasElement.querySelector('[data-grid-1-m]') as HTMLElement;
    const features = featureGridOf(canvasElement);
    await expect(getComputedStyle(heroGrid).display).toBe('grid');
    await expect(getComputedStyle(features).display).toBe('grid');
    await expect(trackCount(heroGrid)).toBe(phoneHelpers ? 1 : 2);
    // Two columns on a phone, not one: the feature grid uses the `-2-m` helper.
    await expect(trackCount(features)).toBe(phoneHelpers ? 2 : 3);

    for (const row of canvasElement.querySelectorAll<HTMLElement>('[data-stack-m]')) {
      await expect(getComputedStyle(row).display).toBe('flex');
      await expect(getComputedStyle(row).flexDirection).toBe(phoneStack ? 'column' : 'row');
    }

    /* The hero copy column carries `align-items: flex-start` INLINE, so `[data-center-m]`
       only wins through its `!important`. Lose that and the phone hero centres its text
       while the pill, headline and store badges stay hard left. */
    const centred = canvasElement.querySelector('[data-center-m]') as HTMLElement;
    await expect(getComputedStyle(centred).alignItems).toBe(phoneHelpers ? 'center' : 'flex-start');

    /* The two glass cards overhang the phone mock by -40px and -34px. They are dropped
       below 1080 rather than clipped, which is the only reason the hero does not have to
       reserve space for them on a narrow screen. */
    const floats = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-hero-float]'));
    await expect(floats).toHaveLength(2);
    for (const float of floats) {
      await expect(getComputedStyle(float).display).toBe(floatsHidden ? 'none' : 'flex');
    }

    /* Nothing pushes the page sideways. The overhanging float cards, the 300px phone mock
       and the two hero glows are the four things here that could, and every one of them
       sits inside an `overflow: hidden` section. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
