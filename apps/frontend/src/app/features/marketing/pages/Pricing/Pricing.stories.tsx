import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import Pricing from './Pricing';
/* Only `(routes)/(public)/layout.tsx` loads this sheet, and without it the page is
   not merely unstyled - it is largely invisible. Every word of the hero headline
   carries `opacity: 0` INLINE and gets it back from the `ycWord` keyframes here
   (with `both`); the hero badge and subtitle do the same through `ycHeroUp`. The
   `[data-reveal]` states the plan cards animate through, and the `[data-grid-1-m]` /
   `[data-stack-m]` phone helpers this page hangs its responsive layout on, are all
   defined here too. The assertions below fail loudly if this import ever goes. */
import '@/app/features/marketing/site/marketing.css';

const grid = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-price-grid]') as HTMLElement;

/** The three tier cards are the grid's children, each one its own `Reveal`. */
const cardsOf = (canvasElement: HTMLElement) =>
  Array.from(grid(canvasElement).children) as HTMLElement[];

/** Found by its badge, so "RECOMMENDED sits on the Business tier" is part of the check. */
const businessCardOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText('RECOMMENDED').closest('[data-reveal]') as HTMLElement;

const trackCount = (element: HTMLElement) =>
  getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;

/**
 * Lets the reveal observer deliver the verdict it queued before the play started.
 *
 * `Reveal` starts at `idle` - which is the SETTLED look, fully opaque - and drops to
 * `hidden` (opacity 0, 34px down, 8px blur) only once the observer confirms the
 * element is off-screen. That callback lands in the rendering step, so it is a frame
 * or two away, and `idle` is both the initial state and a terminal one. Poll straight
 * away and the poll can match `idle` on the tick BEFORE the drop, after which the
 * element falls to opacity 0 and animates back up underneath everything that follows.
 * That is precisely how the FAQ story here failed intermittently while the plan-card
 * stories sharing the same helper passed every time - their assertions never read an
 * opacity.
 */
const observerVerdictDelivered = () =>
  new Promise<void>((resolve) => {
    globalThis.requestAnimationFrame(() =>
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()))
    );
  });

/**
 * Scrolls each element into view in turn and waits for its reveal to finish.
 *
 * One at a time rather than one scroll for the group: stacked on a phone the three
 * tier cards are taller than two viewports, so centring the grid leaves the last one
 * short of the observer's 0.12 threshold and it never reveals at all. Revealing is
 * one-way - `Reveal` unobserves on the first intersection - so an earlier card cannot
 * un-reveal while a later one is scrolled to.
 */
const revealAll = async (elements: HTMLElement[]) => {
  await observerVerdictDelivered();
  for (const element of elements) {
    element.scrollIntoView({ block: 'center' });
    // Polled to the end state, not merely to `shown`: the cards are staggered
    // 0/100/200ms and `ycReveal` then runs for a second, so a same-tick read catches
    // an interpolated opacity part-way up. `idle` is a legitimate answer too - it is
    // what an element the observer first saw on screen keeps for the whole session.
    await waitFor(
      () => {
        expect(element.dataset.reveal).not.toBe('hidden');
        expect(getComputedStyle(element).opacity).toBe('1');
      },
      { timeout: 8000 }
    );
  }
};

/* The billing toggle carries no `aria-pressed`, no radiogroup and no `aria-current`:
   the filled pill is the ONLY signal of which period is selected, for everyone. So
   the pill background is the thing to assert - swap the two `billingBtnStyle(...)`
   arguments and nothing else on the page changes shape. */
const PILL_ON = 'rgb(29, 28, 27)';
const PILL_OFF = 'rgba(0, 0, 0, 0)';

const expectSelected = async (canvasElement: HTMLElement, period: 'Monthly' | 'Yearly') => {
  const canvas = within(canvasElement);
  const selected = canvas.getByRole('button', { name: period });
  const other = canvas.getByRole('button', { name: period === 'Monthly' ? 'Yearly' : 'Monthly' });
  // Polled: `billingBtnStyle` transitions background over 200ms, so reading on the
  // same tick as the click returns the colour it is moving away from.
  await waitFor(() => {
    expect(getComputedStyle(selected).backgroundColor).toBe(PILL_ON);
    expect(getComputedStyle(other).backgroundColor).toBe(PILL_OFF);
  });
};

const meta = {
  title: 'Marketing/Pricing',
  component: Pricing,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview decorator stamps on every
    // other story: PIMS scopes its darker faint inks to that marker, and this is a
    // public marketing surface drawn against the lighter marketing values.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The public pricing page: hero, three tiers behind a monthly/yearly toggle, the ' +
          '"why we take no cut" panel, the FAQ and the closing CTA. It fetches nothing, so the ' +
          "only state on the page is `PlansSection`'s `useState(false)` - and that one boolean " +
          'reprices exactly one card.\n\n' +
          'Two things make this page easy to story wrongly. First, **the plan cards start ' +
          'invisible.** `Reveal` arms itself by moving anything below the fold to ' +
          '`data-reveal="hidden"` (opacity 0, 34px down, 8px blur), and the tiers sit a full ' +
          'viewport below the hero, so a play function that measures on mount is measuring a ' +
          'transparent box. Every story here walks each card into view and waits out its ' +
          'stagger before asserting anything about it.\n\n' +
          'Second, **the toggle announces nothing.** The two period buttons are plain buttons ' +
          'with no `aria-pressed`, no radiogroup and no `aria-current`; the filled `#1d1c1b` ' +
          'pill is the entire indication of which period is live. The stories therefore assert ' +
          'the pill colour on both buttons and the repriced copy, because there is no ' +
          'accessibility state to assert instead.\n\n' +
          'The phone story is the one that earns its keep for layout: the tier grid collapses ' +
          "through a `max-width: 960px` rule in the page's own inline `<style>`, while the FAQ " +
          'and the CTA row collapse through the `[data-grid-1-m]` and `[data-stack-m]` helper ' +
          'attributes in `marketing.css`. Those are bare strings in the markup with nothing ' +
          'type-checking them - a typo leaves a two-column FAQ on a 375px screen and looks ' +
          'perfectly fine at every width Storybook opens by default.',
      },
    },
  },
  tags: ['autodocs'],
  /* Pinned rather than inherited: the three-column tier grid and the two-column FAQ
     are asserted below, and both are decided by a viewport media query. Leaving the
     width to the project default would make those assertions hostage to a change in
     `.storybook/preview.tsx`. */
  globals: { viewport: { value: 'laptop', isRotated: false } },
} satisfies Meta<typeof Pricing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Monthly: Story = {
  name: 'Monthly (the resting state)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The headline is assembled from eight separately animated fragments, each a
       span with `opacity: 0` inline. Asserting the joined accessible name catches
       both halves of that: a dropped `{' '}` welds the words into "Hostitfree.",
       and a missing `ycWord` keyframe leaves the whole line at opacity 0 while the
       text still reads perfectly to a DOM query. Level 1 is qualified by name
       because the preview decorator adds its own sr-only h1. */
    const headline = canvas.getByRole('heading', { level: 1, name: /^Host it free\./ });
    await expect(headline).toHaveAccessibleName('Host it free. Or pay as you grow.');
    await waitFor(
      () => {
        expect(getComputedStyle(headline.querySelector('span') as HTMLElement).opacity).toBe('1');
      },
      { timeout: 6000 }
    );

    const cards = cardsOf(canvasElement);
    await expect(cards).toHaveLength(3);
    await revealAll(cards);

    // Three real tracks at laptop width, not one wide card with two off-screen.
    await expect(trackCount(grid(canvasElement))).toBe(3);

    const business = businessCardOf(canvasElement);
    await expect(within(business).getByText('€12')).toBeInTheDocument();
    await expect(within(business).getByText('per user / month')).toBeInTheDocument();
    await expect(canvas.getByText('€0')).toBeInTheDocument();
    // Sentence case, so it is the Enterprise price line and not its 'COMING SOON' badge.
    await expect(canvas.getByText('Coming soon')).toBeInTheDocument();

    await expectSelected(canvasElement, 'Monthly');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Free at €0 forever, Business at €12 per user / month, Enterprise still unpriced. The ' +
          'Business card is lifted 8px on an inline `translateY`, which is why `Reveal` animates ' +
          '`translate` rather than `transform` - the two are separate properties, so the reveal ' +
          'composes with the lift instead of flattening it.',
      },
    },
  },
};

export const Yearly: Story = {
  name: 'Yearly (only the Business tier moves)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cards = cardsOf(canvasElement);
    await revealAll(cards);

    const business = businessCardOf(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Yearly' }));

    await expect(within(business).getByText('€10')).toBeInTheDocument();
    await expect(within(business).getByText('per user / month, billed yearly')).toBeInTheDocument();
    /* Exact-string query, so this is genuinely "the monthly period line is gone"
       rather than "some element contains that text" - the yearly line opens with
       those same four words. */
    await expect(canvas.queryByText('per user / month')).not.toBeInTheDocument();

    // The other two tiers are not priced per period and must not react at all.
    await expect(canvas.getByText('€0')).toBeInTheDocument();
    await expect(canvas.getByText('forever')).toBeInTheDocument();
    await expect(canvas.getByText('Coming soon')).toBeInTheDocument();

    await expectSelected(canvasElement, 'Yearly');

    /* Back again. The two buttons are adjacent and identical apart from the boolean
       they pass, so wiring both to `onSelect(true)` - the copy-paste that writes
       itself - leaves a toggle that reaches yearly and sticks there while looking
       entirely normal in a screenshot. */
    await userEvent.click(canvas.getByRole('button', { name: 'Monthly' }));
    await expect(within(business).getByText('€12')).toBeInTheDocument();
    await expect(within(business).getByText('per user / month')).toBeInTheDocument();
    await expectSelected(canvasElement, 'Monthly');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Yearly drops Business to €10 and relabels the period "per user / month, billed ' +
          'yearly" - the two months the toggle\'s own caption promises. Free and Enterprise ' +
          'carry no per-period price, so the correct behaviour is that they do nothing.',
      },
    },
  },
};

export const Faq: Story = {
  name: 'FAQ (first answer open)',
  play: async ({ canvasElement }) => {
    const rows = Array.from(canvasElement.querySelectorAll('details.yc-faq'));
    await expect(rows).toHaveLength(5);

    const [first, second] = rows as HTMLDetailsElement[];
    /* The whole FAQ column is one `Reveal`, and it is four screens down, so it is
       armed to opacity 0 on mount - and `toBeVisible` reads opacity, so every
       assertion below would fail on a perfectly working accordion. */
    const column = first.closest('[data-reveal]') as HTMLElement;
    await revealAll([column]);
    // Exactly one row is open on arrival, and it is the one that answers the
    // question the page is built around.
    await expect(rows.filter((row) => (row as HTMLDetailsElement).open)).toHaveLength(1);
    await expect(first.open).toBe(true);
    await expect(
      within(first).getByText(/If you host it yourself, it costs nothing/)
    ).toBeVisible();
    /* `toBeVisible` understands `<details>`: the second answer is in the DOM the
       whole time, so a plain text query would pass on a row that never opens. */
    await expect(
      within(second).getByText(/you pay per active user, either monthly or yearly/)
    ).not.toBeVisible();

    /* The `+` becoming an `x` is a two-line inline `<style>` in the component
       keyed on `.yc-faq[open] .yc-faq-icon`. Nothing type-checks that pairing:
       rename either half and every row keeps a `+` next to an open answer. */
    const iconOf = (row: Element) => row.querySelector('.yc-faq-icon') as HTMLElement;
    const ROTATED = 'matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)';
    await expect(getComputedStyle(iconOf(first)).transform).toBe(ROTATED);
    await expect(getComputedStyle(iconOf(second)).transform).toBe('none');

    await userEvent.click(within(second).getByText('How does billing work?'));
    await expect(second.open).toBe(true);
    await expect(
      within(second).getByText(/you pay per active user, either monthly or yearly/)
    ).toBeVisible();
    // Polled: the icon rotates over a 250ms ease, so the same tick reads part-way.
    await waitFor(() => {
      expect(getComputedStyle(iconOf(second)).transform).toBe(ROTATED);
    });

    /* Native `<details>`, so there is no accordion behaviour - opening the second
       does NOT close the first. Worth pinning: several rows open at once is what
       the reader gets, and it is a deliberate difference from the PIMS accordions. */
    await expect(first.open).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five questions as native `<details>` rows, the first pre-opened through the `open` ' +
          'flag on its entry. They are independent - nothing closes a row when another opens - ' +
          'and the only affordance is the `+` glyph rotating 45 degrees into an `x`.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (tiers stack)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const cards = cardsOf(canvasElement);
    await revealAll(cards);

    /* Every collapse on this page is decided by a VIEWPORT media query, so the
       expected layout is read off the queries themselves rather than hard-coded to
       375. The viewport global pins the canvas in the Storybook UI, but it is inert
       when the story is rendered by loading `iframe.html` directly - which is what
       the verification harness does, at 1280. Asserting "one column" flat would
       then be asserting something the runner cannot produce; asserting the
       COUPLING holds at either width and still fails if a query stops matching its
       rule. */
    const phoneGrid = globalThis.matchMedia('(max-width: 960px)').matches;
    const phoneHelpers = globalThis.matchMedia('(max-width: 900px)').matches;
    const phoneStack = globalThis.matchMedia('(max-width: 700px)').matches;

    // One track and the cards genuinely below one another, rather than a three-column
    // grid squeezed to 109px each - which is what a lost `!important` would give.
    await expect(trackCount(grid(canvasElement))).toBe(phoneGrid ? 1 : 3);
    const boxes = cards.map((card) => card.getBoundingClientRect());
    const lefts = new Set(boxes.map((box) => Math.round(box.left)));
    if (phoneGrid) {
      await expect(lefts.size).toBe(1);
      await expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom - 1);
      await expect(boxes[2].top).toBeGreaterThan(boxes[1].bottom - 1);
    } else {
      await expect(lefts.size).toBe(3);
    }

    /* The other two collapses come from `marketing.css` helper attributes rather
       than from the page. They are untyped strings in the markup: misspell either
       one and the FAQ stays a 0.8fr/1.2fr grid and the CTA pair stays side by side
       on a 375px screen, with no error anywhere. */
    const faq = canvasElement.querySelector('[data-grid-1-m]') as HTMLElement;
    await expect(trackCount(faq)).toBe(phoneHelpers ? 1 : 2);
    const ctaRow = canvasElement.querySelector('[data-stack-m]') as HTMLElement;
    await expect(getComputedStyle(ctaRow).flexDirection).toBe(phoneStack ? 'column' : 'row');

    // Nothing pushes the page sideways: the hero glow and the -8px Business lift are
    // the two things on this page that could, and both are inside `overflow: hidden`.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375 the tier grid becomes a single 460px-max column, so the Business card loses ' +
          'its middle-of-three prominence and simply sits second. The FAQ drops its two-column ' +
          'split and the closing CTA pair stacks full width.',
      },
    },
  },
};
