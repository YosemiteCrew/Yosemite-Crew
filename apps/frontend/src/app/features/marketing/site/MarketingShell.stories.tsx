import type { CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { MarketingShell } from './MarketingShell';
/* The nav collapse lives in this sheet, not in the components: `.yc-nav-burger` is
   `display: none` inline and only the `max-width: 960px` rule here (with
   `!important`) turns it into a flex box, and the `min-width: 961px` rule is what
   takes `.yc-nav-panel` out entirely. Only `(routes)/(public)/layout.tsx` loads the
   file in the app. Without the import BOTH copies of every nav link are live at every
   width, which is exactly what the aria-current story below counts. */
import './marketing.css';
import { useAuthStore, type AuthStore } from '@/app/stores/authStore';
import { STATS_CACHE_KEY, STATS_TS_KEY } from '@/app/features/marketing/site/useGithubStats';

/**
 * Session-cache keys owned by `useGithubStats` (module-private there). The nav's star
 * pill and the footer's star CTA both read this cache, and the hook only skips its
 * `/api/community/*` refresh when the timestamp is inside the TTL AND `discord` is
 * already a string - a missing discord value forces a refresh on its own. Seeding both
 * keeps two requests off the Storybook dev server on every mount.
 */

const CACHED_STATS = {
  stars: '2.4k',
  starsFull: '2,431',
  repositoryClones: '67,134',
  contributors: '128',
  discord: '3,182',
};

const OPENSTATUS_HOST = 'openstatus.dev';

type AuthSeed = Pick<AuthStore, 'status' | 'user' | 'role'>;

const SIGNED_OUT: AuthSeed = { status: 'unauthenticated', user: null, role: null };

/**
 * Everything the shell's two live children reach for, seeded rather than mocked.
 *
 * The auth seed is the least obvious and the most important. `useLazyAuthSlice` starts
 * on an `idle` fallback and SiteNav answers `idle` by firing `ensureSessionChecked()`;
 * that helper re-reads `useAuthStore.getState().status` and returns immediately unless
 * it is still `idle`. A store seeded to a settled status is therefore what keeps the
 * SuperTokens session check off the wire, with no module stub anywhere.
 *
 * `fetch` is swapped because SiteFooter asks api.openstatus.dev for the platform status
 * on mount and colours its pill from the answer - left alone, the footer in these
 * stories would report however the real platform happened to be doing.
 *
 * `yc_default_open_screen` is cleared because `resolveDefaultOpenScreenRoute` prefers a
 * saved route over the role default, so a value left behind by another story would
 * change where the nav's primary CTA points.
 *
 * The scroll reset in the teardown matters for the Scrolled story: the preview iframe
 * is shared between stories, so leaving the window at 600px would hand the next story
 * a nav already wearing its scrolled glass.
 */
const seed = () => () => {
  const previousAuth: AuthSeed = {
    status: useAuthStore.getState().status,
    user: useAuthStore.getState().user,
    role: useAuthStore.getState().role,
  };
  const originalFetch = globalThis.fetch;

  useAuthStore.setState(SIGNED_OUT);
  globalThis.sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(CACHED_STATS));
  globalThis.sessionStorage.setItem(STATS_TS_KEY, String(Date.now()));
  globalThis.localStorage.removeItem('yc_default_open_screen');

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes(OPENSTATUS_HOST)) {
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'operational' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return originalFetch.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = originalFetch;
    useAuthStore.setState(previousAuth);
    globalThis.sessionStorage.removeItem(STATS_CACHE_KEY);
    globalThis.sessionStorage.removeItem(STATS_TS_KEY);
    globalThis.window.scrollTo(0, 0);
  };
};

const rootOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-yc-theme]') as HTMLElement;

const mainOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('#main-content') as HTMLElement;

const headerOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('header[data-nav="true"]') as HTMLElement;

const siteFooterOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-yc-footer="true"]');

/* The pages this shell wraps all start with a band that clears the fixed 72px nav
   themselves - the shell adds no top padding - so the stand-in content does too. */
const BAND_STYLE: CSSProperties = {
  width: 'min(1240px, calc(100% - 48px))',
  margin: '0 auto',
  padding: '140px 0 96px',
};

const HEADING_STYLE: CSSProperties = {
  fontSize: 44,
  fontWeight: 500,
  letterSpacing: '-0.03em',
  margin: 0,
};

const BODY_STYLE: CSSProperties = { marginTop: 16, maxWidth: 620, color: 'var(--ink-muted)' };

const DemoPage = ({ children }: Readonly<{ children?: ReactNode }>) => (
  <section style={BAND_STYLE}>
    <h2 style={HEADING_STYLE}>Everything the clinic runs on</h2>
    <p style={BODY_STYLE}>
      Stand-in page content. The shell owns the chrome around it and nothing else, so the only thing
      this band has to do is be a recognisable child of the main landmark.
    </p>
    {children}
  </section>
);

/**
 * A page that ships its own closing footer - the case `hideFooter` exists for. The
 * footer is inside the landmark here, which is why the story can count `<footer>`
 * elements and get one rather than two stacked ones.
 */
const SelfFooteredPage = () => (
  <DemoPage>
    <footer
      data-demo-footer="true"
      style={{ marginTop: 64, paddingTop: 24, borderTop: '1px solid var(--hairline)' }}
    >
      This page draws its own closing band.
    </footer>
  </DemoPage>
);

/**
 * Tall enough that the window actually scrolls, and carrying one `[data-scroll-speed]`
 * layer so ScrollDrift has something to move. Both are prerequisites for the Scrolled
 * story: the shell is the only place ScrollProgress and ScrollDrift are mounted, and a
 * page with nothing to scroll would let either quietly stop working.
 */
const TallDemoPage = () => (
  <section style={{ ...BAND_STYLE, position: 'relative', minHeight: 2400 }}>
    <div
      aria-hidden="true"
      data-scroll-speed="-0.05"
      style={{
        position: 'absolute',
        top: 80,
        left: '8%',
        width: 420,
        height: 420,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, var(--blue), transparent 70%)',
        opacity: 0.22,
        pointerEvents: 'none',
      }}
    />
    <h2 style={HEADING_STYLE}>Everything the clinic runs on</h2>
    <p style={BODY_STYLE}>
      Two thousand four hundred pixels of stand-in content, so the progress bar has a travel to
      report and the ambient glow above has somewhere to drift to.
    </p>
  </section>
);

const meta = {
  title: 'Marketing/MarketingShell',
  component: MarketingShell,
  parameters: {
    layout: 'fullscreen',
    // Marketing surface: without this the preview decorator stamps `data-yc-app` on the
    // story wrapper, which swaps the faint inks for the PIMS-scoped values. Every public
    // page is drawn against the marketing palette.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The chrome every public marketing page mounts: the fixed nav, the `#main-content` ' +
          'landmark the skip link targets, the shared footer, and the two scroll-linked ' +
          'behaviours - `ScrollProgress` and `ScrollDrift` - that are wired here and nowhere ' +
          'else.\n\n' +
          'Almost everything this component owns fails silently. `tabIndex={-1}` on the main is ' +
          'the entire mechanism behind the skip link: drop it and the link still jumps the ' +
          'viewport, it just never moves focus, which only a keyboard user ever finds out. ' +
          '`overflow-x: clip` is deliberately not `hidden`, because `hidden` would make the ' +
          'landmark a scroll container and break every sticky descendant on every public page. ' +
          '`ScrollDrift` renders nothing at all, so losing it looks like nothing rather than ' +
          'like a bug. The stories below assert those contracts rather than the copy.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    children: <DemoPage />,
    active: 'pet-businesses',
  },
  argTypes: {
    active: {
      control: 'select',
      options: ['pet-businesses', 'pet-parents', 'developers', 'pricing', 'contact', 'about'],
    },
  },
  decorators: [
    /*
      The nav header and the progress bar are both `position: fixed`. A transform on this
      wrapper makes it their containing block, so they pin to this box instead of to the
      browser viewport - otherwise the docs page would stack one header per story at the
      top of the screen. The trade is that they scroll away with the page here where they
      would stay put in the app; the scroll-linked STATE is unaffected, because both read
      `window.scrollY` rather than their own position. Width is left at 100% on purpose:
      the media query that decides burger-vs-rail reads the VIEWPORT, so narrowing this
      box would decouple what is drawn from what is asserted.
    */
    (Story) => (
      <div
        style={{
          position: 'relative',
          transform: 'translateZ(0)',
          minHeight: 640,
          width: '100%',
        }}
      >
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof MarketingShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Full public chrome',
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    const main = mainOf(canvasElement);
    const header = headerOf(canvasElement);

    /* Four element children, in this order: the progress bar, the nav, the landmark,
       the footer. `ScrollDrift` is the fifth thing mounted and renders null, so it is
       deliberately absent from this count - which is also why a story cannot check for
       it by looking, and why the Scrolled story has to make it move instead. */
    await expect(root.children).toHaveLength(4);
    const bar = root.children[0] as HTMLElement;
    await expect(root.children[1]).toBe(header);
    await expect(root.children[2]).toBe(main);
    await expect(root.children[3]).toBe(siteFooterOf(canvasElement));

    /* The skip-link target. `#main-content` is only useful if it can take focus, and
       `tabIndex={-1}` is the whole mechanism - drop it and `href="#main-content"` moves
       the viewport without moving focus, the failure mode nobody sees with a mouse. */
    await expect(main.tagName).toBe('MAIN');
    await expect(main.tabIndex).toBe(-1);
    main.focus();
    await expect(main).toHaveFocus();

    /* The other half of a working skip link, and it lives in globals.css rather than
       here: the nav is 72px of fixed chrome, so a jump with no scroll margin lands with
       the first line of the page underneath it. */
    await expect(getComputedStyle(main).scrollMarginTop).toBe('96px');

    /* `clip`, never `hidden`. Both stop the horizontal scroll the public pages are prone
       to, but `hidden` also makes the landmark a scroll container, which takes every
       `position: sticky` descendant on every public page with it. The overflow-y read is
       the one that actually catches the swap: `clip` leaves it `visible`, `hidden` would
       compute it to `auto`. */
    await expect(main).toHaveClass('yc-public-page');
    await expect(getComputedStyle(main).overflowX).toBe('clip');
    await expect(getComputedStyle(main).overflowY).toBe('visible');

    // The page content goes INSIDE the landmark, not beside it.
    const heading = within(canvasElement).getByRole('heading', {
      level: 2,
      name: 'Everything the clinic runs on',
    });
    await expect(main.contains(heading)).toBe(true);

    /* The progress bar is decoration and is kept out of the accessibility tree, but it
       has to paint OVER the nav glass - it is a 2px sliver at the very top of the
       viewport and the nav sits in the same 2px. Asserted as a relation, because both
       z-indexes are arbitrary numbers that may move together. */
    await expect(bar).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(bar).height).toBe('2px');
    await expect(getComputedStyle(bar).position).toBe('fixed');
    await expect(Number(getComputedStyle(bar).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(header).zIndex)
    );

    /* `data-yc-theme` is the marketing token scope. Its one job in globals.css is
       `color-scheme`, which is what makes native scrollbars and form controls match the
       public palette instead of the OS default. */
    await expect(getComputedStyle(root).colorScheme).toBe('light');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The shell as every marketing page mounts it. The nav is transparent at rest - it only ' +
          'takes its glass once the page moves under it - and the progress bar is 0% wide, so at ' +
          'the top of a page neither is visible at all.',
      },
    },
  },
};

export const CurrentPage: Story = {
  name: 'The current page is announced once',
  args: { active: 'developers' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Exactly one link announces itself as the current page. This is the assertion that
       matters: `active` is threaded from the page through the shell into SiteNav, and a
       shell that dropped the prop would render an entirely correct-looking nav with no
       current-page marker at all. */
    const current = canvas.getAllByRole('link', { current: 'page' });
    await expect(current).toHaveLength(1);
    await expect(current[0]).toHaveAttribute('href', '/developers');
    await expect(current[0]).toHaveTextContent('Developers');

    /* Two anchors carry the attribute, though - the desktop rail's copy and the burger
       panel's, because the panel is always mounted for its slide transition. Above 960px
       marketing.css takes the panel out with `display: none`, which is what keeps the
       second copy out of the accessibility tree. If this ever reads 1, the panel stopped
       honouring `active`; if the role query above ever reads 2, the media query stopped
       applying. */
    await expect(canvasElement.querySelectorAll('a[aria-current="page"]')).toHaveLength(2);

    /* The footer links to /developers as well and must NOT be marked. Only the nav knows
       which page it is on, and aria-current on a footer link would announce the current
       page twice in two different landmarks. */
    const footer = siteFooterOf(canvasElement) as HTMLElement;
    await expect(within(footer).getByRole('link', { name: 'Developers' })).not.toHaveAttribute(
      'aria-current'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Switch `active` in the controls to move the marker. The tinted pill is the visible ' +
          'half; `aria-current="page"` is the half that carries it to a screen reader, and it is ' +
          'the only one of the two that can break without anyone noticing.',
      },
    },
  },
};

export const OwnFooter: Story = {
  name: 'A page that brings its own footer',
  args: { hideFooter: true, children: <SelfFooteredPage /> },
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    const main = mainOf(canvasElement);

    // Three children now: progress bar, nav, landmark. Nothing after the landmark.
    await expect(root.children).toHaveLength(3);
    await expect(siteFooterOf(canvasElement)).toBeNull();

    /* The point of the branch: exactly one footer on the page, and it is the page's own
       inside the landmark. A shell that ignored `hideFooter` would stack the shared
       footer under a closing band that already says goodbye. */
    const footers = canvasElement.querySelectorAll('footer');
    await expect(footers).toHaveLength(1);
    await expect(footers[0]).toHaveAttribute('data-demo-footer', 'true');
    await expect(main.contains(footers[0])).toBe(true);

    // The rest of the chrome is untouched - this hides the footer, not the shell.
    await expect(headerOf(canvasElement)).toBeInTheDocument();
    await expect(main.tabIndex).toBe(-1);
    await expect(within(canvasElement).getAllByRole('link', { name: 'Pricing' })).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          '`hideFooter` is for the pages that end in their own closing band - the shared footer ' +
          'underneath it would be a second goodbye. Everything else about the shell stays, ' +
          'including the landmark and its focus behaviour.',
      },
    },
  },
};

export const Scrolled: Story = {
  name: 'Scrolled: progress, nav glass and drift',
  args: { children: <TallDemoPage /> },
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    const bar = root.children[0] as HTMLElement;
    const header = headerOf(canvasElement);
    const glow = canvasElement.querySelector('[data-scroll-speed]') as HTMLElement;

    // At rest: no progress, no glass, and ScrollDrift has not touched the layer.
    await expect(bar.getBoundingClientRect().width).toBe(0);
    await expect(header.style.background).toBe('transparent');
    await expect(glow.style.transform).toBe('');

    globalThis.window.scrollTo(0, 600);

    /* The bar is the only readout a visitor has for how far down a long marketing page
       they are, and it is driven by a listener the shell installs. Asserted as growth
       rather than as a percentage: the exact figure depends on how tall the stand-in
       content renders, but zero-to-nonzero is the whole behaviour. */
    await waitFor(() => {
      expect(bar.getBoundingClientRect().width).toBeGreaterThan(0);
    });
    await expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(
      root.getBoundingClientRect().width
    );

    /* `useScrolled` flips past 8px and the nav trades transparency for glass. Polled,
       because the background sits on a 300ms ease - a synchronous read here lands
       part-way through the fade. The inline value is the mapping; the computed read
       underneath is what catches a token that no longer resolves, which would leave a
       transparent bar over scrolling content. */
    await waitFor(() => {
      expect(header.style.background).toBe('var(--nav-glass)');
    });
    await waitFor(() => {
      expect(getComputedStyle(header).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    });
    await expect(getComputedStyle(header).borderBottomColor).not.toBe('rgba(0, 0, 0, 0)');

    /* ScrollDrift renders null, so this is the only way to prove it is mounted. It
       stamps a transform on every `[data-scroll-speed]` layer on the page; if it were
       dropped from the shell, every ambient glow on every public page would simply stop
       moving, with no error and nothing missing from the DOM. */
    await waitFor(() => {
      /* Matched loosely on the operands because the browser reserialises what
         ScrollDrift wrote: it sets `translate3d(0, 38.0px, 0)` and reading it back
         gives `translate3d(0px, 38px, 0px)`. Pinning the source spelling passes in
         jsdom and fails in every real engine. */
      expect(glow.style.transform).toMatch(/^translate3d\(0(px)?, -?\d+(\.\d+)?px, 0(px)?\)$/);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Six hundred pixels down a tall page. Three things the shell alone is responsible for ' +
          'have changed: the progress bar has a width, the nav has taken its glass, and the ' +
          'ambient glow has been given a scroll-linked transform. None of the three has a home ' +
          'anywhere else, and two of them are invisible in a static snapshot.',
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
          'Below 960px the nav rail and the desktop CTA cluster are replaced by the burger, and ' +
          'below 900px / 700px the footer collapses its columns and stacks its bottom rows. All ' +
          'of it is viewport media queries in `marketing.css`, applied by the Storybook manager ' +
          'rather than by anything inside the frame - so this story carries no play function on ' +
          'purpose. A headless render of the preview iframe would assert the desktop layout ' +
          'under a phone-shaped name. The panel itself, opened and closed, is covered by the ' +
          'SiteNav stories.',
      },
    },
  },
};
