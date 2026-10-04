import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { StatusOption } from '@/app/features/companions/pages/Companions/types';
import { InvoiceStatusFilters } from '@/app/features/finance/types/invoice';
import InvoiceStatusFilterPills from './InvoiceStatusFilterPills';

/**
 * Resolve a CSS custom property to the colour it actually computes to here, by
 * painting it onto a throwaway probe. Comparing computed colours rather than
 * class names is the only way to catch a chip that silently stopped applying its
 * token set - the markup is identical either way.
 */
const resolveToken = (host: HTMLElement, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  host.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  if (value === 'rgba(0, 0, 0, 0)') {
    throw new Error(`Token ${token} resolved to transparent - it does not exist here.`);
  }
  return value;
};

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const group = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByRole('group', { name: 'Filter invoices by status' });

const pill = (canvasElement: HTMLElement, name: string): HTMLElement =>
  within(group(canvasElement)).getByRole('button', { name });

/**
 * The three colours a chip is drawn in, resolved against the live theme. Each
 * chip is a single `FilterChip` button (fa40ef533): the button itself carries
 * the fill, ring and ink, with no status badge nested inside it.
 */
const chipColours = (chip: HTMLElement) => {
  const style = getComputedStyle(chip);
  return { bg: style.backgroundColor, border: style.borderColor, ink: style.color };
};

/**
 * Hand-built options, one bare and one carrying a pill tint. `StatusOption`
 * lets an option ship its own bg/text/border tokens; the filter row ignores
 * them, so both must draw exactly like every other chip.
 */
const FALLBACK_OPTIONS: StatusOption[] = [
  { name: 'All', key: 'all' },
  { name: 'Untokened', key: 'untokened' },
  { name: 'Tinted', key: 'tinted', bg: 'var(--color-pill-info-bg)' },
];

/**
 * The component is controlled - it never holds `activeStatus` - so a click only
 * moves the pressed state if the caller echoes the key back. Lifting that state
 * here is what makes the aria-pressed swap observable at all; hooks live in a
 * named component because `react-hooks/rules-of-hooks` rejects them in `render`.
 */
const ControlledPills = (args: ComponentProps<typeof InvoiceStatusFilterPills>) => {
  const [active, setActive] = useState(args.activeStatus);
  return (
    <InvoiceStatusFilterPills
      {...args}
      activeStatus={active}
      setActiveStatus={(value) => {
        args.setActiveStatus(value);
        setActive(value);
      }}
    />
  );
};

const meta = {
  title: 'Finance/InvoiceStatusFilterPills',
  component: InvoiceStatusFilterPills,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The finance list's status filter, as a row of filter chips rather than the shared " +
          '"All statuses" dropdown. Both the desktop header row and the phone list mount this same ' +
          'component.\n\n' +
          'Each option is a shared `FilterChip`, sentence case, in one of two states whatever the ' +
          "option's own colour tokens say:\n\n" +
          '- **Inactive** - transparent fill, a `--hairline` ring and 600 `--ink-muted`.\n' +
          '- **Active** - the solid `--chip-selected-*` pill, 700 weight. "All" is not a special ' +
          'case, and a status is not painted in its invoice colour: the row reads as a set of ' +
          'filters rather than a row of statuses.\n\n' +
          'A group, not a radio set: each chip is a `button` with `aria-pressed`, so the pressed ' +
          'state is announced as well as drawn.\n\n' +
          'One geometry throughout: 32px tall, the design system’s `--control-h-sm`. There used to ' +
          'be a `size` prop for a bigger tap target; it stopped having any effect when the badge ' +
          'geometry moved into the shared `StatusPill` primitive, so it has been removed rather ' +
          'than left accepting a value it ignores.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    options: InvoiceStatusFilters,
    activeStatus: 'all',
    setActiveStatus: fn(),
  },
} satisfies Meta<typeof InvoiceStatusFilterPills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllSelected: Story = {
  name: 'All selected',
  play: async ({ canvasElement }) => {
    const all = pill(canvasElement, 'All');
    const paid = pill(canvasElement, 'Paid');

    // Seven backend statuses, exactly one of them pressed. The pressed state is the
    // only thing a screen reader gets here - there is no radiogroup and no selected
    // role - so a group that pressed none, or two, would read as no filter at all.
    await expect(within(group(canvasElement)).getAllByRole('button')).toHaveLength(7);
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(paid).toHaveAttribute('aria-pressed', 'false');

    const selectedBg = resolveToken(canvasElement, '--chip-selected-bg');
    const selectedBorder = resolveToken(canvasElement, '--chip-selected-border');
    const selectedInk = resolveToken(canvasElement, '--chip-selected-ink');
    const hairline = resolveToken(canvasElement, '--hairline');
    const inkMuted = resolveToken(canvasElement, '--ink-muted');

    /* The active chip is the solid selected pill, asserted against the three
       --chip-selected tokens rather than against "not transparent", so a chip that
       fell back to a pill tint would fail. Polled: the chip carries
       `transition-colors`, so a single read can catch an interpolated value. */
    await waitFor(() => {
      expect(chipColours(all)).toEqual({
        bg: selectedBg,
        border: selectedBorder,
        ink: selectedInk,
      });
    });
    await expect(getComputedStyle(all).fontWeight).toBe('700');

    /* Every unselected chip is the same outline, which is why the rail does not read
       as seven coloured statuses. 600 against the active 700 is the weight half. */
    await waitFor(() => {
      expect(chipColours(paid)).toEqual({ bg: TRANSPARENT, border: hairline, ink: inkMuted });
    });
    await expect(getComputedStyle(paid).fontWeight).toBe('600');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state: "All" pressed and drawn as the solid selected chip, every other ' +
          'status an identical hairline outline.',
      },
    },
  },
};

export const StatusSelected: Story = {
  name: 'A status selected',
  args: { activeStatus: 'paid' },
  play: async ({ canvasElement }) => {
    const paid = pill(canvasElement, 'Paid');
    const all = pill(canvasElement, 'All');

    const selectedBg = resolveToken(canvasElement, '--chip-selected-bg');
    const selectedInk = resolveToken(canvasElement, '--chip-selected-ink');
    const successBg = resolveToken(canvasElement, '--color-pill-success-bg');

    /* A filter is a chip, not a status pill: Paid pressed draws in the same selected
       colours as any other chip, not in the green its invoices wear in the list. The
       `not.toBe(successBg)` half is the one that matters - a row painting each active
       chip in its status colour would read as a row of statuses again. */
    await expect(paid).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(getComputedStyle(paid).backgroundColor).toBe(selectedBg);
      expect(getComputedStyle(paid).color).toBe(selectedInk);
    });
    await expect(getComputedStyle(paid).backgroundColor).not.toBe(successBg);

    // And All is now just another outline.
    await waitFor(() => {
      expect(getComputedStyle(all).backgroundColor).toBe(TRANSPARENT);
    });
    await expect(all).toHaveAttribute('aria-pressed', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Filtering to Paid. The chip takes the selected fill, not the green the Paid status wears ' +
          'in the list, so the toolbar reads as filters rather than as another row of statuses.',
      },
    },
  },
};

export const TokenFallbacks: Story = {
  name: 'Options carrying their own colour tokens',
  args: { options: FALLBACK_OPTIONS, activeStatus: 'untokened' },
  render: (args) => <ControlledPills {...args} />,
  play: async ({ args, canvasElement }) => {
    const untokened = pill(canvasElement, 'Untokened');
    const selectedBg = resolveToken(canvasElement, '--chip-selected-bg');
    const selectedBorder = resolveToken(canvasElement, '--chip-selected-border');

    /* An option with no colour tokens at all still draws as the solid selected chip
       when pressed, rather than as a transparent outline that would look inactive. */
    await waitFor(() => {
      expect(getComputedStyle(untokened).backgroundColor).toBe(selectedBg);
      expect(getComputedStyle(untokened).borderColor).toBe(selectedBorder);
    });

    await userEvent.click(pill(canvasElement, 'Tinted'));

    /* The KEY, not the display name. The page filters on a lowercased status key, so a
       pill that handed back "Tinted" would match no invoice and silently empty the
       list. */
    await expect(args.setActiveStatus).toHaveBeenCalledWith('tinted');

    // Controlled: the pressed state only moves because this story echoed the key back.
    const tinted = pill(canvasElement, 'Tinted');
    await expect(tinted).toHaveAttribute('aria-pressed', 'true');
    await expect(pill(canvasElement, 'Untokened')).toHaveAttribute('aria-pressed', 'false');
    await expect(
      within(group(canvasElement))
        .getAllByRole('button')
        .filter((button) => button.getAttribute('aria-pressed') === 'true')
    ).toHaveLength(1);

    /* The option's own tint is ignored: pressed, it is drawn exactly like the bare
       option was, so a hand-built option table cannot reintroduce status colours. */
    const infoBg = resolveToken(canvasElement, '--color-pill-info-bg');
    await waitFor(() => {
      expect(getComputedStyle(tinted).backgroundColor).toBe(selectedBg);
      expect(getComputedStyle(tinted).borderColor).toBe(selectedBorder);
    });
    await expect(getComputedStyle(tinted).backgroundColor).not.toBe(infoBg);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three options built by hand instead of from `InvoiceStatusFilters`: one with no colour ' +
          'at all, one carrying a pill tint. The row ignores both, so pressed they draw as the same ' +
          'selected chip and unpressed as the same outline.',
      },
    },
  },
};

export const Geometry: Story = {
  name: 'One chip geometry',
  args: { activeStatus: 'paid' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const paid = canvas.getByRole('button', { name: 'Paid' });
    const all = canvas.getByRole('button', { name: 'All' });

    /* Was 'sm and md tap targets', rendering the rail twice and asserting the md
       button was TALLER than the sm one. The `size` prop it relied on had already
       stopped doing anything when the row moved to the shared filter chip, so
       that assertion could no longer pass - and a play function that cannot pass
       fails silently unless something reads the addons channel. The prop is now
       gone, and this measures the single geometry instead.

       32px is the design system's own `--control-h-sm`, the height it specifies
       for "chips, table row actions, compact toolbars". Measured rather than
       matched on a class name, so a restyle that keeps the height passes and one
       that changes it fails. */
    await expect(paid.getBoundingClientRect().height).toBeCloseTo(32, 0);
    await expect(all.getBoundingClientRect().height).toBeCloseTo(32, 0);

    // Selected and unselected differ in colour only, never in size: a rail whose
    // chips changed width on selection made the whole row reflow on every click.
    await expect(paid.getBoundingClientRect().height).toBeCloseTo(
      all.getBoundingClientRect().height,
      1
    );

    /* A chip, not a status pill wrapped in a button: no badge is nested inside, and
       the label is sentence case rather than the pill's ALL-CAPS. */
    await expect(paid.querySelector('.yc-status-pill')).toBeNull();
    await expect(getComputedStyle(paid).textTransform).toBe('none');
  },
  parameters: {
    docs: {
      description: {
        story:
          'One geometry for every chip, selected or not: 32px tall, the design system’s ' +
          '`--control-h-sm`. This story replaced a pair that claimed to show "sm" and "md" tap ' +
          'targets - the `size` prop behind them had stopped having any effect when the row moved ' +
          'to the shared filter chip, so the two rails were identical and the assertion comparing ' +
          'them could not pass.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the group never clips itself',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* The box is pinned to 375px here as well as through the viewport global. The
     global is what a human sees when they open the story; the explicit width is
     what makes the overflow relation below measurable, since a headless runner
     that loads `iframe.html` directly never applies the global and would render
     this at panel width, where seven pills fit and the assertion is vacuous. */
  decorators: [
    (Story) => (
      <div style={{ width: 375 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const rail = group(canvasElement);

    /* Seven statuses do not fit in 375px, and this component does nothing about it:
       the buttons are `shrink-0` and the group is `overflow: visible`. Overflow is the
       CALLER's job - PhoneInvoiceList wraps it in an `overflow-x-auto` scroller, the
       desktop header passes `flex-wrap`. Pinned here so a well-meaning `overflow-hidden`
       on the group, which would silently amputate the last statuses on a phone, fails
       a test instead of shipping. */
    await expect(getComputedStyle(rail).overflowX).toBe('visible');
    await expect(getComputedStyle(rail).flexWrap).toBe('nowrap');
    await expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth);
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the seven pills are wider than the screen. The component neither scrolls nor ' +
          'wraps on its own, so every caller has to decide which it wants.',
      },
    },
  },
};
