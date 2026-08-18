import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { InventoryFilterBar } from './index';
import { defaultFilters } from './utils';
import type { InventoryFiltersState } from './types';

/** Mirrors the module-local unions in `index.tsx`, which are not exported. */
type SortMode = 'name' | 'expiry' | 'stock';
type FilterChip = { id: string; label: string; onRemove: () => void };

const CHIPS: FilterChip[] = [
  { id: 'category-vaccines', label: 'Vaccines', onRemove: fn() },
  { id: 'location-fridge-1', label: 'Fridge 1', onRemove: fn() },
  { id: 'abc-a', label: 'Class A', onRemove: fn() },
];

/**
 * `filters` and `sortMode` are owned by the Inventory page, so the bar does not move
 * on its own. The harness holds both, which is what lets a `play` pick a sort option
 * and see the trigger label follow.
 */
const Harness = ({
  initialFilters,
  initialSortMode,
  selectedFilterChips,
  setFilterOpen,
}: {
  initialFilters: InventoryFiltersState;
  initialSortMode: SortMode;
  selectedFilterChips: FilterChip[];
  setFilterOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const [filters, setFilters] = useState<InventoryFiltersState>(initialFilters);
  const [sortMode, setSortMode] = useState<SortMode>(initialSortMode);

  return (
    <div className="min-h-[320px] bg-[var(--screen)] p-6">
      <InventoryFilterBar
        filters={filters}
        selectedFilterChips={selectedFilterChips}
        sortMode={sortMode}
        setFilterOpen={setFilterOpen}
        setFilters={setFilters}
        setSortMode={setSortMode}
      />
    </div>
  );
};

const sortTrigger = (canvasElement: HTMLElement, mode: string) =>
  within(canvasElement).getByRole('button', { name: `Sort: ${mode}` });

/** The panel has no role or label, so it is reached through one of its options. */
const openSortPanel = async (canvasElement: HTMLElement, mode = 'Name') => {
  await userEvent.click(sortTrigger(canvasElement, mode));
  const option = await within(document.body).findByRole('button', { name: 'Expiry date' });
  return option.parentElement as HTMLElement;
};

const meta = {
  title: 'Inventory/InventoryFilterBar',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Active/Hidden pills, the Filter trigger, the Sort trigger and the inventory search, ' +
          'in one row that reflows to a column below `xl`.\n\n' +
          'The Sort panel is the reason this file exists. It is `createPortal`ed to ' +
          '`document.body` and positioned from a `getBoundingClientRect()` read on the trigger in a ' +
          '`useLayoutEffect` - `top: rect.bottom + 6`, `right: window.innerWidth - rect.right`, ' +
          '`minWidth: rect.width`, `zIndex: 9999`. None of that is expressible in CSS from the ' +
          'trigger, and none of it exists until `sortOpen` flips, so a broken measurement renders a ' +
          'panel pinned to the top-left of the viewport and every static snapshot still passes. The ' +
          'stories therefore assert the panel is `position: fixed`, sits below the trigger and is at ' +
          'least as wide as it - not merely that a panel appeared.\n\n' +
          'The panel is also its own dismissal surface: a `mousedown` anywhere outside both the ' +
          'trigger and the panel closes it, and so does any capture-phase scroll. A page whose ' +
          'content scrolls under a fixed panel would otherwise leave it stranded beside nothing, ' +
          'since the position is measured once rather than tracked.\n\n' +
          'The Filter trigger has a second gated detail: with no filters applied it ends in a 14px ' +
          'chevron, and with filters applied that chevron is *replaced* by a count badge. Both are ' +
          'the same button, so the swap is only visible with chips present.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialFilters: defaultFilters,
    initialSortMode: 'name',
    selectedFilterChips: [],
    setFilterOpen: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Closed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Sort: Name' })).toBeInTheDocument();
    // With no chips the Filter trigger carries two glyphs: the sliders and a chevron.
    const filter = canvas.getByRole('button', { name: /^Filter$/ });
    await expect(filter.querySelectorAll('svg')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story: 'The resting bar, with Active selected and sorting by name.',
      },
    },
  },
};

export const SortPanelOpen: Story = {
  name: 'Sort panel open',
  play: async ({ canvasElement }) => {
    const panel = await openSortPanel(canvasElement);

    // Portalled: the panel is not a descendant of the story canvas at all.
    await expect(canvasElement.contains(panel)).toBe(false);

    /* Assert the panel has its three options rather than that a flag flipped -
       an empty portal is indistinguishable from a healthy one at the trigger. */
    const options = within(panel).getAllByRole('button');
    await expect(options).toHaveLength(3);
    await expect(options[0]).toHaveTextContent('Name');
    await expect(options[1]).toHaveTextContent('Expiry date');
    await expect(options[2]).toHaveTextContent('Stock level');

    // The current mode is marked by a check glyph, the only selected affordance here.
    await expect(within(panel).getByText('✓')).toBeInTheDocument();

    /* The measured position is the part no snapshot could hold. A dropped style
       object leaves the panel static at the end of <body>, which still renders
       three healthy-looking rows. */
    await waitFor(async () => {
      await expect(getComputedStyle(panel).position).toBe('fixed');
    });
    const triggerRect = sortTrigger(canvasElement, 'Name').getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    await expect(panelRect.top).toBeGreaterThan(triggerRect.bottom);
    await expect(panelRect.width).toBeGreaterThanOrEqual(triggerRect.width - 1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel right-aligned under its trigger. `minWidth` comes from the trigger rect while ' +
          'the content sets the real width, so the panel can grow leftwards but never narrower than ' +
          'the button that opened it.',
      },
    },
  },
};

export const SortSelection: Story = {
  name: 'Choosing a sort mode',
  play: async ({ canvasElement }) => {
    const panel = await openSortPanel(canvasElement);
    await userEvent.click(within(panel).getByRole('button', { name: 'Expiry date' }));

    // The trigger relabels from the chosen option and the panel goes away.
    await waitFor(async () => {
      await expect(
        within(canvasElement).getByRole('button', { name: 'Sort: Expiry date' })
      ).toBeInTheDocument();
    });
    await expect(within(document.body).queryByRole('button', { name: 'Stock level' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selection closes the panel in the same tick it sets the mode, so the trigger label is the ' +
          'only surviving evidence of the choice - there is no chip and no toast.',
      },
    },
  },
};

export const SortPanelClosesOnOutsideClick: Story = {
  name: 'Outside click dismisses the panel',
  play: async ({ canvasElement }) => {
    const panel = await openSortPanel(canvasElement);
    await expect(within(panel).getAllByRole('button')).toHaveLength(3);

    // The listener is on `mousedown` and ignores the trigger and the panel itself.
    await userEvent.click(canvasElement);

    await waitFor(async () => {
      await expect(within(document.body).queryByRole('button', { name: 'Expiry date' })).toBeNull();
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dismissal is the half of a portalled panel that is easiest to break, because the panel is ' +
          'a sibling of the trigger in the DOM rather than a child: a naive "outside" test treats ' +
          'the panel itself as outside and closes on its own options.',
      },
    },
  },
};

export const WithSelectedFilters: Story = {
  name: 'Filter trigger with a count badge',
  args: { selectedFilterChips: CHIPS },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const filter = canvas.getByRole('button', { name: /^Filter 3$/ });
    // The chevron is replaced by the badge rather than sitting beside it.
    await expect(filter.querySelectorAll('svg')).toHaveLength(1);
    await expect(filter).toHaveTextContent('3');

    await userEvent.click(filter);
    await expect(args.setFilterOpen).toHaveBeenCalledWith(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Three filters applied. The badge takes the chevron's place, so the trigger keeps its " +
          'width and the row does not reflow when a filter is added - which is the only reason to ' +
          'swap rather than append.',
      },
    },
  },
};

export const HiddenVisibility: Story = {
  name: 'Hidden visibility selected',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const active = canvas.getByRole('button', { name: 'Active' });
    const hidden = canvas.getByRole('button', { name: 'Hidden' });
    // Selected is 700 against 600, plus a filled chip - weight alone must not carry it.
    await expect(getComputedStyle(active).fontWeight).not.toBe(getComputedStyle(hidden).fontWeight);

    await userEvent.click(hidden);

    await waitFor(async () => {
      await expect(getComputedStyle(hidden).fontWeight).toBe('700');
    });
    await expect(getComputedStyle(hidden).backgroundColor).not.toBe(
      getComputedStyle(active).backgroundColor
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The two visibility pills are the only always-visible filter in the bar. The selected one ' +
          'takes `--chip-selected-bg` / `--chip-selected-border` / `--chip-selected-ink` together ' +
          'with the weight change, so the state survives at a glance and in greyscale.',
      },
    },
  },
};
