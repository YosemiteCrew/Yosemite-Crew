import { type ReactNode, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import InventoryFilters from './index';
import type { InventoryFiltersState } from '@/app/features/inventory/pages/Inventory/types';

const CATEGORIES = ['Analgesics', 'Antibiotics', 'Consumables', 'Diagnostics', 'Vaccines'];

const BASE_FILTERS: InventoryFiltersState = {
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

const withFilters = (patch: Partial<InventoryFiltersState>): InventoryFiltersState => ({
  ...BASE_FILTERS,
  ...patch,
});

type HarnessProps = {
  /** Seeds the harness's own state; the bar is fully controlled by its parent. */
  filters: InventoryFiltersState;
  categories: string[];
  loading?: boolean;
  categoryAction?: ReactNode;
  onChange: (filters: InventoryFiltersState) => void;
};

/**
 * `InventoryFilters` is controlled - it renders `filters` and hands every change
 * straight back out. With a plain `fn()` for `onChange` the visibility slider
 * would never move and the stock-health pill would never recolour, so the
 * harness holds the state the Inventory page normally holds and still reports
 * each change through the action logger.
 */
const Harness = ({ filters, categories, loading, categoryAction, onChange }: HarnessProps) => {
  const [current, setCurrent] = useState(filters);
  return (
    <div className="min-h-[360px] p-6">
      <InventoryFilters
        filters={current}
        categories={categories}
        loading={loading}
        categoryAction={categoryAction}
        onChange={(next) => {
          onChange(next);
          setCurrent(next);
        }}
      />
    </div>
  );
};

/** The stock-health panel is the only `yc-glass-overlay` on the page while it is open. */
const findStockHealthPanel = () =>
  waitFor(() => {
    const panel = document.querySelector<HTMLElement>('.yc-glass-overlay');
    if (!panel) throw new Error('Stock health panel is not mounted');
    return panel;
  });

const meta = {
  title: 'Filters/InventoryFilters',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Inventory list filter bar: an ALL/ACTIVE/HIDDEN visibility toggle, a stock-health ' +
          'pill that opens a panel, and the category picker.\n\n' +
          'Two of those three are invisible to every static snapshot, which is why this file ' +
          'exists.\n\n' +
          'The stock-health panel is `createPortal`ed to `document.body` and only mounts after a ' +
          'click, and it is positioned from a rect measured **in the click handler** rather than ' +
          'during render - `position: fixed`, `top: rect.bottom + 6`, `right: innerWidth - ' +
          'rect.right`, `minWidth: max(triggerWidth, 180)`. So the panel is right-aligned to the ' +
          'trigger and can be wider than it, and none of that geometry had ever been drawn. It is ' +
          'the same class of surface as the four production bugs on this branch: a popover whose ' +
          'grid template used a comma and collapsed to one column, two calendar overlays with an ' +
          'orphaned grid child that doubled their height, and dropdown panels whose rows used fill ' +
          'tokens where they needed ink tokens. Each was reachable only after an interaction, and ' +
          'each survived exactly as long as no story rendered it.\n\n' +
          'The visibility toggle is the second gap. The pill that reads as "selected" is not the ' +
          'button - it is a single `aria-hidden` `<div>` one third of the track wide that slides ' +
          'with `translate-x-0` / `translate-x-full` / `translate-x-[200%]` under three ' +
          '`calc(100% / 3)` buttons. Only the third position exercises the arbitrary-value class, ' +
          'and only a story per position shows whether the fill actually lands under its label.\n\n' +
          'The rows themselves come from `StatusOptionButtons`, so the ink each row uses is the ' +
          "option's own `--color-pill-*-text` token, with the neutral All row falling back to " +
          '`--color-text-primary`. The active row is marked with a trailing check in that same ' +
          'ink and nothing else - there is no fill - so it has to read as selected on colour alone.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filters: BASE_FILTERS,
    categories: CATEGORIES,
    loading: false,
    onChange: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting (All / Stock health)',
  parameters: {
    docs: {
      description: {
        story:
          'What the Inventory page shows before anything is touched: the slider parked left, the ' +
          'stock-health pill in its neutral outlined form reading "Stock health" rather than a ' +
          'status name, and the category picker on "All categories".',
      },
    },
  },
};

export const StockHealthOpen: Story = {
  name: 'Stock health panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Stock health' }));
    // The panel portals to <body>, so it is outside canvasElement. Assert it has
    // its five rows rather than that the trigger changed - an empty portal would
    // satisfy the weaker check, which is how a panel regression stayed invisible.
    const panel = await findStockHealthPanel();
    await expect(within(panel).getAllByRole('button')).toHaveLength(5);
    await expect(within(panel).getByText('Expiring soon')).toBeInTheDocument();
    await expect(within(panel).getByText('Low stock')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface. Five rows - All, Healthy, Low stock, Expiring soon, Expired - each ' +
          'with an 8px dot in its border colour. "Expiring soon" is the longest label, so this is ' +
          'also where the `minWidth: max(triggerWidth, 180)` floor stops mattering and the panel ' +
          'grows leftwards from its right-aligned edge.',
      },
    },
  },
};

export const ExpiredSelected: Story = {
  name: 'Filtered to Expired (panel open)',
  args: { filters: withFilters({ status: 'EXPIRED' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // With a status chosen the trigger relabels to the status name, so the
    // accessible name is no longer "Stock health".
    await userEvent.click(canvas.getByRole('button', { name: 'Expired' }));
    const panel = await findStockHealthPanel();
    await expect(within(panel).getByText('✓')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Once a status is chosen the pill stops being neutral: it takes the option’s own ' +
          '`--color-pill-warning` background, text and border, and the label swaps from "Stock ' +
          'health" to "Expired". Inside the panel the active row is marked only by a trailing ' +
          'check in the matching ink - worth seeing beside the unselected rows, because a check ' +
          'that inherits the wrong token disappears entirely.',
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
    // 'all' plus the five real categories.
    await expect(within(panel).getAllByRole('button')).toHaveLength(6);
    await expect(within(panel).getByText('Vaccines')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second portalled panel on this bar. `LabelDropdown` prepends a synthetic "All ' +
          'categories" row to whatever the page loaded, so the list is always one longer than the ' +
          'category count - and the panel is positioned absolutely from the trigger rect, so it is ' +
          'the trigger’s width rather than its content’s.',
      },
    },
  },
};

export const ActiveOnly: Story = {
  name: 'Visibility: Active',
  args: { filters: withFilters({ visibility: 'ACTIVE' }) },
  parameters: {
    docs: {
      description: {
        story:
          'The slider at `translate-x-full`. The middle button’s label must sit on the dark ' +
          '`--color-neutral-900` fill in `--color-neutral-0` while its two neighbours stay ' +
          '`--color-text-tertiary` on the bare track.',
      },
    },
  },
};

export const HiddenOnly: Story = {
  name: 'Visibility: Hidden',
  args: { filters: withFilters({ visibility: 'HIDDEN' }) },
  parameters: {
    docs: {
      description: {
        story:
          'The third position, and the only one that uses an arbitrary-value transform - ' +
          '`translate-x-[200%]` rather than a stock Tailwind class. If that class ever fails to ' +
          'compile the fill silently parks under "Active" instead, which no other story would catch.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading (controls disabled)',
  args: { loading: true },
  parameters: {
    docs: {
      description: {
        story:
          'While the inventory query is in flight the toggle and the stock-health pill are ' +
          'disabled, but the category picker is not - it has no `loading` prop to receive. That ' +
          'inconsistency is only visible with the whole bar rendered in this state.',
      },
    },
  },
};

export const WithCategoryAction: Story = {
  name: 'With a category action',
  args: {
    categoryAction: (
      <button
        type="button"
        className="h-11 shrink-0 rounded-[12px] border border-[var(--hairline)] px-3 text-[13px] font-semibold text-[var(--ink-body)]"
      >
        Manage categories
      </button>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'The page can slot an action to the left of the category picker. It lands in a ' +
          '`justify-end` row that is `w-full` below the `sm` breakpoint, so at narrow widths the ' +
          'action and the picker share a line that has already wrapped away from the toggle.',
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
          'Before the category list resolves - or for an org that has none - the picker still ' +
          'renders its synthetic "All categories" row rather than an empty panel. The bar keeps ' +
          'its full width, so nothing reflows when the real categories arrive.',
      },
    },
  },
};
