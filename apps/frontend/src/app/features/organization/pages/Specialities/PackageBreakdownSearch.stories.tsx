import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PackageBreakdownSearch from './PackageBreakdownSearch';
import type { CatalogEntry } from './packageFormDraftHelpers';

const entry = (
  id: string,
  name: string,
  type: CatalogEntry['type'],
  unitPrice: number,
  currency?: string
): CatalogEntry => ({
  id,
  name,
  type,
  unitPrice,
  currency,
  defaultDiscount: 0,
  maxDiscount: 20,
  isBookable: type === 'CONSULTATION' || type === 'PROCEDURE',
  isInpatientPreferred: false,
});

const CATALOG: CatalogEntry[] = [
  entry('cat-1', 'Dermatology consult', 'CONSULTATION', 85),
  entry('cat-2', 'Dental scale and polish', 'PROCEDURE', 240),
  entry('cat-3', 'Full blood panel', 'LAB', 62),
  entry('cat-4', 'Meloxicam 1.5mg/ml oral suspension', 'MEDICATION', 18),
  entry('cat-5', 'Elizabethan collar (medium)', 'INVENTORY', 9),
  entry('cat-6', 'Senior wellness plan', 'PACKAGE', 310),
];

type SearchProps = ComponentProps<typeof PackageBreakdownSearch>;

/**
 * The component is fully controlled - the package form owns the query and does the
 * filtering - so this harness plays that parent. It is what makes the dropdown reachable
 * by typing rather than by handing it a pre-filled `filteredSearch`, which is how it
 * actually appears in the product.
 */
const SearchHarness = (args: SearchProps) => {
  const [query, setQuery] = useState(args.searchQuery);
  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? CATALOG.filter((item) => item.name.toLowerCase().includes(trimmed))
    : [];
  return (
    <div className="w-[560px] max-w-full p-6 pb-56">
      <PackageBreakdownSearch
        {...args}
        searchQuery={query}
        filteredSearch={results}
        onQueryChange={(value) => {
          setQuery(value);
          args.onQueryChange(value);
        }}
      />
    </div>
  );
};

/** The panel carries no role or label, so it is reached through a row it contains. */
const panelFor = (canvasElement: HTMLElement, rowName: RegExp) =>
  within(canvasElement).getByRole('button', { name: rowName }).parentElement as HTMLElement;

const meta = {
  title: 'Organization/PackageBreakdownSearch',
  component: PackageBreakdownSearch,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The catalog picker at the top of a package breakdown. The 42px field is all that ever ' +
          'showed in a snapshot; everything below it is conditional on data that only exists mid-' +
          'typing, so neither panel had been drawn.\n\n' +
          'There are **two** panels, not one, and they are separate elements with different ' +
          'padding: the results list (`overflow-hidden`, rows at `px-4 py-2`) and the "No items ' +
          'found." card (`px-4 py-3`). Both are `absolute top-full left-0 right-0 z-50 mt-1` over ' +
          'a `--screen` fill with a `card-border` hairline, so they overlay whatever follows the ' +
          'field rather than pushing it down - which means a regression to static positioning ' +
          'shoves the entire breakdown table down the page instead of failing visibly.\n\n' +
          'The three conditions are mutually exclusive by arithmetic rather than by an explicit ' +
          'branch: results render when `filteredSearch.length > 0`, the empty card when there is a ' +
          'trimmed query, no results **and** `searchLoading` is false. Nothing renders while a ' +
          'search is in flight - deliberately, so the panel does not flicker between keystrokes - ' +
          'and that silent third state is drawn below as well, since it is indistinguishable from ' +
          'a broken dropdown unless you know it is intended.\n\n' +
          'Each row pairs the item name against a right-aligned `TYPE_LABELS[type] · price`, with ' +
          'the price formatted in the item currency where it has one and the organisation currency ' +
          'otherwise. The stories assert the rows carry that text, not merely that a panel ' +
          'appeared: an empty panel satisfies the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    searchQuery: '',
    filteredSearch: [],
    searchLoading: false,
    orgCurrency: 'USD',
    onQueryChange: fn(),
    onSelectItem: fn(),
  },
} satisfies Meta<typeof PackageBreakdownSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Field only',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Search catalog items')).toBeInTheDocument();
    await expect(canvas.queryByText('No items found.')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'The resting state the breakdown section opens on: an empty `--field-bg` pill.',
      },
    },
  },
};

export const TypingOpensResults: Story = {
  name: 'Typing opens the results panel',
  render: (args) => <SearchHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Search catalog items'), 'de');
    const panel = panelFor(canvasElement, /Dermatology consult/);
    // Assert the panel has its rows and that they carry both halves of their line -
    // an empty overlay would satisfy "the dropdown opened" on its own.
    const rows = within(panel).getAllByRole('button');
    await expect(rows).toHaveLength(2);
    await expect(rows[0]).toHaveTextContent('Dermatology consult');
    await expect(rows[0]).toHaveTextContent('Consultation · $85');
    await expect(rows[1]).toHaveTextContent('Dental scale and polish');
    await expect(rows[1]).toHaveTextContent('Procedure · $240');
    // It overlays the rest of the form rather than displacing it.
    await expect(getComputedStyle(panel).position).toBe('absolute');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two of the six catalog items match "de". This is the panel as the form actually opens ' +
          'it - by typing - rather than by being handed a pre-filled list.',
      },
    },
  },
};

export const ResultsOpen: Story = {
  name: 'Results panel (all types)',
  args: { searchQuery: 'a', filteredSearch: CATALOG },
  play: async ({ canvasElement }) => {
    const panel = panelFor(canvasElement, /Dermatology consult/);
    const rows = within(panel).getAllByRole('button');
    await expect(rows).toHaveLength(6);
    // One row per CatalogItemType, so every label in TYPE_LABELS is on screen at once.
    await expect(panel).toHaveTextContent('Diagnostics · $62');
    await expect(panel).toHaveTextContent('Medication · $18');
    await expect(panel).toHaveTextContent('Inventory · $9');
    await expect(panel).toHaveTextContent('Package · $310');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every catalog type in one panel, which is the only way to see that `LAB` reads as ' +
          '"Diagnostics" rather than "Lab" and that the longest medication name still keeps its ' +
          'type and price on the same line. The panel is `overflow-hidden` with no scroller, so ' +
          'its height is the row count - worth watching, since a real catalog returns more.',
      },
    },
  },
};

export const ForeignCurrency: Story = {
  name: 'Row currency overrides the org currency',
  args: {
    searchQuery: 'consult',
    filteredSearch: [
      entry('cat-7', 'Dermatology consult', 'CONSULTATION', 85),
      entry('cat-8', 'Referral consult (Frankfurt)', 'CONSULTATION', 140, 'EUR'),
    ],
  },
  play: async ({ canvasElement }) => {
    const panel = panelFor(canvasElement, /Dermatology consult/);
    await expect(panel).toHaveTextContent('Consultation · $85');
    await expect(panel).toHaveTextContent('Consultation · €140');
  },
  parameters: {
    docs: {
      description: {
        story:
          'An item carrying its own `currency` is priced in it; everything else falls back to the ' +
          "organisation's. Both appear in the same panel here, which is the only place the two " +
          'symbols can be compared.',
      },
    },
  },
};

export const Selecting: Story = {
  name: 'Selecting a row',
  args: { searchQuery: 'dental', filteredSearch: [CATALOG[1]] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Dental scale and polish/ }));
    // The whole entry goes back to the form - price, discounts and nested breakdown
    // included - not just an id.
    await expect(args.onSelectItem).toHaveBeenCalledWith(CATALOG[1]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A row hands the entire `CatalogEntry` to the parent. The panel does not close itself: ' +
          'the form closes it by clearing the query, so the closing behaviour lives outside this ' +
          'component.',
      },
    },
  },
};

export const NoItemsFound: Story = {
  name: 'No items found',
  args: { searchQuery: 'ultrasound', filteredSearch: [], searchLoading: false },
  play: async ({ canvasElement }) => {
    const empty = within(canvasElement).getByText('No items found.');
    // The second, separate panel - not an empty results list. Same overlay geometry,
    // different padding, and it must not push the breakdown table down the page.
    await expect(getComputedStyle(empty).position).toBe('absolute');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A settled search with nothing to show. This is its own element rather than an empty ' +
          'results list, so it is the only place its `py-3` padding and `--text-secondary` copy ' +
          'can be reviewed against the row padding above.',
      },
    },
  },
};

export const Searching: Story = {
  name: 'Searching (no panel at all)',
  args: { searchQuery: 'ultrasound', filteredSearch: [], searchLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Deliberate: neither panel renders in flight, so nothing flickers between
    // keystrokes. Pinned because "no panel" is otherwise indistinguishable from a
    // dropdown that has stopped working.
    await expect(canvas.queryByText('No items found.')).not.toBeInTheDocument();
    await expect(canvas.getByLabelText('Search catalog items')).toHaveValue('ultrasound');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A query typed, a request in flight, and no panel. There is no spinner and no skeleton - ' +
          'the field simply holds the text until results land or the empty card appears.',
      },
    },
  },
};

export const TypingFindsNothing: Story = {
  name: 'Typing into the empty state',
  render: (args) => <SearchHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Search catalog items'), 'ultrasound');
    await expect(await canvas.findByText('No items found.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same empty card reached the way a user reaches it. With `searchLoading` false the ' +
          'card appears on the first keystroke that matches nothing, so it is visible while the ' +
          'reader is still typing.',
      },
    },
  },
};
