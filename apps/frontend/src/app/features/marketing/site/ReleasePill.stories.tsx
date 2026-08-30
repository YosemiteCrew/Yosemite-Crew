import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { GITHUB_REPO_URL } from './assets';
import { ReleasePill } from './ReleasePill';

/**
 * Mirrors the module-private constants in `useGithubStats`. The pill never talks to
 * api.github.com directly - it goes through this same-origin route handler, and the
 * `?list=1` form is the one the platform/mobile variants use.
 */
const RELEASES_ENDPOINT = '/api/community/github-releases';

/**
 * Session-cache keys the three release hooks own. Every story clears all of them, because
 * sessionStorage survives an iframe reload: without this a story that seeds a release
 * would keep painting it in the story after, and the "falls back" story would silently
 * stop testing the fallback.
 */
const RELEASE_CACHE_KEYS = ['yc_rel_platform_v1', 'yc_rel_pims_v1', 'yc_rel_mobile_v1'] as const;

interface RawRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
}

const RELEASE_YEAR = new Date().getFullYear();

/**
 * Built from a LOCAL-time Date rather than a `...T00:00:00Z` literal. `formatReleaseDate`
 * runs `toLocaleDateString` in the runner's zone, so a UTC literal near midnight formats
 * as a different day depending on where the test runs - and the formatted day is what
 * these stories assert.
 */
const publishedAt = (monthIndex: number, day: number): string =>
  new Date(RELEASE_YEAR, monthIndex, day, 12, 0).toISOString();

const release = (tag: string, monthIndex: number, day: number): RawRelease => ({
  tag_name: tag,
  published_at: publishedAt(monthIndex, day),
  html_url: `${GITHUB_REPO_URL}/releases/tag/${tag}`,
});

/*
  Tags follow RELEASING.md: the three prefixed lanes, plus desktop on bare semver. The
  prefix is what each hook matches on, and `toReleaseInfo` strips it before display - so
  `pims-v2.3.0-beta` has to arrive as `v2.3.0-beta` on the pill.
*/
const PIMS_RELEASE = release('pims-v2.3.0-beta', 7, 19);
const MOBILE_RELEASE = release('mobile-v1.4.2', 7, 11);
const BACKEND_RELEASE = release('backend-v3.1.0', 7, 5);
/** What GitHub's own `/releases/latest` answers for this repo: always a desktop build. */
const DESKTOP_RELEASE = release('v0.9.4', 6, 28);

/** Newest first, the order the API returns and the order the hooks depend on. */
const RELEASE_LIST: RawRelease[] = [PIMS_RELEASE, MOBILE_RELEASE, BACKEND_RELEASE, DESKTOP_RELEASE];

/** Counted per story so a variant can prove which endpoint it did NOT call. */
let listRequests = 0;
let singleRequests = 0;

/**
 * Swaps `fetch` for a canned releases API and clears the session cache first, so every
 * story starts cold and the value on screen is the one that came back over the (stubbed)
 * wire rather than a leftover. Pass `null` for either response to make that endpoint
 * fail, which is how the fallback stories are driven.
 */
const withReleases = (list: RawRelease[] | null, latest: RawRelease | null) => () => {
  listRequests = 0;
  singleRequests = 0;

  const previous = RELEASE_CACHE_KEYS.map(
    (key) => [key, globalThis.sessionStorage.getItem(key)] as const
  );
  for (const key of RELEASE_CACHE_KEYS) globalThis.sessionStorage.removeItem(key);

  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(RELEASES_ENDPOINT)) {
      const isList = url.includes('list=1');
      if (isList) {
        listRequests += 1;
      } else {
        singleRequests += 1;
      }
      const body = isList ? list : latest;
      if (!body) return Promise.resolve(new Response(null, { status: 503 }));
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
    for (const [key, value] of previous) {
      if (value === null) {
        globalThis.sessionStorage.removeItem(key);
      } else {
        globalThis.sessionStorage.setItem(key, value);
      }
    }
  };
};

/** ` · Aug 19, 2026` - the localised publish date, only ever rendered by a live variant. */
const TRAILING_DATE = /·\s[A-Z][a-z]{2} \d{1,2}, \d{4}$/;

/** What a 375px canvas leaves for content once the layout takes its 16px gutters. */
const PHONE_CONTENT_WIDTH = 343;

const meta = {
  title: 'Marketing/ReleasePill',
  component: ReleasePill,
  parameters: {
    layout: 'centered',
    // Marketing surface: the pill is drawn on the public palette, so it opts out of the
    // `data-yc-app` marker that switches the faint inks to their PIMS-scoped values.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The hero eyebrow pill, in all four of its variants. `version` is fixed marketing copy; the ' +
          'tag, the publish date and the link are resolved live from the releases API - and which ' +
          'endpoint gets called is decided entirely by `variant`.\n\n' +
          'That dispatch is the part worth pinning. Each variant mounts EXACTLY ONE release hook, so ' +
          'a mobile pill never pulls the platform list and a static pill never touches the network at ' +
          'all; the stories below assert the request counts, not just the rendered text, because a ' +
          'variant quietly fetching the wrong list looks identical on screen and shows up only as ' +
          'rate-limit failures on a busy marketing page.\n\n' +
          'The second branch nothing else documents is the fallback: until a release resolves - or ' +
          'if the request fails - the pill shows the hard-coded `version` and links to the releases ' +
          'index rather than to `/releases/latest`, which for this repo is always a desktop build.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    variant: 'latest',
    version: 'v2.0 beta',
  },
  beforeEach: withReleases(RELEASE_LIST, DESKTOP_RELEASE),
} satisfies Meta<typeof ReleasePill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Latest: Story = {
  name: 'Latest - resolved',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link');

    await waitFor(() => {
      /* The live tag replaces the marketing copy once it lands, and the link deep-links
         that exact release rather than the index. */
      expect(link).toHaveAttribute('href', DESKTOP_RELEASE.html_url);
      expect(link.textContent).toContain('v0.9.4');
    });
    await expect(link.textContent).not.toContain('v2.0 beta');

    // Fixed copy, and the only variant that carries it - `label` is ignored here.
    await expect(canvas.getByText('Latest release')).toBeInTheDocument();
    /* No date on this variant, whatever the API returned: the latest pill is a name and
       a version, and a date would push it past the hero heading's width. */
    await expect(link.textContent).not.toMatch(TRAILING_DATE);

    /* One request, to the single-release endpoint. The `?list=1` form belongs to the
       platform and mobile pills; firing both would double this page's share of an
       unauthenticated quota for no visible difference. */
    await expect(singleRequests).toBeGreaterThan(0);
    await expect(listRequests).toBe(0);

    // Opens GitHub, so the tab it opens must not keep a handle on this window.
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  },
};

export const LatestFallback: Story = {
  name: 'Latest - request failed',
  beforeEach: withReleases(null, null),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link');

    // The request went out and came back 503...
    await waitFor(() => {
      expect(singleRequests).toBeGreaterThan(0);
    });

    /* ...so the pill keeps the hard-coded copy rather than blanking, and points at the
       releases INDEX. Never `/releases/latest`: for this repo that redirects to whatever
       desktop build is newest, which would label a desktop version as the platform's. */
    await expect(link.textContent).toContain('v2.0 beta');
    await expect(link).toHaveAttribute('href', `${GITHUB_REPO_URL}/releases`);
    await expect(link.textContent).not.toMatch(TRAILING_DATE);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Also the first paint of every live variant, before the request resolves - which is why the ' +
          'fallback has to be a version someone is willing to publish, not a spinner or an empty gap.',
      },
    },
  },
};

export const Platform: Story = {
  name: 'Platform PIMS',
  args: { variant: 'platform', label: 'Platform PIMS', version: 'v2.2.0-beta' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link');

    await waitFor(() => {
      /* The `pims-` prefix is stripped: the tag is the version, and shipping the raw
         tag would put "pims-v2.3.0-beta" in the hero. */
      expect(link.textContent).toContain('v2.3.0-beta');
      expect(link).toHaveAttribute('href', PIMS_RELEASE.html_url);
    });

    await expect(canvas.getByText('Platform PIMS')).toBeInTheDocument();
    // The publish date rides along on this variant, after a middle dot.
    await expect(link.textContent).toMatch(TRAILING_DATE);

    /* The whole reason this variant exists. `/releases/latest` for this repo answers the
       DESKTOP build, so a platform pill that borrowed it would confidently show a version
       that has nothing to do with the PIMS. It picks the newest `pims-`/`pms-` tag out of
       the list instead - and never calls the single-release endpoint at all. */
    await expect(link.textContent).not.toContain('v0.9.4');
    await expect(listRequests).toBeGreaterThan(0);
    await expect(singleRequests).toBe(0);
  },
};

export const Mobile: Story = {
  name: 'Mobile app',
  args: { variant: 'mobile', label: 'Mobile app', version: 'v1.2 beta' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link');

    await waitFor(() => {
      expect(link.textContent).toContain('v1.4.2');
      expect(link).toHaveAttribute('href', MOBILE_RELEASE.html_url);
    });

    await expect(canvas.getByText('Mobile app')).toBeInTheDocument();
    await expect(link.textContent).toMatch(TRAILING_DATE);
    /* Matched on the TAG, not the title: the PIMS release sits above the mobile one in
       the same list, so a looser match would hand the mobile hero the platform version. */
    await expect(link.textContent).not.toContain('v2.3.0-beta');
    await expect(singleRequests).toBe(0);
  },
};

export const Static: Story = {
  name: 'Static - no network',
  args: {
    variant: 'static',
    label: 'Desktop app',
    version: 'v0.9.4',
    href: `${GITHUB_REPO_URL}/releases/tag/v0.9.4`,
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link');

    await expect(link.textContent).toContain('v0.9.4');
    await expect(link).toHaveAttribute('href', `${GITHUB_REPO_URL}/releases/tag/v0.9.4`);

    /* No hook, therefore no date - `release` is the empty literal, and the date span is
       additionally suppressed for this variant so a stale cache could never leak one in. */
    await expect(link.textContent).not.toMatch(TRAILING_DATE);

    /* The assertion this story is for: a static pill costs nothing. Both counters at zero
       is the only evidence of that, since a pill that fetched and ignored the answer
       renders exactly the same. */
    await expect(listRequests).toBe(0);
    await expect(singleRequests).toBe(0);
  },
};

export const Phone: Story = {
  name: 'Phone (375) - the longest pill only just fits',
  args: { variant: 'platform', label: 'Platform PIMS', version: 'v2.2.0-beta' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    /*
      The width is pinned HERE as well as through the viewport global, and that is not
      belt-and-braces. The viewport addon resizes the iframe from the MANAGER, so a story
      opened on its own - which is how the story runner opens every one of them - renders
      at the full panel width no matter what the global says. A play function measuring
      against `window.innerWidth` would quietly be measuring a 1280px canvas and pass on a
      pill twice too wide for a phone.
    */
    (Story) => (
      <div style={{ width: PHONE_CONTENT_WIDTH }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link');
    await waitFor(() => {
      expect(link.textContent).toContain('v2.3.0-beta');
    });

    /* `white-space: nowrap`, so label + version + date can only ever get wider - the pill
       has no way to break onto a second line and no way to shrink. */
    await expect(getComputedStyle(link).whiteSpace).toBe('nowrap');
    /* And it is close. The longest variant measures around 337px in a 343px phone column,
       which is roughly one extra word of headroom: this is the assertion that fires when a
       longer label, a four-part version or a wider date format finally pushes the hero
       sideways on a phone. */
    await expect(Math.ceil(link.getBoundingClientRect().width)).toBeLessThanOrEqual(
      PHONE_CONTENT_WIDTH
    );
  },
};
