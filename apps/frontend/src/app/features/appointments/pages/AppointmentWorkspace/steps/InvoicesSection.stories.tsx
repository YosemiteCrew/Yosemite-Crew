import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { PastInvoice } from '@/app/features/appointments/types/workspace';
import { InvoicesSection } from './invoicePresentation';

const SETTLED: PastInvoice = {
  id: 'inv-2026-0416',
  createdAt: '2026-03-12T09:42:00.000Z',
  totalCents: 28_450,
  outstandingCents: 0,
  status: 'PAID_FULL',
  paidByName: 'Jonah Pike',
  paidAt: '2026-03-12T10:05:00.000Z',
  paymentMethod: 'CASH',
  items: [
    {
      id: 'line-consult',
      name: 'Consultation - 30 min',
      unitPriceCents: 9_000,
      qty: 1,
      grossCents: 9_000,
      discountCents: 0,
      amountCents: 9_000,
    },
    {
      id: 'line-package',
      name: 'Senior wellness package',
      unitPriceCents: 22_000,
      qty: 1,
      grossCents: 22_000,
      discountCents: 2_550,
      amountCents: 19_450,
      breakdown: [
        {
          id: 'brk-bloods',
          name: 'Senior blood panel',
          qty: 1,
          instructions: 'Diagnostic',
          unitPriceCents: 12_000,
          grossCents: 12_000,
          discountPercent: 10,
          discountCents: 1_200,
          amountCents: 10_800,
        },
        {
          id: 'brk-urine',
          name: 'Urinalysis',
          qty: 1,
          instructions: 'Diagnostic',
          unitPriceCents: 6_000,
          grossCents: 6_000,
          amountCents: 6_000,
        },
        {
          id: 'brk-bp',
          name: 'Blood pressure check',
          qty: 2,
          instructions: 'Service',
          unitPriceCents: 2_000,
          grossCents: 4_000,
          amountCents: 4_000,
        },
      ],
    },
  ],
  payments: [
    {
      id: 'pay-1',
      amountCents: 28_450,
      method: 'CASH',
      provider: 'Front desk',
      status: 'succeeded',
      paidAt: '2026-03-12T10:05:00.000Z',
      receiptUrl: 'https://receipts.example.com/inv-2026-0416.pdf',
    },
  ],
};

const OUTSTANDING: PastInvoice = {
  id: 'inv-2026-0417',
  createdAt: '2026-03-12T14:18:00.000Z',
  totalCents: 15_600,
  outstandingCents: 7_800,
  status: 'PARTIAL',
  items: [
    {
      id: 'line-amox',
      name: 'Amoxicillin 250mg',
      unitPriceCents: 1_200,
      qty: 8,
      grossCents: 9_600,
      discountCents: 0,
      amountCents: 9_600,
    },
    {
      id: 'line-dental',
      name: 'Dental scale & polish',
      unitPriceCents: 6_000,
      qty: 1,
      grossCents: 6_000,
      discountCents: 0,
      amountCents: 6_000,
    },
  ],
};

const BREAKDOWN_HEADINGS = ['Item Name', 'Unit Price', 'Qnt.', 'Gross Amt.', 'Discount'];

const expectBreakdownDrawn = async (canvas: ReturnType<typeof within>) => {
  // Assert the expanded panel actually has its grid, not merely that a row is flagged open.
  expect(await canvas.findByText('Breakdown')).toBeInTheDocument();
  for (const heading of BREAKDOWN_HEADINGS) {
    await expect(canvas.getByText(heading)).toBeInTheDocument();
  }
};

const meta = {
  title: 'Appointments/InvoicesSection',
  component: InvoicesSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The past-invoices list at the bottom of the invoice step, and the `InvoiceBreakdown` ' +
          'panel that expands under a row.\n\n' +
          'The breakdown is the surface worth drawing. It is held behind an internal ' +
          '`expandedId` state with no prop to reach it, so outside the seeded first row it exists ' +
          'only after clicking a `CircleIconButton` - and it is built from **two separate grids ' +
          'that must resolve to identical track widths**: the row grid ' +
          '`sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_132px]` ' +
          'and, inside the panel, the breakdown grid ' +
          '`sm:grid-cols-[minmax(0,1.7fr)_repeat(5,minmax(0,1fr))]`. Every fr track is wrapped in ' +
          '`minmax(0,…)` precisely so content cannot widen a column; a single malformed template ' +
          'here collapses six columns into one, which is exactly the bug that shipped in a ' +
          'popover on this branch. Nothing but a rendered expanded row shows it.\n\n' +
          'Three further branches only exist inside the panel: the settled badge (whose copy flips ' +
          'to "Withdrawn from Deposit" when `paidFromDeposit`), the Payments ledger with its ' +
          'receipt links, and the `PackageBreakdownTooltip` info button, which is rendered only ' +
          'for lines that carry a `breakdown` array.\n\n' +
          'The row itself also changes shape with the data: `isInvoiceSettled` adds the Download ' +
          'button, and Share is added on top of that only when not `readOnly` - so the action ' +
          'cluster is one, two or three buttons inside a fixed 132px track.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    invoices: [SETTLED, OUTSTANDING],
    readOnly: false,
    currency: 'USD',
    onDownload: fn(),
    onShare: fn(),
  },
} satisfies Meta<typeof InvoicesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstRowExpanded: Story = {
  name: 'First row expanded (seeded)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectBreakdownDrawn(canvas);
    await expect(canvas.getByText('Senior wellness package')).toBeInTheDocument();
    await expect(canvas.getByText('Invoice Paid')).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Receipt' })).toBeInTheDocument();
    // The package line is the only one with a breakdown, so exactly one info button exists.
    await expect(
      canvas.getByRole('button', { name: 'View Senior wellness package package breakdown' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the section opens in - `expandedId` is seeded to the first invoice - showing ' +
          'the full settled composition at once: the breakdown grid, the 26px tabular total, the ' +
          'green settled badge, and the Payments ledger with a receipt link.',
      },
    },
  },
};

export const ExpandOutstandingInvoice: Story = {
  name: 'Expand the second invoice',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View invoice inv-2026-0417' }));
    await expectBreakdownDrawn(canvas);
    await expect(canvas.getByText('Amoxicillin 250mg')).toBeInTheDocument();
    // Only one row is open at a time: opening this one closes the seeded first row.
    await expect(canvas.queryByText('Senior wellness package')).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'View invoice inv-2026-0416' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The unsettled invoice open. Its panel has no settled badge and no Payments block, so the ' +
          'breakdown ends on the total row - a materially shorter panel from the same grid, and the ' +
          'combination the seeded story can never show.',
      },
    },
  },
};

export const AllRowsCollapsed: Story = {
  name: 'All rows collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Hide invoice inv-2026-0416' }));
    await expect(canvas.queryByText('Breakdown')).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^View invoice/ })).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Toggling the open row shut sets `expandedId` back to null. Worth its own story because ' +
          'the eye/eye-off icon and the button label are the only difference between the two ' +
          'states - the row itself does not change otherwise.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no share)',
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Download invoice inv-2026-0416' })
    ).toBeInTheDocument();
    // Share is gated on settled AND editable, so it disappears rather than disabling.
    await expect(
      canvas.queryByRole('button', { name: 'Share invoice inv-2026-0416' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A locked encounter keeps Download but drops Share, so the settled row falls from three ' +
          'action buttons to two inside the same fixed 132px track - the column does not reflow, ' +
          'the cluster just sits differently against its right edge.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No invoices',
  args: { invoices: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No invoices recorded yet.')).toBeInTheDocument();
    // The heading grid belongs to the populated branch and must not render here.
    await expect(canvas.queryByText('Invoice ID')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty branch swaps the whole list - column headings included - for a single ' +
          '`bg-neutral-100` note, so there is no orphaned header row left hanging above nothing.',
      },
    },
  },
};
