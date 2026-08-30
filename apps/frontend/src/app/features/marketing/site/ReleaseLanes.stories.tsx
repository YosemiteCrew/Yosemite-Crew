import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';

import { GITHUB_REPO_URL } from './assets';
import { ReleaseLanes } from './ReleaseLanes';

/** Mirrors the module-private endpoint in `useGithubStats`. Lanes only ever use `?list=1`. */
const RELEASES_ENDPOINT = '/api/community/github-releases';
/** The one session-cache key the lanes hook owns. */
const LANES_CACHE_KEY = 'yc_marketing_release_lanes_v1';

const RELEASES_INDEX_URL = `${GITHUB_REPO_URL}/releases`;

interface RawRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
}

const THIS_YEAR = new Date().getFullYear();

/**
 * Local-time Date, not a `...T00:00:00Z` literal: both date formatters run
 * `toLocaleDateString` in the runner's zone, so a UTC literal lands on a different day
 * either side of midnight depending on where this runs - and the day is asserted below.
 */
const release = (tag: string, year: number, monthIndex: number, day: number): RawRelease => ({
  tag_name: tag,
  published_at: new Date(year, monthIndex, day, 12, 0).toISOString(),
  html_url: `${GITHUB_REPO_URL}/releases/tag/${tag}`,
});

/*
  One release per lane, tagged the way RELEASING.md says each component is tagged. Desktop
  is deliberately two years old: `formatCompactReleaseDate` appends a 2-digit year only
  for a release outside the CURRENT year, and that branch is invisible in a fixture set
  where everything shipped this year.
*/
const PIMS_RELEASE = release('pims-v2.3.0-beta', THIS_YEAR, 7, 19);
const MOBILE_RELEASE = release('mobile-v1.4.2', THIS_YEAR, 7, 11);
const BACKEND_RELEASE = release('backend-v3.1.0', THIS_YEAR, 7, 5);
const DESKTOP_RELEASE = release('v0.9.4', THIS_YEAR - 2, 6, 28);

/** Newest first, the order the API returns and the order `toLanes` relies on. */
const FULL_LIST: RawRelease[] = [PIMS_RELEASE, MOBILE_RELEASE, BACKEND_RELEASE, DESKTOP_RELEASE];

/** Nothing tagged `mobile-` or `desktop-`/bare-semver, so two lanes cannot resolve. */
const PARTIAL_LIST: RawRelease[] = [PIMS_RELEASE, BACKEND_RELEASE];

/**
 * Canned releases API plus a cleared session cache. Clearing matters here: sessionStorage
 * outlives an iframe reload, so without it the "nothing resolved" story would happily
 * paint the lanes a previous story cached and prove nothing at all.
 *
 * Pass `null` to make the request fail (503). An empty array is a different cause with the
 * same result - the hook ignores a zero-length list rather than blanking known lanes.
 */
const withReleases = (list: RawRelease[] | null) => () => {
  const previous = globalThis.sessionStorage.getItem(LANES_CACHE_KEY);
  globalThis.sessionStorage.removeItem(LANES_CACHE_KEY);

  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes(RELEASES_ENDPOINT)) {
      if (!list) return Promise.resolve(new Response(null, { status: 503 }));
      return Promise.resolve(
        new Response(JSON.stringify(list), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
    if (previous === null) {
      globalThis.sessionStorage.removeItem(LANES_CACHE_KEY);
    } else {
      globalThis.sessionStorage.setItem(LANES_CACHE_KEY, previous);
    }
  };
};

/** The four lanes, in the order the bar must always render them. */
const LANE_LABELS = ['PIMS', 'Desktop', 'Mobile', 'Backend'] as const;

/** U+00B7, the stand-in shown while a lane has no version to show. */
const PLACEHOLDER = '·';

/** What a 375px canvas leaves for content once the padded layout takes its 16px gutters. */
const PHONE_CONTENT_WIDTH = 343;

const segmentsOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLAnchorElement>('[data-yc-lane]'));

/** Each segment is `label`, `version`, and - only when a date resolved - `date`. */
const partsOf = (segment: HTMLAnchorElement) => ({
  label: segment.children[0]?.textContent ?? '',
  version: segment.children[1]?.textContent ?? '',
  date: segment.children[2]?.textContent ?? null,
});

const meta = {
  title: 'Marketing/ReleaseLanes',
  component: ReleaseLanes,
  parameters: {
    layout: 'padded',
    // Marketing surface: the bar is drawn on the public palette, so it opts out of the
    // `data-yc-app` marker that switches the faint inks to their PIMS-scoped values.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The home hero status strip: one glass bar, four linked lanes (PIMS, Desktop, Mobile, ' +
          'Backend), each showing that component\'s newest release. It replaced a single "Latest ' +
          'release" pill that always showed a desktop build, because desktop is the only lane tagged ' +
          'as bare semver and so the only one GitHub gives the Latest badge to.\n\n' +
          'All four lanes come out of ONE `?list=1` request that the hook buckets by tag prefix, so ' +
          'the interesting states are not "loading" and "loaded" but which lanes the response ' +
          'happened to contain. A lane with no match keeps its nulls and shows a `·`: it must ' +
          "never borrow another lane's version or fall back to a literal, and it must not vanish - " +
          'a bar that quietly renders three segments reads as "Mobile has no releases" to anyone ' +
          'who does not know it should be there.\n\n' +
          'The date on each tag face is deliberately compact (`19 Aug`), gaining a 2-digit year only ' +
          'for a release from an earlier year - which is why the Desktop fixture here is two years ' +
          'old.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    /*
      The hero puts this in a centred column, so the bar is a flex ITEM sized to its
      content: wide enough it sits on one line, narrow enough it wraps inside its own
      border. Rendering it as a plain full-width block instead would stretch the glass
      across the canvas and make the wrap assertions untestable.
    */
    (Story) => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: withReleases(FULL_LIST),
} satisfies Meta<typeof ReleaseLanes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllLanes: Story = {
  name: 'Every lane resolved',
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(partsOf(segmentsOf(canvasElement)[0]).version).toBe('v2.3.0-beta');
    });

    const segments = segmentsOf(canvasElement);
    await expect(segments).toHaveLength(4);
    await expect(segments.map((segment) => partsOf(segment).label)).toEqual([...LANE_LABELS]);

    /* Each lane took the newest release carrying ITS prefix, and the prefix is stripped
       before display. Desktop is the odd one out on purpose - bare semver, because
       electron-updater ignores a tag that is not valid semver - so it is the lane that
       breaks first if the matching order is ever rearranged. */
    await expect(segments.map((segment) => partsOf(segment).version)).toEqual([
      'v2.3.0-beta',
      'v0.9.4',
      'v1.4.2',
      'v3.1.0',
    ]);
    await expect(segments[0]).toHaveAttribute('href', PIMS_RELEASE.html_url);
    await expect(segments[1]).toHaveAttribute('href', DESKTOP_RELEASE.html_url);
    await expect(segments[2]).toHaveAttribute('href', MOBILE_RELEASE.html_url);
    await expect(segments[3]).toHaveAttribute('href', BACKEND_RELEASE.html_url);

    /* The compact date drops the year for anything shipped this year and keeps two digits
       of it for anything older. Both halves are asserted together: a formatter that always
       appended the year, or never did, would still look perfectly reasonable on its own. */
    await expect(partsOf(segments[0]).date).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
    await expect(partsOf(segments[1]).date).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{2}$/);

    /* The accessible name is a whole sentence, not the visible text: a screen reader
       otherwise hears "PIMS v2.3.0-beta 19 Aug", which does not say what the link does.
       The FULL date goes here even though the face shows the compact one. */
    await expect(segments[0]).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/^PIMS v2\.3\.0-beta, released [A-Z][a-z]{2} \d{1,2}, \d{4}$/)
    );
    // Same string in the tooltip, so a mouse gets the date the tag face abbreviated away.
    await expect(segments[0].getAttribute('title')).toBe(segments[0].getAttribute('aria-label'));

    /* One row, given the ~690px the four lanes need and the desktop canvas they get here.
       The bar is a wrapping flex container, so "four lanes" and "one strip" are separate
       claims: comparing the tops is what keeps a segment that has grown too wide from
       dropping onto a second line unnoticed. The Phone story asserts the opposite. */
    const tops = segments.map((segment) => segment.getBoundingClientRect().top);
    await expect(new Set(tops).size).toBe(1);
  },
};

export const Unresolved: Story = {
  name: 'Nothing resolved yet',
  beforeEach: withReleases(null),
  play: async ({ canvasElement }) => {
    const segments = segmentsOf(canvasElement);

    /* Four lanes, still, and in the same order. The absent state is the one where a bar
       that dropped its empty segments would look fine and quietly under-report what the
       project ships. */
    await expect(segments).toHaveLength(4);
    await expect(segments.map((segment) => partsOf(segment).label)).toEqual([...LANE_LABELS]);

    for (const segment of segments) {
      const { label, version, date } = partsOf(segment);
      // A placeholder, never a hard-coded literal: a stale version presented as live is
      // worse than an empty slot, and it would poison the shared session cache too.
      await expect(version).toBe(PLACEHOLDER);
      await expect(date).toBeNull();
      // Still goes somewhere useful, and says so rather than announcing a bare dot.
      await expect(segment).toHaveAttribute('href', RELEASES_INDEX_URL);
      await expect(segment).toHaveAttribute('aria-label', `${label} releases on GitHub`);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The request failed. This is also the first paint on a cold cache, and what a visitor sees ' +
          'if the response contains no releases at all - the hook ignores a zero-length list rather ' +
          'than overwriting lanes it already had.',
      },
    },
  },
};

export const Mixed: Story = {
  name: 'Two lanes with no release on the page',
  beforeEach: withReleases(PARTIAL_LIST),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(partsOf(segmentsOf(canvasElement)[0]).version).toBe('v2.3.0-beta');
    });

    const segments = segmentsOf(canvasElement);
    /* Order is fixed by the lane definitions, NOT by what came back, so the two lanes with
       no match hold their places between the two that resolved. A bar that filtered the
       empties out would put Backend where Desktop belongs. */
    await expect(segments.map((segment) => partsOf(segment).label)).toEqual([...LANE_LABELS]);
    await expect(segments.map((segment) => partsOf(segment).version)).toEqual([
      'v2.3.0-beta',
      PLACEHOLDER,
      PLACEHOLDER,
      'v3.1.0',
    ]);

    // Resolved lanes deep-link their release; unresolved ones fall back to the index.
    await expect(segments[0]).toHaveAttribute('href', PIMS_RELEASE.html_url);
    await expect(segments[1]).toHaveAttribute('href', RELEASES_INDEX_URL);
    await expect(segments[2]).toHaveAttribute('href', RELEASES_INDEX_URL);
    await expect(segments[3]).toHaveAttribute('href', BACKEND_RELEASE.html_url);

    /* An empty lane has no date span at all, rather than an empty one - otherwise the
       6px gap would show up as a ragged segment width next to its neighbours. */
    await expect(partsOf(segments[1]).date).toBeNull();
    await expect(partsOf(segments[3]).date).not.toBeNull();
  },
};

export const Phone: Story = {
  name: 'Phone (375) - the strip wraps',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    /*
      The width is pinned HERE as well as through the viewport global, and that is not
      belt-and-braces. The viewport addon resizes the iframe from the MANAGER, so a story
      opened on its own - which is how the story runner opens every one of them - renders
      at the full panel width no matter what the global says. At 1248px all four lanes fit
      on one line, so the wrap assertion below would have been measuring a desktop bar and
      failing for the right reason on a correct component.
    */
    (Story) => (
      <div style={{ width: PHONE_CONTENT_WIDTH }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(partsOf(segmentsOf(canvasElement)[0]).version).toBe('v2.3.0-beta');
    });

    const segments = segmentsOf(canvasElement);
    const bar = canvasElement.querySelector('[data-yc-lanes]') as HTMLElement;
    const tops = segments.map((segment) => segment.getBoundingClientRect().top);

    /* Every segment is `white-space: nowrap`, so the only thing standing between four tags
       and a sideways-scrolling hero is `flex-wrap: wrap` on the bar. Both halves are
       measured: more than one row, and nothing sticking out of the glass. A bar that lost
       the wrap would still satisfy either one on its own. */
    await expect(new Set(tops).size).toBeGreaterThan(1);
    await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);

    /* All four survive the wrap. The separators do not: they stay attached to the segment
       that follows them, so a wrapped row can begin with a hairline. Worth looking at
       rather than asserting - it is a judgement call, not a defect. */
    await expect(segments).toHaveLength(4);
  },
};
