import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import PackageBreakdownTable from './PackageBreakdownTable';

const NESTED: PackageBreakdownItem[] = [
  {
    id: 'nested-1',
    type: 'CONSULTATION',
    name: 'Pre-anaesthetic consultation',
    unitPrice: 68,
    quantity: 1,
    discount: 0,
  },
  {
    id: 'nested-2',
    type: 'LAB',
    name: 'Pre-anaesthetic bloods (full panel)',
    unitPrice: 124.5,
    quantity: 1,
    discount: 10,
  },
  {
    id: 'nested-3',
    type: 'MEDICATION',
    name: 'Meloxicam 1.5 mg/ml oral suspension',
    unitPrice: 22.4,
    quantity: 2,
    discount: 5,
  },
];

const ITEMS: PackageBreakdownItem[] = [
  {
    id: 'item-1',
    type: 'CONSULTATION',
    name: 'Dental consultation',
    unitPrice: 72,
    quantity: 1,
    discount: 0,
    maxDiscount: 20,
  },
  {
    id: 'item-2',
    type: 'PROCEDURE',
    name: 'Scale and polish under GA',
    unitPrice: 310,
    quantity: 1,
    discount: 12.5,
    maxDiscount: 25,
  },
  {
    id: 'item-3',
    type: 'PACKAGE',
    name: 'Pre-anaesthetic workup',
    unitPrice: 214.9,
    quantity: 1,
    discount: 5,
    maxDiscount: 15,
    nestedBreakdown: NESTED,
  },
  {
    id: 'item-4',
    type: 'INVENTORY',
    name: 'Dental radiograph plate',
    unitPrice: 18,
    quantity: 4,
    discount: 0,
  },
];

/**
 * Holds the rows in state, the way both call sites do.
 *
 * The quantity and discount fields are controlled by `item.quantity` / `item.discount`,
 * so a story passing static args cannot type a second character into them: every
 * keystroke re-renders the field back to the prop. That makes the discount clamp
 * unreachable, because the ceiling is 20 and no single digit exceeds it - which is
 * exactly how the first version of the story below failed.
 */
const Stateful = ({
  initialItems,
  additionalDiscount,
  onChangeQty,
  onChangeDiscount,
  onRemoveItem,
}: {
  initialItems: PackageBreakdownItem[];
  additionalDiscount: number;
  onChangeQty?: (id: string, qty: number) => void;
  onChangeDiscount?: (id: string, discount: number) => void;
  onRemoveItem?: (id: string) => void;
}) => {
  const [items, setItems] = useState(initialItems);
  const patch = (id: string, change: Partial<PackageBreakdownItem>) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...change } : item)));

  return (
    <PackageBreakdownTable
      items={items}
      additionalDiscount={additionalDiscount}
      editable
      onChangeQty={(id, qty) => {
        patch(id, { quantity: qty });
        onChangeQty?.(id, qty);
      }}
      onChangeDiscount={(id, discount) => {
        patch(id, { discount });
        onChangeDiscount?.(id, discount);
      }}
      onRemoveItem={(id) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        onRemoveItem?.(id);
      }}
    />
  );
};

const meta = {
  title: 'Organization/PackageBreakdownTable',
  component: PackageBreakdownTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The line-by-line cost table behind a package: eight columns of catalogue rows, ' +
          'a discount line and a total, with a ninth actions column when it is editable.\n\n' +
          'It had no story anywhere, in either of its two call sites - the packages tab and ' +
          'the package form - and neither call site is reachable in Storybook without seeding ' +
          '`useRevampCatalogStore` and stubbing its loader. Drawn directly here instead, which ' +
          'needs no mock at all: every input is a prop.\n\n' +
          'The surface most worth having drawn is the **nested breakdown tooltip**. A row whose ' +
          'type is `PACKAGE` and which carries a `nestedBreakdown` grows an (i) that opens a ' +
          'seven-column table *inside a tooltip bubble* - a table within a tooltip within a ' +
          'table. That is the same shape as `PackageBreakdownTooltip`, which shipped its entire ' +
          'table at 1.00:1 against the bubble and reached dev that way, because nothing had ' +
          'ever opened it. This one inherits `--ink` from `.glass-tooltip-bubble` and names ' +
          '`--ink-muted` explicitly for its headers, so it survives the same check - but that ' +
          'was luck until a story asserted it.\n\n' +
          'The bubble also needs `maxWidth={440}` from the call site: the nested table sets a ' +
          '`min-width: 360px` while `.glass-tooltip-bubble` caps itself at `min(320px, ...)`, ' +
          'so without the override the table would be wider than the bubble holding it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    items: ITEMS,
    additionalDiscount: 0,
  },
} satisfies Meta<typeof PackageBreakdownTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {
  name: 'Read-only',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The colgroup and the header row have to agree, or every column below lands
       one track out. Eight of each here; the editable story checks nine. */
    const table = canvas.getByRole('table');
    await expect(table.querySelectorAll('colgroup col')).toHaveLength(8);
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(8);
    // The read-only total is a pill, not a bare number - it has its own ground.
    await expect(canvas.getByText('Total cost')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Quantities and discounts read as text (`×4`, `-12.5%`) and the total sits in a ' +
          '`bg-primary-100` pill 40px tall. This is the form the packages tab shows.',
      },
    },
  },
};

export const NestedBreakdownOpen: Story = {
  name: 'Nested package breakdown (open)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Only the PACKAGE row with a nestedBreakdown grows the (i).
    const rows = canvas.getAllByRole('row');
    await expect(canvasElement.querySelectorAll('.glass-tooltip')).toHaveLength(1);
    await expect(rows.length).toBeGreaterThan(4);

    const bubble = await openGlassTooltip(
      canvasElement.querySelector('.glass-tooltip') as HTMLElement
    );

    /* Assert the nested TABLE rendered, not merely that a bubble appeared. The
       failure this story exists for is a bubble that opens with its contents
       invisible, which an existence check passes happily. */
    const nested = within(bubble);
    await expect(nested.getAllByRole('columnheader')).toHaveLength(7);
    await expect(nested.getByText('Pre-anaesthetic bloods (full panel)')).toBeInTheDocument();
    await expect(nested.getAllByRole('row')).toHaveLength(NESTED.length + 2); // + head + total

    /* And that its text is not the colour of the bubble behind it. `--ink` and
       `--screen` are different tokens; PackageBreakdownTooltip shipped with them
       equal and its whole table disappeared. */
    const bubbleBg = getComputedStyle(bubble).backgroundColor;
    const cellInk = getComputedStyle(nested.getByText('Pre-anaesthetic bloods (full panel)')).color;
    await expect(cellInk).not.toBe(bubbleBg);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The table inside the tooltip inside the table. Its seven columns are a narrower ' +
          'restatement of the outer eight - no Gross column, and Disc./Net abbreviated - and it ' +
          'is styled entirely with inline `style` objects rather than utilities, which is why a ' +
          'stylesheet-level token sweep never sees it.',
      },
    },
  },
};

export const NestedBreakdownDark: Story = {
  name: 'Nested breakdown (dark)',
  globals: { theme: 'dark' },
  play: NestedBreakdownOpen.play,
  parameters: {
    docs: {
      description: {
        story:
          'The same bubble in dark. Both grounds flip - `--screen` and `--ink` swap roles - so a ' +
          'literal colour anywhere in that table would invert rather than track the theme.',
      },
    },
  },
};

export const WithAdditionalDiscount: Story = {
  name: 'With an additional discount',
  args: { additionalDiscount: 7.5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The discount row only exists above zero, and it spans seven of eight columns.
    const row = canvas.getByText(/Additional Discount \(7\.5%\)/);
    await expect(row).toBeInTheDocument();
    await expect(row.getAttribute('colspan')).toBe('7');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A second footer row appears only when the discount is above zero, and it is the one ' +
          'place the table shows a negative amount. Its `colSpan` widens with the editable ' +
          'column, so the two footer rows have to be checked in both modes.',
      },
    },
  },
};

export const Editable: Story = {
  name: 'Editable (package form)',
  args: {
    editable: true,
    additionalDiscount: 7.5,
    onRemoveItem: fn(),
    onChangeQty: fn(),
    onChangeDiscount: fn(),
  },
  render: (args) => (
    <Stateful
      initialItems={args.items}
      additionalDiscount={args.additionalDiscount}
      onChangeQty={args.onChangeQty}
      onChangeDiscount={args.onChangeDiscount}
      onRemoveItem={args.onRemoveItem}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Nine columns now: the actions column carries an sr-only header, not an empty one.
    await expect(canvas.getByRole('table').querySelectorAll('colgroup col')).toHaveLength(9);
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(9);
    await expect(canvas.getByText('Actions')).toHaveClass('sr-only');

    // Quantity floors at 1: emptying the field must not send 0 or NaN upstream.
    const qty = canvas.getByLabelText('Quantity for Dental consultation');
    await userEvent.clear(qty);
    await expect(args.onChangeQty).toHaveBeenLastCalledWith('item-1', 1);

    /* Discount ceilings at the row's own `maxDiscount`, not at 100, and it is per
       row: 20 here, 25 on the procedure below. Reaching that ceiling needs two
       digits, which is only possible because the wrapper feeds the value back. */
    const discount = canvas.getByLabelText('Discount for Dental consultation');
    await userEvent.clear(discount);
    await userEvent.type(discount, '90');
    await expect(args.onChangeDiscount).toHaveBeenLastCalledWith('item-1', 20);
    await expect(discount).toHaveValue(20);

    await userEvent.click(canvas.getByRole('button', { name: 'Remove Dental consultation' }));
    await expect(args.onRemoveItem).toHaveBeenCalledWith('item-1');
    // The row really goes, rather than the callback merely firing.
    await expect(canvas.queryByText('Dental consultation')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The form variant: quantity and discount become number inputs, a trash control appears ' +
          'in a ninth column, and the total drops its pill for plain emphasised text. The play ' +
          'function drives the two clamps, which are the only logic in the file - quantity floors ' +
          "at 1, and discount ceilings at the row's own `maxDiscount` rather than at 100.",
      },
    },
  },
};

export const SingleRow: Story = {
  name: 'One row',
  args: { items: [ITEMS[0]] },
  parameters: {
    docs: {
      description: {
        story:
          'The narrowest the table gets. The `col` widths are fixed px except the Name column, ' +
          'so a single short row leaves Name holding all the slack.',
      },
    },
  },
};
