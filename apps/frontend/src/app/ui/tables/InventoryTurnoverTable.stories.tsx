import type { Meta, StoryObj } from '@storybook/react';
import InventoryTurnoverTable from './InventoryTurnoverTable';
import type { InventoryTurnoverItem } from '@/app/features/inventory/pages/Inventory/types';

const row = (overrides: Partial<InventoryTurnoverItem>): InventoryTurnoverItem =>
  ({
    name: 'Item',
    category: 'Pharmacy',
    beginningInventory: 120,
    endingInventory: 40,
    averageInventory: 80,
    totalPurchases: 260,
    turnsPerYear: 3.3,
    daysOnShelf: 110,
    status: 'Excellent',
    ...overrides,
  }) as InventoryTurnoverItem;

// Deliberately mixes 1-, 2- and 3-digit figures across every metric column so the
// right-aligned tabular-nums treatment (design finance convention) is obvious.
const ROWS: InventoryTurnoverItem[] = [
  row({
    name: 'Carprofen 50 mg',
    category: 'Pharmacy / NSAID',
    beginningInventory: 6,
    endingInventory: 4,
    averageInventory: 5,
    totalPurchases: 200,
    turnsPerYear: 8,
    daysOnShelf: 45,
    status: 'Excellent',
  }),
  row({
    name: 'Nobivac Rabies 1 ml',
    category: 'Vaccines / Core',
    beginningInventory: 38,
    endingInventory: 35,
    averageInventory: 36.5,
    totalPurchases: 96,
    turnsPerYear: 2.6,
    daysOnShelf: 140,
    status: 'Moderate',
  }),
  row({
    name: 'Royal Canin Renal 2 kg',
    category: 'Food / Prescription diet',
    beginningInventory: 12,
    endingInventory: 12,
    averageInventory: 12,
    totalPurchases: 24,
    turnsPerYear: 1.1,
    daysOnShelf: 320,
    status: 'Low',
  }),
];

const meta = {
  title: 'Tables/InventoryTurnoverTable',
  component: InventoryTurnoverTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Inventory turnover metrics rendered through the shared GenericTable shell. ' +
          'The six numeric metric columns (Beginning / Ending / Avg inventory, Total purchases, ' +
          'Turns/Year, Days on shelf) are right-aligned with tabular figures - header and cell - ' +
          'per the finance-table convention. Swaps to cards below the xl breakpoint.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: 520, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InventoryTurnoverTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { filteredList: ROWS },
};

export const EmptyState: Story = {
  name: 'Empty state',
  args: { filteredList: [] },
};
