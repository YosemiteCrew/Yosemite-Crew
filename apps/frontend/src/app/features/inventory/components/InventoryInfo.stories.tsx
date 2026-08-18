import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import InventoryInfo from './InventoryInfo';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';

const ITEM: InventoryItem = {
  id: 'inv-meloxicam-15',
  organisationId: 'org-storybook',
  businessType: 'HOSPITAL',
  currency: 'USD',
  status: 'ACTIVE',
  stockHealth: 'LOW_STOCK',
  basicInfo: {
    name: 'Meloxicam 1.5 mg/mL oral suspension',
    category: 'Medicine',
    subCategory: 'Analgesic',
    department: 'Pharmacy',
    description: 'NSAID oral suspension for post-operative and chronic pain in dogs.',
    status: 'Active',
    brand: 'Metacam',
    skuCode: 'MEL-15-100',
  },
  classification: {
    genericName: 'Meloxicam',
    itemType: 'Medical',
    drugSchedule: 'Not scheduled',
    storageCondition: 'Room Temperature',
    form: 'Suspension',
    administration: 'Oral',
    strength: '1.5',
    unitofMeasure: 'mg/mL',
    controlledSubstance: 'false',
    prescriptionRequired: 'true',
  },
  pricing: {
    purchaseCost: '18.40',
    selling: '32.00',
    maxDiscount: '10',
    tax: '5',
  },
  vendor: {
    supplierName: 'Northline Veterinary Supply',
    brand: 'Metacam',
    vendor: 'Distributor',
    license: 'VET-4471-NL',
    paymentTerms: 'Net 30',
    leadTime: '5 days',
  },
  stock: {
    current: '14',
    allocated: '3',
    available: '11',
    reorderLevel: '20',
    reorderQuantity: '48',
    stockLocation: 'Pharmacy',
    stockType: 'Bottle',
    unitQnt: '100',
  },
  batch: {
    batch: 'B-2291',
    manufactureDate: '2026-01-14',
    expiryDate: '2027-01-14',
    quantity: '14',
    serial: 'SR-2291',
  },
  batches: [
    {
      _id: 'batch-1',
      batch: 'B-2291',
      manufactureDate: '2026-01-14',
      expiryDate: '2027-01-14',
      quantity: '14',
      allocated: '3',
    },
  ],
};

const meta = {
  title: 'Inventory/InventoryInfo',
  component: InventoryInfo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The inventory detail drawer, and the only place in inventory where **two dialogs stack**.\n\n' +
          'Neither surface is reachable from a rendered page: the drawer is gated on `showModal`, and ' +
          'the "Delete inventory item?" confirmation is gated on internal `showDeleteConfirm` state ' +
          'with no prop that reaches it. Both portal to `document.body` through `ModalBase`, so they ' +
          'are siblings of the story canvas rather than descendants - queries here go through ' +
          '`within(document.body)`, and a story that only looked inside `canvasElement` would find an ' +
          'empty page and still pass.\n\n' +
          'The stacking is the part worth a snapshot. `ModalBase` keeps a module-level `modalStack` ' +
          'and a ref-counted scroll lock precisely because both dialogs install document-level ' +
          'Escape and outside-mousedown listeners; only the topmost may act, or dismissing the ' +
          'confirmation would take the drawer down with it. Visually it means a 22px `--sh55` ' +
          'backdrop with a 6px blur drawn **over** an already-open drawer, and a centered 500px panel ' +
          'over a 470px right-hand one - a composite no single-modal story can produce.\n\n' +
          'The confirmation also has its own two-column `grid grid-cols-2 gap-3` action row (Discard ' +
          'plus a `--danger-strong` Delete), which is exactly the shape of layout that shipped broken ' +
          'elsewhere on this branch: a grid mounted only after an interaction.\n\n' +
          'The footer buttons are stateful rather than fixed. `getPrimaryButtonText` returns "Delete ' +
          'item" at rest, "Restore item" for a hidden item, "Hiding..."/"Unhiding..." while the ' +
          'promise is in flight and "Save"/"Saving..." in edit mode - four labels on one control, ' +
          'and only the first was ever visible.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeInventory: ITEM,
    businessType: 'HOSPITAL',
    onUpdate: fn(async () => {}),
    onAddBatch: fn(async () => {}),
    onUpdateBatch: fn(async () => {}),
    onHide: fn(async () => {}),
    onUnhide: fn(async () => {}),
    canEdit: true,
    organisationId: 'org-storybook',
  },
} satisfies Meta<typeof InventoryInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Detail drawer',
  play: async () => {
    // The drawer portals out of the story canvas, so every query goes through
    // document.body rather than canvasElement.
    const body = within(document.body);
    await expect(
      await body.findByRole('heading', { name: ITEM.basicInfo.name })
    ).toBeInTheDocument();
    // The tab row and the section body both have to be there - a drawer with a
    // header and an empty body would satisfy a "the dialog opened" assertion.
    await expect(body.getAllByRole('tab')).toHaveLength(6);
    await expect(body.getByRole('tab', { name: 'Basic Details' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(body.getByRole('tab', { name: 'Vendor details' })).toBeInTheDocument();
    // A value row from the open Basic Details accordion, so "the drawer rendered"
    // means the section body rendered too.
    await expect(body.getByText('MEL-15-100')).toBeInTheDocument();
    await expect(body.getByRole('button', { name: 'Delete item' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The drawer at rest on its first tab. The header meta line joins category and SKU with a ' +
        'middot ("Medicine · MEL-15-100"), the six section tabs sit under it, and the footer is a ' +
        'stretched Close/Delete pair.',
    },
  },
};

export const DeleteConfirmation: Story = {
  name: 'Nested delete confirmation',
  play: async () => {
    const body = within(document.body);
    await expect(
      await body.findByRole('heading', { name: ITEM.basicInfo.name })
    ).toBeInTheDocument();

    await userEvent.click(body.getByRole('button', { name: 'Delete item' }));

    // Assert the second dialog has its real content, not just that a second
    // dialog exists.
    await expect(
      await body.findByRole('heading', { name: 'Delete inventory item?' })
    ).toBeInTheDocument();
    await expect(body.getByText(/This will remove/)).toHaveTextContent(ITEM.basicInfo.name);
    await expect(body.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    await expect(body.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    // Both panels are on screen at once - that stacking is the whole point.
    await expect(body.getByRole('heading', { name: ITEM.basicInfo.name })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The second-level dialog, which no prop can reach. Its copy is deliberately honest about the ' +
        'backend - the item is hidden rather than hard-deleted and can be restored - so the panel is ' +
        'three lines of body text tall, not one, and the two-column action grid sits under it.',
    },
  },
};

export const ConfirmationDiscarded: Story = {
  name: 'Confirmation discarded (drawer survives)',
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: 'Delete item' }));
    await expect(
      await body.findByRole('heading', { name: 'Delete inventory item?' })
    ).toBeInTheDocument();

    await userEvent.click(body.getByRole('button', { name: 'Discard' }));

    // Only the confirmation unmounts. The drawer underneath must still be open -
    // this is the regression `modalStack` and the ref-counted scroll lock exist
    // to prevent.
    await expect(
      body.queryByRole('heading', { name: 'Delete inventory item?' })
    ).not.toBeInTheDocument();
    await expect(body.getByRole('heading', { name: ITEM.basicInfo.name })).toBeInTheDocument();
    await expect(body.getAllByRole('tab')).toHaveLength(6);
  },
  parameters: {
    docs: {
      story:
        'Dismissing the top dialog. Both dialogs listen on `document` for Escape and outside ' +
        'mousedown, so without the stack the child taking itself down would take the parent with it. ' +
        'The assertion here is that exactly one dialog remains, not zero.',
    },
  },
};

export const HiddenItem: Story = {
  name: 'Hidden item (restore, no confirmation)',
  args: {
    activeInventory: { ...ITEM, status: 'HIDDEN' },
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByRole('button', { name: 'Restore item' })).toBeInTheDocument();
    await expect(body.queryByRole('button', { name: 'Delete item' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'A hidden item flips the primary action to "Restore item", and that path calls `onUnhide` ' +
        'directly - there is no confirmation on the way back in, only on the way out. The asymmetry ' +
        'is intentional and is only visible with both stories side by side.',
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEdit: false },
  play: async () => {
    const body = within(document.body);
    await expect(
      await body.findByRole('heading', { name: ITEM.basicInfo.name })
    ).toBeInTheDocument();
    // The whole primary action is dropped rather than dimmed: a control that
    // looks inactive but still fires is its own defect.
    await expect(body.queryByRole('button', { name: 'Delete item' })).not.toBeInTheDocument();
    // The section body is still fully rendered, just not editable.
    await expect(body.getAllByRole('tab')).toHaveLength(6);
    await expect(body.getByText('MEL-15-100')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'With `canEdit` false the footer keeps only Close, so the stretched two-button row becomes a ' +
        'single full-width control - a layout the permissioned story never draws.',
    },
  },
};

export const PricingSection: Story = {
  name: 'Pricing tab (currency summary)',
  args: { initialSection: 'pricing' },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText('Gross profit per unit :')).toBeInTheDocument();
    await expect(body.getByText('Margin :')).toBeInTheDocument();
    await expect(body.getByText('Total stock value')).toBeInTheDocument();
    await expect(body.getByText('on-hand stock x unit cost')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        '`initialSection` lands the drawer on a tab other than the first - the path Restock and the ' +
        'stock alerts use. Pricing is the only section that renders an extra block below the ' +
        'accordion: two badge-blue derived figures and a bordered total with a floating legend ' +
        'label, none of which exists on the other five tabs.',
    },
  },
};
