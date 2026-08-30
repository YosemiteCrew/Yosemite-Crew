import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { InvoiceItem } from '@yosemite-crew/types';

import InvoiceBilledItems from './InvoiceBilledItems';

/**
 * `formatMoney` runs at `maximumFractionDigits: 0`, so every figure below is a
 * whole number on purpose - a 44.50 line would print as "$45" and make the
 * assertions read as though the arithmetic were wrong.
 */
const ITEMS: InvoiceItem[] = [
  { id: 'line-1', name: 'Dental consultation', quantity: 1, unitPrice: 60, total: 60 },
  { id: 'line-2', name: 'Scale and polish', quantity: 2, unitPrice: 45, total: 90 },
  { id: 'line-3', name: 'Post-op analgesia', quantity: 3, unitPrice: 8, total: 24 },
];

/**
 * The type says `unitPrice` and `total` are required, but the component defends
 * against both being missing (`?? 0`), which is only reachable from a record
 * that never had them - a line imported from an older invoice, or one built by
 * hand in the bill builder before the totals were computed. Cast rather than
 * typed, because writing it as a valid `InvoiceItem` would not exercise the
 * branch at all.
 */
const PRICELESS_LINE = {
  id: 'line-unpriced',
  name: 'Nail clip',
  quantity: 2,
} as unknown as InvoiceItem;

const LONG_NAME =
  'Bilateral cranial cruciate ligament repair with tibial plateau levelling osteotomy';

/** Resolved grid tracks, rounded to whole pixels so subpixel noise cannot fail a match. */
const tracks = (el: HTMLElement): number[] =>
  getComputedStyle(el)
    .gridTemplateColumns.trim()
    .split(/\s+/)
    .map((track) => Math.round(Number.parseFloat(track)));

/** The header band, which carries its four-track template as its own inline style. */
const headBand = (region: HTMLElement): HTMLElement => {
  const head = region.querySelector('.yc-table-head');
  if (!head) throw new Error('The column-header band did not render.');
  return head as HTMLElement;
};

/** Every line row, header band excluded - both match `.grid`. */
const rowsOf = (region: HTMLElement): HTMLElement[] =>
  [...region.querySelectorAll('.grid')].filter(
    (el) => !el.classList.contains('yc-table-head')
  ) as HTMLElement[];

const meta = {
  title: 'Finance/InvoiceBilledItems',
  component: InvoiceBilledItems,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The line-item table inside the invoice drawer. It is a CSS grid pretending to be a ' +
          'table: `TableHead` and every row carry the SAME four-track template ' +
          '(`minmax(0,1.9fr) 50px 90px 90px`) as separate inline styles, with nothing at runtime ' +
          'enforcing that they agree. A drifted header does not break - it just stops sitting ' +
          'above its own column, so every story here compares the resolved tracks rather than ' +
          'trusting the shared constant.\n\n' +
          'Two things about it are quietly defensive. An empty `items` array renders prose in an ' +
          '`<output>` live region rather than an empty band, because a billing document with no ' +
          'rows has to say so. And each figure falls back to `formatMoney(0)` rather than to a ' +
          'dash, because a dash in a money column reads as "not applicable" when what actually ' +
          'happened is that no price was recorded.\n\n' +
          'Desktop only: below 768px `InvoiceInfo` swaps the whole record for ' +
          '`InvoicePhoneRecord`, which draws its own lines and never mounts this.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    items: ITEMS,
    currency: 'USD',
  },
  decorators: [
    // The drawer gives this column roughly 420px at the 840px modal width. Left
    // at full panel width the flexible track never runs out of room and the
    // truncation story would silently stop truncating.
    (Story) => (
      <div style={{ maxWidth: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceBilledItems>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three billed lines',
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed items' });
    const head = headBand(region);
    const rows = rowsOf(region);

    await expect(rows).toHaveLength(3);
    await expect(head.children).toHaveLength(4);
    await expect(tracks(head)).toHaveLength(4);

    /* The header and the rows resolve their own copies of the same template.
       Comparing the RESOLVED pixel tracks is the only check that catches one of
       the two being edited alone, which is invisible in review because both
       still read "four columns". */
    for (const row of rows) {
      await expect(row.children).toHaveLength(4);
      await expect(tracks(row)).toEqual(tracks(head));
    }

    /* Alignment is per-column and set twice - `align: 'right'` on the two money
       headings, `text-right` on the two money cells. Asserting each cell aligns
       the way its own heading does catches the half that gets forgotten: a
       right-aligned "Amount" heading over left-aligned figures still renders,
       it just stops being a money column. */
    for (const row of rows) {
      for (let column = 0; column < 4; column += 1) {
        await expect(getComputedStyle(row.children[column] as HTMLElement).textAlign).toBe(
          getComputedStyle(head.children[column] as HTMLElement).textAlign
        );
      }
    }

    /* Cells in the header's order: name, qty, gross, amount. Read positionally
       rather than by searching for the figure, because "$90" appears twice on
       this invoice and a text query would pass with the columns swapped. */
    await expect(rows[1].children[0]).toHaveTextContent('Scale and polish');
    await expect(rows[1].children[1]).toHaveTextContent('2');
    await expect(rows[1].children[2]).toHaveTextContent('$45');
    await expect(rows[1].children[3]).toHaveTextContent('$90');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The ordinary case, and the layout reference for the rest: gross is the unit price and ' +
          'amount is the line total, so a quantity of 2 makes the last two columns differ. That ' +
          'difference is the only visible proof the two columns are not printing the same field.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'Nothing billed on this invoice',
  args: { items: [] },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed items' });

    /* An `<output>`, so it lands as a `status` live region rather than as a
       silent paragraph. Queried by ROLE: the wording is what a reader sees, but
       the role is what an assistive reader gets told, and swapping the element
       for a `<p>` would leave the story passing on the text alone. */
    const notice = within(region).getByRole('status');
    await expect(notice).toHaveTextContent('No billed items recorded for this invoice.');

    /* The header band survives the empty state with its full template, so the
       card keeps its column structure instead of collapsing to a bare sentence
       - and there are no rows at all, which is what separates "no items" from
       "one row of blanks". */
    await expect(rowsOf(region)).toHaveLength(0);
    await expect(headBand(region).children).toHaveLength(4);
    await expect(tracks(headBand(region))).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An invoice raised with no lines on it - a deposit taken before the visit, or a record ' +
          'someone opened and never filled. Prose rather than a dash, because a dash in a billing ' +
          'document reads as a zero that was deliberately entered.',
      },
    },
  },
};

export const MissingAmounts: Story = {
  name: 'A line with no price recorded',
  args: { items: [PRICELESS_LINE], currency: 'GBP' },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed items' });
    const [row] = rowsOf(region);

    await expect(row.children[0]).toHaveTextContent('Nail clip');
    // The quantity is real, so the row is not empty - only its money is missing.
    await expect(row.children[1]).toHaveTextContent('2');

    /* Both money cells fall back through `?? 0` into `formatMoney`, which means
       a FORMATTED zero rather than a blank cell or the literal "0". Read as
       exact text: `toHaveTextContent('0')` would also pass on "£10". */
    await expect(row.children[2].textContent).toBe('£0');
    await expect(row.children[3].textContent).toBe('£0');

    /* And it is the invoice's currency, not a hardcoded dollar. This component
       is the one place in the drawer that formats a per-line figure, so a
       hardcoded symbol here would print a GBP invoice in dollars line by line
       while the summary below it stayed correct. */
    await expect(region.textContent).not.toContain('$');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A line that reached the drawer without `unitPrice` or `total`. Priced in GBP to prove ' +
          'the symbol comes from the invoice rather than from the formatter default, which is the ' +
          'failure a US-only fixture set can never surface.',
      },
    },
  },
};

export const LongItemName: Story = {
  name: 'A name too long for its column',
  args: {
    items: [{ id: 'line-tplo', name: LONG_NAME, quantity: 1, unitPrice: 2400, total: 2400 }],
  },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Billed items' });
    const head = headBand(region);
    const [row] = rowsOf(region);
    const nameCell = row.children[0] as HTMLElement;

    // Clipped, not wrapped: the row stays one line high beside its money.
    await expect(nameCell.scrollWidth).toBeGreaterThan(nameCell.clientWidth);
    // The full name survives as the tooltip, so nothing is actually lost.
    await expect(nameCell).toHaveAttribute('title', LONG_NAME);

    /* The point of `minmax(0, ...)` on the flexible track. Without the zero
       minimum the name would set the track's floor, widen the grid past its
       card and push the money columns out of the drawer - and it would do it
       only for the customers with long procedure names. Both halves are
       measured: the tracks still match the header, and the card itself has no
       horizontal overflow. */
    await expect(tracks(row)).toEqual(tracks(head));
    const card = row.parentElement as HTMLElement;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);

    // The amount is still fully inside the card rather than clipped off its edge.
    const amount = row.children[3] as HTMLElement;
    await expect(amount.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Surgical procedure names are routinely longer than the column. This is the case that ' +
          'decides whether the table clamps or overflows, and it can only be judged at a realistic ' +
          'column width - which is why every story here is boxed to 460px rather than left at the ' +
          'preview panel width.',
      },
    },
  },
};
