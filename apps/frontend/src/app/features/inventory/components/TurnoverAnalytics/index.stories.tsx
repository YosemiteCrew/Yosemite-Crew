import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type {
  InventoryItem,
  InventoryTurnoverItem,
} from '@/app/features/inventory/pages/Inventory/types';
import { useOrgStore } from '@/app/stores/orgStore';
// `AbcTable` puts `.yc-table-head` on its header band but imports nothing: the
// recipe (the --screen-2 band, 10.5px uppercase Satoshi, the hairline shadow)
// lives in this sheet, and the Inventory page does not pull it in either - it
// arrives at runtime only because some other component in the same route bundle
// happens to import it. In Storybook the module graph is just this component, so
// without the import here the band renders as plain sentence-case text on the
// card background and the story quietly draws something the product never shows.
// `SelectsAnAbcClass` asserts `textTransform` for that reason: the class supplies
// it and no Tailwind utility on that element does, so dropping this line fails a
// story instead of changing a screenshot nobody re-reads.
import '@/app/ui/tables/GenericTable/Generictable.css';
import TurnoverAnalytics from './index';

const item = (id: string, name: string, overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id,
  currency: 'EUR',
  sku: `SKU-${id}`,
  status: 'ACTIVE',
  basicInfo: {
    name,
    category: 'Medicine',
    subCategory: 'NSAID',
    department: 'Pharmacy',
    description: '',
    status: 'Active',
    skuCode: `SKU-${id}`,
  },
  classification: { form: 'Tablet', strength: '50 mg' },
  pricing: { purchaseCost: '4.20', selling: '7.00' },
  vendor: {
    supplierName: 'Nordwest Vet Supply',
    brand: 'Zoetis',
    vendor: 'Distributor',
    license: 'DE-4471',
    paymentTerms: 'Net 30',
  },
  stock: {
    current: '48',
    allocated: '6',
    available: '42',
    reorderLevel: '12',
    reorderQuantity: '60',
    stockLocation: 'Pharmacy',
    abcClass: 'Class A',
  },
  batch: { batch: 'B-2026-04', manufactureDate: '2026-01-08', expiryDate: '2027-02-28' },
  ...overrides,
});

const CARPROFEN = item('1', 'Carprofen 50 mg');

/**
 * The low-stock item, and therefore the one the panel opens on:
 * `selectDefaultProduct` prefers a low-stock product over a Class A one. 4 on hand
 * against a reorder point of 12, so `computeSuggestedOrder` asks for 12 x 2 - 4 = 20.
 */
const NOBIVAC = item('2', 'Nobivac Rabies 1 ml', {
  basicInfo: {
    name: 'Nobivac Rabies 1 ml',
    category: 'Vaccine',
    subCategory: 'Rabies',
    department: 'Pharmacy',
    description: '',
    status: 'Active',
    skuCode: 'SKU-2',
  },
  classification: { form: 'Vial', strength: '1 ml' },
  pricing: { purchaseCost: '12.00', selling: '19.50' },
  stock: {
    current: '4',
    allocated: '0',
    available: '4',
    reorderLevel: '12',
    reorderQuantity: '40',
    stockLocation: 'Cold chain',
    abcClass: 'Class B',
  },
});

const CHLORHEXIDINE = item('3', 'Chlorhexidine scrub 500 ml', {
  basicInfo: {
    name: 'Chlorhexidine scrub 500 ml',
    category: 'Consumable',
    subCategory: 'Antiseptic',
    department: 'Surgery',
    description: '',
    status: 'Active',
    skuCode: 'SKU-3',
  },
  classification: { form: 'Bottle', strength: '4%' },
  pricing: { purchaseCost: '3.10', selling: '6.40' },
  stock: {
    current: '9',
    allocated: '0',
    available: '9',
    reorderLevel: '4',
    reorderQuantity: '20',
    stockLocation: 'Surgery',
    abcClass: 'Class C',
  },
});

const INVENTORY: InventoryItem[] = [CARPROFEN, NOBIVAC, CHLORHEXIDINE];

/** No reorder level at all, which is the branch where the suggestion disappears. */
const UNTRACKED: InventoryItem[] = [
  item('4', 'Meloxicam oral suspension', {
    classification: { form: 'Bottle', strength: '1.5 mg/ml' },
    stock: {
      current: '26',
      allocated: '0',
      available: '26',
      reorderLevel: '',
      reorderQuantity: '',
      stockLocation: 'Pharmacy',
      abcClass: 'Class A',
    },
  }),
];

const TURNOVER: InventoryTurnoverItem[] = [
  {
    itemId: '1',
    name: 'Carprofen 50 mg',
    beginningInventory: 60,
    endingInventory: 48,
    turnsPerYear: 5.2,
    daysOnShelf: 70,
  },
  {
    itemId: '2',
    name: 'Nobivac Rabies 1 ml',
    beginningInventory: 30,
    endingInventory: 4,
    turnsPerYear: 2.4,
    daysOnShelf: 38,
  },
  {
    itemId: '3',
    name: 'Chlorhexidine scrub 500 ml',
    beginningInventory: 14,
    endingInventory: 9,
    turnsPerYear: 1.1,
    daysOnShelf: 120,
  },
];

/**
 * The only network this view can reach is `useDashboardAnalytics`, and its effect
 * returns on its first line when there is no `primaryOrgId` - so clearing that one
 * store field is the whole isolation, with no service stub anywhere. The trade is
 * visible and deliberate: the month chart has no trend to draw and shows its
 * "Not enough history yet" state. Everything the product panel renders comes from
 * the `inventory` / `turnover` props, which are the props under review here.
 */
const seedOrg = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId: null });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const detailPanel = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-testid="product-panel"]') as HTMLElement;

const phoneCard = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-testid="product-card-phone"]') as HTMLElement | null;

const tracksOf = (element: HTMLElement) =>
  getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/);

const meta = {
  title: 'Inventory/TurnoverAnalytics',
  component: TurnoverAnalytics,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The turnover view of Inventory. Two of its parts had never been drawn, and they are the ' +
          'two that never appear together: **`ProductDetailPanel`**, the tall card on the right at ' +
          'desktop width, and **`ProductPhoneCard`**, the single row that replaces it below 768px. ' +
          'Both are module-private and are reached through the exported view.\n\n' +
          'The swap is decided by `useIsPhone`, which is a `matchMedia` subscription seeded `false` ' +
          'and corrected in an effect - so it is a post-mount change, and a story that renders at the ' +
          'panel width and calls itself a phone story shows the desktop card. The viewport is pinned ' +
          'as a global on each story for that reason.\n\n' +
          'Which product the panel opens on is not a prop either: `selectDefaultProduct` picks the ' +
          'first low-stock item, then the first Class A item, then whatever is first. Clicking a row ' +
          'in the ABC table re-points it at that class, again preferring a low-stock member - which ' +
          'is the only way the panel ever changes product.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    turnover: TURNOVER,
    inventory: INVENTORY,
    setActiveView: fn(),
    onReorder: fn(),
    onViewHistory: fn(),
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seedOrg,
} satisfies Meta<typeof TurnoverAnalytics>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DetailPanel: Story = {
  name: 'Product detail panel (low stock)',
  play: async ({ args, canvasElement }) => {
    const panel = detailPanel(canvasElement);
    await expect(panel).not.toBeNull();
    const inPanel = within(panel);

    // Identity: the name, and a subtitle assembled from ABC class, sub-category and
    // the pluralised dose form. `Vial` becomes `vials` in the subtitle AND in the
    // suggestion sentence below, from the same helper.
    await expect(inPanel.getByText('Nobivac Rabies 1 ml')).toBeInTheDocument();
    await expect(inPanel.getByText('Class B · Rabies · vials')).toBeInTheDocument();
    await expect(inPanel.getByText('LOW STOCK')).toBeInTheDocument();

    /* Four metrics in a two-track grid. Four children and two tracks is the shape;
       a template that failed to resolve would stack them into one column and still
       look like a considered layout. */
    const kpis = panel.querySelector('.grid') as HTMLElement;
    await expect(tracksOf(kpis)).toHaveLength(2);
    await expect(kpis.children).toHaveLength(4);
    await expect(within(kpis).getByText('Turnover')).toBeInTheDocument();
    await expect(within(kpis).getByText('2.4×')).toBeInTheDocument();
    await expect(within(kpis).getByText('38')).toBeInTheDocument();

    /* On-hand is the only metric that changes colour, and only when it is under the
       reorder point - so it is asserted against its neighbour rather than against a
       hex value, which would just re-state the token. */
    const onHand = within(kpis).getByText('4');
    const reorderPoint = within(kpis).getByText('12');
    await waitFor(() => {
      expect(getComputedStyle(onHand).color).not.toBe(getComputedStyle(reorderPoint).color);
    });

    // The suggestion is one sentence built from three values, and it has to agree
    // with the button label beside it: reorder-up-to-twice-the-point, 12 x 2 - 4.
    const quantity = inPanel.getByText('20 vials');
    await expect(quantity.parentElement?.textContent).toBe(
      'Suggested order: 20 vials brings stock to twice the reorder point of 12.'
    );

    await expect(inPanel.getByRole('button', { name: 'History' })).toBeInTheDocument();
    await userEvent.click(inPanel.getByRole('button', { name: 'Reorder 20' }));
    // The callback carries the selected InventoryItem, not the derived panel model -
    // the restock drawer needs the item, and that mapping is easy to get wrong.
    await expect(args.onReorder).toHaveBeenCalledWith(NOBIVAC);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel as it opens: the low-stock product, its four metrics, the empty consumption ' +
          'strip (there is no per-product history endpoint yet, and the dashed box says so rather ' +
          'than drawing a flat line), the suggested order, and the two footer actions pinned to the ' +
          'bottom by `mt-auto` so the card matches the height of the chart column beside it.',
      },
    },
  },
};

export const SelectsAnAbcClass: Story = {
  name: 'Panel follows an ABC row',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opening = within(detailPanel(canvasElement));
    await expect(opening.getByText('Nobivac Rabies 1 ml')).toBeInTheDocument();

    /* The row is the selector, so its own layout is worth pinning before clicking
       it: five tracks and five cells above the `sm` breakpoint - class tile, share
       bar, product count, turnover, policy. Below it the row drops to three tracks
       and the last two cells go `display: none`, which is why "five children" alone
       would not have caught a collapsed template. */
    const classARow = canvas.getByText('Weekly review').closest('button') as HTMLElement;
    await expect(tracksOf(classARow)).toHaveLength(5);
    await expect(classARow.children).toHaveLength(5);
    const header = canvasElement.querySelector('.yc-table-head') as HTMLElement;
    await expect(getComputedStyle(header).textTransform).toBe('uppercase');
    await expect(tracksOf(header)).toEqual(tracksOf(classARow));
    await expect(within(classARow).getByText('1 products')).toBeInTheDocument();

    // Class A holds one product and it is fully stocked, so the "prefer a low-stock
    // member" rule falls through to the first member.
    await userEvent.click(classARow);

    const panel = within(detailPanel(canvasElement));
    expect(await panel.findByText('Carprofen 50 mg')).toBeInTheDocument();
    await expect(panel.getByText('Class A · NSAID · tablets')).toBeInTheDocument();
    await expect(panel.queryByText('LOW STOCK')).not.toBeInTheDocument();

    /* Worth looking at rather than passing over: a product that is comfortably in
       stock still draws the suggestion box, because `computeSuggestedOrder` returns
       0 (a number) rather than null once a reorder point exists. The card therefore
       offers "Reorder 0". */
    await expect(panel.getByText('0 tablets')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Reorder 0' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The ABC rows are the only selector this panel has - there is no product picker on the ' +
          'screen - so the row is worth reading as a control rather than as a table line. Each row ' +
          'picks the low-stock member of its class if there is one, so a click usually lands on the ' +
          'product that needs attention rather than on the alphabetically first; Class A here holds ' +
          'one fully stocked product, which is what makes the fallback visible. The header band and ' +
          'the row are separate grids that have to agree column-for-column, and the story compares ' +
          'their resolved templates instead of trusting that two copies of the same track list stayed ' +
          'in step.',
      },
    },
  },
};

export const NoReorderPoint: Story = {
  name: 'Panel without a reorder point',
  args: { inventory: UNTRACKED, turnover: [] },
  play: async ({ canvasElement }) => {
    const panel = within(detailPanel(canvasElement));

    await expect(panel.getByText('Meloxicam oral suspension')).toBeInTheDocument();
    // No reorder level means no low-stock test, no suggestion, and a bare label -
    // the three consequences all come off the same missing field.
    await expect(panel.queryByText('LOW STOCK')).not.toBeInTheDocument();
    await expect(panel.queryByText(/^Suggested order/)).not.toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Reorder' })).toBeInTheDocument();
    // Turnover and days-on-shelf have no matching row here, so both print the
    // em-dash placeholder rather than a zero that would read as a measurement.
    await expect(panel.getAllByText('—')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A product nobody has given a reorder point. This is the common case for a practice that ' +
          'has just imported its stock list, so it is worth seeing that the card degrades to four ' +
          'metrics and one action rather than inventing a target.',
      },
    },
  },
};

export const PhoneCard: Story = {
  name: 'Phone - product card replaces the panel',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ args, canvasElement }) => {
    /* `useIsPhone` is false during the first render and corrected in an effect, so
       the phone card arrives one commit late - polled rather than read once. */
    await waitFor(() => {
      expect(phoneCard(canvasElement)).not.toBeNull();
    });
    const card = phoneCard(canvasElement) as HTMLElement;
    await expect(detailPanel(canvasElement)).toBeNull();

    /* The same product model, rewritten as one line: name and turnover on top, the
       stock sentence under it, and a compact reorder pill. Three children in a
       single flex row - the icon tile, the text block, the action. */
    await expect(getComputedStyle(card).display).toBe('flex');
    await expect(card.children).toHaveLength(3);
    const inCard = within(card);
    await expect(inCard.getByText('Nobivac Rabies 1 ml · 2.4×')).toBeInTheDocument();
    // "below" only appears under the reorder point, and it is the phone card's only
    // low-stock signal apart from the tinted icon tile - there is no pill here.
    await expect(inCard.getByText('4 on hand · below reorder point 12')).toBeInTheDocument();

    await userEvent.click(inCard.getByRole('button', { name: 'Reorder 20' }));
    await expect(args.onReorder).toHaveBeenCalledWith(NOBIVAC);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the 380px panel would be taller than the screen, so it is replaced entirely ' +
          'rather than reflowed: one row, no consumption strip, no suggestion sentence, no History ' +
          'action. Everything dropped is reachable from the product itself - this row is a pointer, ' +
          'not a summary.',
      },
    },
  },
};
