import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

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

const textbox = (name: string) => panel().getByRole('textbox', { name });

const clickButton = async (name: string) => {
  await userEvent.click(panel().getByRole('button', { name }));
};

/**
 * The right-hand chip of a read-only Stock Control field, read off the label's
 * sibling. Stock's derived numbers are not inputs - they are `placeholder :` text
 * followed by a pill - so they need a different query from every other field here.
 */
const readonlyChip = (label: string): string =>
  panel().getByText(`${label} :`).nextElementSibling?.textContent ?? '';

/** Basic Details is the only gate between section 1 and section 2. */
const completeBasicDetails = async () => {
  await userEvent.type(textbox('Item name'), 'Meloxicam 1.5 mg/ml');
  await chooseOption('Category', 'Medicine');
};

/**
 * Clinical Details validates four fields for a HOSPITAL item that is not marked
 * `Non-drug`, and the drug path is taken on purpose. Choosing `Non-drug` would clear
 * the step in a single click, but it also HIDES drug-only fields in three later
 * sections (`tracking` in Batch, `withdrawlPeriod` in Stock), so every section below
 * would be drawn a field short of what a medicine actually shows.
 */
const completeClinicalDetailsAsDrug = async () => {
  await userEvent.type(textbox('Generic name'), 'Meloxicam');
  await chooseOption('Item type', 'Drug');
  await userEvent.type(textbox('Strength'), '1.5');
  await chooseOption('Form', 'Injection');
  await chooseOption('Administration route', 'Injectable');
};

/* The walks below go through the real Next button rather than seeding state, because
   the gates ARE the subject: a section reached any other way would be a section no
   user can reach. */
const goToBatch = async () => {
  await completeBasicDetails();
  await clickButton('Next');
  await completeClinicalDetailsAsDrug();
  await clickButton('Next');
};

const goToStock = async () => {
  await goToBatch();
  await userEvent.type(textbox('Batch quantity'), '12');
  await clickButton('Next');
};

const goToPricing = async () => {
  await goToStock();
  await userEvent.type(textbox('Reorder point'), '5');
  await clickButton('Next');
};

const goToVendor = async () => {
  await goToPricing();
  await userEvent.type(textbox('Unit cost'), '10');
  await userEvent.type(textbox('Selling price'), '25');
  await clickButton('Next');
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
          'section carries a status glyph afterwards - a check for `valid`, an alert triangle ' +
          'for `error`. The two states are deliberately different **shapes**, not just different ' +
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
    // Four text fields for a hospital item, against the groomer story's two.
    await expect(drawer.getAllByRole('textbox')).toHaveLength(4);

    /* The single two-up row in this section, and the pair that shares it. */
    const categoryRow = drawer
      .getByRole('button', { name: 'Category' })
      .closest('.grid') as HTMLElement;
    await expect(
      getComputedStyle(categoryRow).gridTemplateColumns.trim().split(/\s+/)
    ).toHaveLength(2);
    await expect(categoryRow.children).toHaveLength(2);
    await expect(
      within(categoryRow).getByRole('button', { name: 'Sub category' })
    ).toBeInTheDocument();

    /* The footer pair. This is the `grid grid-cols-1 sm:grid-cols-2` nesting the
       component docs call out: it shipped this branch with a template that resolved
       to one track, which stacks Clear over Next full-width and still renders both
       buttons - so a "the Next button is there" check passes on the broken layout.
       Both the track count and the child count are asserted. */
    const next = drawer.getByRole('button', { name: 'Next' });
    const footer = next.closest('.grid') as HTMLElement;
    /* Polled, not read once: the template resolves after the stylesheet applies, and a
       synchronous read on the first frame sees `none` and fails intermittently. */
    await waitFor(() => {
      expect(getComputedStyle(footer).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
      expect(footer.children).toHaveLength(2);
    });
    await expect(within(footer).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as it opens. Basic Details is the only section any previous render could ' +
          'reach, and it is the only one with a `headerSlot` - the Visible in Inventory switch, ' +
          'which sits above the fields rather than inside the grid.\n\n' +
          'The Clear/Next footer is measured here rather than merely found. It is the ' +
          '`grid grid-cols-1 sm:grid-cols-2` that shipped broken on this branch, and a ' +
          'collapsed template stacks the two buttons full-width without removing either of ' +
          'them, so nothing short of reading the computed track list catches it.',
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
          'The refusal path. Two inline errors appear at once - one under a text input, one ' +
          'under a select - and the Basic Details pill grows an alert triangle. Both messages ' +
          'add a row beneath their control, so the whole form below them shifts down; nothing ' +
          'in a clean render shows that.',
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

    /* Item type shares a row with Drug schedule, and the row is the two-up grid the
       design specifies. Track count and child count both, since a template that
       collapsed to one track would still render both dropdowns, just stacked. */
    const typeRow = drawer
      .getByRole('button', { name: 'Item type' })
      .closest('.grid') as HTMLElement;
    /* Polled, not read once: the template resolves after the stylesheet applies, and a
       synchronous read on the first frame sees `none` and fails intermittently. */
    await waitFor(() => {
      expect(getComputedStyle(typeRow).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
      expect(typeRow.children).toHaveLength(2);
    });
    await expect(
      within(typeRow).getByRole('button', { name: 'Drug schedule' })
    ).toBeInTheDocument();

    // Exactly one section is stamped: the one that was validated on the way out.
    await waitFor(() =>
      expect(drawer.getAllByRole('img', { name: 'Section complete' })).toHaveLength(1)
    );
    await expect(drawer.queryByRole('img', { name: 'Section has errors' })).not.toBeInTheDocument();

    // Mid-form, so the CTA is still Next rather than the terminal Save.
    await expect(drawer.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    await expect(drawer.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
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

    /* The whole field list, counted. The hospital section is 4 text fields (Item
       name, Brand, SKU, Description) beside 2 dropdowns; the groomer section
       inverts that into 2 text fields and 8 dropdowns, which is why the two are
       different heights rather than the same form with a couple of labels swapped.
       A per-field existence check would pass on either. */
    await expect(drawer.getAllByRole('textbox')).toHaveLength(2);
    await expect(drawer.queryByRole('textbox', { name: 'SKU (optional)' })).not.toBeInTheDocument();
    await expect(
      drawer.queryByRole('textbox', { name: 'Brand (optional)' })
    ).not.toBeInTheDocument();
    for (const name of [
      'Category',
      'Sub category',
      'Department',
      'Product use',
      'Coat type',
      'Fragrance type',
      'Allergen free',
      'Companion size',
    ]) {
      await expect(drawer.getByRole('button', { name })).toBeInTheDocument();
    }

    /* Three two-up rows here against the hospital section's one, and a `grid-cols-2`
       that resolved to a single track would stack all six of those dropdowns
       vertically while every query above still passed. Both the track count and the
       child count are asserted, because either alone can be right while the row is
       wrong. */
    const coatRow = drawer
      .getByRole('button', { name: 'Coat type' })
      .closest('.grid') as HTMLElement;
    /* Polled, not read once: the template resolves after the stylesheet applies, and a
       synchronous read on the first frame sees `none` and fails intermittently. */
    await waitFor(() => {
      expect(getComputedStyle(coatRow).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
      expect(coatRow.children).toHaveLength(2);
    });
    // The pairing itself, not just that two things share a row.
    await expect(within(coatRow).getByRole('button', { name: 'Product use' })).toBeInTheDocument();

    // The header switch is business-type-agnostic: it is on the section, not the config.
    await expect(drawer.getByRole('switch', { name: 'Visible in Inventory' })).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same drawer for a grooming business. Basic Details gains Coat type, Fragrance ' +
          'type, Allergen free, Product use, Department and Companion size, and loses Brand and ' +
          'the hospital SKU - so a section that was four text inputs and one two-up row becomes ' +
          'two text inputs and three two-up rows, and the section is taller. Worth a snapshot ' +
          'beside the hospital story, since only one of them can be checked by looking at the ' +
          'default.',
      },
    },
  },
};

export const BatchAndExpiry: Story = {
  name: 'Third section (Batch and expiry)',
  play: async () => {
    const drawer = panel();
    await goToBatch();

    await expect(drawer.getByRole('tab', { name: 'Batch and expiry' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // The section body is an Accordion, open by default; its toggle carries the title.
    await expect(drawer.getByRole('button', { name: 'Batch and expiry' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    /* One card, and it is already numbered: this section is a repeater even when
       there is a single batch, which is why the card is bordered and titled while
       every other section is a bare field stack. */
    await expect(drawer.getAllByText(/^Batch \d+$/)).toHaveLength(1);
    await expect(drawer.getByText('Batch 1')).toBeInTheDocument();
    await expect(drawer.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    // Its own five fields. `Regulatory tracking ID` is drug-only and is here because
    // the walk marked the item a Drug; a Non-drug item renders four.
    await expect(drawer.getByRole('textbox', { name: 'Batch/ Lot number' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Batch quantity' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Barcode' })).toBeInTheDocument();
    await expect(
      drawer.getByRole('textbox', { name: 'Regulatory tracking ID' })
    ).toBeInTheDocument();
    await expect(
      drawer.getByRole('button', { name: 'Expiring warning before' })
    ).toBeInTheDocument();
    // Dates are buttons that open a calendar, not text inputs.
    await expect(
      drawer.getByRole('button', { name: 'Manufacturing date, toggle calendar' })
    ).toBeInTheDocument();
    await expect(
      drawer.getByRole('button', { name: 'Expiry date, toggle calendar' })
    ).toBeInTheDocument();

    /* The two-up rows. Nothing enforces that a `grid-cols-2` and its children agree,
       and a template that resolved to one track would stack the pair vertically -
       still rendering, still passing any "the field is there" check, and looking
       nothing like the design. */
    const firstRow = drawer
      .getByRole('textbox', { name: 'Batch/ Lot number' })
      .closest('.grid') as HTMLElement;
    /* Polled, not read once: the template resolves after the stylesheet applies, and a
       synchronous read on the first frame sees `none` and fails intermittently. */
    await waitFor(() => {
      expect(getComputedStyle(firstRow).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
      expect(firstRow.children).toHaveLength(2);
    });

    // Mid-form: still Next, with the two sections behind it stamped complete.
    await expect(drawer.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    await waitFor(() =>
      expect(drawer.getAllByRole('img', { name: 'Section complete' })).toHaveLength(2)
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Section three, reached the way a user reaches it: Basic Details satisfied, then ' +
          'Clinical Details satisfied as a medicine. Both gates matter to what is on screen ' +
          'here - marking the item `Non-drug` back on section two removes the Regulatory ' +
          'tracking ID field from this card entirely, so the same section has two shapes.',
      },
    },
  },
};

export const BatchRepeater: Story = {
  name: 'Adding and removing a batch',
  play: async () => {
    const drawer = panel();
    await goToBatch();

    await userEvent.type(drawer.getByRole('textbox', { name: 'Batch quantity' }), '12');
    await clickButton('Add another batch');

    // A second card with its own copy of every field, and a Remove on BOTH - that
    // control does not exist while there is only one batch.
    await waitFor(() => expect(drawer.getAllByText(/^Batch \d+$/)).toHaveLength(2));
    await expect(drawer.getByText('Batch 2')).toBeInTheDocument();
    await expect(drawer.getAllByRole('textbox', { name: 'Barcode' })).toHaveLength(2);
    await expect(drawer.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);

    const quantities = drawer.getAllByRole('textbox', { name: 'Batch quantity' });
    await expect(quantities[0]).toHaveValue('12');
    await expect(quantities[1]).toHaveValue('');
    await userEvent.type(quantities[1], '8');

    /* The repeater is not a display list: every batch edit recomputes the Stock
       Control totals through `calculateBatchTotals`, so on-hand is the SUM of the
       cards and is not editable anywhere. Asserting it from the next section is the
       only way to see that wiring at all. */
    await clickButton('Next');
    await expect(readonlyChip('On hand stock')).toBe('20');
    await expect(readonlyChip('Available stock (dispensable)')).toBe('20');

    /* Backwards through the strip is ungated - `goToStep` only validates on a forward
       move - so the batches can be edited again without satisfying Stock Control.
       Matched loosely: leaving the section stamped it complete, so its pill now
       announces "Batch and expiry Section complete" rather than its bare name. */
    await userEvent.click(drawer.getByRole('tab', { name: /^Batch and expiry/ }));
    await waitFor(() => expect(drawer.getAllByText(/^Batch \d+$/)).toHaveLength(2));

    /* Removing the SECOND card must leave the FIRST card's value behind. Removal is
       by index, and an off-by-one would keep the wrong batch while the count still
       looked right - which is exactly the kind of bug a count-only assertion misses. */
    await userEvent.click(drawer.getAllByRole('button', { name: 'Remove' })[1]);
    await waitFor(() => expect(drawer.getAllByText(/^Batch \d+$/)).toHaveLength(1));
    await expect(drawer.getByRole('textbox', { name: 'Batch quantity' })).toHaveValue('12');
    await expect(drawer.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `onAddBatch` repeater. A product arrives in lots with different expiry dates, ' +
          'so Batch and expiry is the one section that repeats - a full-width "Add another ' +
          'batch" secondary button under a stack of bordered cards.\n\n' +
          'Two things are worth watching here. The card title is derived from the array index ' +
          'rather than from any identity, so removing a middle batch renumbers everything ' +
          'below it. And on-hand stock is a computed sum of the cards, which means the number ' +
          'a reader sees in Stock Control can only be changed from this section.',
      },
    },
  },
};

export const StockControl: Story = {
  name: 'Fourth section (Stock Control)',
  play: async () => {
    const drawer = panel();
    await goToStock();

    await expect(drawer.getByRole('tab', { name: 'Stock Control' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Editable fields.
    await expect(
      drawer.getByRole('textbox', { name: 'Allocated stock (optional)' })
    ).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Max stock' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Reorder point' })).toBeInTheDocument();
    await expect(
      drawer.getByRole('textbox', { name: 'Reorder quantity (optional)' })
    ).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'ABC Class' })).toBeInTheDocument();
    // Drug-only, and hospital-only respectively.
    await expect(
      drawer.getByRole('button', { name: 'Withdrawal period (optional)' })
    ).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Stock unit type' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Unit qnt' })).toBeInTheDocument();

    /* The two derived fields, carried in from the single batch quantity typed on the
       way here. They are pills, not inputs - there is no way to type an on-hand
       figure into this section, which is the design decision this story records. */
    await expect(readonlyChip('On hand stock')).toBe('12');
    await expect(readonlyChip('Available stock (dispensable)')).toBe('12');
    await expect(drawer.queryByRole('textbox', { name: 'On hand stock' })).not.toBeInTheDocument();

    /* `stockLocationOptions` replaces the built-in nine-entry list entirely when the
       caller passes one, which is how the drawer picks up a clinic's real rooms. The
       override is asserted by using it, so a silently-ignored prop fails here. */
    /* The dropdown is opened and its option list asserted, because that is what the
       `stockLocationOptions` override is for: three entries, not the built-in nine.

       What is NOT asserted here is the trigger's label after choosing. The trigger
       carries the value in both its `aria-label` ("Stock location: <value>") and its
       text, but neither could be shown to update from inside this harness - the query
       finds no updated name after the click, and repeated probing did not establish
       whether the drawer re-parents the trigger or the selection simply does not reach
       it. Asserting a value I could not verify would be worse than admitting the gap,
       so the story stops at the option list and this comment records what is missing.
       Worth returning to: if the selection genuinely does not stick, that is a defect. */
    await userEvent.click(drawer.getByRole('button', { name: 'Stock location' }));
    /* Waited for, not read once. The panel is portalled, so it appears a frame after the
       click - a synchronous read gets `null` and `within(null)` throws a confusing
       "expected container to be an Element" instead of a useful failure. */
    await waitFor(() => expect(document.querySelector('[data-portal-dropdown]')).not.toBeNull());
    const listbox = document.querySelector('[data-portal-dropdown]') as HTMLElement;
    await expect(within(listbox).getAllByRole('button')).toHaveLength(3);
    await expect(
      within(listbox).getByRole('button', { name: 'Main pharmacy' })
    ).toBeInTheDocument();
    await expect(within(listbox).getByRole('button', { name: 'Theatre' })).toBeInTheDocument();

    // Choosing an option at least dismisses the portal, which is observable.
    await userEvent.click(within(listbox).getByRole('button', { name: 'Theatre' }));
    await waitFor(() => expect(document.querySelector('[data-portal-dropdown]')).toBeNull());
  },
  parameters: {
    docs: {
      description: {
        story:
          'Section four. It is the only section that mixes editable fields with read-only ' +
          'derived ones, and the derived pair sits at the bottom in a two-up row so the ' +
          'numbers read together.\n\n' +
          'Reorder point is the single required field here, which is easy to miss on a screen ' +
          'of nine controls - and it is the one that stops a Save from the last tab.',
      },
    },
  },
};

export const Pricing: Story = {
  name: 'Fifth section (Pricing)',
  play: async () => {
    const drawer = panel();
    await goToPricing();

    await expect(drawer.getByRole('tab', { name: 'Pricing' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(drawer.getByRole('textbox', { name: 'Unit cost' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Selling price' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Max. discount %' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Tax (%)' })).toBeInTheDocument();

    await userEvent.type(drawer.getByRole('textbox', { name: 'Unit cost' }), '10');
    await userEvent.type(drawer.getByRole('textbox', { name: 'Selling price' }), '25');

    /* The summary block under the fields is the point of this section, and every
       number in it is derived: profit from the two prices, margin from profit over
       selling, and stock value from the batch quantity carried in from section three
       times the unit cost. Asserting the values rather than the labels is what makes
       this a check on the arithmetic and the currency formatting, not on the layout. */
    await waitFor(() =>
      expect(drawer.getByText('Gross profit per unit :').nextElementSibling).toHaveTextContent(
        '$15'
      )
    );
    await expect(drawer.getByText('Margin :').nextElementSibling).toHaveTextContent('60%');
    await expect(drawer.getByText('Total stock value')).toBeInTheDocument();
    await expect(drawer.getByText('on-hand stock x unit cost')).toBeInTheDocument();
    // 12 on hand at a unit cost of 10.
    await expect(drawer.getByText('$120')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Section five, with its summary block filled. Profit and margin are badge pills ' +
          'inline in a sentence; total stock value is a bordered box with a floating caption, ' +
          'so the three read as one derived group under four inputs.\n\n' +
          'They are formatted with `Intl.NumberFormat` and an item currency that the payload ' +
          'deliberately never sends - the server derives it from the org billing settings - so ' +
          'the drawer always shows USD regardless of where the clinic is. Worth deciding ' +
          'whether that is acceptable before this goes in front of a non-US clinic.',
      },
    },
  },
};

export const VendorAndSave: Story = {
  name: 'Sixth section: the CTA becomes Save',
  // A promise that never settles, so the in-flight state is a resting state here
  // rather than a frame to be raced for.
  args: { onSubmit: fn(() => new Promise<void>(() => {})) },
  play: async ({ args }) => {
    const drawer = panel();
    await goToVendor();

    await expect(drawer.getByRole('tab', { name: 'Vendor details' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(drawer.getByRole('button', { name: 'Vendor type' })).toBeInTheDocument();
    await expect(drawer.getByRole('textbox', { name: 'Vendor name' })).toBeInTheDocument();
    // Hospital-only: the other business types drop the licence field.
    await expect(drawer.getByRole('textbox', { name: 'License number' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Payment terms' })).toBeInTheDocument();

    // The terminal CTA. Same button, same place, different word - the only signal
    // that this section commits the whole form rather than advancing.
    await expect(drawer.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await expect(drawer.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    // Five checks behind it: every section that was left through Next was validated
    // on the way out. Vendor details has no glyph, because nothing has validated it.
    await waitFor(() =>
      expect(drawer.getAllByRole('img', { name: 'Section complete' })).toHaveLength(5)
    );

    await userEvent.click(drawer.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(drawer.getByRole('button', { name: 'Saving...' })).toBeInTheDocument()
    );
    await expect(drawer.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    // Clear is disabled with it, so a half-submitted form cannot be reset underneath
    // the request.
    await expect(drawer.getByRole('button', { name: 'Clear' })).toBeDisabled();

    /* One payload carrying all six sections. This is the assertion the drawer exists
       for: the derived on-hand from Batch, the required Reorder point from Stock and
       the two prices all arrive together, in the shapes the API expects (strings). */
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        basicInfo: expect.objectContaining({
          name: 'Meloxicam 1.5 mg/ml',
          category: 'Medicine',
        }),
        classification: expect.objectContaining({ genericName: 'Meloxicam', itemType: 'Drug' }),
        stock: expect.objectContaining({ current: '12', reorderLevel: '5' }),
        pricing: expect.objectContaining({ purchaseCost: '10', selling: '25' }),
      })
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The end of the walk, and the only place the drawer can be committed. `Saving...` ' +
          'is held open here by an `onSubmit` that never resolves, so the disabled pair is a ' +
          'state to look at rather than a frame between two renders.\n\n' +
          'The label is the only thing that changes: same position, same size, same colour as ' +
          'Next. Someone tabbing quickly through six sections gets no other warning that this ' +
          'press is the one that writes.',
      },
    },
  },
};

export const SaveBouncesBack: Story = {
  name: 'Save with skipped sections bounces back',
  play: async ({ args }) => {
    const drawer = panel();
    await completeBasicDetails();

    /* The strip is not a guard. `goToStep` validates only the section being LEFT, so
       one click from a valid Basic Details jumps five sections forward and none of
       the four in between is ever seen, let alone filled. */
    await userEvent.click(drawer.getByRole('tab', { name: 'Vendor details' }));
    await waitFor(() =>
      expect(drawer.getByRole('tab', { name: 'Vendor details' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(drawer.getByRole('textbox', { name: 'Vendor name' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    await userEvent.click(drawer.getByRole('button', { name: 'Save' }));

    /* `validateAll` walks the sections in order and stops at the first failure, then
       moves the drawer there - so the reader is thrown back four sections to a form
       they have never seen, with all four medicine fields flagged at once. */
    await waitFor(() =>
      expect(drawer.getByRole('tab', { name: /^Clinical Details/ })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(drawer.getByText('Generic name is required')).toBeInTheDocument();
    await expect(drawer.getByText('Strength is required')).toBeInTheDocument();
    await expect(drawer.getByText('Form is required')).toBeInTheDocument();
    await expect(drawer.getByText('Administration route is required')).toBeInTheDocument();
    await expect(drawer.getByRole('img', { name: 'Section has errors' })).toBeInTheDocument();

    // Nothing was submitted, and the CTA is a mid-form Next again.
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(drawer.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    await expect(drawer.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure mode the tab strip makes reachable. Because a forward jump only ' +
          'validates the section being left, Save can be pressed with four sections never ' +
          'opened - and the drawer answers by teleporting backwards with no message ' +
          'explaining the move.\n\n' +
          'Stock Control is silently in the same state (Reorder point is required and empty); ' +
          'it just never gets to report it, because validation stops at the first failure. ' +
          'Whoever picks this up should decide between validating on every forward jump and ' +
          'flagging all the failed sections in the strip at once, rather than one at a time.',
      },
    },
  },
};
