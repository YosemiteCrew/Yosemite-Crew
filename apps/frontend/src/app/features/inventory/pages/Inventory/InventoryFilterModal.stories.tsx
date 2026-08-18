import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { InventoryFiltersState } from '@/app/features/inventory/pages/Inventory/types';
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';
import InventoryFilterModal, { type FilterChip } from './InventoryFilterModal';

const LOCATIONS = ['Main store', 'Pharmacy fridge', 'Surgery trolley'];
const CATEGORIES = ['Medicine', 'Vaccine', 'Consumable'];
const SUBCATEGORIES: Record<string, string[]> = {
  Medicine: ['Antibiotic', 'Analgesic', 'Antiparasitic'],
  Vaccine: ['Core', 'Non-core'],
  // Deliberately none: a category with no subcategories renders no chevron at all.
  Consumable: [],
};
const SUPPLIERS = ['Northgate Veterinary Supply', 'Harbour Labs'];

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

const toggleSetValue = (prev: Set<string>, key: string) => {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};

type HarnessProps = {
  /** Mirrors the page's `filterOpen`; the panel is unmounted-looking until this is true. */
  filterOpen: boolean;
  /** Section keys open on mount: 'stock-status' | 'location' | 'category' | 'abc' | 'supplier'. */
  openSections: string[];
  /** Category names whose subcategory list is expanded on mount. */
  expandedCategories: string[];
  /** Seeds `filters`, which is what drives the chip row and the per-section counts. */
  initialFilters: Partial<InventoryFiltersState>;
  locationFilterOptions: string[];
  categoryOptions: string[];
  categorySubcategoryOptions: Record<string, string[]>;
  supplierFilterOptions: string[];
};

/**
 * The page owns every piece of this panel's state - open flag, filters, which
 * sections are expanded, which categories are expanded - and passes eleven
 * callbacks down. The harness is that owner, reproducing the page's real
 * `toggleArrayValue` / `toggleSetItem` semantics and its `selectedFilterChips`
 * derivation so the chip row, the section counts and the checkboxes stay in
 * agreement the way they do in the app.
 */
/**
 * Chip derivation, lifted out of the harness. It is a pure function of the filter state
 * plus the two removal callbacks, so it can be read - and reasoned about - without the
 * surrounding useState soup. Review flagged the harness for doing state management,
 * filter mutation, chip derivation and rendering all at once; this is the third of those.
 */
const deriveChips = (
  filters: InventoryFiltersState,
  {
    setFilters,
    toggleCategoryFilter,
    toggleListFilter,
  }: {
    setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
    toggleCategoryFilter: (category: string) => void;
    toggleListFilter: (
      key: 'subCategories' | 'locations' | 'abcClasses' | 'suppliers',
      value: string
    ) => void;
  }
): FilterChip[] => {
  const chips: FilterChip[] = [];
  if (filters.status !== 'ALL') {
    chips.push({
      id: `status-${filters.status}`,
      label: filters.status.replaceAll('_', ' ').toLowerCase(),
      onRemove: () => setFilters((prev) => ({ ...prev, status: 'ALL' })),
    });
  }
  filters.categories.forEach((category) =>
    chips.push({
      id: `category-${category}`,
      label: category,
      onRemove: () => toggleCategoryFilter(category),
    })
  );
  filters.subCategories.forEach((sub) =>
    chips.push({
      id: `subCategory-${sub}`,
      label: sub,
      onRemove: () => toggleListFilter('subCategories', sub),
    })
  );
  filters.locations.forEach((location) =>
    chips.push({
      id: `location-${location}`,
      label: location,
      onRemove: () => toggleListFilter('locations', location),
    })
  );
  filters.abcClasses.forEach((abc) =>
    chips.push({
      id: `abc-${abc}`,
      label: `Class ${abc}`,
      onRemove: () => toggleListFilter('abcClasses', abc),
    })
  );
  filters.suppliers.forEach((supplier) =>
    chips.push({
      id: `supplier-${supplier}`,
      label: supplier,
      onRemove: () => toggleListFilter('suppliers', supplier),
    })
  );
  return chips;
};

const InventoryFilterHarness = ({
  filterOpen: initialOpen,
  openSections,
  expandedCategories: initialExpanded,
  initialFilters,
  locationFilterOptions,
  categoryOptions,
  categorySubcategoryOptions,
  supplierFilterOptions,
}: HarnessProps) => {
  const [filterOpen, setFilterOpen] = useState(initialOpen);
  const [filters, setFilters] = useState<InventoryFiltersState>({
    ...defaultFilters,
    ...initialFilters,
  });
  const [filterOpenSections, setFilterOpenSections] = useState(() => new Set(openSections));
  const [expandedCategories, setExpandedCategories] = useState(() => new Set(initialExpanded));

  const toggleFilterSection = (key: string) =>
    setFilterOpenSections((prev) => toggleSetValue(prev, key));
  const toggleExpandedCategory = (category: string) =>
    setExpandedCategories((prev) => toggleSetValue(prev, category));

  const toggleListFilter = (
    key: 'subCategories' | 'locations' | 'abcClasses' | 'suppliers',
    value: string
  ) => setFilters((prev) => ({ ...prev, [key]: toggleValue(prev[key] ?? [], value) }));

  const toggleCategoryFilter = (category: string) =>
    setFilters((prev) => {
      const categories = toggleValue(prev.categories ?? [], category);
      const subs = new Set(categorySubcategoryOptions[category] ?? []);
      // Deselecting a category drops the subcategories that only it offered,
      // otherwise an invisible subcategory filter keeps narrowing the table.
      const subCategories = categories.includes(category)
        ? prev.subCategories
        : prev.subCategories.filter((sub) => !subs.has(sub));
      return {
        ...prev,
        category: categories.length === 1 ? categories[0] : 'all',
        categories,
        subCategories,
      };
    });

  const chips = deriveChips(filters, { setFilters, toggleCategoryFilter, toggleListFilter });

  return (
    <div className="min-h-[560px]">
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className="rounded-full border border-[var(--hairline)] px-4 py-2 text-caption-1 text-[var(--ink-body)]"
      >
        Open filters
      </button>
      <InventoryFilterModal
        filterOpen={filterOpen}
        selectedFilterChips={chips}
        setFilterOpen={setFilterOpen}
        setFilters={setFilters}
        filterOpenSections={filterOpenSections}
        toggleFilterSection={toggleFilterSection}
        filters={filters}
        locationFilterOptions={locationFilterOptions}
        toggleListFilter={toggleListFilter}
        categoryOptions={categoryOptions}
        categorySubcategoryOptions={categorySubcategoryOptions}
        expandedCategories={expandedCategories}
        toggleCategoryFilter={toggleCategoryFilter}
        toggleExpandedCategory={toggleExpandedCategory}
        supplierFilterOptions={supplierFilterOptions}
      />
    </div>
  );
};

/** The panel portals to `document.body`, and only carries `open` while showing. */
const openDialog = () => document.querySelector('dialog[open]') as HTMLElement;

/**
 * Retries, for the one story that opens the drawer from a click rather than from
 * args. Matched on the `open` attribute rather than on `role`, because the closed
 * dialog is still in the DOM - it is hidden by the UA `dialog:not([open])` rule.
 */
const findOpenDialog = async () => {
  await waitFor(() => expect(openDialog()).toBeInTheDocument());
  return openDialog();
};

const meta = {
  title: 'Inventory/InventoryFilterModal',
  component: InventoryFilterHarness,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The inventory filter drawer: a `sm` (360px) right-side `Modal`, portalled to ' +
          '`document.body`, with five collapsible sections and one nested level inside Category.\n\n' +
          'Almost none of this existed in any snapshot. The drawer only mounts visibly while ' +
          '`filterOpen` is true, each section body is gated on `filterOpenSections.has(key)`, and ' +
          'the subcategory list is gated a second time on `expandedCategories.has(category)`. So ' +
          'the deepest surface - a checkbox list indented `ml-6` under an already-open section ' +
          'inside an already-open drawer - is **three** independent state flags deep. That is ' +
          'precisely the shape of the bugs this work exists for: markup no test could reach, ' +
          'because reaching it needs three interactions.\n\n' +
          'The two sections that most need drawing are Category and the chip row. Category renders ' +
          'a different tree per row: a checked category takes `text-blue-text font-semibold` while ' +
          'the rest stay `text-text-primary`, and the chevron is rendered **only** when that ' +
          'category actually has subcategories - `Consumable` here has none, so it has no ' +
          'affordance rather than a dead one. The chip row above the sections appears only when at ' +
          'least one filter is set, and it brings the "Clear all" pill into the header with it, ' +
          'which shifts the whole scroll body down.\n\n' +
          'Section headers carry a count badge (`size-5` circle, `--blue-strong`, 10px/700 white) ' +
          'that is rendered only when the count is above zero, so the header is two different ' +
          'layouts depending on data. Stock status counts 1 for anything other than `ALL`; the ' +
          'other four count their selected values.\n\n' +
          'The harness owns the state the Inventory page owns, including the rule that ' +
          'deselecting a category drops the subcategories only it offered - otherwise an invisible ' +
          'subcategory filter keeps narrowing the table with nothing on screen to explain it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filterOpen: true,
    openSections: ['stock-status'],
    expandedCategories: [],
    initialFilters: {},
    locationFilterOptions: LOCATIONS,
    categoryOptions: CATEGORIES,
    categorySubcategoryOptions: SUBCATEGORIES,
    supplierFilterOptions: SUPPLIERS,
  },
} satisfies Meta<typeof InventoryFilterHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (trigger only)',
  args: { filterOpen: false },
  play: async ({ canvasElement }) => {
    // Nothing carries `open`, so the whole drawer is out of the accessibility tree.
    await expect(openDialog()).toBeNull();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open filters' }));
    const dialog = await findOpenDialog();
    await expect(dialog).toHaveAttribute('open');
    const panel = within(dialog);
    await expect(panel.getByRole('heading', { name: 'Filter' })).toBeInTheDocument();
    // The drawer is not merely present - it has its sections and its footer.
    await expect(panel.getByRole('button', { name: /^Stock status/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The transition the app actually performs: a trigger flips `filterOpen`, the portalled ' +
          '`<dialog>` gains `open`, and the drawer slides in from `translate-x-[120%]`.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Open (stock status expanded)',
  play: async () => {
    const dialog = openDialog();
    await expect(dialog).toBeInTheDocument();
    const panel = within(dialog);
    // All five headers exist...
    await expect(panel.getByRole('button', { name: /^Stock status/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /^Location/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /^Category/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /^ABC/ })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: /^Supplier/ })).toBeInTheDocument();
    // ...but only the seeded one has a body. Assert the body's real content, not
    // just that a header rendered - an empty section would pass the weaker check.
    await expect(panel.getAllByRole('radio')).toHaveLength(4);
    await expect(panel.getByRole('radio', { name: 'All' })).toBeChecked();
    await expect(panel.queryByRole('checkbox')).not.toBeInTheDocument();
    // The footer travels with the panel, not with the scroll body.
    await expect(panel.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "The page's own default: only `stock-status` is open, so four radios show and every other " +
          'section is a bare header. No chips, so the header carries no "Clear all" pill.',
      },
    },
  },
};

export const AllSectionsOpen: Story = {
  name: 'Every section expanded',
  args: { openSections: ['stock-status', 'location', 'category', 'abc', 'supplier'] },
  play: async () => {
    const panel = within(openDialog());
    await expect(panel.getAllByRole('radio')).toHaveLength(4);
    // 3 locations + 3 categories + 3 ABC classes + 2 suppliers, no subcategories yet.
    await expect(panel.getAllByRole('checkbox')).toHaveLength(11);
    await expect(panel.getByRole('checkbox', { name: 'Pharmacy fridge' })).toBeInTheDocument();
    await expect(panel.getByRole('checkbox', { name: 'Class B' })).toBeInTheDocument();
    await expect(panel.getByRole('checkbox', { name: 'Harbour Labs' })).toBeInTheDocument();
    // Only the two categories that have subcategories offer a chevron.
    await expect(panel.getByRole('button', { name: 'Expand Medicine' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Expand Vaccine' })).toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Expand Consumable' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything open at once - the tallest the panel gets, and the only drawing that shows the ' +
          '`divide-y divide-card-border` rules between sections doing their job inside the scroll ' +
          'body while the header and footer stay pinned.',
      },
    },
  },
};

export const SubcategoriesExpanded: Story = {
  name: 'Category to subcategory (three flags deep)',
  args: { openSections: ['category'] },
  play: async () => {
    const panel = within(openDialog());
    // Only the three categories so far - the nested list does not exist yet.
    await expect(panel.getAllByRole('checkbox')).toHaveLength(3);
    await userEvent.click(panel.getByRole('button', { name: 'Expand Medicine' }));
    // Assert the nested list actually has its options, which is the whole point:
    // a chevron that flips while the panel below stays empty is the regression.
    expect(await panel.findByRole('checkbox', { name: 'Antibiotic' })).toBeInTheDocument();
    await expect(panel.getByRole('checkbox', { name: 'Analgesic' })).toBeInTheDocument();
    await expect(panel.getByRole('checkbox', { name: 'Antiparasitic' })).toBeInTheDocument();
    await expect(panel.getAllByRole('checkbox')).toHaveLength(6);
    await expect(panel.getByRole('button', { name: 'Collapse Medicine' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The deepest surface in the panel: three `Medicine` subcategories in an `ml-6` column, ' +
          'reachable only with the drawer open, the Category section expanded and that one category ' +
          'expanded. Nothing had ever rendered it.',
      },
    },
  },
};

export const WithSelections: Story = {
  name: 'With chips and counts',
  args: {
    openSections: ['stock-status', 'category'],
    expandedCategories: ['Medicine'],
    initialFilters: {
      status: 'LOW_STOCK',
      categories: ['Medicine', 'Vaccine'],
      subCategories: ['Antibiotic'],
      locations: ['Main store'],
    },
  },
  play: async () => {
    const panel = within(openDialog());
    // The chip row and the "Clear all" pill exist only while something is selected.
    await expect(panel.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Remove low stock' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Remove Medicine' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Remove Antibiotic' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Remove Main store' })).toBeInTheDocument();
    // Counts land on the section headers: 1 for a non-ALL status, 2 categories.
    await expect(panel.getByRole('button', { name: 'Stock status 1' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Category 2' })).toBeInTheDocument();
    // The nested subcategory is both checked and expanded.
    await expect(panel.getByRole('checkbox', { name: 'Antibiotic' })).toBeChecked();
    await expect(panel.getByRole('checkbox', { name: 'Medicine' })).toBeChecked();
    await expect(panel.getByRole('radio', { name: 'low stock' })).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five filters set. This is the only state where the header carries "Clear all", where the ' +
          'chip row exists between the header and the scroll body, and where the count badges are ' +
          'rendered - the badge is a `size-5` circle inside the header row, so its presence changes ' +
          'that row rather than overlaying it. Note the collapsed Location section still counts 1 ' +
          'even with nothing on screen to explain it: that badge is the only trace of the filter.',
      },
    },
  },
};

export const RemoveChip: Story = {
  name: 'Removing a chip clears its checkbox',
  args: {
    openSections: ['location'],
    initialFilters: { locations: ['Main store', 'Pharmacy fridge'] },
  },
  play: async () => {
    const panel = within(openDialog());
    await expect(panel.getByRole('checkbox', { name: 'Main store' })).toBeChecked();
    await userEvent.click(panel.getByRole('button', { name: 'Remove Main store' }));
    await expect(panel.getByRole('checkbox', { name: 'Main store' })).not.toBeChecked();
    await expect(
      panel.queryByRole('button', { name: 'Remove Main store' })
    ).not.toBeInTheDocument();
    // The other chip and the "Clear all" pill survive.
    await expect(panel.getByRole('button', { name: 'Remove Pharmacy fridge' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The chip `×` and the section checkbox are two views of one value. Removing the chip has ' +
          'to unset the checkbox below it, and the drawer has to keep the remaining chip - the two ' +
          'drifting apart is invisible until both are on screen at once.',
      },
    },
  },
};
