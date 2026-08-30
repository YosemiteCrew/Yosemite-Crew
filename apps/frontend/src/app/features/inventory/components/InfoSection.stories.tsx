import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import type { BusinessType } from '@/app/features/organization/types/org';
import type {
  BasicInfoValues,
  ClassificationValues,
  InventoryItem,
  StockValues,
} from '@/app/features/inventory/pages/Inventory/types';
import InfoSection from './InfoSection';

const ORG_ID = 'org-info-section-story';

/** Every label below is the `placeholder` the HOSPITAL config carries for that field. */
const DRUG_ONLY_LABELS = [
  'Generic name',
  'Drug schedule',
  'Form',
  'Administration route',
  'Strength',
  'Strength unit',
  'Controlled substance',
  'Prescription required',
  'Is it reportable to Government?',
];

const BASIC_INFO: BasicInfoValues = {
  name: 'Meloxicam 15 mg/mL',
  brand: 'Metacam',
  skuCode: 'SKU-4471',
  category: 'Medicine',
  subCategory: 'NSAID',
  department: 'Pharmacy',
  description: 'Injectable NSAID for post-operative analgesia.',
  status: 'ACTIVE',
};

const CLASSIFICATION: ClassificationValues = {
  itemType: 'Drug',
  genericName: 'Meloxicam',
  drugSchedule: 'Non-scheduled',
  species: ['Canine', 'Feline'],
  storageCondition: 'Refrigerated',
  form: 'Injection',
  administration: 'Injectable',
  strength: '15',
  unitofMeasure: 'mg/mL',
  controlledSubstance: 'false',
  prescriptionRequired: 'true',
  reportableToGovernment: 'false',
};

const STOCK: StockValues = {
  current: '120',
  allocated: '45',
  /* Deliberately stale. The stored figure is never rendered - the footer recomputes
     available from on-hand minus the ALLOCATED FIELD IN THE DRAFT - so a story that
     seeds a matching number cannot tell the two apart. */
  available: '999',
  maxStock: '400',
  reorderLevel: '40',
  reorderQuantity: '100',
  stockLocation: 'Pharmacy',
  abcClass: 'Class A',
  withdrawlPeriod: '7 days',
  stockType: 'Bottle',
  unitQnt: '10',
};

const buildItem = (
  overrides: {
    basicInfo?: Partial<BasicInfoValues>;
    classification?: Partial<ClassificationValues>;
    stock?: Partial<StockValues>;
  } = {}
): InventoryItem => ({
  id: 'item-4471',
  organisationId: ORG_ID,
  businessType: 'HOSPITAL',
  basicInfo: { ...BASIC_INFO, ...overrides.basicInfo },
  classification: { ...CLASSIFICATION, ...overrides.classification },
  pricing: { purchaseCost: '18.40', selling: '32.00', maxDiscount: '10', tax: '5' },
  vendor: {
    supplierName: 'Northwind Veterinary Supply',
    brand: 'Metacam',
    vendor: 'Distributor',
    license: 'LIC-88213',
    paymentTerms: 'Net 30',
  },
  stock: { ...STOCK, ...overrides.stock },
  batch: { batch: 'B-2291', manufactureDate: '2026-01-12', expiryDate: '2027-01-12' },
});

const DRUG_ITEM = buildItem();
const NON_DRUG_ITEM = buildItem({
  basicInfo: { name: 'Kennel disinfectant', category: 'Cleaning supply', subCategory: 'Detergent' },
  classification: { itemType: 'Non-drug' },
});

/* Only the four business types in `InventoryFormConfig` have sections. The empty
   state is what an organisation on any OTHER business type renders, which is why
   this has to be cast in - there is no valid value that reaches the branch. */
const UNCONFIGURED_BUSINESS = 'PHARMACY' as unknown as BusinessType;

/** Both dropdown flavours here portal their panel to <body>, outside canvasElement. */
const openPanel = async (): Promise<HTMLElement> =>
  waitFor(() => {
    const panel = globalThis.document.querySelector<HTMLElement>('[data-portal-dropdown]');
    if (!panel) throw new Error('dropdown panel is not mounted');
    return panel;
  });

/** Which of `labels` are on screen, in the order asked for - so a diff names the field. */
const labelsPresent = (canvas: ReturnType<typeof within>, labels: string[]) =>
  labels.filter((label) => canvas.queryByText(label) !== null);

type SectionHandle = {
  save: () => Promise<void>;
  cancel: () => void;
  startEditing: () => void;
  isEditing: () => boolean;
};

/**
 * The section is handed `hideInlineActions`, so it renders no Save or Cancel of its
 * own: the detail modal owns those buttons and drives the section through the ref.
 * This harness is that modal, reduced to the three calls it makes.
 */
const SectionWithParentActions = (props: React.ComponentProps<typeof InfoSection>) => {
  const section = useRef<SectionHandle | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <InfoSection {...props} ref={section} />
      <div className="flex gap-3">
        <button type="button" onClick={() => section.current?.startEditing()}>
          Edit section
        </button>
        <button
          type="button"
          onClick={() => {
            void section.current?.save();
          }}
        >
          Save section
        </button>
        <button type="button" onClick={() => section.current?.cancel()}>
          Discard
        </button>
      </div>
    </div>
  );
};

const meta = {
  title: 'Inventory/InfoSection',
  component: InfoSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One tab of the inventory detail modal. It reads `InventoryFormConfig[businessType]` ' +
          'for the section, flattens the rows into a flat field list and hands that to ' +
          '`EditableAccordion`, so the same component draws Basic Details for a hospital and ' +
          'Stock Control for a groomer.\n\n' +
          'Three pieces of behaviour live here rather than in the accordion. **Drug-only fields ' +
          'are filtered out for a non-drug item** - statically for the stock and batch sections ' +
          'from the saved item type, and dynamically for classification from the DRAFT item ' +
          'type, so switching the dropdown to Non-drug drops nine editors before anything is ' +
          'saved. **Stock replaces its two read-only figures with a footer** that recomputes ' +
          '`available = max(0, onHand - allocated)` from the draft, so the number moves while ' +
          'the allocation is typed. **Upload fields are pulled out of the field list** into a ' +
          'footer of `ImageUploadField`s, which is why the product image sits under the rows ' +
          'instead of beside a label.\n\n' +
          'The section never renders Save or Cancel - `hideInlineActions` is always on and the ' +
          'modal drives `save` / `cancel` / `startEditing` through the ref.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    businessType: 'HOSPITAL',
    sectionKey: 'basicInfo',
    sectionTitle: 'Basic Details',
    inventory: DRUG_ITEM,
    organisationId: ORG_ID,
    onSaveSection: fn(async () => {}),
    onEditingChange: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InfoSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BasicInfo: Story = {
  name: 'Basic details, resting',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The title is printed twice on purpose-of-record: once as the 23px section
       heading and again inside the accordion header. One match would mean the
       accordion did not mount at all, which is the failure this guards. */
    await expect(canvas.getAllByText('Basic Details')).toHaveLength(2);

    await expect(
      labelsPresent(canvas, [
        'Item name',
        'Brand (optional)',
        'SKU (optional)',
        'Category',
        'Sub category',
        'Description (optional)',
      ])
    ).toHaveLength(6);

    /* The `imageUrl` field is component `upload`, so it must NOT be one of the rows
       above - it is moved into the accordion footer. The file input carries the
       field's placeholder, which is how you can tell it came from the config rather
       than from a hardcoded uploader. */
    const fileInput = canvasElement.querySelector('input[type="file"]');
    await expect(fileInput).toHaveAttribute('aria-label', 'Product image (optional)');

    // Resting means resting: nothing is editable until the pencil is used.
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'Edit Basic Details' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the modal opens on. Six labelled rows, then the product-image footer. The ' +
          'section title appears twice - as the heading above the accordion and inside the ' +
          'accordion header - which is worth a decision, because in the modal both sit within ' +
          '60px of each other.',
      },
    },
  },
};

export const EditingBasicInfo: Story = {
  name: 'Changing the category re-resolves the sub category',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Basic Details' }));

    // The saved pair, before anything is touched.
    await expect(canvas.getByRole('button', { name: 'Sub category: NSAID' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Category: Medicine' }));
    const categoryPanel = await openPanel();
    await userEvent.click(within(categoryPanel).getByText('Vaccine'));

    /* `fieldResets` clears subCategory whenever category moves. Without it the item
       keeps an NSAID subcategory under a Vaccine category and nothing complains. */
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Sub category' })).toBeInTheDocument()
    );
    await expect(canvas.getByRole('button', { name: 'Category: Vaccine' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Sub category' }));
    const subCategoryPanel = await openPanel();
    /* `optionsResolver` narrows the list to the chosen category's own subcategories.
       The field's configured options are the FLAT list of every subcategory, so NSAID
       being absent is the proof the resolver ran - its presence would mean the
       dropdown fell back to the config and offers subcategories from other
       categories. */
    await expect(within(subCategoryPanel).getByText('Rabies')).toBeInTheDocument();
    await expect(within(subCategoryPanel).queryByText('NSAID')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one interaction in Basic Details with a rule behind it. Category and sub category ' +
          'sit on the same row, and the sub category dropdown is configured with every ' +
          'subcategory in the system; only the resolver keeps the two consistent.',
      },
    },
  },
};

export const SavesThroughTheParent: Story = {
  name: 'Saving is driven by the modal, not the section',
  render: (args) => <SectionWithParentActions {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit section' }));

    const brand = await canvas.findByRole('textbox', { name: 'Brand (optional)' });
    await userEvent.clear(brand);
    await userEvent.type(brand, 'Metacam Plus');

    /* No inline actions: a section left in edit mode has no way to commit itself.
       If `hideInlineActions` were ever dropped the modal would show two Save
       buttons that disagree about which one is primary. */
    await expect(canvas.queryByText('Save')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Cancel')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Save section' }));

    /* The section key is supplied by the section, not by the caller of `save()` -
       that is the whole contract between the modal and this component. */
    await waitFor(() => expect(args.onSaveSection).toHaveBeenCalledTimes(1));
    await expect(args.onSaveSection).toHaveBeenCalledWith(
      'basicInfo',
      expect.objectContaining({ brand: 'Metacam Plus', name: 'Meloxicam 15 mg/mL' })
    );
    // A successful save leaves edit mode and tells the modal, which is how the
    // modal's footer swaps back from Cancel/Save to Close/Edit.
    await waitFor(() =>
      expect(canvas.queryByRole('textbox', { name: 'Brand (optional)' })).not.toBeInTheDocument()
    );
    await expect(args.onEditingChange).toHaveBeenLastCalledWith(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The section wrapped in a stand-in for the detail modal: three plain buttons calling ' +
          '`startEditing`, `save` and `cancel` on the ref.\n\n' +
          'The payload is only the fields the section rendered, so a save from Basic Details ' +
          'carries no classification or stock keys - and no `imageUrl` either, unless the image ' +
          'footer was touched during the same edit.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Editing disabled (no permission, or a save in flight)',
  args: {
    disableEditing: true,
    inventory: buildItem({ basicInfo: { imageUrl: MEDIA_SOURCES.avatars.dog } }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.queryByRole('button', { name: 'Edit Basic Details' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);

    /* The image footer is NOT withdrawn with the rest of the editing affordances:
       it still draws an enabled Remove control over the picture. What stops it is
       the accordion's readOnly guard swallowing the change, so the button looks
       live and does nothing. Clicking it here proves the guard holds - and that
       the affordance is the thing worth fixing, not the guard. */
    const remove = canvas.getByRole('button', { name: 'Remove image' });
    await expect(remove).toBeEnabled();
    await userEvent.click(remove);
    await expect(canvas.getByRole('img', { name: 'Product image' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a member without edit permission sees - and also what everyone sees while an ' +
          'update or a hide is in flight, since the modal passes the same flag for both. The ' +
          'rows and the product image stay readable; only the pencil goes.',
      },
    },
  },
};

export const ClassificationDrug: Story = {
  name: 'Clinical details for a drug',
  args: { sectionKey: 'classification', sectionTitle: 'Clinical Details' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // All nine drug-only fields, plus the three every item type keeps.
    await expect(labelsPresent(canvas, DRUG_ONLY_LABELS)).toEqual(DRUG_ONLY_LABELS);
    await expect(labelsPresent(canvas, ['Item type', 'Species', 'Storage condition'])).toHaveLength(
      3
    );
    // Multi-selects read back as a joined list rather than the raw array.
    await expect(canvas.getByText('Canine, Feline')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full clinical set: twelve rows, three of them checkboxes that read back as Yes / ' +
          'No. This is the baseline the non-drug story is subtracted from.',
      },
    },
  },
};

export const ClassificationNonDrug: Story = {
  name: 'Clinical details for a non-drug',
  args: {
    sectionKey: 'classification',
    sectionTitle: 'Clinical Details',
    inventory: NON_DRUG_ITEM,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Nine of the twelve rows are gone. Asking for the whole list back rather than
       spot-checking one label is deliberate: the filter is a Set lookup keyed on
       field NAME, so a config rename silently un-hides exactly one field. */
    await expect(labelsPresent(canvas, DRUG_ONLY_LABELS)).toEqual([]);
    await expect(labelsPresent(canvas, ['Item type', 'Species', 'Storage condition'])).toHaveLength(
      3
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A cleaning product carries no schedule, strength or route, so the section collapses ' +
          'to three rows. Same section, same config - the difference is entirely ' +
          '`classification.itemType`.',
      },
    },
  },
};

export const ClassificationSwitchedWhileEditing: Story = {
  name: 'Switching to Non-drug drops the fields immediately',
  args: { sectionKey: 'classification', sectionTitle: 'Clinical Details' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Clinical Details' }));
    await expect(await canvas.findByRole('textbox', { name: 'Generic name' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Item type: Drug' }));
    const panel = await openPanel();
    await userEvent.click(within(panel).getByText('Non-drug'));

    /* The classification filter reads the DRAFT item type, not the saved one, so the
       drug-only editors disappear before any save. Without that, an item retyped as
       non-drug would still be collecting a drug schedule in the same session. */
    await waitFor(() =>
      expect(canvas.queryByRole('textbox', { name: 'Generic name' })).not.toBeInTheDocument()
    );
    await expect(
      canvas.queryByRole('checkbox', { name: 'Prescription required' })
    ).not.toBeInTheDocument();
    // The fields that are not drug-only stay put and keep their draft values.
    await expect(
      canvas.getByRole('button', { name: 'Storage condition: Refrigerated' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Nine editors vanish mid-edit, which is a large jump for the surrounding modal to ' +
          'absorb - the accordion loses roughly half its height on one dropdown selection. The ' +
          'hidden fields keep their draft values, so switching back restores them.',
      },
    },
  },
};

export const StockControl: Story = {
  name: 'Stock control, resting',
  args: { sectionKey: 'stock', sectionTitle: 'Stock Control' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* On hand and Available are configured as read-only fields, then dropped from
       the row list by name and re-drawn as the footer. So the ROW labels must be
       absent - their presence would mean each figure is on screen twice. */
    await expect(canvas.queryByText('On hand stock')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Available stock (dispensable)')).not.toBeInTheDocument();

    const onHand = canvas.getByText('On hand stock :').parentElement as HTMLElement;
    const available = canvas.getByText('Available stock (dispensable) :')
      .parentElement as HTMLElement;
    await expect(within(onHand).getByText('120')).toBeInTheDocument();
    // 120 - 45 = 75, computed here rather than read from the record: the stored
    // `available` on this fixture is a stale 999 and must never reach the screen.
    await expect(within(available).getByText('75')).toBeInTheDocument();
    await expect(canvas.queryByText('999')).not.toBeInTheDocument();

    await expect(
      labelsPresent(canvas, ['Allocated stock (optional)', 'Withdrawal period (optional)'])
    ).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The two figures a dispensing decision turns on are lifted out of the rows into a pair ' +
          'of badges above them, so they read as a summary rather than as two more fields. ' +
          'Available is always derived - the value stored on the item is ignored.',
      },
    },
  },
};

export const EditingStock: Story = {
  name: 'The available badge follows the draft allocation',
  args: { sectionKey: 'stock', sectionTitle: 'Stock Control' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Stock Control' }));

    const allocated = await canvas.findByRole('textbox', {
      name: 'Allocated stock (optional)',
    });
    const available = canvas.getByText('Available stock (dispensable) :')
      .parentElement as HTMLElement;
    const onHand = canvas.getByText('On hand stock :').parentElement as HTMLElement;

    await userEvent.clear(allocated);
    await userEvent.type(allocated, '100');
    await waitFor(() => expect(within(available).getByText('20')).toBeInTheDocument());
    // On hand comes from the record, not the draft, so it must not move with it.
    await expect(within(onHand).getByText('120')).toBeInTheDocument();

    await userEvent.clear(allocated);
    await userEvent.type(allocated, '900');
    /* Clamped at zero. An over-allocation is a data problem, but "-780 available"
       on a dispensing screen reads as a rendering fault rather than as a warning. */
    await waitFor(() => expect(within(available).getByText('0')).toBeInTheDocument());
    await expect(canvas.queryByText('-780')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing an allocation moves the available badge on every keystroke. Over-allocating ' +
          'clamps it to zero rather than going negative - the badge is the only feedback, there ' +
          'is no validation error and the save is allowed.',
      },
    },
  },
};

export const StockLocationsFromTheOrganisation: Story = {
  name: 'Stock locations supplied by the organisation',
  args: {
    sectionKey: 'stock',
    sectionTitle: 'Stock Control',
    stockLocationOptions: ['Main pharmacy', 'Cold room', 'Theatre store'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The saved value still reads back, because an unmatched value falls through to
    // itself rather than to a dash.
    await expect(canvas.getByText('Pharmacy')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Edit Stock Control' }));

    /* But the EDITOR cannot show it: the trigger resolves its label against the
       organisation's list, and 'Pharmacy' is not in it, so the control comes up
       blank on a field that has a value. The draft still holds it, so saving
       without touching the dropdown keeps it. */
    await expect(await canvas.findByRole('button', { name: 'Stock location' })).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Stock location: Pharmacy' })
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Stock location' }));
    const panel = await openPanel();
    await expect(within(panel).getByText('Main pharmacy')).toBeInTheDocument();
    // The nine built-in locations are replaced, not appended to.
    await expect(within(panel).queryByText('Warehouse')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the organisation has configured its own stock locations they replace the built-in ' +
          'list outright. That is the intended behaviour, but it makes an item saved against a ' +
          'built-in location (here, Pharmacy) open with an empty location dropdown - the row ' +
          'reads Pharmacy and the editor reads nothing.',
      },
    },
  },
};

export const StockForANonDrug: Story = {
  name: 'Stock control for a non-drug',
  args: { sectionKey: 'stock', sectionTitle: 'Stock Control', inventory: NON_DRUG_ITEM },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Withdrawal period is a food-safety field and is meaningless on a disinfectant,
       so the same drug-only map that thins classification also thins stock. */
    await expect(canvas.queryByText('Withdrawal period (optional)')).not.toBeInTheDocument();
    await expect(canvas.getByText('Allocated stock (optional)')).toBeInTheDocument();
    await expect(canvas.getByText('On hand stock :')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drug-only filter is not confined to the clinical tab. Stock loses its withdrawal ' +
          'period for a non-drug item, and batch loses its regulatory tracking ID the same way.',
      },
    },
  },
};

export const NoFieldsConfigured: Story = {
  name: 'A business type with no configuration',
  args: {
    businessType: UNCONFIGURED_BUSINESS,
    sectionKey: 'stock',
    sectionTitle: 'Stock Control',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No fields configured for this section.')).toBeInTheDocument();
    /* The early return drops the section heading too, so the tab loses its own name
       as well as its fields - the member is left with a modal that says nothing
       about which tab they are on. */
    await expect(canvas.queryByText('Stock Control')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Edit Stock Control' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reached when an organisation is on a business type `InventoryFormConfig` has no entry ' +
          'for. One centred grey line, no heading and no retry - so it reads as an empty section ' +
          'rather than as a configuration gap.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: stock control',
  args: { sectionKey: 'stock', sectionTitle: 'Stock Control' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const footer = canvas.getByText('On hand stock :').parentElement?.parentElement as HTMLElement;

    /* The two badges are 330px of text side by side, which does not fit a 375px
       phone. Wrapping is the only thing that stops the footer forcing the modal
       into a sideways scroll, and it is a single utility class away from being
       lost. */
    await expect(getComputedStyle(footer).flexWrap).toBe('wrap');
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Stock Control is the widest section - the footer badges plus the paired rows - so it ' +
          'is the one that decides whether the detail modal fits a phone.',
      },
    },
  },
};
