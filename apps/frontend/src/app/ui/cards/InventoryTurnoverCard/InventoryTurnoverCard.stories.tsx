import type { Meta, StoryObj } from '@storybook/react';
import InventoryTurnoverCard from './index';
// The status micro-pill (.appointment-status) geometry ships in the shared table CSS.
import '../../tables/DataTable.css';

const baseItem = {
  name: 'Nitrile Gloves',
  category: 'Consumable',
  beginningInventory: 50,
  endingInventory: 10,
  averageInventory: 30,
  totalPurchases: 200,
  turnsPerYear: 8,
  daysOnShelf: 45,
  status: 'Healthy',
};

const meta = {
  title: 'Cards/InventoryTurnoverCard',
  component: InventoryTurnoverCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Inventory-turnover summary card. Status renders as the design-system uppercase micro-pill (.appointment-status), not a full-width band.',
      },
    },
  },
  tags: ['autodocs'],
  args: { item: baseItem },
} satisfies Meta<typeof InventoryTurnoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const Moderate: Story = {
  args: { item: { ...baseItem, name: 'Isoflurane', status: 'Moderate' } },
};

export const Low: Story = {
  args: { item: { ...baseItem, name: 'Syringes 5ml', status: 'Low' } },
};
