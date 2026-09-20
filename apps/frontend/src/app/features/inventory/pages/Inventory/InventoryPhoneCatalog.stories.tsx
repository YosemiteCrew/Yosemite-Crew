import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import InventoryPhoneCatalog from './InventoryPhoneCatalog';
import type { InventoryFiltersState, InventoryItem } from './types';
import { defaultFilters } from './utils';

/**
 * Resolves a design token to the `rgb(...)` string `getComputedStyle` reports, by
 * measuring a throwaway probe rather than hard-coding a hex that would drift from
 * `globals.css` and from the dark theme.
 *
 * Called OUTSIDE any `waitFor`: testing-library retries a `waitFor` callback from a
 * MutationObserver, so a callback that appends and removes a node re-triggers itself
 * forever and wedges the tab instead of failing.
 */
const resolveTokenColor = (token: string): string => {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.backgroundColor = `var(${token})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

const item = (over: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'item-1',
  currency: 'USD',
  basicInfo: {
    name: 'Meloxicam 1.5 mg/ml',
    category: 'Medicine',
    subCategory: 'Analgesic',
    department: 'Pharmacy',
    description: '',
    status: 'Active',
    skuCode: 'MEL-015',
  },
  classification: {},
  pricing: { purchaseCost: '10', selling: '25' },
  vendor: { supplierName: '', brand: '', vendor: '', license: '', paymentTerms: '' },
  stock: {
    current: '38',
    allocated: '0',
    available: '38',
    reorderLevel: '10',
    reorderQuantity: '',
    stockLocation: 'Pharmacy',
  },
  batch: { batch: 'B-2291', manufactureDate: '', expiryDate: '12/03/2026' },
  ...over,
});

const HEALTHY = item({ stockHealth: 'HEALTHY' });

const LOW = item({
  id: 'item-2',
  stockHealth: 'LOW_STOCK',
  basicInfo: { ...HEALTHY.basicInfo, name: 'Gauze swabs (pack of 100)', skuCode: 'GAU-100' },
  stock: { ...HEALTHY.stock, current: '4', available: '4', stockLocation: 'Treatment room' },
});

const OUT_OF_STOCK = item({
  id: 'item-3',
  stockHealth: 'OUT_OF_STOCK',
  basicInfo: { ...HEALTHY.basicInfo, name: 'Buprenorphine 0.3 mg/ml', skuCode: 'BUP-003' },
  stock: { ...HEALTHY.stock, current: '0', available: '0', stockLocation: 'Controlled cabinet' },
});

const EXPIRED = item({
  id: 'item-4',
  stockHealth: 'EXPIRED',
  basicInfo: { ...HEALTHY.basicInfo, name: 'Feline leukaemia vaccine', skuCode: 'FLV-001' },
  stock: { ...HEALTHY.stock, current: '6', available: '6', stockLocation: 'Fridge 1' },
  batch: { batch: 'B-1180', manufactureDate: '', expiryDate: '02/01/2025' },
});

const CATALOG = [HEALTHY, LOW, OUT_OF_STOCK, EXPIRED];

const CATEGORIES = ['Medicine', 'Consumable', 'Vaccine'];

// Hoisted so the spies are stable across re-renders rather than replaced on each one.
const onView = fn();
const onRestock = fn();
const toggleCategoryFilter = fn();

/** `filters` is owned by the Inventory page, so the harness holds it for the pills. */
const Catalog = ({
  filteredInventory,
  loading,
  canRestock,
}: {
  filteredInventory: InventoryItem[];
  loading: boolean;
  canRestock: boolean;
}) => {
  const [filters, setFilters] = useState<InventoryFiltersState>(defaultFilters);
  return (
    <div className="bg-[var(--page)] p-3">
      <InventoryPhoneCatalog
        filteredInventory={filteredInventory}
        filters={filters}
        setFilters={setFilters}
        categoryOptions={CATEGORIES}
        toggleCategoryFilter={toggleCategoryFilter}
        lowStockCount={2}
        loading={loading}
        onView={onView}
        onRestock={onRestock}
        canRestock={canRestock}
      />
    </div>
  );
};

/** The card root is the parent of its own "View <name>" button. */
const cardFor = (canvasElement: HTMLElement, name: string): HTMLElement =>
  within(canvasElement).getByRole('button', { name: `View ${name}` }).parentElement as HTMLElement;

/**
 * Polls the left border rather than reading it once. The accent is applied as an
 * inline `borderLeft` shorthand over a Tailwind `border` class, so it only resolves
 * once `globals.css` has painted; a single synchronous read on the first frame can
 * report the 1px hairline (or a transparent var) and pass or fail for the wrong
 * reason. `expected` is resolved BEFORE the waitFor, because `resolveTokenColor`
 * mutates the DOM and a mutating callback re-triggers its own MutationObserver
 * retry forever instead of failing.
 */
const expectLeftBorder = (card: HTMLElement, width: string, expected?: string) =>
  waitFor(() => {
    const style = getComputedStyle(card);
    expect(style.borderLeftWidth).toBe(width);
    if (expected) expect(style.borderLeftColor).toBe(expected);
  });

/**
 * The 375px preset, pinned on the META rather than story by story, because this
 * component only exists below 768px - the page renders the 12-column table above
 * it. No story in this file wants another width, and a per-story pin is one a
 * new story can silently be added without: it would draw the phone catalog at
 * the 1280px project default, a width it never has in the product, and every
 * assertion below it would still pass.
 *
 * Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
 * Storybook 10 and is inert.
 */
const PHONE = { viewport: { value: 'mobile', isRotated: false } };

const meta = {
  title: 'Inventory/InventoryPhoneCatalog',
  component: Catalog,
  globals: PHONE,
  parameters: {
    layout: 'fullscreen',
    // Every story here is phone-only, so the snapshot width is set once on the meta.
    // This is Chromatic's own key, not the `parameters.viewport.viewports` map that
    // Storybook 10 removed - the render width is pinned by `globals: PHONE` above.
    chromatic: { viewports: [375] },
    docs: {
      description: {
        component:
          'The phone (<768px) inventory catalog: a horizontally scrolling pill row over a ' +
          'single column of stock-health cards. The desktop table has no legible phone form, ' +
          'so this is a bespoke screen rather than a reflow of the table, and its **async and ' +
          'empty branches had never been drawn**.\n\n' +
          'There are three list states, not two, and the third is easy to miss: the loader is ' +
          'gated on `loading && filteredInventory.length === 0`, so a refresh over rows ' +
          'already on screen shows the rows, not the loader. All three have a story below.\n\n' +
          'The card carries two signals that are computed rather than passed. The **left ' +
          'border** is 3px `--danger` when the item is expired and 3px `--warn` when it is ' +
          'restockable, against a plain 1px hairline otherwise. The **Restock CTA** needs ' +
          'three things at once - the item low or out of stock, `canRestock`, and an ' +
          '`onRestock` handler - so an expired item gets the loudest border on the screen and ' +
          'no action at all. Both are asserted here as measurements, since the difference ' +
          'between a 1px hairline and a 3px accent is not something a passing "the card ' +
          'rendered" check would ever notice.',
      },
    },
  },
  tags: ['autodocs'],
  args: { filteredInventory: CATALOG, loading: false, canRestock: true },
} satisfies Meta<typeof Catalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StockHealth: Story = {
  name: 'Four stock-health cards',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Resolved up front: these append and remove a probe node, which must never
    // happen inside a waitFor callback.
    const warn = resolveTokenColor('--warn');
    const danger = resolveTokenColor('--danger');

    /* The viewport pin, checked rather than trusted. `globals.viewport` is the only
       spelling Storybook 10 reads; the removed `parameters.viewport.defaultViewport`
       is inert, and because this component has no desktop branch, a story drawing it
       at the 1280px project default would still pass every assertion below while
       proving nothing about the phone. */
    await expect(window.innerWidth).toBeLessThan(768);
    await expect(canvas.getAllByRole('button', { name: /^View / })).toHaveLength(4);

    // The pill row sits above the list and carries the low count it was handed.
    await expect(canvas.getByRole('button', { name: 'All' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Low (2)' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    for (const category of CATEGORIES) {
      await expect(canvas.getByRole('button', { name: category })).toBeInTheDocument();
    }

    /* The healthy card, asserted on the derived fact line rather than on the raw
       props: the unit abbreviation, the reorder hint and the margin are all computed
       by `buildInventoryPhoneMeta`, and every one of them can be wrong while the card
       still renders. */
    const healthy = cardFor(canvasElement, 'Meloxicam 1.5 mg/ml');
    await expect(within(healthy).getByText('In stock')).toBeInTheDocument();
    await expect(within(healthy).getByText('38 u')).toBeInTheDocument();
    await expect(within(healthy).getByText('Pharmacy')).toBeInTheDocument();
    await expect(within(healthy).getByText('exp 03/2026')).toBeInTheDocument();
    // selling 25 against a cost of 10 - the design puts price and margin together.
    await expect(within(healthy).getByText('$25 · 60%')).toBeInTheDocument();
    // No reorder hint on a healthy item, and no CTA.
    await expect(within(healthy).queryByText(/^reorder at /)).not.toBeInTheDocument();
    await expect(within(healthy).queryByRole('button', { name: /^Restock / })).toBeNull();
    await expectLeftBorder(healthy, '1px');

    /* The low card. "bx" rather than "u" because the name says pack - the abbreviation
       is inferred from the item name, which is a guess worth seeing drawn. */
    const low = cardFor(canvasElement, 'Gauze swabs (pack of 100)');
    await expect(within(low).getByText('Low stock')).toBeInTheDocument();
    await expect(within(low).getByText('4 bx')).toBeInTheDocument();
    await expect(within(low).getByText('reorder at 10')).toBeInTheDocument();
    await expect(
      within(low).getByRole('button', { name: 'Restock Gauze swabs (pack of 100)' })
    ).toBeInTheDocument();
    await expectLeftBorder(low, '3px', warn);

    // Out of stock is restockable too, and reads 0 rather than blank.
    const out = cardFor(canvasElement, 'Buprenorphine 0.3 mg/ml');
    await expect(within(out).getByText('Out of stock')).toBeInTheDocument();
    await expect(within(out).getByText('0 u')).toBeInTheDocument();
    await expect(
      within(out).getByRole('button', { name: 'Restock Buprenorphine 0.3 mg/ml' })
    ).toBeInTheDocument();

    /* The expired card is the interesting one: the loudest border on the screen and
       NO action, because `restockEligible` is low-or-out-of-stock only. Whether an
       expired batch should offer a restock is a product decision this story pins
       rather than hides. */
    const expired = cardFor(canvasElement, 'Feline leukaemia vaccine');
    await expect(within(expired).getByText('Expired')).toBeInTheDocument();
    await expect(within(expired).getByText('exp 01/2025')).toBeInTheDocument();
    await expect(within(expired).queryByRole('button', { name: /^Restock / })).toBeNull();
    await expectLeftBorder(expired, '3px', danger);
    // The two accents are genuinely different colours, not the same var read twice.
    await expect(warn).not.toBe(danger);

    // Two CTAs on the screen in total, not four.
    await expect(canvas.getAllByRole('button', { name: /^Restock / })).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting catalog at 375px. Each card is a tap target (the whole card opens the ' +
          'record) with an optional CTA below it, so the Restock button is a sibling of the ' +
          'view button rather than nested inside it - nesting them would have made the ' +
          'restock area open the record on any missed tap.',
      },
    },
  },
};

export const NoRestockPermission: Story = {
  name: 'Without restock permission',
  args: { canRestock: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Same four cards, same borders, no CTA anywhere.
    await expect(canvas.getAllByRole('button', { name: /^View / })).toHaveLength(4);
    await expect(canvas.queryAllByRole('button', { name: /^Restock / })).toHaveLength(0);

    const warn = resolveTokenColor('--warn');
    const low = cardFor(canvasElement, 'Gauze swabs (pack of 100)');
    await expect(within(low).getByText('reorder at 10')).toBeInTheDocument();
    await expect(within(low).getByText('4 bx')).toBeInTheDocument();
    await expectLeftBorder(low, '3px', warn);
    // The card is down to its one tap target: the whole-card View button and nothing else.
    await expect(within(low).getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A reader without the restock permission. The warning border and the reorder hint ' +
          'stay - the item is still low - but the card loses its CTA and with it 38px of ' +
          'height, so a permission difference changes the rhythm of the whole list.',
      },
    },
  },
};

export const LowFilterSelected: Story = {
  name: 'The Low filter, on',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Resolved before any waitFor: the probe mutates the DOM.
    const cancelledInk = resolveTokenColor('--status-cancelled-text');
    const cancelledFill = resolveTokenColor('--status-cancelled-bg');

    const low = canvas.getByRole('button', { name: 'Low (2)' });
    const idle = getComputedStyle(low);
    await expect(idle.backgroundColor).toBe(cancelledFill);
    await expect(idle.fontWeight).toBe('600');

    await userEvent.click(low);
    await expect(low).toHaveAttribute('aria-pressed', 'true');

    /* The whole point of the finding: selected used to differ from idle ONLY by
       `shadow-[0_1px_3px_var(--sh08)]`, so these two reads were the same colour
       and the same weight and the assertions below would both have failed. The
       shadow is still there as a secondary cue, but the fill and the weight now
       carry the state - the same currency the All and category pills use. */
    await waitFor(async () => {
      await expect(getComputedStyle(low).backgroundColor).toBe(cancelledInk);
    });
    await expect(getComputedStyle(low).fontWeight).toBe('700');
    await expect(getComputedStyle(low).boxShadow).not.toBe('none');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one filter that changes what the list contains, in both states. Measured as ' +
          'computed colour and weight rather than by class name: the defect this pins was a ' +
          'selected state made entirely of a 1px-offset, 3px-blur shadow on an already-tinted ' +
          'pill, which a "the pill rendered" check would never notice.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading',
  args: { filteredInventory: [], loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading inventory…')).toBeInTheDocument();

    // Loading is not empty: the empty card must NOT be on screen at the same time.
    await expect(canvas.queryByText('Looks like a quiet day… for now.')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: /^View / })).toHaveLength(0);

    // The pills render regardless, so the filter row does not pop in after the fetch.
    await expect(canvas.getByRole('button', { name: 'All' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Low (2)' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first paint of the catalog. It is a centred line of 13px `--ink-muted` copy ' +
          'with 40px of padding above and below - not a skeleton - so the pill row is the ' +
          'only thing with any weight on screen while the fetch is out.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'Loaded and empty',
  args: { filteredInventory: [], loading: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Derived from the same noun the inventory table uses, so the phone
       catalogue and the table no longer disagree. This surface hardcoded the
       table's old "Looks like a quiet day… for now." by hand and was left behind
       when the table moved on. */
    const title = canvas.getByText('No items yet');
    await expect(title).toBeInTheDocument();
    await expect(canvas.queryByText('Looks like a quiet day… for now.')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Loading inventory…')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: /^View / })).toHaveLength(0);

    /* The empty state is a bordered card, not bare copy - which is what
       distinguishes it visually from the loader above. Walked up from the copy
       rather than matched on a class name, so a restyle that keeps the card
       still passes and one that drops the card still fails. */
    let card: HTMLElement | null = title;
    while (card && getComputedStyle(card).borderTopWidth !== '1px') {
      card = card.parentElement;
    }
    await expect(card).not.toBeNull();
    await expect(getComputedStyle(card as HTMLElement).borderRadius).toBe('16px');

    await expect(canvas.getByRole('button', { name: 'Low (2)' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Loaded, and genuinely nothing to show. Worth reading next to the loader: the two ' +
          'states are one boolean apart and look almost the same, except this one is inside a ' +
          'bordered card.\n\n' +
          'The copy does not distinguish "this clinic has no inventory yet" from "your ' +
          'filters match nothing", and the pill row above it stays active with a low count ' +
          'that can be non-zero while the list is empty - which is exactly the case where a ' +
          'reader needs to be told a filter is on.',
      },
    },
  },
};

export const RefreshOverExistingRows: Story = {
  name: 'Refreshing over rows already on screen',
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `loading` is true, and the loader is deliberately NOT shown, because the guard
    // is `loading && filteredInventory.length === 0`.
    await expect(canvas.queryByText('Loading inventory…')).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^View / })).toHaveLength(4);
    const low = cardFor(canvasElement, 'Gauze swabs (pack of 100)');
    await expect(within(low).getByText('4 bx')).toBeInTheDocument();
    await expect(within(low).getByText('reorder at 10')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The third list state, and the one the two-state reading of this component misses. ' +
          'A background refresh with rows already on screen keeps the rows: no loader, no ' +
          'flash to empty and back.\n\n' +
          'The flip side is that there is no indication a refresh is running at all, so stale ' +
          'numbers look settled. If that matters, this is the story to change.',
      },
    },
  },
};
