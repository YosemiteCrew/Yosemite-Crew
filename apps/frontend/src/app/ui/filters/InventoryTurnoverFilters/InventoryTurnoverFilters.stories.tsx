import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import InventoryTurnoverFilters, { type InventoryTurnoverFilterState } from './index';

const CATEGORIES = ['Antibiotic', 'Anaesthetic', 'Vaccine', 'Consumable', 'Diet'];

const baseFilters: InventoryTurnoverFilterState = {
  status: 'ALL',
  category: 'all',
};

const meta = {
  title: 'Filters/InventoryTurnoverFilters',
  component: InventoryTurnoverFilters,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Toolbar above the inventory turnover report: a stock-health trigger on the left and the ' +
          'category `LabelDropdown` on the right. The trigger repaints itself from the selected ' +
          'status tokens - neutral card border while it is on "All", the pill fill, border and text ' +
          'of the chosen health band otherwise - so the control states the current filter without a ' +
          'separate chip. Its option list is portalled to `document.body` and positioned from the ' +
          'trigger rect, so a scrolled or clipped toolbar cannot cut it off.',
      },
    },
  },
  args: {
    filters: baseFilters,
    categories: CATEGORIES,
    setFilters: fn(),
  },
} satisfies Meta<typeof InventoryTurnoverFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'No filters applied',
};

export const LowStockSelected: Story = {
  name: 'Low stock, one category',
  args: {
    filters: { status: 'LOW', category: 'Antibiotic' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A non-`ALL` status swaps the trigger label from "Status" to the band name and repaints it ' +
          "in that band's warning tokens. The category dropdown shows the picked category in place of " +
          'the "All categories" default.',
      },
    },
  },
};

export const UnknownCategory: Story = {
  name: 'Category no longer in the list',
  args: {
    filters: { status: 'EXCELLENT', category: 'Discontinued line' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A stored category that is no longer offered - the supplier list changed under a saved ' +
          'filter - falls back to "All categories" rather than rendering a dropdown with no matching ' +
          'option. The status pill is unaffected and stays on its success tone.',
      },
    },
  },
};

const InteractiveTurnoverFilters = () => {
  const [filters, setFilters] = useState<InventoryTurnoverFilterState>(baseFilters);
  return (
    <InventoryTurnoverFilters filters={filters} setFilters={setFilters} categories={CATEGORIES} />
  );
};

export const Interactive: Story = {
  name: 'Interactive',
  render: () => <InteractiveTurnoverFilters />,
  parameters: {
    docs: {
      description: {
        story:
          'Wired to local state so the portalled status panel and the category dropdown both respond. ' +
          'Use this one to check that the trigger recolours to each of the six health bands and that ' +
          'the panel stays anchored to the trigger while the page scrolls.',
      },
    },
  },
};
