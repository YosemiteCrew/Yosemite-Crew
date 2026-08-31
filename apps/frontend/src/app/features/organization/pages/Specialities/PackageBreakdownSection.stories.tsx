import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import PackageBreakdownSection from './PackageBreakdownSection';
import type { CatalogEntry } from './packageFormDraftHelpers';

const ITEMS: PackageBreakdownItem[] = [
  {
    id: 'item-1',
    type: 'CONSULTATION',
    name: 'Dental consultation',
    unitPrice: 72,
    quantity: 1,
    discount: 0,
    maxDiscount: 20,
  },
  {
    id: 'item-2',
    type: 'PROCEDURE',
    name: 'Scale and polish under GA',
    unitPrice: 310,
    quantity: 1,
    discount: 10,
    maxDiscount: 25,
  },
  {
    id: 'item-3',
    type: 'INVENTORY',
    name: 'Dental radiograph plate',
    unitPrice: 18,
    quantity: 4,
    discount: 0,
  },
];

const RESULTS: CatalogEntry[] = [
  {
    id: 'cat-lab',
    code: 'LB-0007',
    name: 'Pre-anaesthetic bloods',
    type: 'LAB',
    unitPrice: 124,
    defaultDiscount: 0,
    maxDiscount: 15,
    isBookable: false,
    isInpatientPreferred: false,
  },
  {
    id: 'cat-med',
    code: 'ME-0031',
    name: 'Meloxicam oral suspension',
    type: 'MEDICATION',
    unitPrice: 22,
    defaultDiscount: 5,
    maxDiscount: 20,
    isBookable: false,
    isInpatientPreferred: false,
  },
];

const meta = {
  title: 'Organization/PackageBreakdownSection',
  component: PackageBreakdownSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Breakdown card inside the package form: the catalogue search, the line table and ' +
          'the additional-discount field, plus two things that belong to no child - the ' +
          'empty-breakdown placeholder and the breakdown error line.\n\n' +
          'The search and the table each have their own stories; what only exists here is the ' +
          '**swap between the table and the placeholder**, and the conversion of ' +
          "`additionalDiscount` from the form's string state into the number the table " +
          'arithmetic needs. `Number.parseFloat(additionalDiscount) || 0` is the whole of that ' +
          'conversion, and it is the guard between a half-typed field and a total reading ' +
          '`$NaN` - a value that formats without throwing and reaches the screen intact.\n\n' +
          'The two error slots are not the same kind of thing, which is worth knowing before ' +
          'trusting either. `errors.additionalDiscount` goes through `FormInput`, so it gets ' +
          '`role="alert"`, `aria-invalid` and an `aria-describedby` tie to the field. ' +
          '`errors.breakdown` is a bare centred `<p>` with no role and no association - it is ' +
          'the error a screen reader is least likely to hear, and it is the one that blocks the ' +
          'save. Recorded here rather than endorsed.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    breakdown: ITEMS,
    additionalDiscount: '0',
    errors: {},
    filteredSearch: [],
    orgCurrency: 'USD',
    searchLoading: false,
    searchQuery: '',
    onAdditionalDiscountChange: fn(),
    onChangeDiscount: fn(),
    onChangeQty: fn(),
    onQueryChange: fn(),
    onRemoveItem: fn(),
    onSelectItem: fn(),
  },
} satisfies Meta<typeof PackageBreakdownSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Nothing added yet',
  args: { breakdown: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Search above to add items to the package breakdown.')
    ).toBeInTheDocument();
    /* The table is REMOVED, not emptied. An eight-column head with no rows under
       it reads as a broken fetch; the sentence reads as a form waiting for input. */
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
    /* The discount field survives the empty state, so a value typed before the
       first item is not silently discarded when the table appears. */
    await expect(canvas.getByLabelText('Discount %')).toHaveValue(0);
  },
};

export const WithItems: Story = {
  name: 'Three lines and an additional discount',
  args: { additionalDiscount: '7.5' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByText('Search above to add items to the package breakdown.')
    ).toBeNull();

    /* The section holds the discount as the STRING the field owns and hands the
       table a number. A `7.5` that arrived as `7` (parseInt) or as the string
       itself would both still render a footer row, so the row's own label is
       what pins the conversion. */
    await expect(canvas.getByText('Additional Discount (7.5%)')).toBeInTheDocument();
    await expect(canvas.getAllByRole('row')).toHaveLength(ITEMS.length + 3); // head + discount + total
  },
};

export const HalfTypedDiscount: Story = {
  name: 'A discount field mid-keystroke',
  args: { additionalDiscount: '.' },
  play: async ({ canvasElement }) => {
    /* `.` is what the field holds for one keystroke on the way to `.5`, and
       `Number.parseFloat('.')` is NaN. Without the `|| 0` the table multiplies
       every line by NaN and `formatMoney` renders "$NaN" - it neither throws nor
       blanks, so nothing but a check for the string itself catches it. */
    await expect(canvasElement.textContent).not.toContain('NaN');
    /* And no footer discount row at all, rather than one reading "(NaN%)". The
       pattern needs the digit: the field's own caption is the literal string
       "Additional Discount (%)" and sits in the same card. */
    await expect(within(canvasElement).queryByText(/^Additional Discount \(\d/)).toBeNull();
  },
};

export const SearchResults: Story = {
  name: 'Search results open',
  args: { searchQuery: 'pre', filteredSearch: RESULTS },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole('button', { name: /Pre-anaesthetic bloods/ });

    /* `LAB` is shown as "Diagnostics". The store, the payload and the table all
       say LAB, so a missing mapping surfaces as a raw enum in the one place a
       user is choosing from a list. */
    await expect(option).toHaveTextContent('Diagnostics · $124');

    await userEvent.click(option);
    // The whole catalogue entry goes up, not just its id: the caller needs the
    // price, the discount ceiling and the bookable flags to build the line.
    await expect(args.onSelectItem).toHaveBeenCalledWith(RESULTS[0]);
  },
};

export const Searching: Story = {
  name: 'Search in flight',
  args: { searchQuery: 'pre', filteredSearch: [], searchLoading: true },
  play: async ({ canvasElement }) => {
    /* Nothing matched YET. "No items found." while the request is still out is a
       lie that corrects itself a moment later, which is worse than no panel at
       all - `searchLoading` is the only thing holding it back. */
    await expect(within(canvasElement).queryByText('No items found.')).toBeNull();
  },
};

export const NoMatches: Story = {
  name: 'Search found nothing',
  args: { searchQuery: 'zzz', filteredSearch: [], searchLoading: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No items found.')).toBeInTheDocument();

    // The field is controlled from above, so a keystroke has to leave the section.
    await userEvent.type(canvas.getByLabelText('Search catalog items'), 'q');
    await expect(args.onQueryChange).toHaveBeenCalledWith('zzzq');
  },
};

export const Errors: Story = {
  name: 'Both error slots filled',
  args: {
    breakdown: [],
    additionalDiscount: '140',
    errors: {
      breakdown: 'Add at least one item to this package.',
      additionalDiscount: 'Additional discount must be 0–100.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The field error is announced and tied to the input it is about.
    const discount = canvas.getByLabelText('Discount %');
    await expect(discount).toHaveAttribute('aria-invalid', 'true');
    const alerts = canvas.getAllByRole('alert');
    await expect(alerts).toHaveLength(1);
    await expect(alerts[0]).toHaveTextContent('Additional discount must be 0–100.');
    await expect(discount.getAttribute('aria-describedby')).toBe(alerts[0].id);

    /* The breakdown error is on screen and nowhere in the accessibility tree:
       no role, no association, and it is the one that actually blocks the save.
       Asserted as-is so that giving it a role trips this line rather than
       passing unnoticed. */
    const breakdownError = canvas.getByText('Add at least one item to this package.');
    await expect(breakdownError.tagName).toBe('P');
    await expect(breakdownError).not.toHaveAttribute('role');
  },
};

export const Phone: Story = {
  name: 'Phone: the table scrolls, the card does not',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table');
    const scroller = table.parentElement as HTMLElement;

    /* Eight fixed-width columns total roughly 730px, so at 375 the only question
       is which box takes the overflow. It has to be the table's own wrapper; if
       that `overflow-x` ever goes back to `visible` the page takes it instead and
       every other card on the form scrolls sideways with it.

       Asserted as a property of the box rather than as a measurement, because the
       viewport global only resizes the iframe from the Storybook manager - a
       harness that loads `iframe.html` directly renders this story at the panel
       width and a width comparison would pass there for the wrong reason. */
    await expect(getComputedStyle(scroller).overflowX).toBe('auto');
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
