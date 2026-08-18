import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';

import PackageBreakdownTooltip from './PackageBreakdownTooltip';
import type {
  InvoiceLineItem,
  LineItemBreakdown,
} from '@/app/features/appointments/types/workspace';

const BREAKDOWN: LineItemBreakdown[] = [
  {
    id: 'cmp-1',
    name: 'Pre-anaesthetic blood panel',
    qty: 1,
    instructions: 'Lab',
    unitPriceCents: 8500,
    amountCents: 8500,
  },
  {
    id: 'cmp-2',
    name: 'General anaesthesia (first 30 min)',
    qty: 1,
    instructions: 'Procedure',
    unitPriceCents: 12000,
    discountPercent: 5,
    discountCents: 600,
    amountCents: 11400,
  },
  {
    id: 'cmp-3',
    name: 'Ultrasonic scale and polish',
    qty: 1,
    instructions: 'Procedure',
    unitPriceCents: 14500,
    amountCents: 14500,
  },
  {
    id: 'cmp-4',
    name: 'Meloxicam 1.5 mg/mL oral suspension',
    qty: 2,
    instructions: 'Medication',
    unitPriceCents: 2200,
    discountPercent: 10,
    discountCents: 440,
    amountCents: 3960,
  },
];

const PACKAGE_ITEM: InvoiceLineItem = {
  id: 'line-dental-package',
  name: 'Dental package (grade 2)',
  unitPriceCents: 38360,
  qty: 1,
  grossCents: 38360,
  discountCents: 3836,
  amountCents: 34524,
  breakdown: BREAKDOWN,
};

/**
 * Opens the portalled bubble and hands back its root for assertions.
 *
 * The wrapper span carries the listeners and binds them in an effect, which a play
 * function can start ahead of - so the dispatch is retried rather than sent once.
 * `findByRole` retries the query but never re-sends the event, so a dispatch that lands
 * before the listener exists is lost for good.
 */
const openBubble = (canvasElement: HTMLElement, itemName: string) =>
  // GlassTooltip portals to document.body, so the bubble is outside canvasElement.
  openGlassTooltip(
    within(canvasElement).getByRole('button', { name: `View ${itemName} package breakdown` })
  );

const meta = {
  title: 'Workspace/PackageBreakdownTooltip',
  component: PackageBreakdownTooltip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The (i) beside a package line in the bill. Everything of interest lives in the hover ' +
          'bubble, and the bubble is portalled to `document.body` by `GlassTooltip` only while the ' +
          'trigger is hovered or focused - there is no prop that forces it open, because the ' +
          'listeners are attached imperatively in a `useEffect`. Nothing had ever drawn it.\n\n' +
          'What was hidden is a **seven-column table**, which is the widest piece of tabular layout ' +
          'anywhere in the workspace: `#`, Item, Type, Unit, Qty, Default disc., Amount. It sits ' +
          'inside a `min-w-130` column in a bubble capped at `maxWidth={560}`, and `GlassTooltip` ' +
          'then clamps that bubble to the viewport with 8px of padding. Those three constraints only ' +
          'compete once the bubble is on screen, so the stories assert the column count rather than ' +
          'merely that a tooltip appeared - a table that had silently collapsed to fewer columns ' +
          'would still satisfy the weaker check.\n\n' +
          'The `tfoot` is conditional in the middle: "Component total" and "Total" always render, but ' +
          'the "Package discount (n%)" row between them only exists when `item.discountCents > 0`. ' +
          'Its percentage is derived, not passed - `discountCents / grossCents * 100` - so a package ' +
          'priced with `grossCents: 0` silently reports 0%.\n\n' +
          'The component returns `null` outright when `item.breakdown` is empty or absent, so a ' +
          'non-package line renders no trigger at all rather than an (i) that opens nothing.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    item: PACKAGE_ITEM,
    currency: 'USD',
  },
} satisfies Meta<typeof PackageBreakdownTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trigger: Story = {
  name: 'Trigger only (resting)',
  parameters: {
    docs: {
      description: {
        story:
          'What the bill row shows until someone hovers: a `size-4` icon button nudged down by ' +
          '`translate-y-px` so it sits on the text baseline beside the package name.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Breakdown open',
  play: async ({ canvasElement }) => {
    const bubble = await openBubble(canvasElement, PACKAGE_ITEM.name);

    // The point of this file: seven columns, not "a tooltip appeared".
    await expect(within(bubble).getAllByRole('columnheader')).toHaveLength(7);
    // thead (1) + one row per component (4) + tfoot (component total, package
    // discount, total = 3).
    await expect(within(bubble).getAllByRole('row')).toHaveLength(8);
    await expect(within(bubble).getByText('Package breakdown')).toBeInTheDocument();
    await expect(within(bubble).getByText('Component total')).toBeInTheDocument();
    await expect(within(bubble).getByText('Pre-anaesthetic blood panel')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Four component lines with mixed per-line discounts, so the "Default disc." column shows both ' +
          'its `n% / -$x` form and its `-` fallback in the same table. The row `#` column is fixed at ' +
          '`w-8` and the item name is capped at `max-w-44` with a `truncate` span; every other column ' +
          'is content-sized, which is what makes the seven-column measurement worth a snapshot.',
      },
    },
  },
};

export const NoPackageDiscount: Story = {
  name: 'No package-level discount',
  args: {
    item: { ...PACKAGE_ITEM, discountCents: 0, amountCents: PACKAGE_ITEM.grossCents },
  },
  play: async ({ canvasElement }) => {
    const bubble = await openBubble(canvasElement, PACKAGE_ITEM.name);
    await expect(within(bubble).getAllByRole('columnheader')).toHaveLength(7);
    // The middle tfoot row drops out: 1 head + 4 body + 2 foot.
    await expect(within(bubble).getAllByRole('row')).toHaveLength(7);
    await expect(within(bubble).queryByText(/Package discount/)).not.toBeInTheDocument();
    await expect(within(bubble).getByText('Total')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'With `discountCents: 0` the "Package discount" row is not rendered, so "Component total" and ' +
          '"Total" become adjacent and both `border-t border-neutral-0/25` rules land back to back. ' +
          'That doubled rule is only visible in this branch.',
      },
    },
  },
};

export const SingleComponent: Story = {
  name: 'Single component line',
  args: {
    item: {
      ...PACKAGE_ITEM,
      name: 'Nail trim bundle',
      breakdown: [BREAKDOWN[0]],
      grossCents: 8500,
      discountCents: 850,
      amountCents: 7650,
    },
  },
  play: async ({ canvasElement }) => {
    const bubble = await openBubble(canvasElement, 'Nail trim bundle');
    // Seven headers over one body row - the narrowest the table can get, and where
    // `min-w-130` has to hold the column widths up on its own.
    await expect(within(bubble).getAllByRole('columnheader')).toHaveLength(7);
    await expect(within(bubble).getAllByRole('row')).toHaveLength(5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'One component, three footer rows. The `last:border-b-0` on the body row means the only rule ' +
          "under it is the footer's own top border, so this is where a missing or doubled divider shows.",
      },
    },
  },
};

export const LongComponentNames: Story = {
  name: 'Long names (truncate, not widen)',
  args: {
    item: {
      ...PACKAGE_ITEM,
      breakdown: BREAKDOWN.map((row, index) => ({
        ...row,
        name:
          index === 0
            ? 'Pre-anaesthetic haematology and biochemistry profile with electrolytes'
            : row.name,
      })),
    },
  },
  play: async ({ canvasElement }) => {
    const bubble = await openBubble(canvasElement, PACKAGE_ITEM.name);
    await expect(within(bubble).getAllByRole('columnheader')).toHaveLength(7);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow guard. The Item cell is `max-w-44` around a `block truncate` span, so a long ' +
          'component name must ellipsise rather than push the bubble past `maxWidth: 560` and into the ' +
          'viewport clamp - which would move the whole bubble sideways off its trigger.',
      },
    },
  },
};

export const KeyboardFocus: Story = {
  name: 'Opened by keyboard focus',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* focusin, not hover: the path a keyboard user gets, and the one that rots unnoticed
       because every manual check is done with a mouse. Dispatched at the wrapper rather
       than via `.focus()`, which fires nothing unless the page itself has focus. */
    const bubble = await openGlassTooltip(
      canvas.getByRole('button', { name: `View ${PACKAGE_ITEM.name} package breakdown` }),
      { via: 'focus' }
    );
    await expect(within(bubble).getAllByRole('columnheader')).toHaveLength(7);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The trigger carries `aria-label="View <name> package breakdown"` and a `focus-visible` ring, ' +
          'and `GlassTooltip` listens for `focusin` as well as `mouseenter`, so the same table is ' +
          'reachable without a pointer.',
      },
    },
  },
};

export const NoBreakdown: Story = {
  name: 'Not a package (renders nothing)',
  args: {
    item: { ...PACKAGE_ITEM, name: 'Consultation', breakdown: undefined },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An ordinary bill line. The component returns `null` before rendering a `GlassTooltip` at ' +
          'all, so there is no (i) to hover - the bill must not offer an affordance that opens an ' +
          'empty bubble.',
      },
    },
  },
};
