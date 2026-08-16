import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { InventoryFiltersState } from '@/app/features/inventory/pages/Inventory/types';
import { Secondary } from '@/app/ui/primitives/Buttons';
import InventoryFilters from './index';

const CATEGORIES = ['Antibiotic', 'Anaesthetic', 'Vaccine', 'Consumable', 'Diet'];

const baseFilters: InventoryFiltersState = {
  category: 'all',
  categories: [],
  subCategories: [],
  locations: [],
  abcClasses: [],
  suppliers: [],
  visibility: 'ALL',
  status: 'ALL',
  search: '',
};

const meta = {
  title: 'Filters/InventoryFilters',
  component: InventoryFilters,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Toolbar above the inventory list. Left side: the three-way All/Active/Hidden visibility ' +
          'toggle (a sliding `--color-neutral-900` thumb) and the stock-health pill, whose fill, ' +
          'border and text come from the selected status tokens rather than a fixed colour. Right ' +
          'side: an optional caller-supplied action and the category `LabelDropdown`. The ' +
          'stock-health panel is portalled to `document.body` and positioned from the trigger rect, ' +
          'so a scrolling toolbar cannot clip it.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    loading: { control: 'boolean' },
  },
  args: {
    filters: baseFilters,
    categories: CATEGORIES,
    onChange: fn(),
    loading: false,
  },
} satisfies Meta<typeof InventoryFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StockHealthSelected: Story = {
  name: 'Low stock, hidden items',
  args: {
    filters: { ...baseFilters, status: 'LOW_STOCK', visibility: 'HIDDEN', category: 'Antibiotic' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A non-`ALL` stock health repaints the trigger in that status’ own pill tokens and ' +
          'swaps the label from "Stock health" to the status name. The visibility thumb has slid to ' +
          'the third segment, and the category dropdown shows the picked category instead of the ' +
          '"All categories" default.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading (controls locked)',
  args: { loading: true },
  parameters: {
    docs: {
      description: {
        story:
          'While the inventory query is in flight the visibility segments and the stock-health ' +
          'trigger are disabled, so a second filter cannot be queued against a list that is about ' +
          'to be replaced.',
      },
    },
  },
};

const InteractiveInventoryFilters = () => {
  const [filters, setFilters] = useState<InventoryFiltersState>(baseFilters);
  return (
    <InventoryFilters
      filters={filters}
      onChange={setFilters}
      categories={CATEGORIES}
      categoryAction={<Secondary text="Manage categories" size="small" onClick={fn()} />}
    />
  );
};

export const Interactive: Story = {
  name: 'Interactive, with a category action',
  render: () => <InteractiveInventoryFilters />,
  parameters: {
    docs: {
      description: {
        story:
          'Wired to local state so the sliding toggle, the portalled stock-health panel and the ' +
          'category dropdown all respond. `categoryAction` slots a caller-owned button in ahead of ' +
          'the category dropdown; the inventory page uses it for "Manage categories".',
      },
    },
  },
};
