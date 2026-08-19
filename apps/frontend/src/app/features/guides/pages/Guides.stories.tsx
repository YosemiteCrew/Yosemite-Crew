import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { guidesData } from '@/app/features/guides/data/guidesData';
import { Guides } from './Guides';

/** Every card is a button labelled `Play guide: <title>`, so this counts the grid. */
const cards = (canvasElement: HTMLElement) =>
  within(canvasElement).queryAllByRole('button', { name: /^Play guide: / });

/**
 * The search field takes its accessible name from `Search`'s own `label` prop,
 * which the page does not pass - so it is the default "Search" and NOT the
 * "Search guides" placeholder. Worth pinning in one helper rather than getting
 * it wrong in five play functions.
 */
const searchBox = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('searchbox', { name: 'Search' });

/**
 * The three strings the state card actually rendered, in order: title, message,
 * clear-button label. Read off the card's own children rather than queried one
 * at a time, so a story asserts the whole set the page overrode instead of
 * spot-checking one line and leaving a `FilteredEmptyState` default in place.
 * The leading icon span holds an svg and no text, which is what `filter(Boolean)`
 * drops. Read-only, so it is safe to call from anywhere.
 */
const emptyStateLines = (canvasElement: HTMLElement): string[] => {
  const card = within(canvasElement).getByText('No guides match your search')
    .parentElement as HTMLElement;
  return Array.from(card.children)
    .map((node) => (node.textContent ?? '').trim())
    .filter(Boolean);
};

const meta = {
  title: 'Guides/Guides',
  component: Guides,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The guides library: six static walkthroughs from `guidesData`, a category pill row, ' +
          'a search field and a player modal.\n\n' +
          'The **filtered-empty branch at Guides.tsx:159-219 had never been drawn**. Reaching it ' +
          'takes a query that matches nothing or a category that excludes everything, and the ' +
          'route wraps the page in `ProtectedRoute` + `OrgGuard` - which hold a `PageSkeleton` ' +
          'until a real session and org membership resolve - so no story could get near it. ' +
          '`Guides` is now a named export beside the protected default, and the route still ' +
          'imports the default.\n\n' +
          'The copy in that branch is the page’s own, not the component default: ' +
          '`FilteredEmptyState` falls back to "Nothing matches these filters" / "Try widening the ' +
          'date range or clearing a status filter", which is finance language and wrong here. ' +
          'Guides overrides all three strings, and only these stories show which set actually ' +
          'renders.\n\n' +
          'Search and category are **combined, not alternative**: the filter drops a guide if the ' +
          'category misses OR the query misses, so a query with hits inside one category still ' +
          'empties the grid under another. Both routes in are drawn below because they fail ' +
          'independently - a search bug and a category bug both end at the same sentence.\n\n' +
          'The query is matched against title, description, category and the joined tags, so ' +
          'typing "barcode" - a word that appears in no visible label - is a legitimate hit.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--page)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Guides>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Library: Story = {
  name: 'Full library',
  // Pinned at 1440 rather than left on the project default. The grid is
  // `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` and `xl` is exactly 1280, so at
  // the `laptop` preset the third track sits on the boundary and depends on
  // whether a scrollbar eats a pixel. `desktop` is unambiguously past it.
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const all = cards(canvasElement);
    await expect(all).toHaveLength(guidesData.length);

    /* Track count AND child count, because they disagree silently: a grid with
       three tracks and six children is the intended two rows, while three tracks
       and five children is a filter that quietly dropped one. */
    const grid = all[0].parentElement as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(3);
    await expect(grid.children).toHaveLength(6);

    /* Six pills: All plus one per distinct category, in first-seen order. Read
       off the pill row itself rather than by looking each name up and asserting
       it equals the name we looked it up by - that version could not see a
       seventh pill, a duplicated category, or the row in the wrong order. */
    const pillRow = canvas.getByRole('button', { name: 'All' }).parentElement as HTMLElement;
    await expect(
      Array.from(pillRow.children).map((pill) => (pill.textContent ?? '').trim())
    ).toEqual(['All', 'Getting started', 'Appointments', 'Finance', 'Inventory', 'Integrations']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state. Three cards carry a status affordance and three carry none: ' +
          '"Your first day" reads Watched, "Invoices, deposits and payouts" reads New, and ' +
          '"Run a visit end to end" shows the 60% progress bar instead of either word.',
      },
    },
  },
};

export const SearchFindsNothing: Story = {
  name: 'Search matches nothing',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(cards(canvasElement)).toHaveLength(6);

    await userEvent.type(searchBox(canvasElement), 'radiology');

    /* Assert the copy this page supplies, not merely that a card appeared.
       `FilteredEmptyState` renders its own defaults when a caller passes
       nothing, and all three of those defaults ("Nothing matches these filters"
       / "Try widening the date range or clearing a status filter" / "Clear all
       filters") would render here without a single type error. Asserting the
       card's three strings together is what catches one of them leaking back. */
    await canvas.findByText('No guides match your search');
    await expect(emptyStateLines(canvasElement)).toEqual([
      'No guides match your search',
      'Try a different search or pick another category.',
      'Clear filters',
    ]);

    // The grid is gone, not merely covered.
    await expect(cards(canvasElement)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A query no title, description, category or tag contains. The state card replaces the ' +
          'grid entirely - the page has no "0 results" header row - so this sentence is the only ' +
          'thing telling a user their search ran at all.',
      },
    },
  },
};

export const CategoryEmptiesTheSearch: Story = {
  name: 'Category excludes every hit',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // "stock" hits exactly one guide, and it lives under Inventory.
    await userEvent.type(searchBox(canvasElement), 'stock');
    await waitFor(() => expect(cards(canvasElement)).toHaveLength(1));
    await expect(cards(canvasElement)[0]).toHaveAccessibleName(
      'Play guide: Stock that counts itself'
    );

    // Finance excludes it, so the same query now matches nothing.
    await userEvent.click(canvas.getByRole('button', { name: 'Finance' }));

    const title = await canvas.findByText('No guides match your search');
    await expect(title).toBeInTheDocument();
    await expect(cards(canvasElement)).toHaveLength(0);
    // The query survives the category change - the field is not cleared for you.
    await expect(searchBox(canvasElement)).toHaveValue('stock');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second route into the same sentence, and the one a search-only story would miss: ' +
          'the query still has a hit, the category is what removed it. The copy says "match your ' +
          'search" either way, which is why the message also offers "pick another category".',
      },
    },
  },
};

export const ClearFiltersRestores: Story = {
  name: 'Clear filters returns the grid',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(searchBox(canvasElement), 'radiology');
    await userEvent.click(canvas.getByRole('button', { name: 'Integrations' }));
    const title = await canvas.findByText('No guides match your search');
    await expect(title).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }));

    // Both filters are reset, not just the one that emptied the grid.
    await waitFor(() => expect(cards(canvasElement)).toHaveLength(6));
    await expect(searchBox(canvasElement)).toHaveValue('');
    await expect(canvas.queryByText('No guides match your search')).not.toBeInTheDocument();

    /* The All pill is selected again. Weight is set inline and does not animate,
       so it reads immediately; the background does animate (`transition-colors`),
       so it is polled rather than sampled once mid-interpolation. */
    const allPill = canvas.getByRole('button', { name: 'All' });
    const integrationsPill = canvas.getByRole('button', { name: 'Integrations' });
    await expect(getComputedStyle(allPill).fontWeight).toBe('700');
    await expect(getComputedStyle(integrationsPill).fontWeight).toBe('600');
    await waitFor(() => {
      expect(getComputedStyle(allPill).backgroundColor).not.toBe(
        getComputedStyle(integrationsPill).backgroundColor
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          '`handleClearFilters` resets the query and the category together. That matters here ' +
          'because either one alone can empty the grid, so a button that cleared only the search ' +
          'would leave the user staring at the same state card it just dismissed.',
      },
    },
  },
};

export const PhoneFilteredEmpty: Story = {
  name: 'Phone: filtered empty',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert - a story pinned that way renders desktop markup
  // under a phone name and still passes.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(searchBox(canvasElement), 'radiology');
    await canvas.findByText('No guides match your search');

    // Same branch, same three overridden strings, and no grid behind them.
    await expect(emptyStateLines(canvasElement)).toEqual([
      'No guides match your search',
      'Try a different search or pick another category.',
      'Clear filters',
    ]);
    await expect(cards(canvasElement)).toHaveLength(0);

    /* At 375px the search field is `!w-full` (the `sm:!w-[240px]` override starts
       at 640px), so it takes its own row under the pill strip rather than sitting
       beside it, and it spans the whole filter row. Measured with
       getBoundingClientRect, not getComputedStyle.width: this wrapper carries a
       1px border and 14px of horizontal padding, so the computed `width` reads
       the content box and lands 30px short of the field's drawn edge. */
    const box = searchBox(canvasElement).closest('div') as HTMLElement;
    const pill = canvas.getByRole('button', { name: 'All' });
    const pillRow = pill.parentElement as HTMLElement;
    const filterRow = pillRow.parentElement as HTMLElement;
    await expect(box.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      pill.getBoundingClientRect().bottom
    );
    await expect(Math.round(box.getBoundingClientRect().width)).toBe(
      Math.round(filterRow.getBoundingClientRect().width)
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same empty branch at 375px. The five category pills wrap to two rows and the ' +
          'search field goes full width beneath them, so the state card starts lower down the ' +
          'page than the desktop story suggests.',
      },
    },
  },
};
