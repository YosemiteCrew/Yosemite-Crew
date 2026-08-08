import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import InventoryCard from './index';
// The status micro-pill (.appointment-status) geometry ships in the shared table CSS.
import '../../tables/DataTable.css';

const baseItem = {
  basicInfo: { name: 'Amoxicillin 250mg', category: 'Antibiotic', status: 'active' },
  stock: { current: 42, allocated: 4, stockLocation: 'Shelf B2' },
  pricing: { purchaseCost: 8, selling: 14 },
  batch: { expiryDate: '2027-03-01' },
};

const meta = {
  title: 'Cards/InventoryCard',
  component: InventoryCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Inventory item card. Status renders as the design-system uppercase micro-pill (.appointment-status) above a full-width Secondary action.',
      },
    },
  },
  tags: ['autodocs'],
  args: { item: baseItem, handleViewInventory: fn() },
} satisfies Meta<typeof InventoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LowStock: Story = {
  args: {
    item: {
      ...baseItem,
      basicInfo: { name: 'Isoflurane 250ml', category: 'Anaesthetic', status: 'active' },
      stock: { current: 2, allocated: 0, stockLocation: 'Cabinet A' },
    },
  },
};
