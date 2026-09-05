import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type { Estimate, EstimateItem } from '@/app/features/finance/types/estimate';
import EstimateLineItems from './EstimateLineItems';

const item = (
  id: string,
  description: string,
  quantity: number,
  unitPrice: number,
  taxRate: number,
  notes: string | null = null
): EstimateItem => ({
  id,
  description,
  quantity,
  unitPrice,
  taxRate,
  lineTotal: quantity * unitPrice,
  notes,
});

const LONG_DESCRIPTION =
  'Pre-anaesthetic haematology and biochemistry profile with electrolytes and urinalysis';

/**
 * Figures are deliberately not round. `formatMoneyPrecise` keeps both decimals,
 * so 3 x 19.99 has to read as 59.97 - whole numbers would hide the rounding bug
 * this table exists to avoid.
 */
const estimate = (items: EstimateItem[], currency = 'GBP'): Estimate => ({
  id: 'est-1',
  organisationId: 'org-1',
  patientId: 'pat-marnie',
  encounterId: null,
  status: 'APPROVED',
  validUntil: '2026-10-01T00:00:00.000Z',
  subtotal: items.reduce((sum, row) => sum + row.lineTotal, 0),
  taxAmount: items.reduce((sum, row) => sum + (row.lineTotal * row.taxRate) / 100, 0),
  total: 0,
  currency,
  notes: null,
  approvedBy: 'user-1',
  approvedAt: '2026-09-01T09:00:00.000Z',
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: 'user-1',
  createdAt: '2026-08-30T09:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
  items,
});

const DENTAL = estimate([
  item('i1', 'Dental scale and polish', 1, 120, 0),
  item('i2', 'Pre-anaesthetic bloods', 3, 19.99, 20, 'Repeat on the day if delayed'),
  item('i3', 'Overnight hospitalisation', 1, 85.5, 20),
]);

const meta = {
  title: 'Finance/EstimateLineItems',
  component: EstimateLineItems,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "An estimate's line items: description over an optional note, quantity, unit " +
          'price, tax rate and the pre-tax line total.\n\n' +
          'Built the way `InvoiceBilledItems` is built - the shared `TableHead` recipe over a ' +
          'CSS grid, with the same track on the header and every row - so an estimate and the ' +
          'invoice it converts into read as one family. The head is deliberately not sticky: ' +
          'inside a detail card sticky resolves against the wrong container and strands the ' +
          'band mid-panel.\n\n' +
          'Money is `formatMoneyPrecise`, not the shared `formatMoney`, because that one rounds ' +
          'to whole units - fine for a dashboard tile, wrong for a figure a client approves.',
      },
    },
  },
  tags: ['autodocs'],
  args: { estimate: DENTAL },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[760px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EstimateLineItems>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'Three lines, one with a note',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Dental scale and polish')).toBeInTheDocument();
    await expect(canvas.getByText('Pre-anaesthetic bloods')).toBeInTheDocument();
    // The note sits under its description as a second, quieter line.
    await expect(canvas.getByText('Repeat on the day if delayed')).toBeInTheDocument();

    // Pennies survive: 3 x 19.99 is 59.97, and 85.5 prints with both decimals.
    await expect(canvas.getByText('£19.99')).toBeInTheDocument();
    await expect(canvas.getByText('£59.97')).toBeInTheDocument();
    await expect(canvas.getAllByText('£85.50')).toHaveLength(2);
    await expect(canvas.getAllByText('20%')).toHaveLength(2);
    await expect(canvas.getByText('0%')).toBeInTheDocument();

    // Five columns in the head, in the order the rows follow.
    for (const heading of ['Description', 'Qty', 'Unit price', 'Tax', 'Line total']) {
      await expect(canvas.getByText(heading)).toBeInTheDocument();
    }
  },
};

export const Empty: Story = {
  name: 'No lines',
  args: { estimate: estimate([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This estimate has no lines.')).toBeInTheDocument();
    // The head stays, so the empty message reads as an empty table rather than a broken one.
    await expect(canvas.getByText('Description')).toBeInTheDocument();
  },
};

export const LongDescription: Story = {
  name: 'A long description truncates',
  args: { estimate: estimate([item('i1', LONG_DESCRIPTION, 1, 240, 20)]) },
  play: async ({ canvasElement }) => {
    const description = within(canvasElement).getByText(LONG_DESCRIPTION);
    const style = getComputedStyle(description);
    await expect(style.textOverflow).toBe('ellipsis');
    await expect(style.whiteSpace).toBe('nowrap');
    // The full text is kept as a hover title, so nothing is lost to the clip.
    await expect(description).toHaveAttribute('title', LONG_DESCRIPTION);
  },
};

export const EuroEstimate: Story = {
  name: 'Euro currency',
  args: {
    estimate: estimate(
      [item('i1', 'Consultation - 30 min', 1, 65, 19), item('i2', 'Nail clip', 2, 12, 19)],
      'EUR'
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('€65.00')).toHaveLength(2);
    await expect(canvas.getByText('€24.00')).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: fixed columns keep their width',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('£59.97')).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
