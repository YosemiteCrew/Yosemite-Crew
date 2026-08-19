import { type Dispatch, type SetStateAction, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import InventoryTurnoverFilters, { type InventoryTurnoverFilterState } from './index';

const CATEGORIES = ['Analgesics', 'Antibiotics', 'Consumables', 'Diagnostics', 'Vaccines'];

const BASE_FILTERS: InventoryTurnoverFilterState = { status: 'ALL', category: 'all' };

type HarnessProps = {
  /** Seeds the harness's own state; the bar itself is fully controlled. */
  filters: InventoryTurnoverFilterState;
  categories: string[];
  onFiltersChange: (filters: InventoryTurnoverFilterState) => void;
};

/**
 * The component takes a `setFilters` typed as a `useState` setter, so it has to
 * be handed a real one - a bare `fn()` would leave the pill stuck on whatever
 * status it started with and the panel would never show a selected row. The
 * harness owns that state and reports each resolved value through the action
 * logger.
 */
const Harness = ({ filters, categories, onFiltersChange }: HarnessProps) => {
  const [current, setCurrent] = useState(filters);
  const setFilters: Dispatch<SetStateAction<InventoryTurnoverFilterState>> = (update) => {
    const next = typeof update === 'function' ? update(current) : update;
    onFiltersChange(next);
    setCurrent(next);
  };

  return (
    <div className="min-h-[360px] p-6">
      <InventoryTurnoverFilters filters={current} setFilters={setFilters} categories={categories} />
    </div>
  );
};

/** The status panel is the only `yc-glass-overlay` on the page while it is open. */
const findStatusPanel = () =>
  waitFor(() => {
    const panel = document.querySelector<HTMLElement>('.yc-glass-overlay');
    if (!panel) throw new Error('Turnover status panel is not mounted');
    return panel;
  });

const meta = {
  title: 'Filters/InventoryTurnoverFilters',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The filter bar above the inventory turnover report: a status pill that opens a panel, ' +
          'and the category picker.\n\n' +
          'The panel is the reason this file exists. It is `createPortal`ed to `document.body` ' +
          'behind a `useState` flag, so it does not exist until someone clicks - no static ' +
          'snapshot had ever contained it, and nothing but a `play` function can reach it. That ' +
          'is precisely the shape of the four production bugs on this branch (an invalid ' +
          'comma-separated grid template that collapsed six children into one column, two ' +
          'overlays with an orphaned grid child that doubled their height, and dropdown text ' +
          'using fill tokens instead of ink tokens): all four lived on surfaces that only exist ' +
          'after an interaction, and none was reachable by tsc, eslint or jest.\n\n' +
          'The list is six rows deep and, unlike the sibling stock-health filter, **two of them ' +
          'share a colour**: `EXCELLENT` and `HEALTHY` both resolve to `--color-pill-success`, ' +
          'and `LOW` and `OUT OF STOCK` both resolve to `--color-pill-warning`. So the dot and ' +
          'the ink cannot be what distinguishes those rows - only the label can - which is ' +
          'invisible until the panel is drawn.\n\n' +
          'Two more details only the open panel shows. The panel geometry is measured in a ' +
          '`useLayoutEffect` after the flag flips (`position: fixed`, `top: rect.bottom + 6`, ' +
          '`right: innerWidth - rect.right`, `minWidth: max(triggerWidth, 180)`), so it is ' +
          'right-aligned to a trigger it is usually wider than. And "Out of stock" carries the ' +
          'literal key `OUT OF STOCK` - with a space - so a row whose key never round-trips ' +
          'would silently render as unselected forever.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filters: BASE_FILTERS,
    categories: CATEGORIES,
    onFiltersChange: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting (Status / All categories)',
  parameters: {
    docs: {
      description: {
        story:
          'The neutral state. With `ALL` selected the pill is an outlined `--color-card-border` ' +
          'chip labelled "Status" rather than a status name, so it reads as a filter that has ' +
          'not been applied.',
      },
    },
  },
};

export const StatusPanelOpen: Story = {
  name: 'Status panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Status' }));
    // The panel portals out of canvasElement. Assert it holds its six rows, not
    // merely that the trigger toggled - an empty panel passes the weaker check.
    const panel = await findStatusPanel();
    await expect(within(panel).getAllByRole('button')).toHaveLength(6);
    await expect(within(panel).getByText('Out of stock')).toBeInTheDocument();
    await expect(within(panel).getByText('Excellent')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The surface no snapshot contained. Six rows, and the pair that matters: Excellent and ' +
          'Healthy are the same green, Low and Out of stock the same amber. Seeing them stacked ' +
          'is the only way to judge whether the labels carry enough of the distinction on their ' +
          'own.',
      },
    },
  },
};

export const LowSelected: Story = {
  name: 'Filtered to Low (panel open)',
  args: { filters: { status: 'LOW', category: 'all' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A chosen status relabels the trigger, so it is no longer named "Status".
    await userEvent.click(canvas.getByRole('button', { name: 'Low' }));
    const panel = await findStatusPanel();
    await expect(within(panel).getByText('✓')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A selected status floods the pill with its own `--color-pill-warning` background, ink ' +
          'and border. In the panel the active row is marked only by a trailing check in that ' +
          'same ink - there is no fill behind it - so this is the state where an amber check on ' +
          'the glass surface has to hold up on its own.',
      },
    },
  },
};

export const SelectFromPanel: Story = {
  name: 'Selecting a status closes the panel',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Status' }));
    const panel = await findStatusPanel();
    await userEvent.click(within(panel).getByText('Moderate'));
    await expect(args.onFiltersChange).toHaveBeenCalledWith({
      status: 'MODERATE',
      category: 'all',
    });
    // The panel unmounts on select, and the trigger takes the chosen label.
    await waitFor(() => expect(document.querySelector('.yc-glass-overlay')).toBeNull());
    await expect(canvas.getByRole('button', { name: 'Moderate' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full round trip: open, choose, the panel unmounts and the pill recolours to the ' +
          'chosen status. Worth asserting rather than eyeballing, because the trigger label and ' +
          'the panel selection are derived from the same `filters.status` string and a key that ' +
          'does not round-trip leaves the pill neutral while the list looks right.',
      },
    },
  },
};

export const CategoryPanelOpen: Story = {
  name: 'Category picker open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Category: All categories' }));
    const panel = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-portal-dropdown]');
      if (!element) throw new Error('Category panel is not mounted');
      return element;
    });
    // The synthetic "All categories" row plus the five real ones.
    await expect(within(panel).getAllByRole('button')).toHaveLength(6);
    await expect(within(panel).getByText('Diagnostics')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The bar’s second portalled panel, from `LabelDropdown`. It is sized from the trigger ' +
          'rect rather than from its content, and the trigger is `sm:w-55 min-w-45`, so this is ' +
          'where a long category name starts to truncate.',
      },
    },
  },
};

export const UnknownCategory: Story = {
  name: 'Selected category no longer exists',
  args: { filters: { status: 'ALL', category: 'Retired line' } },
  parameters: {
    docs: {
      description: {
        story:
          'A category that has since been removed. The component does not write the correction ' +
          'back into state - it derives an `effectiveCategory` for the picker only - so the ' +
          'picker falls back to "All categories" while `filters.category` still holds the stale ' +
          'value. Seeing that is the point: the label must not go blank.',
      },
    },
  },
};

export const NoCategories: Story = {
  name: 'No categories loaded',
  args: { categories: [] },
  parameters: {
    docs: {
      description: {
        story:
          'The default `categories` is a module-level constant empty array rather than a fresh ' +
          '`[]` per render, which is what keeps the `useMemo` for the option list from ' +
          'recomputing on every render. The picker still shows its synthetic "All categories" ' +
          'row rather than an empty panel.',
      },
    },
  },
};
