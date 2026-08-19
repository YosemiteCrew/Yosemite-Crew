import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import AddInventory from './index';

/** The drawer portals to `document.body`, so nothing here is inside `canvasElement`. */
const panel = () => within(document.body);

/** Opens the portalled option list of a `LabelDropdown` and picks one option. */
const chooseOption = async (triggerName: string, optionName: string) => {
  await userEvent.click(panel().getByRole('button', { name: triggerName }));
  const listbox = document.querySelector('[data-portal-dropdown]');
  await expect(listbox).toBeInTheDocument();
  await userEvent.click(within(listbox as HTMLElement).getByRole('button', { name: optionName }));
};

const meta = {
  title: 'Inventory/AddInventory',
  component: AddInventory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The add-product drawer: six sections - Basic Details, Clinical Details, Batch and ' +
          'expiry, Stock Control, Pricing, Vendor details - behind one tab strip, driven by a ' +
          'single `activeLabel` in local state.\n\n' +
          'Two layers were invisible. The whole panel is a `Modal` portalled to `document.body` ' +
          'and gated on `showModal`, and **five of the six section forms are gated on internal ' +
          'state with no prop behind them at all**: the only section a rendered `AddInventory` ' +
          'has ever shown is Basic Details. Everything else - and every field layout inside it - ' +
          'lived behind a click that no story made.\n\n' +
          'The tab strip is not free navigation. `goToStep` validates the section you are ' +
          'leaving before any forward move, so a tab click can be refused; and the pill for a ' +
          'section carries a status glyph afterwards - a check for `valid`, an alert triangle for ' +
          '`error`. The two states are deliberately different **shapes**, not just different ' +
          'hues, because `--success` and `--danger` differ by 0.0005 in relative luminance and ' +
          'were indistinguishable in greyscale. That pair of glyphs cannot appear until a ' +
          'validation has actually run, so it had never been drawn either.\n\n' +
          'The section body itself is a `grid grid-cols-2` of fields inside a `flex flex-col` ' +
          'accordion, over a footer whose Clear/Next pair is its own `grid grid-cols-1 ' +
          'sm:grid-cols-2` - exactly the nesting where an invalid grid template collapses ' +
          'silently, as one shipped this branch. The forms are business-type-driven: HOSPITAL ' +
          'and GROOMER share the shell but not one field list, so the same drawer has to hold ' +
          'both.\n\n' +
          'The stories below open sections through the real controls and assert the fields that ' +
          'section owns, rather than asserting that a tab flipped - which would pass on an empty ' +
          'panel.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    businessType: 'HOSPITAL',
    onSubmit: fn(async () => {}),
    stockLocationOptions: ['Main pharmacy', 'Ward store', 'Theatre'],
  },
} satisfies Meta<typeof AddInventory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BasicDetails: Story = {
  name: 'Open on Basic Details',
  play: async () => {
    const drawer = panel();
    await expect(drawer.getByRole('heading', { name: 'Add product' })).toBeInTheDocument();
    // The strip carries all six sections even though only one is mounted.
    await expect(drawer.getAllByRole('tab')).toHaveLength(6);
    await expect(drawer.getByRole('tab', { name: 'Basic Details' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // Assert the section's own fields, not merely that a section rendered.
    await expect(drawer.getByRole('textbox', { name: 'Item name' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Category' })).toBeInTheDocument();
    await expect(drawer.getByRole('switch', { name: 'Visible in Inventory' })).toBeChecked();
    await expect(drawer.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as it opens. Basic Details is the only section any previous render could ' +
          'reach, and it is the only one with a `headerSlot` - the Visible in Inventory switch, ' +
          'which sits above the fields rather than inside the grid.',
      },
    },
  },
};

export const ValidationBlocksTheStep: Story = {
  name: 'Next with an empty form (error state)',
  play: async () => {
    const drawer = panel();
    await userEvent.click(drawer.getByRole('button', { name: 'Next' }));
    // Both required-field messages, and the pill glyph that reports the section.
    await expect(drawer.getByText('Item name cannot be empty')).toBeInTheDocument();
    await expect(drawer.getByText('Select Category')).toBeInTheDocument();
    await expect(drawer.getByRole('img', { name: 'Section has errors' })).toBeInTheDocument();
    // The step did not advance. The name is matched loosely on purpose: the status
    // glyph is inside the pill, so a section with a status is announced as
    // "Basic Details Section has errors", not "Basic Details".
    await expect(drawer.getByRole('tab', { name: /^Basic Details/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The refusal path. Two inline errors appear at once - one under a text input, one under ' +
          'a select - and the Basic Details pill grows an alert triangle. Both messages add a ' +
          'row beneath their control, so the whole form below them shifts down; nothing in a ' +
          'clean render shows that.',
      },
    },
  },
};

export const ClinicalDetails: Story = {
  name: 'Second section (Clinical Details)',
  play: async () => {
    const drawer = panel();
    await userEvent.type(drawer.getByRole('textbox', { name: 'Item name' }), 'Meloxicam 1.5 mg/ml');
    await chooseOption('Category', 'Medicine');
    await userEvent.click(drawer.getByRole('button', { name: 'Next' }));

    // The section actually swapped: its own fields are mounted and the previous
    // section's are gone.
    await expect(drawer.getByRole('tab', { name: 'Clinical Details' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(drawer.getByRole('textbox', { name: 'Generic name' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Item type' })).toBeInTheDocument();
    await expect(drawer.queryByRole('textbox', { name: 'Item name' })).not.toBeInTheDocument();
    // The section left behind is now stamped complete.
    await expect(drawer.getByRole('img', { name: 'Section complete' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two sections deep, which is as far as anything could previously see: nothing at all. ' +
          'Reaching it requires satisfying Basic Details first, so this story also draws the ' +
          'check-mark glyph on the tab behind it - the shape half of the shape-not-hue status ' +
          'pair.',
      },
    },
  },
};

export const GroomerFields: Story = {
  name: 'Groomer business type',
  args: { businessType: 'GROOMER' },
  play: async () => {
    const drawer = panel();
    // Same shell, a different field list - the config is keyed by business type.
    await expect(drawer.getByRole('textbox', { name: 'Item name' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Coat type' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Fragrance type' })).toBeInTheDocument();
    await expect(drawer.queryByRole('textbox', { name: 'SKU (optional)' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same drawer for a grooming business. Basic Details gains Coat type, Fragrance type ' +
          'and Product use, and loses the hospital SKU field - so the two-column grid packs ' +
          'differently and the section is taller. Worth a snapshot beside the hospital story, ' +
          'since only one of them can be checked by looking at the default.',
      },
    },
  },
};
