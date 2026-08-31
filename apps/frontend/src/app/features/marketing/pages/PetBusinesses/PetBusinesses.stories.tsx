import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

/* Only `(routes)/(public)/layout.tsx` loads this sheet, and without it the page is not
   merely unstyled - the top of it is blank. Every word of the h1 ships with an inline
   `opacity: 0` and gets it back from the `ycWord` keyframes in here; the release pill,
   the subtitle, both CTA rows and the whole PIMS window mockup ride `ycHeroUp` the same
   way. The `[data-reveal]` states the eight sections animate through, and the
   `[data-grid-1-m]` / `[data-grid-2-m]` / `[data-stack-m]` / `[data-hide-m]` phone
   helpers this page hangs its responsive layout on, are all defined here too. */
import '@/app/features/marketing/site/marketing.css';
import { GITHUB_REPO_URL, HERO_VIDEOS, RELEASES_LATEST_URL } from '@/app/features/marketing/site';

import PetBusinesses from './PetBusinesses';

/** Session-cache key `usePlatformRelease` renders the hero pill from. */
const PIMS_CACHE_KEY = 'yc_rel_pims_v1';

/** Hard-coded fallback copy the pill carries until (or unless) a release resolves. */
const FALLBACK_VERSION = 'v2.2.0-beta';

type RawRelease = { tag_name: string; published_at: string; html_url: string };

const release = (tag: string, published: string): RawRelease => ({
  tag_name: tag,
  published_at: published,
  html_url: `${GITHUB_REPO_URL}/releases/tag/${tag}`,
});

/**
 * Newest-first, exactly as the GitHub list endpoint returns it, and deliberately led by
 * two releases the platform pill must NOT take. `/releases/latest` on this repo is a
 * desktop build, which is the whole reason `usePlatformRelease` filters the list by tag
 * instead: the pill has to walk past `backend-` and `mobile-` and land on `pims-`.
 */
const RELEASE_FEED: RawRelease[] = [
  release('backend-v3.0.1', '2026-08-20T12:00:00.000Z'),
  release('mobile-v1.9.0', '2026-08-16T12:00:00.000Z'),
  release('pims-v2.1.4', '2026-08-12T12:00:00.000Z'),
  release('pms-v1.9.9', '2026-05-04T12:00:00.000Z'),
];

const PLATFORM_RELEASE = RELEASE_FEED[2];
/** The tag with its area prefix stripped - what `toReleaseInfo` leaves for the pill. */
const PLATFORM_VERSION = 'v2.1.4';
/* Formatted here rather than hard-coded, and with the same call the hook makes. A literal
   'Aug 12, 2026' would be a fixture that slides by the runner's UTC offset: a 00:00Z
   timestamp reads as the 11th anywhere west of Greenwich, so the story would pass in
   Berlin and fail in California. Midday plus a mirrored format is offset-proof either way. */
const PLATFORM_DATE = new Date(PLATFORM_RELEASE.published_at).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/**
 * Serves the releases list the hero pill asks for, and clears the session cache first so
 * each story starts from the same cold state.
 *
 * Left alone the pill fires a real request at `/api/community/github-releases?list=1` on
 * mount, which in Storybook is a 404 - so every story would silently be the fallback
 * branch, and the resolved-release branch would never be reviewed at all. Passing `null`
 * asks for that failure on purpose.
 */
const withReleaseFeed = (feed: RawRelease[] | null) => () => {
  const originalFetch = globalThis.fetch;
  const previous = globalThis.sessionStorage.getItem(PIMS_CACHE_KEY);
  globalThis.sessionStorage.removeItem(PIMS_CACHE_KEY);

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/api/community/github-releases')) {
      if (!feed) return Promise.resolve(new Response('', { status: 503 }));
      return Promise.resolve(
        new Response(JSON.stringify(feed), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return originalFetch.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = originalFetch;
    if (previous === null) globalThis.sessionStorage.removeItem(PIMS_CACHE_KEY);
    else globalThis.sessionStorage.setItem(PIMS_CACHE_KEY, previous);
  };
};

/**
 * Flips the JS-side reduced-motion read only.
 *
 * `useReducedMotion` goes through `window.matchMedia('(prefers-reduced-motion: reduce)')`,
 * and on this page that one read gates `HeroVideo`, `useParallax`, `useMagnet`, `Spotlight`
 * and `InkAnnotate`. Every other query is delegated to the real implementation so the
 * viewport addon keeps working.
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

/** The six section headings, in the order the page composes them. */
const SECTION_SPINE = [
  'One patient. Every slice, in one place.',
  'You pay your vet. Your statement should say your vet.',
  'The wifi blinks mid-emergency. Nothing you typed is lost.',
  "The math you don't want to get wrong.",
  'Everything the clinic runs on.',
  'Close the notebook.',
];

const flatten = (node: Element | null): string =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

const trackCount = (element: HTMLElement): number =>
  getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;

const heroHeadingOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-hero] h1') as HTMLElement;

/** The hero eyebrow pill, found by its product label rather than by position. */
const platformPillOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('link', { name: /Platform PIMS/ });

/** Every ambient glow layer `useParallax` drives - both of them live in the hero. */
const depthLayersOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-depth]'));

const meta = {
  title: 'Marketing/PetBusinesses',
  component: PetBusinesses,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview decorator stamps on every other
    // story. PIMS scopes its darker faint inks to that marker because public marketing
    // pages need the lighter values for their always-dark --spot panels, and the
    // notebook section here is exactly one of those.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The `/pet-businesses` clinic-facing landing page: hero with a live platform release ' +
          'pill and a PIMS window mockup, the dark "notebook" statement, records, finance, ' +
          'offline-first, the calculator wall, the nine module cards and the closing CTA.\n\n' +
          'It holds no state of its own. What it is actually made of is one network read and a ' +
          'pile of motion primitives, and both are easy to story wrongly.\n\n' +
          '**The release pill is the only live thing on the page.** `ReleasePill ' +
          'variant="platform"` mounts `usePlatformRelease`, which renders from the ' +
          '`yc_rel_pims_v1` session cache and refreshes it from ' +
          '`/api/community/github-releases?list=1`. In Storybook that endpoint 404s, so an ' +
          'unstubbed story is always quietly showing the hard-coded ' +
          `\`${FALLBACK_VERSION}\` fallback - the resolved branch would never be seen. Every ` +
          'story here serves the list instead, and one asks for the failure on purpose.\n\n' +
          '**Reduced motion is a real branch, not a screenshot variant.** `HeroVideo` returns ' +
          '`null` outright, so the loop and its scrim leave the DOM; `useParallax` and ' +
          '`useMagnet` never attach; `InkAnnotate` draws its encircle complete instead of ' +
          'animating it. All five read the preference through `useReducedMotion`, which is a ' +
          '`matchMedia` call - so a stub reaches it.\n\n' +
          'The hero loop streams from the marketing CDN. `HeroVideo` unmounts itself on a load ' +
          'error, so the default story asserting the `<video>` is present is also, unavoidably, ' +
          'asserting that the CDN answered.',
      },
    },
  },
  tags: ['autodocs'],
  /* Pinned rather than inherited: the records/finance two-column splits and the four-across
     offline row are asserted below and both are decided by a viewport media query. Leaving
     the width to the project default would make those assertions hostage to a change in
     `.storybook/preview.ts`. */
  globals: { viewport: { value: 'laptop', isRotated: false } },
  beforeEach: withReleaseFeed(RELEASE_FEED),
} satisfies Meta<typeof PetBusinesses>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'The whole page',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The headline is a flex row of one-word spans with NO whitespace between them in the
       markup - the gaps come from `column-gap: 0.24em` on the h1. Drop the `display: flex`
       and the line reads "Thepractice,ononescreen." with nothing in the DOM to show for
       it, which is why both halves are asserted together. */
    const headline = heroHeadingOf(canvasElement);
    await expect((headline.textContent ?? '').replace(/\s/g, '')).toBe('Thepractice,ononescreen.');
    const headlineStyle = getComputedStyle(headline);
    await expect(headlineStyle.display).toBe('flex');
    await expect(Number.parseFloat(headlineStyle.columnGap)).toBeGreaterThan(0);

    /* Every word ships with an inline `opacity: 0` and gets it back only from `ycWord`, so
       three separate things have to hold or the hero is simply blank while every text query
       above still passes: the sheet has to be loaded, the animation has to be wired, and it
       has to be `both` - lose the fill and each word fades in and then drops back to 0 as it
       finishes, which is a page that goes blank a second and a half after it paints.
       `[data-reveal]`'s blur is the sheet probe: marketing.css is the only thing that sets
       it, and without the sheet the computed value is `none`. */
    const words = Array.from(headline.querySelectorAll<HTMLElement>(':scope > span'));
    await expect(words).toHaveLength(5);
    for (const word of words) {
      const wordStyle = getComputedStyle(word);
      await expect(wordStyle.animationName).toBe('ycWord');
      await expect(wordStyle.animationFillMode).toBe('both');
    }
    const revealed = canvasElement.querySelector('[data-reveal]') as HTMLElement;
    await expect(getComputedStyle(revealed).filter).not.toBe('none');
    /* And the keyframes genuinely resolve. Deliberately the FIRST word: it is 0.1s into its
       run almost immediately, where waiting for all five to reach exactly 1 means waiting out
       0.58s of stagger plus a 1.1s run - and the verification harness samples the story a
       fixed moment after load, so an assertion parked behind that wait is never checked. */
    await waitFor(async () => {
      await expect(Number.parseFloat(getComputedStyle(words[0]).opacity)).toBeGreaterThan(0);
    });

    // The section spine. Level 2 skips the sr-only h1 the preview decorator injects.
    await expect(canvas.getAllByRole('heading', { level: 2 }).map((h) => flatten(h))).toEqual(
      SECTION_SPINE
    );

    /* The pill has to walk past `backend-v3.0.1` and `mobile-v1.9.0` - both newer, both at
       the top of the same list - and land on the platform tag, with its `pims-` prefix
       stripped off. Borrowing the newest release instead is the exact bug the tag filter
       exists to prevent, and it would look completely normal in a screenshot. Polled
       because the value arrives from the refresh effect, a tick after mount. */
    const pill = platformPillOf(canvasElement);
    await waitFor(async () => {
      await expect(within(pill).getByText(PLATFORM_VERSION)).toBeInTheDocument();
    });
    await expect(pill).toHaveAttribute('href', PLATFORM_RELEASE.html_url);
    await expect(within(pill).getByText(`· ${PLATFORM_DATE}`)).toBeInTheDocument();
    await expect(within(pill).queryByText(FALLBACK_VERSION)).toBeNull();

    /* Eight links, and no more: five in the hero (pill, two CTAs, two downloads), the
       pricing link in the finance section and the two CTAs in the closing band. */
    const links = canvas.getAllByRole('link');
    await expect(links).toHaveLength(8);

    /* The two download buttons show "Download for" over "macOS"/"Windows" in two stacked
       spans, so their aria-label is the only thing that reads as a sentence. Both open a
       new tab, and a half-written `rel="noopener"` looks identical on screen and in review. */
    for (const name of ['Download the macOS desktop app', 'Download the Windows desktop app']) {
      const download = canvas.getByRole('link', { name });
      await expect(download).toHaveAttribute('href', RELEASES_LATEST_URL);
      await expect(download).toHaveAttribute('target', '_blank');
      await expect(download.getAttribute('rel')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['noopener', 'noreferrer'])
      );
    }

    /* The hero CTA pair and the closing CTA pair are separate copies of the same two
       links. Nothing couples them, so one destination can drift while the other stays
       right and the page still reads perfectly. */
    const started = canvas.getAllByRole('link', { name: 'Get started free' });
    await expect(started).toHaveLength(2);
    for (const link of started) await expect(link).toHaveAttribute('href', '/signup');
    const walkthrough = canvas.getAllByRole('link', { name: 'Book a walkthrough' });
    await expect(walkthrough).toHaveLength(2);
    for (const link of walkthrough) await expect(link).toHaveAttribute('href', '/contact-us');
    await expect(canvas.getByRole('link', { name: /See how pricing works/ })).toHaveAttribute(
      'href',
      '/pricing'
    );

    /* The ambient loop. It is decorative, so the whole layer sits behind one aria-hidden
       wrapper rather than putting the attribute on the (focusable) <video> itself, and the
       three landing pages each pass their own asset - a copy-paste that swaps in the home
       or pet-parents loop changes nothing else on the page. */
    const video = canvasElement.querySelector('video[data-hero-video]') as HTMLVideoElement;
    await expect(video).toBeTruthy();
    await expect(video.closest('[aria-hidden="true"]')).toBeTruthy();
    await expect(video.querySelector('source')).toHaveAttribute('src', HERO_VIDEOS.petBusinesses);
    await expect(video.muted).toBe(true);
    await expect(video.autoplay).toBe(true);
    await expect(video.loop).toBe(true);
    // The scrim is what keeps the headline legible over the footage; it only ever renders
    // beside the video, and marketing.css hides the pair together.
    await expect(canvasElement.querySelector('[data-hero-scrim]')).toBeTruthy();

    /* The calculator wall is generated from one array while the paragraph above it says
       "Fifteen" in prose. Nothing couples the two, so adding a sixteenth calculator leaves
       a page that contradicts itself. The unit chips are the second half of the same
       check: two of the fifteen carry no unit, so the ternary must still be a ternary. */
    const chipRow = canvas.getByText('CRI').parentElement?.parentElement as HTMLElement;
    const chips = Array.from(chipRow.children) as HTMLElement[];
    await expect(chips).toHaveLength(15);
    await expect(chips.filter((chip) => chip.childElementCount === 2)).toHaveLength(13);
    await expect(canvas.getByText(/^Fifteen clinical calculators/)).toBeInTheDocument();

    /* The two wide card grids, in DOM order: four offline cards, then nine module cards.
       Both are rendered by mapping an array keyed on `title`, and both repeat their stagger
       delay every third card - so a duplicated title silently drops a card and leaves a grid
       that still looks deliberate. */
    const wideGrids = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-grid-2-m]'));
    await expect(wideGrids).toHaveLength(2);
    await expect(wideGrids[0].childElementCount).toBe(4);
    await expect(wideGrids[1].childElementCount).toBe(9);
    for (const title of [
      'Appointments',
      'Inventory',
      'Tasks',
      'Team and roles',
      'Chat',
      'Dashboard',
      'Templates & forms',
      'Integrations',
      'Universal search',
    ]) {
      await expect(within(wideGrids[1]).getByText(title)).toBeInTheDocument();
    }

    /* Motion is live: the control for the ReducedMotion story below. `useMagnet` writes its
       transition on mount and its transform on the first mousemove, and that same mousemove
       bubbles to the window listener `useParallax` installed, so both glow layers drift.
       All three are inline styles nobody looks at, and this is the only place they are checked. */
    const primary = started[0];
    await expect(primary.style.transition).toMatch(/transform/);
    await userEvent.hover(primary);
    await expect(primary.style.transform).toMatch(/^translate\(/);
    const layers = depthLayersOf(canvasElement);
    await expect(layers).toHaveLength(2);
    for (const layer of layers) await expect(layer.style.transform).toMatch(/^translate3d\(/);

    /* The encircle under "one" is built imperatively after `document.fonts.ready`, so it
       leaves no JSX behind and would stop drawing without a single test noticing. A numeric
       stroke-dasharray is the animated branch specifically - the reduced-motion story
       asserts its absence - and 2.4 is the circle weight rather than the 3.4 underline. */
    await waitFor(
      async () => {
        await expect(canvasElement.querySelector('[data-hero] h1 svg[data-ink] path')).toBeTruthy();
      },
      { timeout: 8000 }
    );
    const ink = canvasElement.querySelector('[data-hero] h1 svg[data-ink]') as SVGSVGElement;
    await expect(ink).toHaveAttribute('aria-hidden', 'true');
    const inkPath = ink.querySelector('path') as SVGPathElement;
    await expect(inkPath).toHaveAttribute('stroke-width', '2.4');
    await expect(Number.parseFloat(inkPath.style.strokeDasharray)).toBeGreaterThan(0);
  },
};

export const PlatformReleaseUnresolved: Story = {
  name: 'Release pill falls back',
  beforeEach: withReleaseFeed(null),
  play: async ({ canvasElement }) => {
    const pill = platformPillOf(canvasElement);

    // The hard-coded copy, and no publish date - the date span only renders when a real
    // release resolved, so an empty " · " would mean the fallback had leaked a null through.
    await expect(within(pill).getByText(FALLBACK_VERSION)).toBeInTheDocument();
    await expect(within(pill).queryByText(/·/)).toBeNull();

    /* The fallback href is the releases INDEX, not `/releases/latest`. That distinction is
       the whole point of the platform variant: `/releases/latest` on this repo resolves to a
       desktop build, so a pill that deep-links it sends a clinic looking for the PIMS
       version to the wrong download - and the two URLs differ by one path segment. The
       download buttons on the same screen legitimately use `/releases/latest`, which is
       exactly why this is easy to "fix" in the wrong direction. */
    await expect(pill).toHaveAttribute('href', `${GITHUB_REPO_URL}/releases`);
    await expect(pill).not.toHaveAttribute('href', RELEASES_LATEST_URL);

    // A failed release read costs the reader nothing else on the page.
    await expect(
      within(canvasElement)
        .getAllByRole('heading', { level: 2 })
        .map((h) => flatten(h))
    ).toEqual(SECTION_SPINE);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the hero shows when the releases endpoint is unreachable, which is also the ' +
          'first paint before the request resolves and the state every unstubbed story is ' +
          `quietly in: the hard-coded \`${FALLBACK_VERSION}\` with no publish date, linking ` +
          'to the releases index.',
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
       does not stop playback - a hidden loop would keep decoding and keep pulling the file
       down for a reader who asked for less motion. The scrim goes with it: it exists to
       hold contrast over the footage, so on its own it would just darken the hero. */
    await expect(canvasElement.querySelector('video[data-hero-video]')).toBeNull();
    await expect(canvasElement.querySelector('[data-hero-scrim]')).toBeNull();

    /* The ink mark still exists and is still drawn - it is content, not decoration the
       reader can be denied. What changes is that it is drawn complete: no dash array, so
       there is nothing for a stroke-dashoffset transition to animate and no
       IntersectionObserver replaying it on every scroll past. */
    await waitFor(
      async () => {
        await expect(canvasElement.querySelector('[data-hero] h1 svg[data-ink] path')).toBeTruthy();
      },
      { timeout: 8000 }
    );
    const inkPath = canvasElement.querySelector(
      '[data-hero] h1 svg[data-ink] path'
    ) as SVGPathElement;
    await expect(inkPath.style.strokeDasharray).toBe('');
    await expect(inkPath.style.strokeDashoffset).toBe('');

    /* `useMagnet` never attaches, so the CTA does not chase the pointer away from itself.
       Its transition is the tell: the effect's first act is to overwrite the link's own
       inline `transition: background 200ms` with a transform transition, so a link that
       still carries the page's value is one the magnet never touched. */
    const primary = canvas.getAllByRole('link', { name: 'Get started free' })[0];
    await expect(primary.style.transition).toBe('background 200ms');
    await userEvent.hover(primary);
    await expect(primary.style.transform).toBe('');

    // Same for the glow layers: the window listener is never installed, so the same
    // mousemove that drifted both of them in the Default story leaves them where they are.
    const layers = depthLayersOf(canvasElement);
    await expect(layers).toHaveLength(2);
    for (const layer of layers) await expect(layer.style.transform).toBe('');

    // None of that costs the reader any content.
    await expect(canvas.getAllByRole('heading', { level: 2 }).map((h) => flatten(h))).toEqual(
      SECTION_SPINE
    );
    await expect(canvas.getAllByRole('link')).toHaveLength(8);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A `window.matchMedia` stub, so this is the JS half of the preference: `HeroVideo`, ' +
          '`useParallax`, `useMagnet`, `Spotlight` and `InkAnnotate` all read it through ' +
          '`useReducedMotion`. The CSS half - the blanket `animation-duration: 0.01ms` guard ' +
          'in globals.css, the settled `[data-reveal]` block and the `[data-hero-video]` ' +
          'display rule in marketing.css - is media-query driven and cannot be reached from a ' +
          'stub, so the hero word entrances still run here at full length.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (sections stack)',
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
       error anywhere. Records and Finance are the two-column splits, Offline (four cards)
       and Modules (nine) are the wide grids, and the three stacks are the hero CTA row,
       the hero download row and the closing CTA pair. */
    const oneColumn = all('[data-grid-1-m]');
    const twoColumn = all('[data-grid-2-m]');
    const stacks = all('[data-stack-m]');
    await expect(oneColumn).toHaveLength(2);
    await expect(twoColumn).toHaveLength(2);
    await expect(stacks).toHaveLength(3);
    await expect(all('[data-hide-m]')).toHaveLength(2);
    await expect(all('[data-order-first-m]')).toHaveLength(1);

    /* Each helper silently depends on the box it lands on. `grid-template-columns: 1fr`
       does nothing to a flex row and `flex-direction: column` does nothing to a grid, so an
       element restyled out from under its attribute keeps the attribute, passes review, and
       ships a 1240px two-column section to a phone. */
    for (const grid of [...oneColumn, ...twoColumn]) {
      await expect(getComputedStyle(grid).display).toBe('grid');
    }
    for (const row of stacks) {
      await expect(getComputedStyle(row).display).toBe('flex');
      await expect(getComputedStyle(row).flexDirection).toBe(phoneStack ? 'column' : 'row');
    }

    // Records and Finance both go to a single column; Offline drops four-across to 2x2 and
    // Modules three-across to 2x2 as well, which is why they use the other helper.
    for (const grid of oneColumn) await expect(trackCount(grid)).toBe(phoneHelpers ? 1 : 2);
    await expect(trackCount(twoColumn[0])).toBe(phoneHelpers ? 2 : 4);
    await expect(trackCount(twoColumn[1])).toBe(phoneHelpers ? 2 : 3);

    /* `order: -1` only means anything to a flex/grid child, and it is doing real work here:
       the finance intro is SECOND in the DOM so that the mockup card takes the left column
       on a wide screen, and on a phone the reader must meet the argument before the picture
       of it. Lose the attribute and the section opens with an unexplained invoice card. */
    const intro = canvasElement.querySelector('[data-order-first-m]') as HTMLElement;
    const financeGrid = intro.parentElement as HTMLElement;
    await expect(getComputedStyle(financeGrid).display).toBe('grid');
    const card = financeGrid.firstElementChild as HTMLElement;
    if (phoneHelpers) {
      await expect(intro.getBoundingClientRect().top).toBeLessThan(
        card.getBoundingClientRect().top
      );
    } else {
      await expect(intro.getBoundingClientRect().left).toBeGreaterThan(
        card.getBoundingClientRect().left
      );
    }

    /* Nothing pushes the page sideways. The hero mockup's two floating cards hang off the
       edge at `right: -34` and the glow layers are wider than the viewport, so both rely on
       `overflow: hidden` on their section - which is the kind of thing a refactor drops. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pinned to the `mobile` (375) viewport. The hero CTA and download rows stack full ' +
          'width, the PIMS mockup drops its sidebar and its "Day" range chip, records and ' +
          'finance become single columns with the finance copy lifted above its card, and the ' +
          'offline and module grids fall to two across.',
      },
    },
  },
};
