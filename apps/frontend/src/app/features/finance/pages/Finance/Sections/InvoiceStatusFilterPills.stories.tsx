import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { StatusOption } from '@/app/features/companions/pages/Companions/types';
import { InvoiceStatusFilters } from '@/app/features/finance/types/invoice';
import InvoiceStatusFilterPills from './InvoiceStatusFilterPills';

/**
 * Resolve a CSS custom property to the colour it actually computes to here, by
 * painting it onto a throwaway probe. Comparing computed colours rather than
 * class names is the only way to catch a pill that silently stopped applying its
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

/** The badge inside a pill button - the element that actually carries the colour. */
const badge = (button: HTMLElement): HTMLElement =>
  button.querySelector('.yc-status-pill') as HTMLElement;

/**
 * Two options that exercise the token fallback chain, which the real
 * `InvoiceStatusFilters` never does because every entry there is built from a
 * complete `--color-pill-*` triple.
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
          "The finance list's status filter, as inline segmented pills rather than the shared " +
          '"All statuses" dropdown. Both the desktop header row and the phone list mount this same ' +
          'component.\n\n' +
          'Colour carries the entire state, and it is computed in three different ways depending on ' +
          'the pill:\n\n' +
          '- **Inactive** - transparent fill, a `--hairline` ring and 600 `--ink-muted`, whatever ' +
          "the option's own tokens say. Everything unselected looks identical.\n" +
          '- **Active "All"** - a deliberate special case keyed off `option.key === "all"`: ' +
          '`--inset` fill, `--divider` ring, 700 `--ink`. Without it, All would paint itself in the ' +
          'neutral pill tokens and read as just another status rather than as "no filter".\n' +
          "- **Any other active status** - the option's own bg/text/border tokens, untouched.\n\n" +
          'A group, not a radio set: each pill is a `button` with `aria-pressed`, so the pressed ' +
          'state is announced even though nothing but the fill distinguishes it visually.\n\n' +
          '`size` changes the tap target only. The badge geometry moved into the shared `StatusPill` ' +
          'primitive, and the prop stayed behind for callers.',
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

    const inset = resolveToken(canvasElement, '--inset');
    const divider = resolveToken(canvasElement, '--divider');
    const ink = resolveToken(canvasElement, '--ink');
    const hairline = resolveToken(canvasElement, '--hairline');
    const inkMuted = resolveToken(canvasElement, '--ink-muted');

    /* The "all" special case, asserted against --inset rather than against "not
       transparent". All's own tokens are the neutral pill set, so dropping the
       `key === 'all'` branch would still paint it - just in --color-pill-neutral-bg,
       a different, lighter fill that makes "no filter" look like a status. Polled:
       these colours are inherited through the theme's transition. */
    const allBadge = badge(all);
    const paidBadge = badge(paid);
    await waitFor(() => {
      expect(getComputedStyle(allBadge).backgroundColor).toBe(inset);
      expect(getComputedStyle(allBadge).borderColor).toBe(divider);
      expect(getComputedStyle(allBadge).color).toBe(ink);
    });
    await expect(getComputedStyle(allBadge).fontWeight).toBe('700');

    /* Every unselected pill is flattened to the same outline regardless of its own
       colour, which is why the rail does not read as seven coloured chips. 600 against
       the active 700 is the weight half of that. */
    await waitFor(() => {
      expect(getComputedStyle(paidBadge).backgroundColor).toBe(TRANSPARENT);
      expect(getComputedStyle(paidBadge).borderColor).toBe(hairline);
      expect(getComputedStyle(paidBadge).color).toBe(inkMuted);
    });
    await expect(getComputedStyle(paidBadge).fontWeight).toBe('600');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state. "All" is the only pill the component styles by name, and it is the ' +
          'one state where the fill comes from the surface tokens (`--inset` / `--divider`) instead ' +
          'of the pill palette.',
      },
    },
  },
};

export const StatusSelected: Story = {
  name: 'A coloured status selected',
  args: { activeStatus: 'paid' },
  play: async ({ canvasElement }) => {
    const paidBadge = badge(pill(canvasElement, 'Paid'));
    const allBadge = badge(pill(canvasElement, 'All'));

    const successBg = resolveToken(canvasElement, '--color-pill-success-bg');
    const successText = resolveToken(canvasElement, '--color-pill-success-text');
    const inset = resolveToken(canvasElement, '--inset');

    /* Selecting anything other than All takes the OTHER branch: no inline style at
       all, so the option's own token triple reaches the badge untouched. Asserting it
       is not --inset is the half that matters - a `key === 'all'` check written as a
       truthiness test would paint every active pill with the flat inset treatment and
       lose the status colour entirely. */
    await waitFor(() => {
      expect(getComputedStyle(paidBadge).backgroundColor).toBe(successBg);
      expect(getComputedStyle(paidBadge).color).toBe(successText);
    });
    await expect(getComputedStyle(paidBadge).backgroundColor).not.toBe(inset);

    // And All is now just another outline, with no memory of its special case.
    await waitFor(() => {
      expect(getComputedStyle(allBadge).backgroundColor).toBe(TRANSPARENT);
    });
    await expect(pill(canvasElement, 'All')).toHaveAttribute('aria-pressed', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Filtering to Paid. The green here is the invoice status colour used everywhere else in ' +
          'finance, not a selection colour, so the rail doubles as a legend for the list below it.',
      },
    },
  },
};

export const TokenFallbacks: Story = {
  name: 'Options with missing colour tokens',
  args: { options: FALLBACK_OPTIONS, activeStatus: 'untokened' },
  render: (args) => <ControlledPills {...args} />,
  play: async ({ args, canvasElement }) => {
    const untokened = pill(canvasElement, 'Untokened');
    const neutralBg = resolveToken(canvasElement, '--color-pill-neutral-bg');
    const neutralBorder = resolveToken(canvasElement, '--color-pill-neutral-border');

    /* `StatusOption` makes bg/text/border optional, so an option table can ship an
       entry with none of them. Active, that option falls back to the neutral pill set
       rather than to an unstyled transparent badge that would look inactive while
       being pressed. */
    await waitFor(() => {
      expect(getComputedStyle(badge(untokened)).backgroundColor).toBe(neutralBg);
      expect(getComputedStyle(badge(untokened)).borderColor).toBe(neutralBorder);
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

    /* Second fallback rung: a bg with no border reuses the bg, so a tinted pill gets a
       tinted ring. Falling through to the neutral border instead would hang a grey
       outline on a coloured fill. */
    const infoBg = resolveToken(canvasElement, '--color-pill-info-bg');
    await waitFor(() => {
      expect(getComputedStyle(badge(tinted)).backgroundColor).toBe(infoBg);
      expect(getComputedStyle(badge(tinted)).borderColor).toBe(infoBg);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three options built by hand instead of from the `--color-pill-*` triples: one with no ' +
          'colour at all, one with a fill but no border. Both fallbacks are only visible while the ' +
          'option is selected, because an unselected pill is overridden to a transparent outline ' +
          'whatever its tokens say.',
      },
    },
  },
};

export const Sizes: Story = {
  name: 'sm and md tap targets',
  args: { activeStatus: 'paid' },
  render: (args) => (
    <div className="flex flex-col gap-6">
      <InvoiceStatusFilterPills {...args} size="sm" />
      <InvoiceStatusFilterPills {...args} size="md" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [smGroup, mdGroup] = within(canvasElement).getAllByRole('group', {
      name: 'Filter invoices by status',
    });
    const smButton = within(smGroup).getByRole('button', { name: 'Paid' });
    const mdButton = within(mdGroup).getByRole('button', { name: 'Paid' });

    /* `size` buys a tap target and nothing else: md pads the button out to the 38px
       minimum the phone rail needs, sm collapses it onto the badge (p-0). A thumb
       cannot reliably hit a 21px target, so a regression that dropped the md branch
       would be invisible on desktop and unusable on a phone. */
    await expect(mdButton.getBoundingClientRect().height).toBeGreaterThanOrEqual(38);
    await expect(mdButton.getBoundingClientRect().height).toBeGreaterThan(
      smButton.getBoundingClientRect().height
    );

    /* The badge itself must NOT resize. Geometry moved into the shared StatusPill so
       one status reads at one size everywhere; wiring `size` back into the pill would
       reintroduce exactly the two-sizes-of-the-same-badge bug that move fixed. */
    await expect(badge(mdButton).getBoundingClientRect().height).toBeCloseTo(
      badge(smButton).getBoundingClientRect().height,
      1
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same rail at both sizes. Nothing about the badge changes between them - only the ' +
          'invisible padding around it, which is the whole reason the prop survived the move to ' +
          '`StatusPill`.',
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
