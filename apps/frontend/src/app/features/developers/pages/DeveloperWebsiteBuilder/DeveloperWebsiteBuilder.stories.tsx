import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useAuthStore } from '@/app/stores/authStore';
import DeveloperWebsiteBuilder from './DeveloperWebsiteBuilder';

/**
 * The page takes no props and fetches nothing - the only input it has is the
 * session, read through DevRouteGuard. So the seed is the whole fixture.
 *
 * `.env.local` sets `NEXT_PUBLIC_DISABLE_AUTH_GUARD=true` and Storybook is
 * served from localhost, which puts the guard's local developer fallback in
 * play: a leftover `devAuth` flag in sessionStorage promotes ANY signed-in
 * account to a developer. Left alone it would turn the rejection story into a
 * second copy of the happy path, and it would do it silently on one machine
 * and not another. Cleared for the story, put back on unmount.
 */
const withSession = (role: string | null) => () => {
  const snapshot = useAuthStore.getState();
  const devAuth = getStorageItem('session', 'devAuth');

  useAuthStore.setState({ status: 'authenticated', role });
  removeStorageItem('session', 'devAuth');

  return () => {
    if (devAuth !== null) setStorageItem('session', 'devAuth', devAuth);
    useAuthStore.setState({ status: snapshot.status, role: snapshot.role });
  };
};

/** querySelector that fails loudly instead of handing a play function `null`. */
const el = (root: ParentNode, selector: string): HTMLElement => {
  const found = root.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`expected ${selector} to be in the DOM`);
  return found;
};

const all = (root: ParentNode, selector: string): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(selector),
];

/** Content-box width, so a bar's span can be compared without hard-coding the padding. */
const contentWidth = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
};

const luminance = (colour: string) => {
  const [r, g, b] = (colour.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const meta = {
  title: 'Developers/DeveloperWebsiteBuilder',
  component: DeveloperWebsiteBuilder,
  parameters: {
    layout: 'fullscreen',
    // DevRouteGuard reads `usePathname` and can call `redirect`; both need the
    // App Router mock or the page throws "invariant expected app router to be
    // mounted" before anything renders.
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/website-builder' } },
    docs: {
      description: {
        component:
          'Template gallery for the not-yet-built clinic website builder.\n\n' +
          'Every template card carries a hand-drawn `TemplateSkeleton` - a stack of plain spans ' +
          'with inline widths and heights standing in for a page layout. There is no screenshot ' +
          'and no image asset, so the three layouts (**editorial** with its tile row, **compact** ' +
          'with two full-bleed text blocks, **imagery** with a single tall band) exist only as ' +
          'CSS. Nothing else in the app renders them, which makes these stories the only place a ' +
          'change to that artwork is visible before it ships.\n\n' +
          'The page is a preview: the cards are inert, and the header link out to `/contact-us` ' +
          'is the only thing on it a reader can follow.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withSession('developer'),
} satisfies Meta<typeof DeveloperWebsiteBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three template layouts',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The one real action on the page. Everything in the grid only looks like one.
    await expect(canvas.getByRole('link', { name: /Open builder/ })).toHaveAttribute(
      'href',
      '/contact-us'
    );

    const cards = all(canvasElement, '.dev-wb-card');
    await expect(cards).toHaveLength(3);

    /* Pins template order before anything below indexes by it: the skeleton
       assertions are per layout, and a reordered TEMPLATES array would otherwise
       measure the wrong card and still pass. */
    await expect(cards.map((card) => el(card, '.dev-wb-card-title').textContent)).toEqual([
      'Alpine Clinic',
      'City Vets',
      'Equine Estate',
    ]);

    // Card titles sit under the "Templates" h2, so they have to be h3s rather
    // than styled divs - the section is navigable by heading or it is not.
    await expect(canvas.getByRole('heading', { level: 2, name: 'Templates' })).toBeInTheDocument();
    for (const card of cards) {
      await expect(el(card, '.dev-wb-card-title').tagName).toBe('H3');
    }

    /* Grid rows stretch, so all three cards take one height however long the
       description runs; the skeleton (`flex: 1`) is what absorbs the difference.
       Drop that and the cards go ragged. */
    const heights = cards.map((card) => Math.round(card.getBoundingClientRect().height));
    await expect(new Set(heights).size).toBe(1);

    const skeletons = all(canvasElement, '.dev-wb-skeleton');
    await expect(skeletons).toHaveLength(3);
    const [editorial, compact, imagery] = skeletons;

    /* The artwork is a pile of empty spans. Unhidden it reads out as nothing at
       all, three times over, between the description and the action. */
    for (const skeleton of skeletons) {
      await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      await expect(skeleton.getBoundingClientRect().height).toBeGreaterThan(0);
    }
    for (const thumb of all(canvasElement, '.dev-wb-card-thumb')) {
      await expect(thumb).toHaveAttribute('aria-hidden', 'true');
    }

    // Editorial is the only layout with the services tile row, and the tiles are
    // one width each - they are a `flex: 1` row, not three fixed blocks.
    const tiles = all(editorial, '.dev-wb-sk-tile');
    await expect(tiles).toHaveLength(3);
    await expect(all(compact, '.dev-wb-sk-tile')).toHaveLength(0);
    await expect(all(imagery, '.dev-wb-sk-tile')).toHaveLength(0);
    const tileWidths = tiles.map((tile) => tile.getBoundingClientRect().width);
    await expect(Math.max(...tileWidths) - Math.min(...tileWidths)).toBeLessThanOrEqual(1);

    /* Compact's signature is two text blocks running the full width of the
       card - that is what makes it read as the dense single-page site. */
    const compactBars = all(compact, '.dev-wb-sk-bar');
    await expect(compactBars).toHaveLength(3);
    const compactInner = contentWidth(compact);
    for (const bar of compactBars.filter((bar) => bar.classList.contains('is-faded'))) {
      await expect(Math.abs(bar.getBoundingClientRect().width - compactInner)).toBeLessThanOrEqual(
        0.5
      );
    }

    /* Imagery's signature is the hero band. Measured against the other bars
       rather than against 52px, so the check survives a proportional retune but
       still fails if the band flattens into another text line. */
    const bars = skeletons.flatMap((skeleton) => all(skeleton, '.dev-wb-sk-bar'));
    const barHeights = bars.map((bar) => bar.getBoundingClientRect().height);
    const band = el(imagery, '.dev-wb-sk-bar').getBoundingClientRect().height;
    const others = barHeights.filter((height) => height !== band);
    await expect(band).toBeGreaterThanOrEqual(4 * Math.max(...others));

    // One CTA pill per template, identical in all three, so the cards read as
    // one family rather than three unrelated drawings.
    const pills = all(canvasElement, '.dev-wb-sk-pill');
    await expect(pills).toHaveLength(3);
    const pillBoxes = pills.map((pill) => pill.getBoundingClientRect());
    await expect(new Set(pillBoxes.map((box) => `${box.width}x${box.height}`)).size).toBe(1);

    /* "Use template" is a span. It is styled like an action because the builder
       is coming, but nothing in the grid is focusable or clickable yet - if that
       changes, this fails and the story has to say so. */
    await expect(all(el(canvasElement, '.dev-wb-grid'), 'a, button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The permitted case: a session carrying the developer role. All three skeleton layouts ' +
          'are on screen at once, which is the only view in which they can be compared.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    // Guards the seed itself: if the theme decorator ever stops stamping <html>,
    // the assertions below would quietly measure the light palette and pass.
    await expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('dark');

    /* The promo panel is painted from `--spot` and its type is a hardcoded
       #f4efe6 with no dark-mode counterpart, so the panel is only readable for
       as long as `--spot` stays dark in BOTH themes. Nothing else enforces that. */
    const promo = el(canvasElement, '.dev-wb-promo');
    const title = el(canvasElement, '.dev-wb-promo-title');
    await expect(
      contrast(getComputedStyle(title).color, getComputedStyle(promo).backgroundColor)
    ).toBeGreaterThan(4.5);

    /* The classic dark-mode collapse: card surface and page ground both land on
       the same near-black and the cards disappear into the background. */
    const card = el(canvasElement, '.dev-wb-card');
    await expect(getComputedStyle(card).backgroundColor).not.toBe(
      getComputedStyle(globalThis.document.body).backgroundColor
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Espresso dark. The promo panel does not invert with the theme - it is an always-dark ' +
          'panel in both, so the light theme is the one where its contrast is easiest to break.',
      },
    },
  },
};

export const Tablet: Story = {
  name: 'Tablet',
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement }) => {
    /* Header, promo panel and gallery are three separate blocks in two different
       stylesheets. They line up only because none of them carries a horizontal
       margin, and a stepped left edge is the kind of thing that survives review. */
    const boxes = ['.TitleContainer', '.dev-wb-promo', '.dev-wb-grid'].map((selector) =>
      el(canvasElement, selector).getBoundingClientRect()
    );
    await expect(new Set(boxes.map((box) => Math.round(box.left))).size).toBe(1);
    await expect(new Set(boxes.map((box) => Math.round(box.right))).size).toBe(1);

    // The three numbered steps wrap inside the promo panel instead of running
    // out through its padding once the panel stops being 1200px wide.
    const steps = el(canvasElement, '.dev-wb-steps');
    await expect(steps.scrollWidth).toBeLessThanOrEqual(steps.clientWidth + 1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 768 the page padding drops to 16px, the header stacks the title above the button, ' +
          'and the gallery falls from three columns to two - the 260px track floor is what forces ' +
          'the wrap.\n\n' +
          'Note the pinned width only applies in the manager and in Chromatic. Loading ' +
          '`iframe.html` directly (which is what the story verifier does) leaves the frame at its ' +
          'own size, so the assertions here are deliberately width-independent.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    // Every bar in the artwork is a percentage width, so the skeletons cannot be
    // what pushes the page sideways - but the promo panel's 23px title and the
    // steps row can, and a phone has nowhere to put the overflow.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    /* `minmax(260px, 1fr)` is a floor, not a hint: once a card is squeezed under
       it the description reflows to five lines and the tile row stops reading as
       a services grid. Holds at any width, which is the point. */
    for (const card of all(canvasElement, '.dev-wb-card')) {
      await expect(card.getBoundingClientRect().width).toBeGreaterThanOrEqual(260);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'One column, 16px gutters, and the promo panel keeps its full-height padding. Same ' +
          'caveat as the tablet story: the width is real in the manager and in Chromatic, not ' +
          'when the story file is rendered straight out of `iframe.html`.',
      },
    },
  },
};

export const NotADeveloper: Story = {
  name: 'Signed in, not a developer',
  beforeEach: withSession('user'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The guard replaces the page rather than layering over it. If the wrapper
       were still mounted underneath, the template gallery would be one CSS
       change away from being visible to an account with no developer role. */
    await expect(canvasElement.querySelector('.OperationsWrapper')).toBeNull();
    await expect(canvasElement.querySelector('.DevWebsiteBuilder')).toBeNull();

    await expect(canvas.getByText("This isn't a developer account")).toBeInTheDocument();

    /* Both ways out are real buttons, not links: the first has to sign the
       reader out before it can navigate. Neither is clicked here - the primary
       calls the store's real `signout`, which would reach SuperTokens. */
    await expect(
      canvas.getByRole('button', { name: 'Create a developer account' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Back to Yosemite Crew' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A valid session on an account that is not a developer one. The session is kept - the ' +
          'portal is a separate account type, so signing the reader out would cost them the rest ' +
          'of the app and land them on a sign-in that can only fail the same way.',
      },
    },
  },
};
