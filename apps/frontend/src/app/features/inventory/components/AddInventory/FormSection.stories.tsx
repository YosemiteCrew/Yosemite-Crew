import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { BusinessType } from '@/app/features/organization/types/org';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import FormSection from './FormSection';

/** `formatCurrencyValue`/`formatPercentValue` return U+2014 when they cannot compute. */
const EM_DASH = '—';

const baseItem: InventoryItem = {
  currency: 'USD',
  basicInfo: {
    name: '',
    category: '',
    subCategory: '',
    department: '',
    description: '',
    status: 'Active',
    brand: '',
    imageUrl: '',
    visibleInInventory: true,
  },
  classification: {
    form: '',
    unitofMeasure: '',
    species: [],
    administration: '',
    drugSchedule: '',
    storageCondition: '',
    controlledSubstance: 'false',
    prescriptionRequired: 'false',
    reportableToGovernment: 'false',
  },
  pricing: { purchaseCost: '', selling: '', maxDiscount: '', tax: '' },
  vendor: { supplierName: '', brand: '', vendor: '', license: '', paymentTerms: '' },
  stock: {
    current: '',
    allocated: '',
    available: '',
    maxStock: '',
    reorderLevel: '',
    reorderQuantity: '',
    stockLocation: '',
    abcClass: '',
    withdrawlPeriod: '',
    unitQnt: '',
  },
  batch: {
    batch: '',
    manufactureDate: '',
    expiryDate: '',
    expiryWarningBefore: '',
    barcode: '',
    quantity: '',
    allocated: '',
  },
  batches: [],
};

/** Section slices are merged rather than replaced, so a story only names what it changes. */
const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  ...baseItem,
  ...overrides,
  basicInfo: { ...baseItem.basicInfo, ...overrides.basicInfo },
  classification: { ...baseItem.classification, ...overrides.classification },
  pricing: { ...baseItem.pricing, ...overrides.pricing },
  vendor: { ...baseItem.vendor, ...overrides.vendor },
  stock: { ...baseItem.stock, ...overrides.stock },
  batch: { ...baseItem.batch, ...overrides.batch },
});

const drug = { itemType: 'Drug' };
const nonDrug = { itemType: 'Non-drug' };

/**
 * Both dropdowns portal their option list to `document.body`, so it is never inside
 * `canvasElement`. Waiting is not optional: the panel only mounts once
 * `useDropdownPositioning` has measured the trigger and produced a style.
 */
const openPanel = async (trigger: HTMLElement) => {
  await userEvent.click(trigger);
  return waitFor(() => {
    const node = globalThis.document.querySelector('[data-portal-dropdown]');
    if (!node) throw new Error('portalled dropdown panel never opened');
    return node as HTMLElement;
  });
};

/**
 * A read-only Stock field is not an input - it is `placeholder :` text followed by a
 * pill - so its value has to be read off the label's sibling.
 */
const readonlyChip = (canvas: ReturnType<typeof within>, label: string): string =>
  canvas.getByText(`${label} :`).nextElementSibling?.textContent ?? '';

/**
 * Vertical space between the last visible control and the footer. Every hidden field
 * still leaves an empty `<div class="w-full">` in a `gap-3` stack, so this number is
 * what tells the two `itemType` branches apart.
 */
const gapToFooter = (canvas: ReturnType<typeof within>, lastControl: Element): number =>
  canvas.getByRole('button', { name: 'Clear' }).getBoundingClientRect().top -
  lastControl.getBoundingClientRect().bottom;

const meta = {
  title: 'Inventory/FormSection',
  component: FormSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One section of the add-product form, drawn entirely from `InventoryFormConfig`: the ' +
          'component holds no field list of its own, it walks `config[businessType][sectionKey]` ' +
          'and renders each entry as one of seven controls (text, dropdown, multi-select, date, ' +
          'checkbox, textarea, upload), either full width or two-up inside a `grid-cols-2` row.\n\n' +
          'Three behaviours only exist here and nowhere in the config, which is what these ' +
          'stories are for.\n\n' +
          '**Drug-only fields are hidden by value, not by config.** When ' +
          '`classification.itemType` is `Non-drug`, nine classification fields, the batch ' +
          '`tracking` field and the stock `withdrawlPeriod` field return `null` - but the wrapper ' +
          'divs around them are still rendered, so the section keeps a 12px gap for each one it ' +
          'no longer shows.\n\n' +
          '**Pricing grows a computed summary.** Gross profit, margin and total stock value are ' +
          'derived on every render from four strings the user typed. Blank reads as zero, so an ' +
          'untouched form reports a $0 profit; only margin declines to answer, because dividing ' +
          'by a zero selling price is guarded.\n\n' +
          '**Batch is a repeater.** It maps over `formData.batches` (falling back to the single ' +
          '`formData.batch` when the list is empty), passes the index back through ' +
          '`onFieldChange`, and only offers Remove once there is more than one card.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    businessType: 'HOSPITAL',
    sectionKey: 'basicInfo',
    sectionTitle: 'Basic Details',
    formData: item(),
    errors: {},
    onFieldChange: fn(),
    onSave: fn(),
    onClear: fn(),
    onAddBatch: fn(),
    onRemoveBatch: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BasicDetails: Story = {
  name: 'Basic Details, with a header slot',
  args: {
    headerSlot: (
      <button type="button" role="switch" aria-checked="true" aria-label="Visible in Inventory">
        Visible in Inventory
      </button>
    ),
    formData: item({ basicInfo: { ...baseItem.basicInfo, category: 'Vaccine' } }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The slot is placed inside the accordion body, above the first configured
    // field - not in the accordion header, where its name suggests it lands.
    const slot = canvas.getByRole('switch', { name: 'Visible in Inventory' });
    const name = canvas.getByRole('textbox', { name: 'Item name' });
    await expect(slot.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      name.getBoundingClientRect().top
    );

    /* The section key is threaded into every change. A field that reported the wrong
       section would write into the wrong slice of the record and show up as data
       silently landing in another tab. `value` is owned by the caller and never
       echoed back here, so each keystroke is reported on its own. */
    await userEvent.type(name, 'M');
    await expect(args.onFieldChange).toHaveBeenLastCalledWith('basicInfo', 'name', 'M', undefined);

    /* Sub category is not a fixed list: `getSubCategoryOptions` narrows it to the
       chosen category. With Vaccine picked it must offer the seven vaccine
       subcategories and none of the medicine ones. */
    const panel = await openPanel(canvas.getByRole('button', { name: 'Sub category' }));
    const options = within(panel).getAllByRole('button');
    await expect(options).toHaveLength(7);
    await expect(within(panel).getByText('Rabies')).toBeInTheDocument();
    await expect(within(panel).queryByText('Antibiotic')).not.toBeInTheDocument();

    /* The footer is a nested `grid grid-cols-1 sm:grid-cols-2 gap-3` inside a flex
       column, which is exactly where an invalid template collapses without an error.
       Two equal halves and one 12px gutter is the whole contract. */
    const clear = canvas.getByRole('button', { name: 'Clear' }).getBoundingClientRect();
    const next = canvas.getByRole('button', { name: 'Next' }).getBoundingClientRect();
    await expect(next.width).toBeCloseTo(clear.width, 0);
    await expect(next.top).toBeCloseTo(clear.top, 0);
    await expect(Math.round(next.left - clear.right)).toBe(12);
  },
};

export const ClassificationDrug: Story = {
  name: 'Clinical Details for a drug',
  args: {
    sectionKey: 'classification',
    sectionTitle: 'Clinical Details',
    formData: item({
      classification: {
        ...baseItem.classification,
        ...drug,
        drugSchedule: 'Schedule IV',
        species: 'Canine, Feline',
        controlledSubstance: 'true',
      },
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // All nine drug-only controls, in the three shapes they take.
    await expect(canvas.getByRole('textbox', { name: 'Generic name' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Strength' })).toBeInTheDocument();
    for (const label of ['Form', 'Administration route', 'Strength unit']) {
      await expect(canvas.getByRole('button', { name: label })).toBeInTheDocument();
    }
    await expect(
      canvas.getByRole('button', { name: 'Drug schedule: Schedule IV' })
    ).toBeInTheDocument();

    /* Species is stored as a comma string on older records and as an array on new
       ones. `getMultiSelectValues` splits and trims the string form, so both have to
       arrive at the same trigger label. */
    await expect(
      canvas.getByRole('button', { name: 'Species: Canine, Feline' })
    ).toBeInTheDocument();

    /* A checkbox is checked for the strings 'true' and 'Yes' only, and reports 'true'
       or 'false' back - never a boolean. A handler expecting a boolean would read
       every unchecked box as truthy. */
    await expect(canvas.getByRole('checkbox', { name: 'Controlled substance' })).toBeChecked();
    const rx = canvas.getByRole('checkbox', { name: 'Prescription required' });
    await expect(rx).not.toBeChecked();
    await userEvent.click(rx);
    await expect(args.onFieldChange).toHaveBeenLastCalledWith(
      'classification',
      'prescriptionRequired',
      'true',
      undefined
    );

    /* Baseline for the non-drug story: with nothing hidden, the stack ends at the
       last control and the only space left is the accordion's pb-2 plus the root's
       gap-6 - 32px. */
    const last = canvas.getByRole('checkbox', { name: 'Is it reportable to Government?' });
    const lastRow = last.closest('label');
    await expect(lastRow).not.toBeNull();
    if (lastRow) await expect(gapToFooter(canvas, lastRow)).toBeLessThan(48);
  },
};

export const ClassificationNonDrug: Story = {
  name: 'Clinical Details for a non-drug item',
  args: {
    sectionKey: 'classification',
    sectionTitle: 'Clinical Details',
    formData: item({ classification: { ...baseItem.classification, ...nonDrug } }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every drug-only field is gone, in all three of its shapes.
    await expect(canvas.queryByRole('textbox', { name: 'Generic name' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('textbox', { name: 'Strength' })).not.toBeInTheDocument();
    for (const label of ['Drug schedule', 'Form', 'Administration route', 'Strength unit']) {
      await expect(canvas.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    await expect(canvas.queryAllByRole('checkbox')).toHaveLength(0);

    // What a non-drug item is left with.
    const itemType = canvas.getByRole('button', { name: 'Item type: Non-drug' });
    const storage = canvas.getByRole('button', { name: 'Storage condition' });
    await expect(canvas.getByRole('button', { name: 'Species' })).toBeInTheDocument();

    /* Item type shared a `grid-cols-2` row with Drug schedule. Hiding the sibling
       leaves the column empty rather than letting Item type expand, so it stays at
       half the width of a full-bleed control like Storage condition. */
    await expect(itemType.getBoundingClientRect().width).toBeLessThan(
      storage.getBoundingClientRect().width * 0.6
    );

    /* The cost of hiding fields this way: six of the nine hidden entries sit after
       the last visible control and each still contributes an empty div plus its 12px
       gap, so the section ends in ~72px of dead space on top of the 32px the drug
       variant leaves. */
    await expect(gapToFooter(canvas, storage)).toBeGreaterThan(80);
  },
};

export const Pricing: Story = {
  name: 'Pricing with the computed summary',
  args: {
    sectionKey: 'pricing',
    sectionTitle: 'Pricing',
    formData: item({
      pricing: { purchaseCost: '12.5', selling: '20', maxDiscount: '10', tax: '5' },
      stock: { ...baseItem.stock, current: '40' },
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* Three numbers nothing else recomputes: selling - cost, that over selling, and
       on-hand x cost. They are formatted with maximumFractionDigits keyed off
       Number.isInteger, which is why one of them keeps cents and one does not. */
    await expect(canvas.getByText('$7.50')).toBeInTheDocument();
    await expect(canvas.getByText('37.5%')).toBeInTheDocument();
    await expect(canvas.getByText('$500')).toBeInTheDocument();
    // Stock value borrows on-hand from the stock slice, not from anything on screen.
    await expect(canvas.getByText('on-hand stock x unit cost')).toBeInTheDocument();

    /* Numeric fields sanitise in the change handler rather than with `type=number`,
       so the guard is only as good as the regex pair. Letters are stripped... */
    const cost = canvas.getByRole('textbox', { name: 'Unit cost' });
    await userEvent.type(cost, 'a');
    await expect(args.onFieldChange).toHaveBeenLastCalledWith(
      'pricing',
      'purchaseCost',
      '12.5',
      undefined
    );
    // ...and so is a second decimal point, which `12.5.` would otherwise become.
    await userEvent.type(cost, '.');
    await expect(args.onFieldChange).toHaveBeenLastCalledWith(
      'pricing',
      'purchaseCost',
      '12.5',
      undefined
    );
  },
};

export const PricingUntouched: Story = {
  name: 'Pricing before anything is typed',
  args: { sectionKey: 'pricing', sectionTitle: 'Pricing' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The state the drawer opens in, and the one worth arguing about: `toNumberSafe`
       reads '' as 0, so the summary asserts a $0 profit and a $0 stock value on a
       product with no prices at all. Margin is the only one that declines, and only
       because a zero selling price is explicitly guarded against - not because the
       field is empty. */
    await expect(canvas.getAllByText('$0')).toHaveLength(2);
    await expect(canvas.getByText(EM_DASH)).toBeInTheDocument();
  },
};

export const Batches: Story = {
  name: 'Three batches',
  args: {
    sectionKey: 'batch',
    sectionTitle: 'Batch and expiry',
    formData: item({
      classification: { ...baseItem.classification, ...drug },
      batches: [
        { _id: 'b-1', batch: 'LOT-A-114', manufactureDate: '', expiryDate: '', quantity: '40' },
        { _id: 'b-2', batch: 'LOT-B-220', manufactureDate: '', expiryDate: '', quantity: '25' },
        { _id: 'b-3', batch: 'LOT-C-337', manufactureDate: '', expiryDate: '', quantity: '12' },
      ],
    }),
    errors: { batch: { batch: 'Batch number is required' } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Batch 1')).toBeInTheDocument();
    await expect(canvas.getByText('Batch 3')).toBeInTheDocument();

    /* Each card must read its own row of `batches`. The whole repeater sharing one
       set of values is the failure this guards: it looks correct until two batches
       differ. */
    const lots = canvas.getAllByRole('textbox', { name: 'Batch/ Lot number' });
    await expect(lots.map((input) => (input as HTMLInputElement).value)).toEqual([
      'LOT-A-114',
      'LOT-B-220',
      'LOT-C-337',
    ]);

    // Typing into the second card has to report index 1, or the edit lands elsewhere.
    await userEvent.type(lots[1], 'X');
    await expect(args.onFieldChange).toHaveBeenLastCalledWith('batch', 'batch', 'LOT-B-220X', 1);

    // Same for Remove, which is only offered once a second batch exists.
    const removes = canvas.getAllByRole('button', { name: 'Remove' });
    await expect(removes).toHaveLength(3);
    await userEvent.click(removes[1]);
    await expect(args.onRemoveBatch).toHaveBeenCalledWith(1);

    await userEvent.click(canvas.getByRole('button', { name: 'Add another batch' }));
    await expect(args.onAddBatch).toHaveBeenCalledTimes(1);

    /* Errors are held per section, not per batch, so one invalid lot number marks
       all three cards. There is no way for the form to point at the offending one. */
    await expect(canvas.getAllByRole('alert')).toHaveLength(3);
  },
};

export const SingleBatch: Story = {
  name: 'One batch on a non-drug item',
  args: {
    sectionKey: 'batch',
    sectionTitle: 'Batch and expiry',
    formData: item({
      classification: { ...baseItem.classification, ...nonDrug },
      batch: { ...baseItem.batch, batch: 'LOT-A-114', quantity: '40' },
      batches: [],
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* An empty `batches` list falls back to the single `formData.batch`, so the
       card is still drawn - the section is never blank. */
    await expect(canvas.getByText('Batch 1')).toBeInTheDocument();
    await expect(canvas.queryByText('Batch 2')).not.toBeInTheDocument();

    /* But only the card is. The header comes from the fallback, while every field
       inside it reads `formData.batches[index]` - and the fallback exists precisely
       because that list is empty. `formData.batch.batch` is 'LOT-A-114' in this
       record and the input below is blank, so an item whose one batch was never
       promoted into `batches` opens with an empty form over real stored data. */
    const lot = canvas.getByRole('textbox', { name: 'Batch/ Lot number' });
    await expect((lot as HTMLInputElement).value).toBe('');

    // Edits from the fallback card still report index 0, against a list of length 0.
    await userEvent.type(lot, 'X');
    await expect(args.onFieldChange).toHaveBeenLastCalledWith('batch', 'batch', 'X', 0);

    // Nothing to remove when there is one batch, but another can still be added.
    await expect(canvas.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add another batch' })).toBeInTheDocument();

    /* The drug-only rule reaches into Batch too: a non-drug item loses the
       regulatory tracking field while every other batch field stays. */
    await expect(
      canvas.queryByRole('textbox', { name: 'Regulatory tracking ID' })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Barcode' })).toBeInTheDocument();
  },
};

export const StockControl: Story = {
  name: 'Stock Control',
  args: {
    sectionKey: 'stock',
    sectionTitle: 'Stock Control',
    stockLocationOptions: ['Main pharmacy', 'Ward store', 'Theatre'],
    formData: item({
      classification: { ...baseItem.classification, ...drug },
      stock: { ...baseItem.stock, current: '40', allocated: '6', reorderLevel: '10' },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* On hand and Available are read-only pills, not inputs. Available is recomputed
       from current minus allocated on every render and ignores `stock.available`,
       which is '' here - so a stale stored figure can never be shown. */
    await expect(readonlyChip(canvas, 'On hand stock')).toBe('40');
    await expect(readonlyChip(canvas, 'Available stock (dispensable)')).toBe('34');

    // HOSPITAL is the only business type configured with the stock-unit row.
    await expect(canvas.getByRole('button', { name: 'Stock unit type' })).toBeInTheDocument();
    // Drug-only in Stock, so a non-drug item would not show this one.
    await expect(
      canvas.getByRole('button', { name: 'Withdrawal period (optional)' })
    ).toBeInTheDocument();

    /* The org's own locations replace the built-in list entirely rather than
       extending it. If the override stopped applying, the field would still look
       populated - with nine locations this practice does not have. */
    const panel = await openPanel(canvas.getByRole('button', { name: 'Stock location' }));
    const options = within(panel).getAllByRole('button');
    await expect(options.map((option) => option.textContent)).toEqual([
      'Main pharmacy',
      'Ward store',
      'Theatre',
    ]);
  },
};

export const Vendor: Story = {
  name: 'Vendor details',
  args: { sectionKey: 'vendor', sectionTitle: 'Vendor details' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Only the requested section is drawn, from the same whole-record `formData`.
    await expect(canvas.queryByRole('textbox', { name: 'Item name' })).not.toBeInTheDocument();
    // HOSPITAL is configured with the licence field; GROOMER and BOARDER are not.
    await expect(canvas.getByRole('textbox', { name: 'License number' })).toBeInTheDocument();

    /* The label and the field name disagree here - "Vendor name" writes to
       `supplierName` - so the change has to be checked by the name the record uses,
       not by the copy on screen. */
    await userEvent.type(canvas.getByRole('textbox', { name: 'Vendor name' }), 'A');
    await expect(args.onFieldChange).toHaveBeenLastCalledWith(
      'vendor',
      'supplierName',
      'A',
      undefined
    );
  },
};

export const RequiredFieldErrors: Story = {
  name: 'Errors on required fields',
  args: {
    errors: { basicInfo: { name: 'Name is required', category: 'Category is required' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A text field announces its error: aria-invalid, and aria-describedby pointing
       at a live region. */
    const name = canvas.getByRole('textbox', { name: 'Item name' });
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    const describedBy = name.getAttribute('aria-describedby');
    await expect(describedBy).toBeTruthy();
    await expect(globalThis.document.getElementById(describedBy ?? '')?.textContent).toContain(
      'Name is required'
    );

    /* A dropdown does not. Both fields are failing, both draw a red border and a
       12px line of red text, and only one of the two is reachable without sight:
       there is exactly one alert on a section with two errors, and the Category
       trigger carries neither aria-invalid nor aria-describedby. */
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(canvas.getByText('Category is required')).toBeInTheDocument();
    const category = canvas.getByRole('button', { name: 'Category' });
    await expect(category).not.toHaveAttribute('aria-invalid');
    await expect(category).not.toHaveAttribute('aria-describedby');
  },
};

export const SaveDisabled: Story = {
  name: 'Saving blocked, with a custom label',
  args: { disableSave: true, saveLabel: 'Save product' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // `saveLabel` replaces the default 'Next' on the last section of the drawer.
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    const save = canvas.getByRole('button', { name: 'Save product' });
    const clear = canvas.getByRole('button', { name: 'Clear' });

    /* One flag disables both. Clear is not a save, and locking it means a user who
       cannot submit also cannot start over - worth deciding whether that is intended
       before something depends on it. */
    await expect(save).toBeDisabled();
    await expect(clear).toBeDisabled();

    // The disabled class also drops pointer events, hence the bypass.
    await userEvent.click(save, { pointerEventsCheck: 0 });
    await userEvent.click(clear, { pointerEventsCheck: 0 });
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onClear).not.toHaveBeenCalled();
  },
};

export const NoFieldsConfigured: Story = {
  name: 'A business type with no config',
  args: {
    /* The union has four members, so this is only reachable from a record whose
       businessType the frontend does not know yet - a new type added on the backend
       first, which is how it will actually happen. */
    businessType: 'CLINIC' as BusinessType,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('No fields configured.')).toBeInTheDocument();

    /* The guard returns before the accordion AND before the footer, so the section
       title disappears and there is no Clear or Next left. A user who reaches this
       state has no control to move off it. */
    await expect(canvas.queryByRole('button', { name: 'Basic Details' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    /* The two-up `grid-cols-2` rows have to hold two 44px controls in a phone-width
       column without pushing the page sideways.

       The other half of the phone story is not asserted here on purpose: the footer's
       `grid-cols-1 sm:grid-cols-2` stacking is a viewport media query, and the
       verification harness loads the story frame at the panel width rather than at
       375px, so a stacking assertion would be measuring the desktop branch and
       passing for the wrong reason. Stacking is checked by eye at this viewport;
       the footer's two-up geometry is asserted in `BasicDetails`. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
