import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { SiteNav } from './SiteNav';
import { STATS_CACHE_KEY, STATS_TS_KEY } from './useGithubStats';
// The collapse is pure CSS and it lives in this sheet, not in the component:
// `.yc-nav-burger` carries `display: none` as an INLINE style, and only the
// `max-width: 960px` rule here (with `!important`, which is what lets it beat the
// inline value) turns it into a flex box. The same media query hides
// `.yc-nav-links` / `.yc-nav-cta`, and the `min-width: 961px` rule hides
// `.yc-nav-panel` outright. Only `(routes)/(public)/layout.tsx` loads this file, so
// without the import the burger can never be clicked, the panel is present at every
// width, and a story would sit there proving nothing.
import './marketing.css';
import { useAuthStore, type AuthStore, type AuthUser } from '@/app/stores/authStore';

/**
 * Seeding the session cache makes `isStatsCacheFresh()` true AND gives `discord` a
 * string, which are the two conditions that keep the hook's effect from firing its
 * `/api/community/*` fetches. Without it the nav renders a bare star with no count
 * and fires two requests at the Storybook dev server on every mount.
 *
 * The keys are imported from the hook rather than restated. They were copied here
 * as literals, and when the hook bumped them v1 -> v2 this file kept seeding v1:
 * the hook then read an empty cache and the star lost its count, which presented
 * as "the live star count drifted past the assertion" rather than as a broken seed.
 */

const CACHED_STATS = {
  stars: '2.4k',
  starsFull: '2,431',
  repositoryClones: '67,134',
  contributors: '128',
  discord: '3,182',
};

const STAFF_USER: AuthUser = {
  userId: 'user-storybook',
  email: 'elena@harboursidevet.com',
  authProfile: 'emailpassword',
  loginMethod: 'emailpassword',
  emailVerified: true,
  getUsername: () => 'user-storybook',
};

type AuthSeed = Pick<AuthStore, 'status' | 'user' | 'role'>;

const SIGNED_OUT: AuthSeed = { status: 'unauthenticated', user: null, role: null };
const SIGNED_IN: AuthSeed = { status: 'authenticated', user: STAFF_USER, role: 'owner' };

/**
 * Seeds the two real sources the nav reads, rather than mocking either module.
 *
 * The auth seed matters more than it looks: `useLazyAuthSlice` starts on the `idle`
 * fallback, and SiteNav answers `idle` by firing `ensureSessionChecked()`. That helper
 * re-reads `useAuthStore.getState().status` and returns immediately unless it is still
 * `idle` - so a store seeded to a settled status is what keeps the SuperTokens session
 * check off the wire, with no stub anywhere.
 *
 * `yc_default_open_screen` is cleared because `resolveDefaultOpenScreenRoute` prefers a
 * saved route over the role default, and a value left in localStorage by any other
 * story would silently change the "Go to app" target asserted below.
 */
const seed = (auth: AuthSeed = SIGNED_OUT) => {
  return () => {
    const previousAuth: AuthSeed = {
      status: useAuthStore.getState().status,
      user: useAuthStore.getState().user,
      role: useAuthStore.getState().role,
    };
    useAuthStore.setState(auth);
    globalThis.sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(CACHED_STATS));
    globalThis.sessionStorage.setItem(STATS_TS_KEY, String(Date.now()));
    globalThis.localStorage.removeItem('yc_default_open_screen');

    return () => {
      useAuthStore.setState(previousAuth);
      globalThis.sessionStorage.removeItem(STATS_CACHE_KEY);
      globalThis.sessionStorage.removeItem(STATS_TS_KEY);
    };
  };
};

const NAV_LABELS = [
  'Pet Businesses',
  'Pet Parents',
  'Developers',
  'Pricing',
  'Contact',
  'About',
] as const;

const panelOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('.yc-nav-panel') as HTMLElement;

const burgerOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('button', { name: /menu$/ });

const meta = {
  title: 'Marketing/SiteNav',
  component: SiteNav,
  parameters: {
    layout: 'fullscreen',
    // Marketing surface: without this the preview decorator stamps `data-yc-app` on
    // the story wrapper, which switches the faint inks to the PIMS-scoped values.
    // The nav is drawn against the marketing palette, so it opts out.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The public site header, and specifically **the burger panel inside it**, which had never ' +
          'been drawn. `MobilePanel` is module-private and takes no props a story could set, so it ' +
          'is driven through the exported `SiteNav` - the same way a visitor reaches it.\n\n' +
          'Two things make this surface easy to get wrong in Storybook. The collapse is decided by a ' +
          '**viewport** media query in `marketing.css`, not by a container query and not by the ' +
          'component, so a story has to import that sheet AND pin the viewport global; a story that ' +
          'does neither renders the desktop nav under a phone-shaped name. And the panel is **always ' +
          'mounted** - it stays in the DOM at opacity 0 for the 260ms slide - so "is it closed?" can ' +
          'only be answered by `inert` / `aria-hidden` / computed opacity, never by absence.\n\n' +
          'The stories below therefore assert reachability rather than presence: closed, the six nav ' +
          'links are in the DOM but out of the accessibility tree; open, they are back; and above ' +
          '960px the panel is `display: none` so it contributes nothing at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: { active: 'pricing' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    /*
      The header and the panel are both `position: fixed`. A transform on this
      wrapper makes it their containing block, so they pin to this box instead of
      the browser viewport - otherwise every story on the docs page would stack its
      header on top of the last one at the top of the screen. Width is left at 100%
      on purpose: the media query that decides burger-vs-links reads the VIEWPORT,
      so narrowing this box would decouple what is drawn from what is asserted.
    */
    (Story) => (
      <div
        style={{
          position: 'relative',
          transform: 'translateZ(0)',
          minHeight: 520,
          width: '100%',
          background: 'var(--page)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof SiteNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Phone - collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const burger = burgerOf(canvasElement);

    /* Proves the stylesheet is actually loaded. `BURGER_BUTTON_STYLE` sets
       `display: none` inline, so this reads `none` - and every interaction story
       below fails on an unclickable button - the moment the marketing.css import
       goes missing. */
    await expect(getComputedStyle(burger).display).toBe('flex');
    await expect(burger).toHaveAccessibleName('Open menu');
    await expect(burger).toHaveAttribute('aria-expanded', 'false');

    const panel = panelOf(canvasElement);
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(panel.hasAttribute('inert')).toBe(true);
    await expect(getComputedStyle(panel).pointerEvents).toBe('none');
    await waitFor(() => {
      expect(getComputedStyle(panel).opacity).toBe('0');
    });

    /* Mounted but unreachable, which is the whole contract. The eight anchors are
       in the DOM; none of them is in the accessibility tree, because the panel is
       `aria-hidden` and the desktop rail is `display: none` at this width. A story
       that only asserted "the link exists" would pass on a panel that never
       closed. */
    await expect(panel.querySelectorAll('a')).toHaveLength(8);
    for (const label of NAV_LABELS) {
      await expect(canvas.queryAllByRole('link', { name: label })).toHaveLength(0);
    }
    await expect(canvas.queryByRole('link', { name: 'Get started' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting phone header: logo, burger, nothing else. The header itself is transparent ' +
          'until `useScrolled` reports a scroll, so at rest there is no glass and no border - the ' +
          'tint and blur only appear once the page moves under it.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Phone - burger panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const burger = burgerOf(canvasElement);
    const panel = panelOf(canvasElement);

    await userEvent.click(burger);

    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    await expect(burger).toHaveAccessibleName('Close menu');
    await expect(panel.hasAttribute('inert')).toBe(false);
    /* `aria-hidden="false"`, not an absent attribute: React writes aria-* booleans
       out literally, so the attribute is always there and only its value moves.
       Asserting absence here would fail on a correctly opened panel. */
    await expect(panel).toHaveAttribute('aria-hidden', 'false');

    // Polled: opacity and transform are on a 260ms ease, so a single synchronous
    // read here catches an interpolated value part-way through the slide.
    await waitFor(() => {
      expect(getComputedStyle(panel).opacity).toBe('1');
      expect(getComputedStyle(panel).transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
    });

    /* Nine accessible links: the logo plus the panel's eight. The desktop rail and
       the desktop CTA cluster are `display: none` at this width, so if this ever
       reads 17 the media query has stopped applying and both sets are live. */
    await expect(canvas.getAllByRole('link')).toHaveLength(9);
    for (const label of NAV_LABELS) {
      await expect(canvas.getByRole('link', { name: label })).toBeInTheDocument();
    }
    await expect(canvas.getByRole('link', { name: 'Star on GitHub' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Get started' })).toBeInTheDocument();

    /* Six links, a hairline rule, the GitHub row, then the CTA row: nine children in
       the flex column. The CTA row is the only one that is not full width - it pairs
       the primary with the theme toggle. */
    await expect(panel.children).toHaveLength(9);
    await expect(getComputedStyle(panel).flexDirection).toBe('column');
    const ctaRow = panel.children[8] as HTMLElement;
    await expect(ctaRow.children).toHaveLength(2);
    await expect(
      within(ctaRow).getByRole('button', { name: /Switch to (light|dark) theme/ })
    ).toBeInTheDocument();

    // `active` is honoured inside the panel too, not only on the desktop rail: the
    // current page is the one link tinted --nav-active.
    const pricing = canvas.getByRole('link', { name: 'Pricing' });
    const about = canvas.getByRole('link', { name: 'About' });
    await expect(pricing).toHaveAttribute('aria-current', 'page');
    await expect(about).not.toHaveAttribute('aria-current');
    await waitFor(() => {
      expect(getComputedStyle(pricing).color).not.toBe(getComputedStyle(about).color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel a phone visitor actually sees: a floating 24px card inset 12px from both edges ' +
          'and dropped 78px from the top, on `--glass-93` behind a 40px blur. The links are 17px ' +
          'here against 15px on the desktop rail, which is the only place that size exists.',
      },
    },
  },
};

export const OpenSignedIn: Story = {
  name: 'Phone - open, signed in',
  beforeEach: seed(SIGNED_IN),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = panelOf(canvasElement);
    await userEvent.click(burgerOf(canvasElement));

    /* The panel's primary is the one thing in it that depends on session state, and
       the route depends on the role: `owner` resolves to /dashboard, everyone else
       to /appointments. Asserting the href is the point - "Go to app" pointing at
       the wrong screen looks identical in a snapshot. */
    const goToApp = await canvas.findByRole('link', { name: 'Go to app' });
    await expect(goToApp).toHaveAttribute('href', '/dashboard');
    await expect(canvas.queryByRole('link', { name: 'Get started' })).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('link')).toHaveLength(9);

    /* Same shape as signed out - nine children, and the CTA row still pairs the
       primary with the theme toggle. The session swaps ONE link in place; a story
       that only checked "Go to app" is present would pass just as happily on a
       panel that had grown a tenth row or lost the toggle. */
    await expect(panel.children).toHaveLength(9);
    const ctaRow = panel.children[8] as HTMLElement;
    await expect(ctaRow.children).toHaveLength(2);
    await expect(ctaRow.children[0]).toBe(goToApp);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Signed in. Public pages never bootstrap the session check on their own, so the nav kicks ' +
          'it off itself and swaps "Get started" for "Go to app" once it resolves - the store is ' +
          'seeded to a settled status here, which is exactly the condition that makes ' +
          '`ensureSessionChecked` return without touching the network.',
      },
    },
  },
};

export const ClosesOnEscape: Story = {
  name: 'Phone - closes on Escape',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const burger = burgerOf(canvasElement);
    const panel = panelOf(canvasElement);

    await userEvent.click(burger);
    await expect(canvas.getByRole('link', { name: 'Pricing' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(panel.hasAttribute('inert')).toBe(true);
    await waitFor(() => {
      expect(getComputedStyle(panel).opacity).toBe('0');
    });
    // Back out of the accessibility tree, not merely faded: the panel is still
    // mounted and its anchors are still in the DOM.
    await expect(canvas.queryByRole('link', { name: 'Pricing' })).not.toBeInTheDocument();
    await expect(panel.querySelectorAll('a')).toHaveLength(8);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Escape is bound to `window` by `useEscapeToClose`, and only while the panel is open - ' +
          'there is no focus trap and no dismissable scrim, so the key handler is the whole ' +
          'keyboard exit.',
      },
    },
  },
};

export const Desktop: Story = {
  name: 'Desktop - panel suppressed',
  globals: { viewport: { value: 'laptop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = panelOf(canvasElement);

    // Above 960px the panel is `display: none !important`, so it is not merely
    // transparent - it draws nothing and contributes nothing to the a11y tree.
    await expect(getComputedStyle(panel).display).toBe('none');
    /* Queried by class, not by role: the burger is `display: none` here, which
       takes it out of the accessibility tree, so a role query would throw before
       reaching the assertion it was meant to make. */
    const burger = canvasElement.querySelector('.yc-nav-burger') as HTMLElement;
    await expect(getComputedStyle(burger).display).toBe('none');

    /* Exactly one accessible link per label. Both copies of every nav item exist at
       every width - the rail's and the panel's - so a broken media query shows up
       here as a duplicate rather than as a visual difference. */
    for (const label of NAV_LABELS) {
      await expect(canvas.getAllByRole('link', { name: label })).toHaveLength(1);
    }
    // "Star" and the count are separate spans, so the accessible name is the two
    // joined - matched loosely on the count, which is the part the seed controls.
    await expect(canvas.getByRole('link', { name: /Star .*2\.4k/ })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Get started' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same component above the 960px breakpoint, included because it is what proves the ' +
          'panel never leaks onto desktop. The star count comes from the session cache the stats ' +
          'hook reads, which is seeded here, so the number is stable rather than whatever GitHub ' +
          'last answered.',
      },
    },
  },
};
