import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { Invoice } from '@yosemite-crew/types';

import InvoiceSummaryPanel from './InvoiceSummaryPanel';

/**
 * `formatMoney` runs at `maximumFractionDigits: 0`, so every figure below is a
 * whole number on purpose - a 1240.60 total would print as "$1,241" and make the
 * arithmetic in these assertions read as though it were wrong.
 */
const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'a1b2c3d4e5f60718293a4b5c',
  organisationId: 'org-avenger-park',
  items: [],
  subtotal: 1050,
  discountTotal: 60,
  taxPercent: 20,
  taxTotal: 250,
  totalAmount: 1240,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  status: 'AWAITING_PAYMENT',
  createdAt: new Date('2026-08-12T10:02:00.000Z'),
  updatedAt: new Date('2026-08-12T10:02:00.000Z'),
  ...overrides,
});

const resolveToken = (host: HTMLElement, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  host.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  if (value === 'rgba(0, 0, 0, 0)') {
    throw new Error(`Token ${token} resolved to transparent - it does not exist here.`);
  }
  return value;
};

const panel = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByRole('region', { name: 'Invoice summary' });

/** The figure that sits opposite a row label, e.g. `amountFor(canvas, 'Outstanding')`. */
const amountFor = (canvasElement: HTMLElement, label: string): HTMLElement =>
  within(panel(canvasElement)).getByText(label).nextElementSibling as HTMLElement;

const meta = {
  title: 'Finance/InvoiceSummaryPanel',
  component: InvoiceSummaryPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The money block of the invoice drawer: subtotal, discount, tax, a rule, the total, and ' +
          'the outstanding balance.\n\n' +
          'Two things here are computed rather than displayed.\n\n' +
          '**Outstanding** comes from `getInvoiceOutstanding`, not from the invoice. It prefers ' +
          '`settlementSummary.balance` when the backend sends one, treats PAID / REFUNDED / ' +
          'CANCELLED as owing nothing whatever the total says, and otherwise falls back to total ' +
          'minus any collected deposit - floored at zero, so an over-collected invoice reads $0 ' +
          'rather than a negative. Its colour is the only status signal in the block: `--warn-text` ' +
          'while anything is owed, `--success-text` at zero.\n\n' +
          '**The tax label** carries the rate when the invoice recorded one ("Tax · 20%") and ' +
          'degrades to a bare "Tax" when it did not, so a zero-rated invoice never claims "Tax · 0%".\n\n' +
          'Every money field is read with `?? 0`, so a partially built invoice renders a complete ' +
          'block of zeroes instead of "$NaN".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    invoice: invoice({ depositCollectedAmount: 300 }),
    currency: 'USD',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outstanding: Story = {
  name: 'Part paid, money still owed',
  play: async ({ canvasElement }) => {
    const canvas = within(panel(canvasElement));

    // Deposit taken off the total: 1240 - 300. The panel never shows the deposit
    // itself, so this subtraction is invisible unless the number is checked.
    await expect(amountFor(canvasElement, 'Outstanding')).toHaveTextContent('$940');
    await expect(amountFor(canvasElement, 'Total')).toHaveTextContent('$1,240');
    await expect(amountFor(canvasElement, 'Subtotal')).toHaveTextContent('$1,050');
    await expect(amountFor(canvasElement, 'Discount')).toHaveTextContent('$60');

    // The rate rides in the label rather than in its own row.
    await expect(canvas.getByText('Tax · 20%')).toBeInTheDocument();
    await expect(canvas.queryByText('Tax')).not.toBeInTheDocument();

    /* Amber, not the body ink. Nothing else in the block says an invoice is unpaid -
       no pill, no icon - so if this colour stopped applying the drawer would report a
       $940 debt in the same tone it uses for the subtotal. */
    const warn = resolveToken(canvasElement, '--warn-text');
    const success = resolveToken(canvasElement, '--success-text');
    await waitFor(() => {
      expect(getComputedStyle(amountFor(canvasElement, 'Outstanding')).color).toBe(warn);
    });
    await expect(getComputedStyle(amountFor(canvasElement, 'Outstanding')).color).not.toBe(success);
  },
};

export const Settled: Story = {
  name: 'Settled, and no tax rate recorded',
  args: {
    invoice: invoice({ status: 'PAID', taxPercent: undefined, taxTotal: 0 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(panel(canvasElement));

    /* PAID zeroes the balance from the STATUS, with no payment record involved: this
       invoice carries no deposit and no settlement summary, and its total is still
       $1,240. A rewrite that computed outstanding from collected payments alone would
       show the full total owing on an invoice the clinic has already been paid for. */
    await expect(amountFor(canvasElement, 'Outstanding')).toHaveTextContent('$0');
    await expect(amountFor(canvasElement, 'Total')).toHaveTextContent('$1,240');

    // Bare "Tax" - no rate was recorded, so none is invented.
    await expect(canvas.getByText('Tax')).toBeInTheDocument();
    await expect(canvas.queryByText(/Tax · /)).not.toBeInTheDocument();

    const success = resolveToken(canvasElement, '--success-text');
    await waitFor(() => {
      expect(getComputedStyle(amountFor(canvasElement, 'Outstanding')).color).toBe(success);
    });
  },
};

export const SettlementSummaryWins: Story = {
  name: 'A settlement summary overrides the arithmetic',
  args: {
    invoice: invoice({
      depositCollectedAmount: 300,
      settlementSummary: {
        invoiceTotal: 1240,
        cashPaid: 525,
        depositRecordedAmount: 300,
        credited: 0,
        effectivePaid: 825,
        balance: 415,
        lineAllocations: [],
      },
    }),
  },
  play: async ({ canvasElement }) => {
    /* Same invoice as the default story, plus a settlement summary. Total minus
       deposit is still 940, but the backend has reconciled cash and credits and says
       415 - and the summary wins. The two numbers being different is the whole point
       of the fixture: with a summary of 940 this story would pass against a component
       that ignored the summary entirely. */
    await expect(amountFor(canvasElement, 'Outstanding')).toHaveTextContent('$415');
    await expect(amountFor(canvasElement, 'Outstanding')).not.toHaveTextContent('$940');

    const warn = resolveToken(canvasElement, '--warn-text');
    await waitFor(() => {
      expect(getComputedStyle(amountFor(canvasElement, 'Outstanding')).color).toBe(warn);
    });
  },
};

export const MissingAmounts: Story = {
  name: 'An invoice with no money fields yet',
  args: {
    invoice: invoice({
      subtotal: undefined,
      discountTotal: undefined,
      taxTotal: undefined,
      totalAmount: undefined,
      taxPercent: undefined,
    }),
  },
  play: async ({ canvasElement }) => {
    /* A draft invoice built line by line reaches this panel before any of the totals
       are computed. Every read is `?? 0`, so all five rows print $0 - the failure
       being guarded against is "$NaN" in four places, which is what a bare
       `formatMoney(invoice.subtotal)` produces. */
    for (const label of ['Subtotal', 'Discount', 'Tax', 'Total', 'Outstanding']) {
      await expect(amountFor(canvasElement, label)).toHaveTextContent('$0');
    }

    // Nothing owed, so the balance is green rather than amber.
    const success = resolveToken(canvasElement, '--success-text');
    await waitFor(() => {
      expect(getComputedStyle(amountFor(canvasElement, 'Outstanding')).color).toBe(success);
    });
  },
};

export const LargeTotals: Story = {
  name: 'Six-figure totals stay aligned',
  args: {
    invoice: invoice({
      subtotal: 128400,
      discountTotal: 4000,
      taxTotal: 24880,
      totalAmount: 149280,
      depositCollectedAmount: 12000,
    }),
  },
  play: async ({ canvasElement }) => {
    const box = panel(canvasElement);
    const figures = [...box.querySelectorAll<HTMLElement>('.tabular-nums')];

    await expect(figures).toHaveLength(5);
    await expect(amountFor(canvasElement, 'Total')).toHaveTextContent('$149,280');
    await expect(amountFor(canvasElement, 'Outstanding')).toHaveTextContent('$137,280');

    /* The rows are five independent flex lines, not a grid, so nothing structural
       keeps the figures in a column - only the fact that each row is
       `justify-between` inside the same padded box. Comparing right edges states that
       rule directly and survives a change of currency or font. */
    const rights = figures.map((figure) => figure.getBoundingClientRect().right);
    for (const right of rights) {
      await expect(Math.abs(right - rights[0])).toBeLessThan(0.5);
    }

    /* Tabular figures on every amount, the 24px total included. Proportional digits
       would let "1" occupy less width than "8" and make the column of numbers ripple
       even while the right edges stayed put. */
    for (const figure of figures) {
      await expect(getComputedStyle(figure).fontVariantNumeric).toContain('tabular-nums');
    }
  },
};

export const Phone: Story = {
  name: 'Phone: label and figure do not collide',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    invoice: invoice({
      subtotal: 128400,
      discountTotal: 4000,
      taxTotal: 24880,
      totalAmount: 149280,
      depositCollectedAmount: 12000,
    }),
  },
  /* 375px is pinned twice: as the viewport global, which is what a human sees when
     they open the story, and as an explicit width, because a headless runner that
     loads `iframe.html` directly never applies the global and would measure this at
     panel width - where nothing could collide and the assertion proves nothing. */
  decorators: [
    (Story) => (
      <div style={{ width: 375 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const box = panel(canvasElement);

    /* The widest row on the narrowest screen: "Tax · 20%" against $24,880 and the
       24px "$149,280". Nothing in the block truncates or wraps, so an over-long label
       or an over-large figure overlaps rather than clipping, and overlap is invisible
       to any text-content assertion. */
    for (const label of ['Subtotal', 'Discount', 'Tax · 20%', 'Total', 'Outstanding']) {
      const labelNode = within(box).getByText(label);
      const figure = labelNode.nextElementSibling as HTMLElement;
      await expect(labelNode.getBoundingClientRect().right).toBeLessThan(
        figure.getBoundingClientRect().left
      );
    }

    // And the block itself stays inside the phone.
    await expect(box.scrollWidth).toBeLessThanOrEqual(375);
  },
};
