import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';
import DeveloperPlugins from './DeveloperPlugins';

/**
 * Seeds the auth store and restores the previous state on unmount, so a seeded
 * role cannot leak into the next story.
 *
 * `DevRouteGuard` wraps the whole page and renders NOTHING while status is
 * `idle`/`checking`, so the status matters as much as the role - an unseeded
 * store leaves this an empty canvas rather than a failing story. The page itself
 * reads no store at all; every branch below belongs to the guard.
 */
const withSession = (status: string, role: string | null) => () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({ status: status as never, role });
  return () => {
    useAuthStore.setState({ status: snapshot.status, role: snapshot.role });
  };
};

/**
 * sRGB relative luminance from a computed `rgb()`/`rgba()` string.
 *
 * Used instead of comparing colour strings because the claims worth making here
 * are about DARKNESS - "the promo panel is an always-dark island", "no surface
 * on this page stayed light when the shell went dark" - and a hex comparison
 * would need rewriting every time a token is retuned by a shade.
 *
 * Alpha is deliberately ignored rather than composited, so this may only be
 * pointed at OPAQUE backgrounds. `.dev-plugin-card-icon` is a 13% tint and is
 * checked for its alpha instead, further down.
 */
const luminance = (colour: string) => {
  const parts = colour.match(/[\d.]+/g);
  if (!parts || parts.length < 3) throw new Error(`Unparseable colour: ${colour}`);
  const [r, g, b] = parts.slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Throws rather than returning null, so a renamed class fails at the query. */
const must = (root: HTMLElement, selector: string) => {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`${selector} did not render.`);
  return el as HTMLElement;
};

const box = (root: HTMLElement, selector: string) => must(root, selector).getBoundingClientRect();

const alphaOf = (colour: string) => {
  const parts = colour.match(/[\d.]+/g) ?? [];
  return parts.length < 4 ? 1 : Number(parts[3]);
};

/* ------------------------------------------------------------------------- *
 * Responsive assertions.
 *
 * The viewport pinned in `globals` is applied by the MANAGER resizing the
 * preview iframe. The headless verifier loads `iframe.html` directly, so there
 * is no manager and `innerWidth` is whatever the runner's browser is - a play
 * function hard-coding 375px fails there, and one hard-coding the desktop
 * numbers is wrong in the Storybook UI. Both helpers therefore evaluate the
 * CSS RULE against the width actually rendered, which is true either way and
 * still fails if the rule itself changes.
 * ------------------------------------------------------------------------- */

/** `auto-fit` leaves a collapsed `0px` track behind, so filter before counting. */
const trackCount = (grid: HTMLElement) =>
  getComputedStyle(grid)
    .gridTemplateColumns.split(' ')
    .filter((track) => Number.parseFloat(track) > 0).length;

/**
 * `.dev-plugins-grid` is `repeat(auto-fit, minmax(260px, 1fr))` with a 16px gap
 * and exactly three fixtures, so the column count is arithmetic off the measured
 * width - and the three cards must then land on that many left edges and the
 * matching number of rows. Checking both directions is what separates "one
 * column" from "one row of three that happen to be narrow".
 */
const assertGridTracks = async (canvasElement: HTMLElement) => {
  const grid = must(canvasElement, '.dev-plugins-grid');
  const width = grid.getBoundingClientRect().width;
  const expected = Math.min(3, Math.max(1, Math.floor((width + 16) / (260 + 16))));
  await expect(trackCount(grid)).toBe(expected);

  const cards = [...canvasElement.querySelectorAll('.dev-plugin-card')].map((card) =>
    card.getBoundingClientRect()
  );
  await expect(cards).toHaveLength(3);
  await expect(new Set(cards.map((c) => Math.round(c.left))).size).toBe(expected);
  await expect(new Set(cards.map((c) => Math.round(c.top))).size).toBe(Math.ceil(3 / expected));
};

/**
 * `.dev-website-card` is a row with the browser mock capped at 460px, and flips
 * to a stretched column at 900px - a breakpoint it shares with nothing else on
 * the page. Both halves of that rule are asserted, because a panel that stacked
 * without releasing the cap leaves a 460px browser window floating in the middle
 * of the card and reads as a rendering fault rather than a design.
 */
const assertPromoLayout = async (canvasElement: HTMLElement) => {
  const card = must(canvasElement, '.dev-website-card');
  const style = getComputedStyle(card);
  const inner =
    card.getBoundingClientRect().width -
    Number.parseFloat(style.paddingLeft) -
    Number.parseFloat(style.paddingRight);
  const copy = box(canvasElement, '.dev-website-copy');
  const preview = box(canvasElement, '.dev-site-preview');

  if (globalThis.window.innerWidth <= 900) {
    await expect(copy.bottom).toBeLessThanOrEqual(preview.top + 1);
    await expect(Math.round(preview.width)).toBe(Math.round(inner));
  } else {
    await expect(preview.top).toBeLessThan(copy.bottom);
    await expect(preview.width).toBeLessThanOrEqual(460);
    await expect(preview.width).toBeLessThan(inner);
  }
};

const meta = {
  title: 'Developers/DeveloperPlugins',
  component: DeveloperPlugins,
  parameters: {
    layout: 'fullscreen',
    // The guard reads `usePathname` and can call `redirect`; both need the App
    // Router mock, and the pathname has to start with `/developers` or the guard
    // waves everything through without ever checking the role.
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/plugins' } },
    docs: {
      description: {
        component:
          'The plugin catalog, and the only page in the developer portal that is entirely ' +
          'hard-coded: `PLUGINS` is a module-level array of three fixtures, so there is no ' +
          'loading, empty or error state to draw. The page says as much itself, in the ' +
          '"Preview · the plugin catalog and submission flow are coming soon" pill.\n\n' +
          'Worth knowing before reading the stories: **none of the plugin cards are ' +
          'interactive**. "Manage" and "Review status" are bare `<span>`s in the accent ink, so ' +
          'they read as links, cannot be tabbed to, and do nothing when clicked. The only three ' +
          'real controls on the page are "Submit a plugin" (to `/contact-us`) and the two ' +
          'website-builder CTAs, which share a single destination.\n\n' +
          'The lower half is a promo panel painted from `--spot`, the always-dark token, holding ' +
          'a hand-built browser-chrome mock - three dots, a URL pill and a miniature clinic ' +
          'homepage. The mock is drawn from ordinary elements rather than shipped as an image, ' +
          'so it has to be reviewed in both themes and at both breakpoints: it reflows at 900px, ' +
          'a wider width than anything else on this page uses.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: withSession('authenticated', 'developer'),
} satisfies Meta<typeof DeveloperPlugins>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
  name: 'Catalog (signed-in developer)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Level 1 is qualified by name: the preview decorator injects its own
    // sr-only <h1> carrying "{title} - {story name}", which makes an unqualified
    // level-1 query ambiguous on every story in this repo.
    await expect(canvas.getByRole('heading', { level: 1, name: 'Plugins' })).toBeInTheDocument();

    /* The three fixtures, in order. Reading the h2s as a list pins the order too,
       which a per-title `getByText` would not: the in-review card is deliberately
       last so the two installed ones lead. */
    const titles = canvas.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    await expect(titles).toEqual(['IDEXX lab bridge', 'MSD Vet Manual', 'Anesthesia monitor sync']);

    /* The badge is one element whose STATUS lives only in a class name, and that
       class is the only thing choosing between the completed and in-progress
       token triples. Drop it and the badge still reads correctly while being
       silently the wrong colour, so the computed background is compared rather
       than the class alone. */
    const badges = [...canvasElement.querySelectorAll('.dev-plugin-badge')] as HTMLElement[];
    await expect(badges.map((b) => b.textContent)).toEqual([
      'Installed · 412 clinics',
      'Installed · 1,208 clinics',
      'In review',
    ]);
    await expect(badges[0]).toHaveClass('installed');
    await expect(badges[2]).toHaveClass('in-review');
    await expect(getComputedStyle(badges[0]).backgroundColor).not.toBe(
      getComputedStyle(badges[2]).backgroundColor
    );

    /* The finding this page is worth reviewing for. Every card ends in an
       accent-inked word that looks exactly like a link, and every one of them is
       a `<span>`: the grid contains no anchor, no button and nothing focusable at
       all. A keyboard user tabs straight past all three. */
    const grid = must(canvasElement, '.dev-plugins-grid');
    const actions = [...grid.querySelectorAll('.dev-plugin-card-action')];
    await expect(actions.map((a) => a.textContent)).toEqual(['Manage', 'Manage', 'Review status']);
    await expect(grid.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);

    /* So the whole page carries exactly three controls, and two of them go to the
       same place. "See templates" is not a different destination from "Open
       builder" - it is the same route under a second label. */
    const links = canvas.getAllByRole('link');
    await expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Submit a plugin', '/contact-us'],
      ['Open builder', '/developers/website-builder'],
      ['See templates', '/developers/website-builder'],
    ]);

    // Both CTAs are the same 38px pill. They sit side by side, so a size drift in
    // one of them is obvious on screen and invisible in the diff.
    await expect(links[1].getBoundingClientRect().height).toBe(38);
    await expect(links[2].getBoundingClientRect().height).toBe(38);

    /* `--spot` is the always-dark token: the promo panel is meant to read as a
       dark island on the bone page in the LIGHT theme, which is the only reason
       its title and body colours are hardcoded light literals rather than tokens.
       Comparing it against a plugin card - an ordinary `--color-surface-card` -
       is the check that the island survived. */
    const spot = getComputedStyle(must(canvasElement, '.dev-website-card')).backgroundColor;
    const card = getComputedStyle(must(canvasElement, '.dev-plugin-card')).backgroundColor;
    await expect(luminance(spot)).toBeLessThan(luminance(card));

    /* The browser mock is decoration, so its three chrome dots and its three
       species tiles are hidden from assistive tech and the photos carry an empty
       alt. Losing that leaves a screen reader announcing unnamed graphics in the
       middle of a marketing panel. */
    const dots = [...canvasElement.querySelectorAll('.dev-site-dot')];
    await expect(dots).toHaveLength(3);
    for (const dot of dots) await expect(dot).toHaveAttribute('aria-hidden', 'true');

    const tiles = [...canvasElement.querySelectorAll('.dev-site-species-tile')];
    await expect(tiles).toHaveLength(3);
    for (const tile of tiles) await expect(tile).toHaveAttribute('aria-hidden', 'true');

    /* The species art is served from the `/images` staticDir and next/image may
       rewrite the src through its loader, so the filename is checked inside the
       decoded src rather than the attribute being compared whole. A renamed or
       moved asset fails here instead of drawing three empty grey tiles. */
    const photos = [...canvasElement.querySelectorAll('.dev-site-species-photo')];
    const sources = photos.map((img) => decodeURIComponent(img.getAttribute('src') ?? ''));
    await expect(sources.every((src) => src.includes('/images/developers/'))).toBe(true);
    await expect(sources.map((src) => src.split('/').pop()?.split('?')[0])).toEqual([
      'species-dog.png',
      'species-cat.png',
      'species-horse.png',
    ]);
    await expect(photos.every((img) => img.getAttribute('alt') === '')).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full page at 1440: three cards across, the promo panel beside its browser mock, ' +
          'and the "Preview" pill under the title admitting none of the catalog is wired up yet.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the grid collapses to one column',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await assertGridTracks(canvasElement);

    /* The mock keeps its full chrome at every width - it is never simplified for
       the phone - and it is built from fixed-size pieces: a 26px photo, a 9.5px
       URL pill, a "Book appointment" chip. None of it may push the page sideways
       inside a 291px card. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375 a 343px content box fits one 260px track, so the three cards stack. The promo ' +
          'panel is stacked here too, but it crossed its own breakpoint 525px earlier - see the ' +
          'tablet story.',
      },
    },
  },
};

export const Tablet: Story = {
  name: 'Tablet: promo stacked while the grid is not',
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement }) => {
    await assertPromoLayout(canvasElement);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The width this story exists for. `.dev-website-card` reflows at 900px and the plugin ' +
          'grid does not reflow until its tracks stop fitting, so between roughly 900 and 768 ' +
          'the panel is already in its phone layout while the catalog is still two cards across. ' +
          'Nothing else on the page changes across that band, which is why it is easy to miss.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark', viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    /* The failure this guards is named in globals.css: the warm-bone `--color-*`
       tokens are declared as light literals so Tailwind can parse them at build
       time, and never flip on their own - so anything reading them directly, and
       "the developer pages' CSS" is called out by name there, renders as a light
       island on the dark shell. Every opaque surface this page paints is checked,
       not just one, because the mirroring is per-token and a single missed one is
       a white rectangle in the middle of an espresso page.
       Polled: the theme decorator stamps `data-theme` on <html> outside React, so
       a synchronous first read can land before the cascade resettles. */
    const surfaces = [
      '.dev-plugins-preview',
      '.dev-plugin-card',
      '.dev-site-preview',
      '.dev-site-chrome',
      '.dev-site-url',
      '.dev-site-species-tile',
    ];
    await waitFor(() => {
      for (const selector of surfaces) {
        expect(
          luminance(getComputedStyle(must(canvasElement, selector)).backgroundColor)
        ).toBeLessThan(0.15);
      }
    });

    /* The card icon tile is the exception and must stay one: it is a translucent
       tint over whatever card it sits on, which is exactly why it needs no dark
       override. Swapping it for an opaque literal would look right in one theme
       and wrong in the other, so the alpha is the thing worth pinning. */
    const tint = getComputedStyle(must(canvasElement, '.dev-plugin-card-icon')).backgroundColor;
    await expect(alphaOf(tint)).toBeLessThan(1);

    /* The promo panel is the one thing that does NOT flip - `--spot` is dark in
       both themes and the title is a hardcoded `#f4efe6`. That is correct, and is
       why the panel needs its own check: it is now dark-on-dark, and the browser
       mock has to stay a distinguishable window rather than melting into the
       panel behind it. */
    await expect(getComputedStyle(must(canvasElement, '.dev-website-title')).color).toBe(
      'rgb(244, 239, 230)'
    );
    const panel = getComputedStyle(must(canvasElement, '.dev-website-card')).backgroundColor;
    const mock = getComputedStyle(must(canvasElement, '.dev-site-preview')).backgroundColor;
    await expect(luminance(mock)).toBeGreaterThan(luminance(panel));

    /* Once every surface sits within a few percent luminance of the others, the
       1px border is the only thing separating one plugin card from the next. An
       unset `--color-card-border` is invisible in the light theme and fatal
       here. */
    const cardStyle = getComputedStyle(must(canvasElement, '.dev-plugin-card'));
    await expect(cardStyle.borderTopWidth).toBe('1px');
    await expect(cardStyle.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Espresso dark. The plugin cards and the browser mock flip with the shell; the promo ' +
          'panel does not, because it is painted from the always-dark `--spot` and its copy ' +
          'colours are literals rather than tokens.',
      },
    },
  },
};

export const NotADeveloper: Story = {
  name: 'Signed in, but not a developer account',
  beforeEach: withSession('authenticated', 'member'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("This isn't a developer account")).toBeInTheDocument();

    /* The whole page sits inside the guard, so the denial is a REPLACEMENT rather
       than an overlay. Checking the grid is gone as well as the heading matters:
       rendering the catalog underneath a full-bleed state card would look
       identical on screen and would still leak what the portal offers. */
    await expect(
      canvas.queryByRole('heading', { level: 1, name: 'Plugins' })
    ).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('.dev-plugins-grid')).toBeNull();
    await expect(canvasElement.querySelector('.dev-website-card')).toBeNull();
    await expect(canvas.queryByText('IDEXX lab bridge')).not.toBeInTheDocument();

    /* Both ways out are present, and neither is clicked here: "Create a developer
       account" calls the store's real `signout`, which POSTs `/v1/auth/logout`
       and then asks SuperTokens to clear the session. */
    await expect(
      canvas.getByRole('button', { name: 'Create a developer account' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Back to Yosemite Crew' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A valid session on the wrong account type. The session is kept rather than torn down - ' +
          'the developer portal is a separate account, so signing this user out would cost them ' +
          'the rest of the app and land them on a sign-in that could only fail the same way.',
      },
    },
  },
};
