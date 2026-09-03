import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type {
  ExpiringAlertBatch,
  LowStockAlertItem,
} from '@/app/features/inventory/services/inventoryAlertsService';
import InventoryAlerts from './InventoryAlerts';

/** Expiry fixtures are anchored to render-time so the relative pills ("in 3 days",
 *  "yesterday") stay correct forever rather than drifting into the past like a
 *  hardcoded ISO date would. */
const inDays = (days: number): string => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const LOW_STOCK: LowStockAlertItem[] = [
  {
    id: 'item-1',
    name: 'Meloxicam 15 mg/mL',
    onHand: 2,
    reorderLevel: 10,
    unitOfMeasure: 'mL',
    category: 'Medicine',
    sku: 'SKU-4471',
  },
  {
    id: 'item-2',
    name: 'Rabies vaccine (Nobivac)',
    onHand: 0,
    reorderLevel: 25,
    unitOfMeasure: 'dose',
    category: 'Vaccine',
    sku: 'SKU-2210',
  },
  {
    id: 'item-3',
    name: 'IV catheter 22G',
    onHand: 6,
    reorderLevel: 40,
    unitOfMeasure: 'unit',
    category: 'Consumable',
    sku: 'SKU-0098',
  },
];

const EXPIRING: ExpiringAlertBatch[] = [
  {
    id: 'batch-1',
    itemId: 'item-1',
    batchNumber: 'B-2026-04',
    expiryDate: inDays(3),
    quantity: 18,
    inventoryItem: { name: 'Meloxicam 15 mg/mL' },
  },
  {
    id: 'batch-2',
    itemId: 'item-9',
    batchNumber: 'B-2026-01',
    expiryDate: inDays(-1),
    quantity: 4,
    inventoryItem: { name: 'Amoxicillin 250 mg' },
  },
  {
    id: 'batch-3',
    itemId: 'item-7',
    batchNumber: 'B-2026-07',
    expiryDate: inDays(21),
    quantity: 30,
    // No item relation on purpose — the panel falls back to the batch number.
  },
];

const meta = {
  title: 'Inventory/InventoryAlerts',
  component: InventoryAlerts,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Two grouped alert lists for the inventory page — **Low stock** and **Expiring soon**. ' +
          'Presentational only: it renders the arrays the container passes and never fetches. ' +
          'A zero-on-hand item reads as danger ("Out of stock"); an already-expired batch reads ' +
          'as danger with a relative + absolute date. Each group has its own empty state.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    lowStock: LOW_STOCK,
    expiring: EXPIRING,
    loading: false,
    error: null,
    expiringWindowDays: 30,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InventoryAlerts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'Populated',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both group headings render.
    await expect(canvas.getByText('Low stock')).toBeInTheDocument();
    await expect(canvas.getByText('Expiring soon')).toBeInTheDocument();
    // Low-stock rows, including the zero-on-hand danger case.
    await expect(canvas.getByText('Meloxicam 15 mg/mL')).toBeInTheDocument();
    await expect(canvas.getByText('Out of stock')).toBeInTheDocument();
    await expect(canvas.getAllByText('Low').length).toBeGreaterThan(0);
    // The batch with no item relation falls back to its batch number as the title.
    await expect(canvas.getByText('B-2026-07')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A few of each. The Rabies row is at zero on hand, so it carries the danger "Out of ' +
          'stock" pill instead of "Low"; the expired batch carries a danger date pill.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'Empty',
  args: { lowStock: [], expiring: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No low-stock items')).toBeInTheDocument();
    await expect(canvas.getByText('Nothing expiring in the next 30 days')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The all-clear state: both groups show their own empty line. The expiring copy names ' +
          'the window it checked so "nothing" is unambiguous.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading',
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Skeleton rows replace content; the real data must not be on screen yet.
    await expect(canvas.queryByText('Meloxicam 15 mg/mL')).not.toBeInTheDocument();
    await expect(canvas.getByText('Low stock')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While the container fetches, each group shows three placeholder rows and the header ' +
          'count is suppressed — the panel keeps its shape so the page does not jump on load.',
      },
    },
  },
};
