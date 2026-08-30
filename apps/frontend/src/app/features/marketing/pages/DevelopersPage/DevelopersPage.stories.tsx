import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

// Only `(routes)/(public)/layout.tsx` loads this sheet, and the whole page depends
// on it far more than it looks. Every hero word ships with an inline `opacity: 0`
// and an `animation: ycWord ... both`, so without the keyframes in here the
// headline never becomes visible at all - a story would be reviewing a blank hero.
// The responsive `[data-grid-1-m]` / `[data-stack-m]` collapses and the
// `[data-reveal]` states live here too.
import '@/app/features/marketing/site/marketing.css';
import { GITHUB_REPO_URL } from '@/app/features/marketing/site';

import DevelopersPage from './DevelopersPage';

/** The six section headings, in the order the page composes them. */
const SECTION_SPINE = [
  'One animal, many authorities.',
  'FHIR-native, all the way down.',
  'Publish once. Reach every clinic.',
  'Bring your own AI. Sell to every clinic. Keep all of it.',
  'Read every line. Change any of it. Leave with all of it.',
  'Clone it tonight.',
];

const flatten = (node: Element | null): string =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * Fraction of its track that a comparison bar fills. The label span sits inside the
 * track alongside the fill, so the track is its parent and the fill is the track's
 * first child. Measured rather than read off the inline `width: '77%'`, because the
 * track carries a 1px border and the point of the pair is the ratio a reader sees.
 */
const fillFraction = (label: HTMLElement): number => {
  const track = label.parentElement as HTMLElement;
  const fill = track.firstElementChild as HTMLElement;
  return fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
};

/**
 * Flips the JS-side reduced-motion read only.
 *
 * `useReducedMotion` goes through `window.matchMedia('(prefers-reduced-motion:
 * reduce)')`, and that is what gates `Tilt`, `Spotlight`, `useMagnet`, `useParallax`
 * and `InkAnnotate`. Every other query is delegated to the real implementation, so
 * nothing else in the preview changes behaviour.
 *
 * What this canNOT do is move the CSS side: `@media (prefers-reduced-motion: reduce)`
 * in globals.css and marketing.css is evaluated by the engine, not by this stub, so
 * the ycWord/ycHeroUp entrances still play here at full length. Only a runner that
 * emulates the media feature can show that half.
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

const meta = {
  title: 'Marketing/DevelopersPage',
  component: DevelopersPage,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview stamps on every other story.
    // PIMS scopes its darker faint inks to that marker; this is a public marketing
    // surface and needs the lighter values its always-dark --spot panels are drawn for.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The `/developers` landing page: hero, the machine-user statement, the FHIR API and ' +
          'marketplace features, the 0% economics panel, the open-source proof row and the ' +
          'closing CTA.\n\n' +
          'It fetches nothing and holds no state, so what it is really made of is motion ' +
          'primitives: `Reveal` on nearly every block, `Spotlight` on the three dark sections, ' +
          '`Tilt` on the economics card, `InkAnnotate` under the hero’s cyan em-word, and ' +
          '`useMagnet` on all four CTAs. All of those read `prefers-reduced-motion` through JS, ' +
          'which is why the reduced-motion story below is a real branch and not a screenshot ' +
          'variant.\n\n' +
          'Three of the five links point at `/developers/signup` - including the hero’s ' +
          '"Read the docs", which does not go to any docs.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta<typeof DevelopersPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'The whole page',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The headline is a flex row of one-word spans with NO whitespace between them
       in the markup - the gaps are `column-gap: 0.24em` on the h1 itself. Drop the
       `display: flex` and the copy reads "Fromideatotheclinic," with nothing in the
       DOM to show for it, which is why both halves are asserted together. */
    const headline = canvasElement.querySelector('[data-hero] h1') as HTMLElement;
    await expect((headline.textContent ?? '').replace(/\s/g, '')).toBe(
      'Fromideatotheclinic,inanafternoon.'
    );
    const headlineStyle = getComputedStyle(headline);
    await expect(headlineStyle.display).toBe('flex');
    await expect(Number.parseFloat(headlineStyle.columnGap)).toBeGreaterThan(0);

    /* Each word starts at inline `opacity: 0` and is carried to 1 by ycWord, so this
       is also the load-bearing check that marketing.css reached the story. Without the
       sheet the keyframes do not exist, the fill has nothing to hold, and the hero
       stays blank while every text query below still passes. */
    const words = Array.from(headline.querySelectorAll<HTMLElement>(':scope > span'));
    await expect(words).toHaveLength(5);
    await waitFor(
      async () => {
        for (const word of words) {
          await expect(getComputedStyle(word).opacity).toBe('1');
        }
      },
      { timeout: 8000 }
    );

    // The section spine. Level 2 skips the sr-only h1 the preview decorator injects.
    const spine = canvas.getAllByRole('heading', { level: 2 }).map((h) => flatten(h));
    await expect(spine).toEqual(SECTION_SPINE);

    // Five links, and the two that open a new tab both carry the full rel pair. A
    // half-written `rel="noopener"` looks identical on screen and in review.
    const links = canvas.getAllByRole('link');
    await expect(links).toHaveLength(5);
    for (const link of links.filter((l) => l.getAttribute('target') === '_blank')) {
      await expect(link).toHaveAttribute('href', GITHUB_REPO_URL);
      await expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['noopener', 'noreferrer'])
      );
    }
    await expect(canvas.getAllByRole('link', { name: /github|repo/i })).toHaveLength(2);

    /* "Read the docs" does not lead to docs: it and both portal links share one
       destination. Asserting it stops the trio drifting apart silently. */
    for (const name of ['Read the docs', 'Open the developer portal', 'Developer portal']) {
      await expect(canvas.getByRole('link', { name })).toHaveAttribute(
        'href',
        '/developers/signup'
      );
    }

    /* The ink underline is built imperatively into the DOM after `document.fonts.ready`,
       so it leaves no JSX behind and would stop drawing without a single test noticing.
       A numeric stroke-dasharray is the animated branch specifically - the reduced-motion
       story below asserts its absence. */
    const inkHost = canvasElement.querySelector('[data-hero] h1 em span') as HTMLElement;
    await waitFor(
      async () => {
        await expect(inkHost.querySelector('svg[data-ink] path')).toBeTruthy();
      },
      { timeout: 8000 }
    );
    const ink = inkHost.querySelector('svg[data-ink]') as SVGSVGElement;
    await expect(ink).toHaveAttribute('aria-hidden', 'true');
    const inkPath = ink.querySelector('path') as SVGPathElement;
    await expect(Number.parseFloat(inkPath.style.strokeDasharray)).toBeGreaterThan(0);

    /* The economics bars ARE the argument of that section, and both are unlabelled
       divs - nothing but their measured width says 77% versus 100%. The store bar is
       under 0.77 rather than exactly it because the track's 1px border eats into the
       percentage box. */
    const storeBar = fillFraction(canvas.getByText(/^they take 15/));
    const oursBar = fillFraction(canvas.getByText('every euro is yours'));
    await expect(storeBar).toBeGreaterThan(0.74);
    await expect(storeBar).toBeLessThan(0.79);
    await expect(oursBar).toBeGreaterThan(0.98);
    await expect(oursBar).toBeGreaterThan(storeBar);

    /* Motion is live: the control for the ReducedMotion story. Hovering the economics
       card tilts it AND lights the spotlight it sits in - one glow, not all three,
       because only the section under the cursor gets the mousemove. */
    const tilt = canvas.getByText('0%').closest('[data-reveal]')?.firstElementChild as HTMLElement;
    await userEvent.hover(tilt);
    await expect(tilt.style.transform).toMatch(/perspective\(1100px\)/);
    const lit = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[aria-hidden="true"]')
    ).filter((layer) => layer.style.opacity === '1');
    await expect(lit).toHaveLength(1);

    // Same for the magnet on the hero CTA: at the element's centre the pull is zero,
    // but the inline transform is written, which is the whole difference from inert.
    const primary = canvas.getByRole('link', { name: 'Read the docs' });
    await userEvent.hover(primary);
    await expect(primary.style.transform).toMatch(/^translate\(/);
  },
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (cursor effects inert)',
  beforeEach: withReducedMotion(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The ink mark still exists and is still drawn - it is content, not decoration
       the reader can be denied. What changes is that it is drawn complete: no dash
       array, so there is nothing for a stroke-dashoffset transition to animate and
       no IntersectionObserver replaying it on every scroll past. */
    const inkHost = canvasElement.querySelector('[data-hero] h1 em span') as HTMLElement;
    await waitFor(
      async () => {
        await expect(inkHost.querySelector('svg[data-ink] path')).toBeTruthy();
      },
      { timeout: 8000 }
    );
    const inkPath = inkHost.querySelector('svg[data-ink] path') as SVGPathElement;
    await expect(inkPath.style.strokeDasharray).toBe('');
    await expect(inkPath.style.strokeDashoffset).toBe('');

    /* Tilt never attaches its listeners, so the card stays flat under the cursor and
       never even gets the `transition`/`will-change` the effect would have written.
       Both are inline styles nobody looks at, and this is the only place they are checked. */
    const tilt = canvas.getByText('0%').closest('[data-reveal]')?.firstElementChild as HTMLElement;
    await userEvent.hover(tilt);
    await expect(tilt.style.transform).toBe('');
    await expect(tilt.style.willChange).toBe('');

    // And the spotlight under it stays dark: zero lit glows, against exactly one in
    // the Default story after the same hover.
    const lit = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[aria-hidden="true"]')
    ).filter((layer) => layer.style.opacity === '1');
    await expect(lit).toHaveLength(0);

    // useMagnet is inert too, so the CTA does not chase the pointer away from itself.
    const primary = canvas.getByRole('link', { name: 'Read the docs' });
    await userEvent.hover(primary);
    await expect(primary.style.transform).toBe('');

    // None of that costs the reader any content.
    await expect(canvas.getAllByRole('heading', { level: 2 }).map((h) => flatten(h))).toEqual(
      SECTION_SPINE
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A `window.matchMedia` stub, so this covers the JS half of the preference: `Tilt`, ' +
          '`Spotlight`, `useMagnet`, `useParallax` and `InkAnnotate` all read it through ' +
          '`useReducedMotion`. The CSS half - the blanket `animation-duration: 0.01ms` guard in ' +
          'globals.css and the settled `[data-reveal]` block in marketing.css - is media-query ' +
          'driven and cannot be reached from a stub, so the entrance animations still run here.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    /* The phone layout is entirely CSS: five `[data-grid-1-m]` grids collapse to one
       column at 900px, the proof row goes to two, the AGPL badge is dropped and the two
       CTA rows stack at 700px. The page's only contribution is putting the attributes on
       the right elements, so that is what is asserted - the media queries themselves are
       marketing.css's business, and the story runner renders at its own width regardless
       of the pinned viewport, so measuring the collapse here would prove nothing. */
    const count = (selector: string) =>
      canvasElement.querySelectorAll<HTMLElement>(selector).length;
    await expect(count('[data-grid-1-m]')).toBe(5);
    await expect(count('[data-grid-2-m]')).toBe(1);
    await expect(count('[data-hide-m]')).toBe(1);
    await expect(count('[data-stack-m]')).toBe(2);
    await expect(count('[data-order-first-m]')).toBe(1);

    /* Each hook silently depends on the box it lands on. `grid-template-columns: 1fr`
       does nothing to a flex row and `flex-direction: column` does nothing to a grid,
       so an element that gets restyled out from under its attribute keeps the attribute,
       passes review, and ships a 1200px-wide two-column hero to a 375px screen. */
    for (const grid of canvasElement.querySelectorAll<HTMLElement>(
      '[data-grid-1-m],[data-grid-2-m]'
    )) {
      await expect(getComputedStyle(grid).display).toBe('grid');
    }
    for (const row of canvasElement.querySelectorAll<HTMLElement>('[data-stack-m]')) {
      await expect(getComputedStyle(row).display).toBe('flex');
    }
    // `order: -1` only means anything to a flex/grid child.
    const reordered = canvasElement.querySelector('[data-order-first-m]') as HTMLElement;
    await expect(getComputedStyle(reordered.parentElement as HTMLElement).display).toBe('grid');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pinned to the `mobile` (375) viewport. The hero drops to a single column with the ' +
          'terminal below the copy, the AGPL badge that overhangs the code panel is removed ' +
          'rather than clipped, the marketplace copy moves above its plugin list, and the ' +
          'proof row goes from four cards to two.',
      },
    },
  },
};
