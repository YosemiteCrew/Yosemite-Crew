import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import {
  BookFooter,
  BookShell,
  Callout,
  CheckIcon,
  ClockIcon,
  IconDisc,
  Skeleton,
  Spinner,
  StateCard,
  WarnIcon,
} from './bookingChrome';
import { SLOT_GRID, STATE_BODY } from './bookingStyles';

/**
 * The primitives `/book/<slug>` and `/book/<slug>/confirm` are both built from.
 *
 * Nothing here talks to the network or reads a store, so the stories need no
 * stub - which is the point of the module. What they are for is the half of the
 * chrome jsdom cannot see: whether the footer links are actually underlined
 * once the unlayered `a { text-decoration: none !important }` in globals.css is
 * in play, whether an IconDisc paints the tone it was asked for, and whether a
 * Callout keeps its icon beside the first line when the message wraps.
 *
 * Several of these variants render nowhere in the app today - the `brand`
 * IconDisc tone and the role-less Callout among them - so this file is the only
 * place they are exercised at all.
 */

/**
 * Resolves a design token to the colour the browser actually paints, so a story
 * can say "this disc is the warn tint" rather than only "it is tinted with
 * something". Borrowed from `ConfirmModal.stories.tsx`, which needs the same
 * trick for the same reason.
 */
const resolveToken = (host: HTMLElement, token: string) => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  host.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

/** Thrown rather than asserted, so a missing element reads as a failure where it
 *  went missing instead of as a null-deref three lines later. */
const requireEl = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T => {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`bookingChrome story: nothing matched ${selector}`);
  return el;
};

/** The disc tones, paired with the token each one is supposed to paint. Spelled
 *  out here on purpose: the pairing IS the assertion, and a swapped map entry is
 *  exactly the regression that a screenshot review misses. */
const DISC_TONES = [
  { tone: 'brand', token: '--blue-soft' },
  { tone: 'warn', token: '--warn-bg' },
  { tone: 'success', token: '--inset' },
] as const;

const CONFIRMED_BODY = (
  <p className={STATE_BODY}>
    Avenger Park Veterinary can now see your request and will contact you to arrange the
    appointment.
  </p>
);

const meta = {
  title: 'PublicBooking/BookingChrome',
  component: StateCard,
  parameters: {
    layout: 'padded',
    // BookFooter renders two next/link elements. The app router mock has to be
    // mounted for them, the same way the sibling BookClient stories mount it.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The shared surface for the two public booking pages. The props table below is ' +
          '`StateCard`; `BookShell`, `BookFooter`, `IconDisc`, `Callout`, `Skeleton` and the four ' +
          'icons are rendered by the stories that name them. Both pages used to pick their own ' +
          'width and padding - 560/p-5 against 520/p-6 - so the column visibly jumped when a ' +
          'reader followed the emailed confirmation link out of their inbox. Everything that ' +
          'decides what those pages look like now lives in this one module.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    heading: 'Request confirmed',
    icon: (
      <IconDisc tone="success">
        <CheckIcon />
      </IconDisc>
    ),
    children: CONFIRMED_BODY,
  },
} satisfies Meta<typeof StateCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shell: Story = {
  name: 'The shell and footer both pages sit in',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The frame around every state: a full-height warm-bone page, one centred column capped ' +
          'at 640px (720px from `lg`), and the footer that names who provides the page. The ' +
          'shell is also the SkipLink target - the root layout points at `#main-content`, and ' +
          'the id and `tabIndex={-1}` here are what make that bypass land somewhere.',
      },
    },
  },
  render: () => (
    <BookShell>
      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-5 sm:p-8">
        <h2 className="text-heading-2 text-[var(--ink)]">Avenger Park Veterinary</h2>
        <p className={STATE_BODY}>
          Sample page content. The shell owns the page background, the gutters and the column width;
          whatever a page puts inside it inherits all three.
        </p>
      </div>
      <BookFooter />
    </BookShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A role query would be ambiguous here: the preview decorator wraps every
       story in a <main> of its own, so the canvas holds two. */
    const main = requireEl(canvasElement, 'main#main-content');
    await expect(main).toHaveAttribute('tabindex', '-1');

    const privacy = canvas.getByRole('link', { name: 'Privacy' });
    const terms = canvas.getByRole('link', { name: 'Terms' });
    await expect(privacy).toHaveAttribute('href', '/privacy-policy');
    await expect(terms).toHaveAttribute('href', '/terms-and-conditions');

    /* `a { text-decoration: none !important }` is unlayered in globals.css, and
       an unlayered important declaration beats a layered non-important one
       whatever the specificity. The `!` in `underline!` is the only reason
       these two read as links rather than as body text. */
    for (const link of [privacy, terms]) {
      await expect(getComputedStyle(link).textDecorationLine).toContain('underline');
    }

    /* min-h-svh, not a content height: a confirm page is three short lines, and
       without this the warm-bone background would stop a third of the way down
       and the footer would float in the middle of the screen. Asserted loosely
       against the viewport because the point is that it fills it, not that it
       measures any particular number of pixels. */
    await expect(main.getBoundingClientRect().height).toBeGreaterThan(
      canvasElement.ownerDocument.defaultView!.innerHeight * 0.95
    );

    /* The column is centred and capped rather than filling the panel. Measured
       as a relation so a change to the gutter moves both numbers together. */
    const shell = main.getBoundingClientRect();
    const column = requireEl(main, ':scope > div').getBoundingClientRect();
    await expect(column.width).toBeLessThan(shell.width);
    await expect(Math.abs(column.left - shell.left - (shell.right - column.right))).toBeLessThan(2);
  },
};

export const Tones: Story = {
  name: 'IconDisc: the three tones side by side',
  parameters: {
    docs: {
      description: {
        story:
          'The 44px round plate every state card leads with. `brand` renders nowhere in the app ' +
          'today - the booking page uses `warn` for the unavailable practice and `success` for a ' +
          'sent request - so this is the only place all three can be compared.',
      },
    },
  },
  render: () => (
    <div className="flex items-center gap-4">
      <div data-tone="brand">
        <IconDisc tone="brand">
          <ClockIcon />
        </IconDisc>
      </div>
      <div data-tone="warn">
        <IconDisc tone="warn">
          <WarnIcon />
        </IconDisc>
      </div>
      <div data-tone="success">
        <IconDisc tone="success">
          <CheckIcon />
        </IconDisc>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const widths: number[] = [];

    for (const { tone, token } of DISC_TONES) {
      const disc = requireEl(canvasElement, `[data-tone="${tone}"] > span`);
      const box = disc.getBoundingClientRect();
      widths.push(box.width);

      // A disc, not a rounded square: square box, radius at least half of it.
      await expect(box.width).toBeCloseTo(box.height, 1);
      await expect(box.width).toBeGreaterThan(0);
      await expect(parseFloat(getComputedStyle(disc).borderRadius)).toBeGreaterThanOrEqual(
        box.width / 2
      );

      await expect(getComputedStyle(disc).backgroundColor).toBe(resolveToken(canvasElement, token));

      /* Decoration, not content. The heading beside it already says what the
         state is, so a disc that reached the accessibility tree would make a
         screen reader announce the same fact twice. */
      await expect(disc).toHaveAttribute('aria-hidden', 'true');
    }

    // One size for all three, so a row of them lines up.
    await expect(widths[1]).toBeCloseTo(widths[0], 1);
    await expect(widths[2]).toBeCloseTo(widths[0], 1);
  },
};

export const Icons: Story = {
  name: 'The icon set at its default size',
  parameters: {
    docs: {
      description: {
        story:
          'Four hand-drawn 20-unit glyphs rather than an icon dependency, because these two pages ' +
          'are the only public surface in the app and pulling a library in for four shapes costs ' +
          'the pet owner the download. The Spinner is the odd one out: smaller than the rest, and ' +
          'the only one that moves.',
      },
    },
  },
  render: () => (
    <div className="flex items-center gap-6 text-[var(--ink)]">
      <span data-icon="warn">
        <WarnIcon />
      </span>
      <span data-icon="check">
        <CheckIcon />
      </span>
      <span data-icon="clock">
        <ClockIcon />
      </span>
      <span data-icon="spinner">
        <Spinner />
      </span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const iconOf = (name: string) =>
      requireEl<SVGElement>(canvasElement, `[data-icon="${name}"] svg`);
    const still = ['warn', 'check', 'clock'].map(iconOf);
    const spinner = iconOf('spinner');

    for (const icon of [...still, spinner]) {
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      const box = icon.getBoundingClientRect();
      await expect(box.width).toBeGreaterThan(0);
      await expect(box.width).toBeCloseTo(box.height, 1);
    }

    // The three status glyphs share one default size, so swapping one for
    // another in a Callout or a disc never moves the text beside it.
    const base = still[0].getBoundingClientRect().width;
    for (const icon of still) {
      await expect(icon.getBoundingClientRect().width).toBeCloseTo(base, 1);
    }

    /* The Spinner sits inside a button label rather than on its own, so it is
       deliberately a size smaller than the rest. */
    await expect(spinner.getBoundingClientRect().width).toBeLessThan(base);

    /* The whole reason it exists. `animate-spin` is a Tailwind utility, so this
       fails if the class is dropped OR if the keyframes stop being emitted -
       and a still spinner is indistinguishable from a frozen page. */
    await expect(getComputedStyle(spinner).animationName).not.toBe('none');
    for (const icon of still) {
      await expect(getComputedStyle(icon).animationName).toBe('none');
    }
  },
};

export const Alerts: Story = {
  name: 'Callout: announced, and silent',
  parameters: {
    docs: {
      description: {
        story:
          'One tone for every message this surface can carry, on purpose: times would not load, ' +
          'the request would not send, the slot went while the form was open - all of them mean ' +
          '"we could not do this yet", never "something was destroyed", and two colours for one ' +
          'meaning is vocabulary the page has not earned. `role` is opt-in, because a callout ' +
          'that was always a live region would interrupt a reader for copy that was on the page ' +
          'before they arrived.',
      },
    },
  },
  render: () => (
    // The width cap is a fixture, not a design constant: the wrap assertion
    // below needs the message to wrap at any panel width.
    <div className="flex max-w-[22rem] flex-col gap-3">
      <div data-callout="alert">
        <Callout role="alert">
          We could not load the available times for this day. That is usually a connection problem
          rather than a full diary, so it is worth trying again in a moment. If it keeps happening,
          please call the practice and they will book you in over the phone.
        </Callout>
      </div>
      <div data-callout="plain">
        <Callout>Nothing is booked yet, and the time you asked for is not being held.</Callout>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Exactly one live region. The second callout carries standing copy, so if
       `role` were hardcoded rather than passed through, a reader would be
       interrupted by a sentence that was there all along. */
    const alerts = canvas.getAllByRole('alert');
    await expect(alerts).toHaveLength(1);
    await expect(alerts[0]).toHaveTextContent(/could not load the available times/);
    await expect(requireEl(canvasElement, '[data-callout="plain"] > p')).not.toHaveAttribute(
      'role'
    );

    const alert = alerts[0];
    const icon = requireEl<SVGElement>(alert, 'svg').getBoundingClientRect();
    const text = requireEl(alert, 'span').getBoundingClientRect();

    // The message really did wrap - otherwise the alignment check below proves
    // nothing, because a one-line callout looks the same either way.
    await expect(text.height).toBeGreaterThan(icon.height * 2);

    /* items-start, not items-center: on a wrapped message a centred icon drifts
       down beside the middle of the paragraph and reads as a bullet for the
       wrong line. */
    await expect(icon.top).toBeLessThan(text.top + text.height / 2);

    // shrink-0: as a flex item next to a long string the glyph is the first
    // thing the layout squeezes, and a squashed circle is worse than none.
    await expect(icon.width).toBeCloseTo(icon.height, 1);

    await expect(getComputedStyle(alert).backgroundColor).toBe(
      resolveToken(canvasElement, '--warn-bg')
    );
  },
};

export const Confirmed: Story = {
  name: 'StateCard: a confirmed request',
  args: { headingLevel: 'h1' },
  parameters: {
    docs: {
      description: {
        story:
          'What the confirm page shows once the POST behind the emailed link succeeds. It takes ' +
          '`h1` because it is the only heading on that page - the state card IS the page there, ' +
          'so anything lower would leave the document with no top-level heading at all.',
      },
    },
  },
  play: async ({ canvas }) => {
    /* Queried by name, not by level: the preview decorator adds an sr-only h1
       of its own to every story, so a level query matches two headings. */
    const heading = canvas.getByRole('heading', { name: 'Request confirmed' });
    await expect(heading.tagName).toBe('H1');

    const inner = heading.parentElement;
    if (!inner) throw new Error('the state card heading rendered with no wrapper');

    /* No innerRef was passed, so nothing here should be focusable. A card that
       collects a tabindex it was not given puts a dead stop in the tab order of
       a page whose only job is to be read. */
    await expect(inner).not.toHaveAttribute('tabindex');

    // Icon, then heading, then body - the shape every state that replaces the
    // form takes, so the page never resizes under the reader.
    await expect(inner.children[0]).toHaveAttribute('aria-hidden', 'true');
    await expect(inner.children[1]).toBe(heading);
    await expect(canvas.getByText(/can now see your request/)).toBeInTheDocument();

    await expect(getComputedStyle(inner).textAlign).toBe('center');

    // Centred as a fact about the box, not just about the text inside it.
    const card = inner.getBoundingClientRect();
    const disc = inner.children[0].getBoundingClientRect();
    await expect(Math.abs(disc.left + disc.width / 2 - (card.left + card.width / 2))).toBeLessThan(
      2
    );
  },
};

export const Expired: Story = {
  name: 'StateCard: a link that will not open',
  args: {
    headingLevel: 'h1',
    heading: 'This link is not valid',
    icon: (
      <IconDisc tone="warn">
        <WarnIcon />
      </IconDisc>
    ),
    children: (
      <p className={STATE_BODY}>
        It may have already been used, or it may have expired. Confirmation links last 48 hours.
        Please submit your request again, or contact the practice directly.
      </p>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'One state for several facts: the token was already spent, it expired, or it was never ' +
          'ours. They are deliberately not told apart, because a page that distinguishes them ' +
          'lets anyone with a guessed token learn whether it was real. Same card, same padding, ' +
          'same heading level as the confirmed state - only the tone and the words change.',
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const heading = canvas.getByRole('heading', { name: 'This link is not valid' });
    await expect(heading.tagName).toBe('H1');

    const inner = heading.parentElement;
    if (!inner) throw new Error('the state card heading rendered with no wrapper');

    /* The warn pairing, both halves of it. `--warn-text` is the readable twin of
       the fill; asserting only the background would let a disc pass while its
       glyph sat at 1.9:1 on top of it. */
    const disc = requireEl(inner, 'span[aria-hidden="true"]');
    await expect(getComputedStyle(disc).backgroundColor).toBe(
      resolveToken(canvasElement, '--warn-bg')
    );
    await expect(getComputedStyle(disc).color).toBe(resolveToken(canvasElement, '--warn-text'));

    await expect(getComputedStyle(inner).textAlign).toBe('center');
    await expect(canvas.getByText(/Confirmation links last 48 hours/)).toBeInTheDocument();
  },
};

/**
 * The booking page holds the card in a ref and moves focus into it after a
 * submit, so the story has to own a real ref rather than hand the prop a
 * literal.
 */
const FocusTargetCard = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <StateCard
      innerRef={ref}
      heading="Request sent"
      icon={
        <IconDisc tone="success">
          <CheckIcon />
        </IconDisc>
      }
    >
      <p className={STATE_BODY}>
        The practice will email you to confirm. Nothing is booked yet, and the time you asked for is
        not being held.
      </p>
    </StateCard>
  );
};

export const FocusTarget: Story = {
  name: 'StateCard: the post-submit focus target',
  parameters: {
    docs: {
      description: {
        story:
          'The same card with `innerRef` set. The form it replaces has just gone from under the ' +
          'reader, so focus is moved here rather than left on a button that no longer exists. ' +
          'The `-1` is doing two jobs: it makes the card focusable in code without putting it in ' +
          'the tab order, and it takes the card out of the global focus-ring selector, so a ' +
          'reader who never tabbed here is not shown a ring they did not ask for. This story ' +
          'also covers the default heading level, which the two page-level states override.',
      },
    },
  },
  render: () => <FocusTargetCard />,
  play: async ({ canvas, canvasElement }) => {
    const heading = canvas.getByRole('heading', { name: 'Request sent' });

    // The default, unlike both confirm-page states: this card sits under a page
    // heading that already exists, so it must not claim to be one.
    await expect(heading.tagName).toBe('H2');

    const inner = heading.parentElement;
    if (!inner) throw new Error('the state card heading rendered with no wrapper');
    await expect(inner).toHaveAttribute('tabindex', '-1');

    inner.focus();
    await expect(inner).toHaveFocus();

    /* The app's own focus ring does not apply here. globals.css draws a
       `2px solid` outline from a `:where()` list that excludes
       `[tabindex='-1']`, precisely so a programmatic move like this one does
       not look like a click the reader made.

       Asserted against that ring specifically, not against "no outline at all".
       `outlineStyle` reads `auto` on this element whether it is focused or not
       - that is the UA default sitting in the computed value, not evidence of
       anything being painted - and the element DOES match `:focus-visible`, so
       a check for `none` fails for a reason that has nothing to do with the
       rule under test. Measured for comparison: a covered control in the same
       shell (`BookFooter`'s Privacy link) computes `solid` / `2px`, while this
       one computes `auto` / `1px`. */
    const focusRing = getComputedStyle(inner);
    await expect(focusRing.outlineStyle).not.toBe('solid');
    await expect(focusRing.outlineWidth).not.toBe('2px');

    /* And it stays out of the tab order. If this ever became tabIndex={0}, a
       keyboard reader would land on a silent div between the heading and the
       footer links with nothing to do there. */
    inner.blur();
    canvasElement.ownerDocument.body.focus();
    await userEvent.tab();
    await expect(inner).not.toHaveFocus();
  },
};

export const Placeholders: Story = {
  name: 'Skeleton: both pages waiting',
  parameters: {
    docs: {
      description: {
        story:
          'The two placeholder layouts in the module: the confirm page holding the shape of a ' +
          'state card while its POST is in flight, and the booking page holding the slot grid ' +
          'while a day loads. Both are drawn in the geometry the real content will occupy, so ' +
          'nothing jumps when it arrives.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-[26rem] flex-col gap-8">
      <div data-skeletons="confirm" className="flex flex-col items-center gap-4">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-6 w-1/2 rounded-xl" />
        <Skeleton className="h-4 w-3/4 rounded-xl" />
      </div>
      <div data-skeletons="slots" className={SLOT_GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-11 rounded-full" />
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const confirm = requireEl(canvasElement, '[data-skeletons="confirm"]');
    const slots = requireEl(canvasElement, '[data-skeletons="slots"]');
    const all = [
      ...confirm.querySelectorAll<HTMLElement>(':scope > div'),
      ...slots.querySelectorAll<HTMLElement>(':scope > div'),
    ];
    await expect(all).toHaveLength(9);

    for (const block of all) {
      /* A div, so it adds no phantom role, and no text, so a screen reader is
         told nothing at all about it. The pages announce their own loading
         state in an sr-only live region instead - nine placeholders announcing
         themselves would be nine interruptions. */
      await expect(block.tagName).toBe('DIV');
      await expect(block).not.toHaveAttribute('role');
      await expect(block.textContent).toBe('');

      // yc-shimmer is the only thing separating a placeholder from a plain grey
      // box, and a still grey box reads as content that failed to load.
      await expect(getComputedStyle(block).animationName).not.toBe('none');
      await expect(getComputedStyle(block).backgroundColor).toBe(
        resolveToken(canvasElement, '--band')
      );
    }

    const [disc, headingBar, bodyBar] = confirm.querySelectorAll<HTMLElement>(':scope > div');
    const discBox = disc.getBoundingClientRect();
    await expect(discBox.width).toBeCloseTo(discBox.height, 1);
    await expect(parseFloat(getComputedStyle(disc).borderRadius)).toBeGreaterThanOrEqual(
      discBox.width / 2
    );

    /* Relations, not pixel counts: the heading placeholder stands in for a
       larger line than the body one, and the body line runs longer. A font or
       spacing change moves both numbers without failing this. */
    await expect(headingBar.getBoundingClientRect().height).toBeGreaterThan(
      bodyBar.getBoundingClientRect().height
    );
    await expect(headingBar.getBoundingClientRect().width).toBeLessThan(
      bodyBar.getBoundingClientRect().width
    );
  },
};
