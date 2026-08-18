import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import InventoryTable from './InventoryTable';

const item = (id: string, name: string, overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id,
  currency: 'USD',
  sku: `SKU-${id}`,
  stockHealth: 'HEALTHY',
  status: 'ACTIVE',
  basicInfo: {
    name,
    category: 'Medicine',
    subCategory: 'NSAID',
    department: 'Pharmacy',
    description: '',
    status: 'Active',
    skuCode: `SKU-${id}`,
  },
  classification: { form: 'Tablet', strength: '50 mg' },
  pricing: { purchaseCost: '4.20', selling: '7.00' },
  vendor: {
    supplierName: 'Nordwest Vet Supply',
    brand: 'Zoetis',
    vendor: 'Distributor',
    license: 'DE-4471',
    paymentTerms: 'Net 30',
  },
  stock: {
    current: '48',
    allocated: '6',
    available: '42',
    reorderLevel: '12',
    reorderQuantity: '60',
    stockLocation: 'Pharmacy',
    abcClass: 'Class A',
  },
  batch: { batch: 'B-2026-04', manufactureDate: '2026-01-08', expiryDate: '2027-02-28' },
  ...overrides,
});

const ROWS: InventoryItem[] = [
  item('1', 'Carprofen 50 mg'),
  item('2', 'Nobivac Rabies 1 ml', {
    stockHealth: 'LOW_STOCK',
    basicInfo: {
      name: 'Nobivac Rabies 1 ml',
      category: 'Vaccine',
      subCategory: 'Rabies',
      department: 'Pharmacy',
      description: '',
      status: 'Active',
      skuCode: 'SKU-2',
    },
    stock: {
      current: '4',
      allocated: '0',
      available: '4',
      reorderLevel: '12',
      reorderQuantity: '40',
      stockLocation: 'Cold chain',
      abcClass: 'Class B',
    },
    pricing: { purchaseCost: '12.00', selling: '19.50' },
  }),
  item('3', 'Chlorhexidine scrub 500 ml', {
    stockHealth: 'EXPIRED',
    basicInfo: {
      name: 'Chlorhexidine scrub 500 ml',
      category: 'Consumable',
      subCategory: 'Antiseptic',
      department: 'Surgery',
      description: '',
      status: 'Active',
      skuCode: 'SKU-3',
    },
    batch: { batch: 'B-2025-11', manufactureDate: '2025-02-02', expiryDate: '2026-01-10' },
    stock: {
      current: '9',
      allocated: '0',
      available: '9',
      reorderLevel: '4',
      reorderQuantity: '20',
      stockLocation: 'Surgery',
      abcClass: 'Class C',
    },
  }),
];

/** Hovers the tooltip's wrapper span, which is the element carrying the listeners. */
const hoverTooltipTrigger = async (control: HTMLElement) => {
  const trigger = control.closest('.glass-tooltip');
  await expect(trigger).toBeInTheDocument();
  await userEvent.hover(trigger as HTMLElement);
  return within(document.body).findByRole('tooltip');
};

const meta = {
  title: 'Tables/InventoryTable',
  component: InventoryTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The twelve-column inventory grid, rendered through the shared `PaginatedGridTable` ' +
          'shell on a 1320px floor - the floor exists because a shared 1080px one starved the ' +
          'two `fr` tracks and collapsed the item name to about 48px.\n\n' +
          'What had never been drawn is the row action rail: two 30px circular buttons at the ' +
          'end of every row, each wrapped in a `GlassTooltip` whose bubble is ' +
          '`createPortal`ed to `document.body` and exists only after a hover or a focus. ' +
          'Neither bubble had ever appeared in a snapshot, and neither is reachable from ' +
          'props.\n\n' +
          'The Restock control is doubly conditional. It renders only when `onRestock` is ' +
          'passed, and its fill flips with the row: a low-stock row gets ' +
          '`bg-[var(--nav-active-bg)] text-[var(--nav-active)]`, every other row gets the ' +
          'plain `grid-row-action` outline. So the rail has three distinct shapes - two ' +
          'buttons with the accent fill, two plain, or one alone - and the single-button case ' +
          'is what a role without restock permission actually sees.\n\n' +
          'Row state is data-driven in the same invisible way: an expired row paints ' +
          '`var(--danger-bg-faint)` behind the whole twelve-column grid and turns the expiry ' +
          'cell bold danger, while a low-stock row only marks its Available cell. The stories ' +
          'below assert the tooltip bubbles carry their copy, not merely that a hover ' +
          'happened.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: 520, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    filteredList: ROWS,
    setActiveInventory: fn(),
    setViewInventory: fn(),
    onView: fn(),
    onRestock: fn(),
  },
} satisfies Meta<typeof InventoryTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three rows, three stock states',
  parameters: {
    docs: {
      story:
        'In stock, low stock and expired together, so the row tint, the bold expiry cell and ' +
        'the accented restock button can be compared against their neutral versions.',
    },
  },
};

export const RestockTooltip: Story = {
  name: 'Restock tooltip open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const restock = canvas.getByRole('button', { name: 'Restock Nobivac Rabies 1 ml' });
    // The low-stock row takes the accent fill rather than the outline treatment.
    await expect(restock).toHaveClass('bg-[var(--nav-active-bg)]');
    const tooltip = await hoverTooltipTrigger(restock);
    // Assert the bubble carries its copy - an empty portalled node would still
    // satisfy role="tooltip".
    await expect(tooltip).toHaveTextContent('Restock');
  },
  parameters: {
    docs: {
      story:
        'The bubble for the low-stock row, portalled to `document.body` and positioned ' +
        '`side="top"` from the trigger rect with a 10px gap and an 8px viewport clamp. It only ' +
        'exists after a hover or focus, so nothing had rendered it.',
    },
  },
};

export const ViewDetailsTooltip: Story = {
  name: 'View details tooltip open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const view = canvas.getByRole('button', { name: 'View Carprofen 50 mg' });
    const tooltip = await hoverTooltipTrigger(view);
    await expect(tooltip).toHaveTextContent('View details');
  },
  parameters: {
    docs: {
      story:
        'The second bubble on the same rail. Both buttons carry a per-row `aria-label` ' +
        '("View Carprofen 50 mg") while the tooltip says only "View details", so the visible ' +
        'copy and the announced name deliberately differ.',
    },
  },
};

export const WithoutRestock: Story = {
  name: 'Rail without restock',
  args: { onRestock: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The button is not disabled, it is absent - the rail collapses to one control.
    await expect(canvas.queryByRole('button', { name: /^Restock / })).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^View / })).toHaveLength(3);
    const tooltip = await hoverTooltipTrigger(
      canvas.getByRole('button', { name: 'View Carprofen 50 mg' })
    );
    await expect(tooltip).toHaveTextContent('View details');
  },
  parameters: {
    docs: {
      story:
        'What a role without restock permission sees. The 96px actions column now holds a ' +
        'single centred button instead of a pair, which shifts it relative to every other row ' +
        'in the design.',
    },
  },
};

export const OpensDetails: Story = {
  name: 'View falls back to the legacy setters',
  args: { onView: undefined },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View Carprofen 50 mg' }));
    // With no `onView`, the table drives the older two-setter API instead.
    await expect(args.setActiveInventory).toHaveBeenCalled();
    await expect(args.setViewInventory).toHaveBeenCalledWith(true);
  },
  parameters: {
    docs: {
      story:
        'The table supports two ways of opening a row: a single `onView` callback, or the older ' +
        '`setActiveInventory` + `setViewInventory` pair it falls back to. Which branch runs is ' +
        'invisible until the button is actually pressed.',
    },
  },
};

export const EmptyState: Story = {
  name: 'Empty state',
  args: { filteredList: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Looks like a quiet day… for now.')).toBeInTheDocument();
    await expect(canvas.getByText('No items')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'No rows: the header track stays, the body is replaced by a single centred line, and ' +
        'the footer summary reads "No items" rather than a range.',
    },
  },
};
