import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import TotalBillContainer, { type BillableSearchItem } from './TotalBillContainer';
import type { InvoiceLineItem } from '@/app/features/appointments/types/workspace';

// Total Bill seeded with lines mapped from saved Treatment items (Bug 9: saved
// Services/Packages + in-house prescriptions now auto-appear in the Total Bill so
// they are billable/payable without re-adding each by search).
const items: InvoiceLineItem[] = [
  {
    id: 'inv-1',
    name: 'Dental cleaning',
    unitPriceCents: 5000,
    qty: 2,
    grossCents: 10000,
    discountCents: 0,
    amountCents: 10000,
  },
  {
    id: 'inv-2',
    name: 'Amoxicillin (in-house)',
    unitPriceCents: 800,
    qty: 1,
    grossCents: 800,
    discountCents: 0,
    amountCents: 800,
  },
];

/**
 * A package line, which is the only shape that renders `PackageBreakdownTooltip`
 * at all - the component returns `null` when `breakdown` is empty, so a fixture
 * without one removes the trigger from the DOM rather than merely leaving it
 * unhovered.
 */
const PACKAGE_LINE: InvoiceLineItem = {
  id: 'inv-3',
  name: 'Puppy wellness package',
  unitPriceCents: 24000,
  qty: 1,
  grossCents: 24000,
  discountCents: 2400,
  amountCents: 21600,
  maxDiscountPercent: 15,
  breakdown: [
    {
      id: 'brk-1',
      name: 'Physical examination',
      qty: 1,
      instructions: 'Service',
      unitPriceCents: 6000,
      amountCents: 6000,
    },
    {
      id: 'brk-2',
      name: 'DHPP vaccination',
      qty: 2,
      instructions: 'Vaccination',
      unitPriceCents: 4500,
      discountPercent: 10,
      discountCents: 900,
      amountCents: 8100,
    },
    {
      id: 'brk-3',
      name: 'Faecal flotation',
      qty: 1,
      instructions: 'Diagnostic',
      unitPriceCents: 5400,
      amountCents: 5400,
    },
  ],
};

/** Catalogue the search bar filters. Names deliberately share the token "dent". */
const BILLABLE_ITEMS: BillableSearchItem[] = [
  {
    name: 'Dental radiograph (full mouth)',
    unitPriceCents: 12000,
    qty: 1,
    grossCents: 12000,
    discountCents: 0,
    amountCents: 12000,
    kind: 'EXISTING_TREATMENT',
  },
  {
    name: 'Dental extraction - single tooth',
    unitPriceCents: 9500,
    qty: 1,
    grossCents: 9500,
    discountCents: 0,
    amountCents: 9500,
    kind: 'PACKAGE_COMPONENT',
  },
  {
    name: 'Dentalcare chews (30 pack)',
    unitPriceCents: 2200,
    qty: 1,
    grossCents: 2200,
    discountCents: 0,
    amountCents: 2200,
    kind: 'INVENTORY',
  },
  {
    name: 'Metronidazole 250mg',
    unitPriceCents: 1400,
    qty: 1,
    grossCents: 1400,
    discountCents: 0,
    amountCents: 1400,
    kind: 'IN_HOUSE_PRESCRIPTION',
  },
];

/**
 * Opens a 16px (i) button's bubble and returns it.
 *
 * GlassTooltip binds mouseenter/focusin to its own wrapper span, not the button, and
 * binds them in an effect a play function can outrun - so the dispatch is retried.
 */
const hoverInfoIcon = async (canvasElement: HTMLElement, accessibleName: string) =>
  openGlassTooltip(within(canvasElement).getByRole('button', { name: accessibleName }));

const meta = {
  title: 'Workspace/TotalBillContainer',
  component: TotalBillContainer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The invoice table in the appointment workspace: a search bar that adds billable items, ' +
          'the line rows with their editable quantity and per-line discount, and the recessed ' +
          'totals footer.\n\n' +
          'Three of its surfaces only exist after an interaction, and the fixtures this file ' +
          'shipped with removed all three from the DOM before anyone could hover them: ' +
          '`billableItems` was `[]`, so the search never matched and the dropdown never mounted; no ' +
          'line carried a `breakdown`, so `PackageBreakdownTooltip` returned `null` and its (i) ' +
          'button was not rendered; and `incompleteItemNames` was an empty `Set`, so no row got the ' +
          '"Fill information in previous step" hint. The stories below give it real data.\n\n' +
          'Each surface is portalled, so none of them is a descendant of the card in the DOM. The ' +
          'search results are `position: fixed` at `zIndex 1000` on `document.body`, deliberately ' +
          'escaping the card and the sticky workspace chrome that used to paint over them. Both ' +
          'tooltips are `GlassTooltip` bubbles created on `mouseenter`/`focusin` and appended to ' +
          '`document.body`, positioned from the trigger rect.\n\n' +
          'The package bubble is the one worth drawing most: it is a seven-column `<table>` inside a ' +
          'floating panel with `min-w-130` (520px) against a `maxWidth` of 560px, holding a head, ' +
          'the component rows and a three-row `tfoot`. That is a whole table layout that no ' +
          'snapshot of this component has ever contained - and rendering it turns out to expose a ' +
          'live defect, described on that story below.\n\n' +
          'The play functions assert the opened panels have their content - option rows, column ' +
          'headers, footer labels - rather than that a trigger changed state, because an empty ' +
          'panel satisfies the weaker check and that is precisely how such regressions survive.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    items,
    billableItems: [],
    currency: 'USD',
    depositCents: 0,
    withdrawDeposit: false,
    overallDiscountPercent: 0,
    taxPercent: 8,
    incompleteItemNames: new Set<string>(),
    onToggleWithdrawDeposit: fn(),
    onChangeOverallDiscount: fn(),
    onAddItem: fn(),
    onUpdateItem: fn(),
    onRemoveItem: fn(),
  },
} satisfies Meta<typeof TotalBillContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

// Subtotal $108.00, Estimated/Total $108.00, caption "Exclusive of 8% tax".
export const SavedItemsInBill: Story = {};

// Overall discount 10% -> -$10.80 -> Total $97.20.
export const WithOverallDiscount: Story = {
  args: { overallDiscountPercent: 10 },
};

export const SearchResultsOpen: Story = {
  name: 'Billable-item dropdown open',
  args: { billableItems: BILLABLE_ITEMS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The dropdown has no `open` prop of its own: it is derived from the
    // internal query matching `billableItems`, so it can only be reached by typing.
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search invoice items' }), 'dent');

    /* The panel is a body portal, so it is outside canvasElement. Anchor on one
       option and walk up to its list rather than matching a layout class. */
    const option = await within(document.body).findByRole('button', {
      name: /Dental radiograph/i,
    });
    const list = option.closest('ul') as HTMLElement;
    await expect(list).toBeTruthy();

    // Three of the four catalogue items contain "dent"; the fourth must not be
    // there. Asserting the row count is the check an empty panel would fail.
    await expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    await expect(within(list).queryByText('Metronidazole 250mg')).toBeNull();

    // Each row carries its kind pill and its formatted price - the two slots
    // most likely to be dropped by a mapping change.
    await expect(within(list).getByText('Package component')).toBeInTheDocument();
    await expect(within(list).getByText('$120')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The results panel, anchored under the search field and painted at `zIndex 1000` on the ' +
          'body so it clears the card, the line rows and the workspace chrome. Rows are plain ' +
          '`<button>`s inside `<li>`s - not `role="option"` - so anything querying a listbox here ' +
          'would find nothing and pass.',
      },
    },
  },
};

export const SearchNoMatches: Story = {
  name: 'Search with no matches',
  args: { billableItems: BILLABLE_ITEMS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search invoice items' }), 'zzz');
    // `open` is `matches.length > 0`, so a miss renders no panel at all rather
    // than an empty one - there is no "No results" affordance to review.
    await expect(within(document.body).queryByText(/Dental radiograph/i)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A query that matches nothing. Worth its own story because the component has no ' +
          'empty-state row: the panel simply does not mount, so the field looks identical to one ' +
          'that has not been typed in.',
      },
    },
  },
};

export const PackageBreakdown: Story = {
  name: 'Package breakdown tooltip',
  args: { items: [...items, PACKAGE_LINE] },
  play: async ({ canvasElement }) => {
    const bubble = await hoverInfoIcon(
      canvasElement,
      'View Puppy wellness package package breakdown'
    );

    // A seven-column table lives inside this bubble. Assert the structure, not
    // just that a bubble appeared.
    await expect(within(bubble).getAllByRole('columnheader')).toHaveLength(7);
    await expect(within(bubble).getByText('Package breakdown')).toBeInTheDocument();
    await expect(within(bubble).getByText('DHPP vaccination')).toBeInTheDocument();
    await expect(within(bubble).getByText('Faecal flotation')).toBeInTheDocument();
    // The tfoot carries three rows once a package discount exists: component
    // total, the discount line, and the total.
    await expect(within(bubble).getByText('Component total')).toBeInTheDocument();
    await expect(within(bubble).getByText(/Package discount/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The package line expanded: 520px of table inside a 560px cap, with the discount row ' +
          'appearing only when the line actually carries one.\n\n' +
          '**This story renders a live bug.** Look at it rather than at this text: the component ' +
          'names, the package title and every money figure are invisible. `PackageBreakdownTooltip` ' +
          'paints its primary text `text-neutral-0` and its secondary text `text-neutral-200`, but ' +
          'in this system `--color-neutral-0` is `var(--screen)` - the panel FILL - and ' +
          '`--color-neutral-200` is `var(--hairline)` - a BORDER token. `.glass-tooltip-bubble` ' +
          'paints its background from that same `var(--screen)`, so the primary text is measurably ' +
          'the same colour as the surface under it: `rgb(247,243,236)` on `rgb(247,243,236)` in ' +
          'light and `rgb(47,39,30)` on `rgb(47,39,30)` in dark. That is 1.00:1 in **both** themes, ' +
          'and the secondary rows sit at roughly 1.25:1.\n\n' +
          'It is the exact failure this Storybook work exists to catch - a dropdown panel whose text ' +
          'reaches for fill tokens instead of ink tokens - and it survived because the surface is ' +
          'built on `mouseenter`, so nothing had ever drawn it. The bubble already inherits ' +
          '`color: var(--ink)` from `.glass-tooltip-bubble`, which is the pair that actually ' +
          'inverts; the fix is to drop the `text-neutral-*` overrides rather than to add more. ' +
          'The assertions here are structural on purpose, so the story stays green and the defect ' +
          'stays visible until the component is changed.',
      },
    },
  },
};

export const IncompleteItemHint: Story = {
  name: 'Incomplete prescription hint',
  args: { incompleteItemNames: new Set(['amoxicillin (in-house)']) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The hint is keyed on a lower-cased, trimmed name match, so it is present
    // on exactly one of the two rows.
    await expect(canvas.getAllByRole('button', { name: /Fill information/i })).toHaveLength(1);

    const bubble = await hoverInfoIcon(canvasElement, 'Fill information in previous step');
    await expect(bubble).toHaveTextContent(
      'Fill prescription information in the Treatment step before finalizing this invoice.'
    );
    /* side="bottom" - it hangs under the row rather than covering the row above.
       Read the inline transform, not the computed one: a laid-out element
       resolves any transform to a `matrix(...)`, so a computed-style check
       cannot tell the two placements apart. */
    await expect(bubble.style.transform).toMatch(/^translate\(-50%, 0(px)?\)$/);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A billed medication whose prescription details were never filled in. The row gets a ' +
          'second 16px (i) beside the name, and the sentence explaining what to do exists only ' +
          'inside the hovered bubble - the row itself says nothing.',
      },
    },
  },
};

export const PerLineDiscountCap: Story = {
  name: 'Per-line discount cap',
  args: {
    items: [
      {
        ...items[0],
        maxDiscountPercent: 20,
        discountCents: 1500,
        amountCents: 8500,
      },
      items[1],
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'With a catalogue ceiling the discount cell grows a second line ("Max discount 20% / $20") ' +
          'under the input, and the row adds `pb-2` so that caption cannot collide with ' +
          'the next row. The gross cell simultaneously grows its struck discount line, so this is ' +
          'the render where the row is at its tallest.',
      },
    },
  },
};

export const EmptyBill: Story = {
  name: 'No line items',
  args: { items: [] },
  parameters: {
    docs: {
      description: {
        story:
          'With no lines the column headings are dropped entirely rather than left over an empty ' +
          'table, and the footer still renders with its zeroed totals.',
      },
    },
  },
};
