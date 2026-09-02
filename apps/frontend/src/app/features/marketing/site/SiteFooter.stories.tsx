import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { SiteFooter } from './SiteFooter';
// `.yc-pill-green` (the operational hover tone) and the `data-stack-m` breakpoint
// that stacks the three bottom rows on a phone both live here, and only
// `(routes)/(public)/layout.tsx` loads the sheet in the app.
import './marketing.css';
import { STATS_CACHE_KEY, STATS_TS_KEY } from '@/app/features/marketing/site/useGithubStats';

/**
 * Session-cache keys owned by `useGithubStats` (module-private there). Seeding the
 * payload AND the timestamp is what makes `isStatsCacheFresh()` true; `discord` has
 * to be a string as well, because a missing one forces a refresh on its own. Both
 * conditions have to hold or the hook fires `/api/community/*` at the Storybook dev
 * server on every mount and the star count lands whenever it lands.
 */

const CACHED_STATS = {
  stars: '2.4k',
  starsFull: '2,431',
  repositoryClones: '67,134',
  contributors: '128',
  discord: '3,182',
};

const OPENSTATUS_HOST = 'openstatus.dev';

/** Stands in for `window.scrollTo` so "Back to top" can be clicked without moving the canvas. */
const scrollSpy = fn();

/**
 * The footer asks api.openstatus.dev for the platform status on mount and colours
 * the pill from the answer, so every story swaps `fetch` for a canned reply and puts
 * the real one back on unmount. Left alone, the tone of the pill would depend on how
 * the platform happened to be doing when the story was opened.
 *
 * `seedStats: false` is the cold-cache case: the stats hook then has nothing to read
 * and `stars` stays null, which is the other half of what these stories cover.
 */
const seed = ({ status, seedStats = true }: { status: string | 'reject'; seedStats?: boolean }) => {
  return () => {
    const originalFetch = globalThis.fetch;
    const originalScrollTo = globalThis.window.scrollTo;
    scrollSpy.mockClear();
    globalThis.window.scrollTo = scrollSpy as unknown as typeof globalThis.window.scrollTo;

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes(OPENSTATUS_HOST)) {
        if (status === 'reject') return Promise.reject(new Error('status api unreachable'));
        return Promise.resolve(
          new Response(JSON.stringify({ status }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        );
      }
      return originalFetch.call(globalThis, input, init);
    }) as typeof globalThis.fetch;

    if (seedStats) {
      globalThis.sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(CACHED_STATS));
      globalThis.sessionStorage.setItem(STATS_TS_KEY, String(Date.now()));
    } else {
      globalThis.sessionStorage.removeItem(STATS_CACHE_KEY);
      globalThis.sessionStorage.removeItem(STATS_TS_KEY);
    }

    return () => {
      globalThis.fetch = originalFetch;
      globalThis.window.scrollTo = originalScrollTo;
      globalThis.sessionStorage.removeItem(STATS_CACHE_KEY);
      globalThis.sessionStorage.removeItem(STATS_TS_KEY);
    };
  };
};

const statusPill = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-footer-mid="true"] a') as HTMLAnchorElement;

const starLink = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-star="true"]') as HTMLAnchorElement;

/** dot, label, "Live" tag - the pill's three spans, in order. */
const pillParts = (canvasElement: HTMLElement) => {
  const pill = statusPill(canvasElement);
  return {
    pill,
    dot: pill.children[0] as HTMLElement,
    label: pill.children[1] as HTMLElement,
    live: pill.children[2] as HTMLElement,
  };
};

const meta = {
  title: 'Marketing/SiteFooter',
  component: SiteFooter,
  parameters: {
    layout: 'fullscreen',
    // Marketing surface: the preview decorator otherwise stamps `data-yc-app` on the
    // wrapper, which swaps the faint inks for the PIMS-scoped values. The footer is
    // drawn against the marketing palette.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The public site footer: brand block and social rail, four link columns, the app ' +
          'download badges, a star CTA carrying the live count, the compliance strip, and the ' +
          'legal block.\n\n' +
          'Two of its pieces are live and neither is visible in a static snapshot. The status ' +
          'pill is fed by `usePlatformStatus`, which starts at `unknown` and only turns green ' +
          'once openstatus.dev answers - it was a hardcoded "all systems operational" before, ' +
          'which claimed health on the public site during an outage. The star count comes from ' +
          'the community-stats session cache and is `★` until it resolves. Both are seeded per ' +
          'story here rather than fetched.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seed({ status: 'operational' }),
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Operational',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { pill, dot, label, live } = pillParts(canvasElement);

    /* Polled: the pill paints `unknown` first and only takes its tone once the
       status request resolves, so a synchronous read here catches the neutral
       first frame no matter what the stub answers. */
    await waitFor(() => {
      expect(label).toHaveTextContent('All systems operational');
    });

    /* The tone is carried by two inline values read out of STATUS_TONE_DOT and
       STATUS_TONE_TEXT. Asserting the raw `var(...)` keeps the check on the
       mapping rather than on a resolved rgb triple that changes with the theme -
       and the computed read underneath is what catches a token that no longer
       exists, which would otherwise leave a transparent dot. */
    await expect(dot.style.background).toBe('var(--success)');
    // `#1d6b4f`, reserialised: the success label is the one tone written as a
    // literal hex instead of a token, so it is also the one that does not follow
    // the theme.
    await expect(label.style.color).toBe('rgb(29, 107, 79)');
    await expect(getComputedStyle(dot).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    // Only the healthy pill pulses, and only it takes the green hover tone. Both
    // are conditional on `tone === 'success'`, so an outage that kept the pulse
    // would read as a live green heartbeat next to red text.
    await expect(getComputedStyle(dot).animationName).toBe('ycStatusPulse');
    await expect(pill.classList.contains('yc-pill-green')).toBe(true);
    await expect(pill).toHaveAttribute('href', '/trust-center');
    await expect(live).toHaveTextContent('Live');

    // The count comes from the seeded session cache, not from GitHub.
    await expect(starLink(canvasElement)).toHaveTextContent('2.4k');

    /* One probe per column list. The four lists are separate literals in the
       file, and a route that quietly changed on one of them still renders as a
       perfectly ordinary link. */
    await expect(canvas.getByText('Product')).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Pet Businesses' })).toHaveAttribute(
      'href',
      '/pet-businesses'
    );
    await expect(canvas.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
      'href',
      '/impressum'
    );
    /* Community mixes internal routes with outbound links. Insights and the
       developer portal are next/link, so they must NOT open a new tab - a
       `target` here would drop client-side navigation for two in-app routes. */
    await expect(canvas.getByRole('link', { name: 'Insights' })).not.toHaveAttribute('target');
    await expect(canvas.getByRole('link', { name: 'Contributing' })).toHaveAttribute(
      'target',
      '_blank'
    );

    /* Every outbound link, without exception, carries the full rel. There are
       seventeen of them across the social rail, the community column, the app
       badges and the star CTA, and one missing `noreferrer` is invisible until it
       is a finding on a scan. */
    const external = canvasElement.querySelectorAll('a[target="_blank"]');
    await expect(external.length).toBeGreaterThan(10);
    for (const link of external) {
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    /* "Back to top" is a button that looks like a link and its only job is the
       scroll. `window.scrollTo` is stubbed for the story, so this asserts the
       wiring - including the smooth behaviour, which is the part that silently
       reverts to a jump if the options object is dropped. */
    await userEvent.click(canvas.getByRole('button', { name: /Back to top/ }));
    await expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday footer: a green pulsing dot on the status pill, the star CTA carrying a ' +
          'resolved count, and all four link columns at full width.',
      },
    },
  },
};

export const Degraded: Story = {
  name: 'Degraded performance',
  beforeEach: seed({ status: 'degraded_performance' }),
  play: async ({ canvasElement }) => {
    const { pill, dot, label } = pillParts(canvasElement);

    await waitFor(() => {
      expect(label).toHaveTextContent('Degraded performance');
    });
    await expect(dot.style.background).toBe('var(--amber)');
    await expect(label.style.color).toBe('var(--amber)');
    // No pulse and no green hover tone: the pill stops advertising health the
    // moment the tone leaves `success`.
    await expect(getComputedStyle(dot).animationName).toBe('none');
    await expect(pill.classList.contains('yc-pill-green')).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The warning tone, shared with `under_maintenance` ("Under maintenance"). Only the ' +
          'pill changes - dot, label colour and the loss of the pulse - so this is the story to ' +
          'watch if the tone map and the pill styling drift apart.',
      },
    },
  },
};

export const MajorOutage: Story = {
  name: 'Major outage',
  beforeEach: seed({ status: 'major_outage' }),
  play: async ({ canvasElement }) => {
    const { dot, label } = pillParts(canvasElement);

    await waitFor(() => {
      expect(label).toHaveTextContent('Major outage');
    });
    await expect(dot.style.background).toBe('var(--danger)');
    await expect(label.style.color).toBe('var(--danger)');
    await expect(getComputedStyle(dot).animationName).toBe('none');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The danger tone, shared by `partial_outage` ("Partial outage") and `incident` ' +
          '("Active incident"). The pill still links to the trust centre, which is where the ' +
          'incident detail lives.',
      },
    },
  },
};

export const NothingResolved: Story = {
  name: 'Status and stars unresolved',
  beforeEach: seed({ status: 'reject', seedStats: false }),
  play: async ({ canvasElement }) => {
    const { dot, label } = pillParts(canvasElement);

    /* Neutral, and worded as an absence of information rather than as health.
       This is both the first paint and where an unreachable status API lands, and
       it is the state the pill exists to make possible - the old hardcoded green
       had no way to say "we do not know". */
    await expect(label).toHaveTextContent('Status unavailable');
    await expect(dot.style.background).toBe('var(--ink-faint)');
    await expect(getComputedStyle(dot).animationName).toBe('none');

    /* No cached stats, so the star CTA falls back to a bare ★ rather than an
       empty gap or a zero. The label beside it stays, so the CTA is still a CTA. */
    const star = starLink(canvasElement);
    await expect(star).toHaveTextContent('Star on GitHub');
    await expect(star).toHaveTextContent('★');
    await expect(star).not.toHaveTextContent('2.4k');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The footer with nothing resolved: the status request failed and the community-stats ' +
          'session cache is empty. Identical to the first paint before either answers, which is ' +
          'the state a visitor actually sees for the first few hundred milliseconds.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below 900px the five link columns collapse to two (`data-grid-2-m`), and below 700px ' +
          'the three bottom rows - app badges, compliance strip, legal block - stack and stretch ' +
          '(`data-stack-m`). Both are viewport media queries in `marketing.css`, so this story ' +
          'carries no play function: the size is applied by the Storybook manager, and a headless ' +
          'render of the preview iframe would assert the desktop layout under a phone-shaped name.',
      },
    },
  },
};
