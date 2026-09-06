import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Invoice } from '@yosemite-crew/types';

import InvoicePaymentLedger from './InvoicePaymentLedger';

/**
 * The block renders through `formatMoneyPrecise`, which pins no fraction digits
 * and lets `Intl` use each currency's minor unit - so USD prints two decimals
 * and this total renders as "$114.00", not "$114". The fixture stays a whole
 * number so the rendered string is unambiguous rather than rounded.
 */
const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'a1b2c3d4e5f60718293a4b5c',
  organisationId: 'org-avenger-park',
  items: [],
  subtotal: 114,
  totalAmount: 114,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  status: 'PAID',
  // Local-time Dates rather than UTC literals: a `...T10:15:00.000Z` fixture
  // slides by the runner's offset, which is how a fixture starts passing by
  // timezone. Nothing below asserts the stamp itself for the same reason.
  paidAt: new Date(2026, 7, 12, 10, 15),
  createdAt: new Date(2026, 7, 12, 10, 2),
  updatedAt: new Date(2026, 7, 12, 10, 15),
  ...overrides,
});

/**
 * `paymentCollectionMethod` is typed as three values, but `getLedgerChannel` and
 * `getPaymentCollectionMethodLabel` both carry a fallback for anything else -
 * reachable from an older record, or one written before the enum settled. Cast
 * rather than typed, because a valid value would not exercise the branch.
 */
const legacyMethod = (value: string) => value as Invoice['paymentCollectionMethod'];

const LONG_PAYER = 'Alexandra Constance Fotheringay-Whitmore';

/** The bordered card: `region.children` is `[heading, card]`. */
const cardOf = (region: HTMLElement): HTMLElement => region.children[1] as HTMLElement;

const meta = {
  title: 'Finance/InvoicePaymentLedger',
  component: InvoicePaymentLedger,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "Payments" block on the invoice drawer, and the one section that can vanish ' +
          'entirely: an unsettled invoice renders `null`, so the drawer is SHORTER rather than ' +
          'showing an empty ledger. Settled means `PAID`, `REFUNDED`, or any invoice at all that ' +
          'carries a `paidAt` - that last clause is a real escape hatch and has its own story.\n\n' +
          'The row is labelled by the channel the money came through rather than with a generic ' +
          '"payment recorded": an app or link payment gets the phone glyph and "Paid in the ' +
          'pet-parent app", an over-the-counter payment gets the card glyph and "Paid at the ' +
          'clinic", and anything else falls back. Getting that wrong is not a cosmetic bug - it ' +
          'tells a practice the client already paid online when nobody took their card.\n\n' +
          'The receipt link is the security-sensitive part. React does not sanitise link ' +
          'protocols, and `stripeReceiptUrl` is invoice data, so it is passed through ' +
          '`getSafeStripeRedirectUrl` and the link is ABSENT rather than broken when the URL is ' +
          'not https on a real Stripe host.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    invoice: invoice(),
    currency: 'USD',
    payerName: 'Sky Doe',
  },
  decorators: [
    /* Two jobs. The 460px box is roughly the column the drawer gives this card,
       which is where the caption has to fit beside the amount and the link. And
       the wrapper means the unsettled story still mounts SOMETHING, so "renders
       nothing" can be asserted against an element rather than inferred from an
       empty canvas. */
    (Story) => (
      <div data-testid="ledger-host" style={{ maxWidth: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoicePaymentLedger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaidInApp: Story = {
  name: 'Paid in the app, with a receipt',
  args: {
    invoice: invoice({ stripeReceiptUrl: 'https://pay.stripe.com/receipts/acct_1H/ch_3Ab' }),
    payerName: LONG_PAYER,
  },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Payments' });
    const card = cardOf(region);

    // Heading and card. There is no third child: the "Receipt sent to ..." line
    // was removed deliberately, because nothing in the product emails a receipt.
    await expect(region.children).toHaveLength(2);
    await expect(within(card).getByText('Paid in the pet-parent app')).toBeInTheDocument();
    await expect(within(card).getByText('$114.00')).toBeInTheDocument();

    /* The channel glyph carries the meaning only in the eyes of a sighted
       reader; the title beside it is what a screen reader gets. If the svg ever
       stops being aria-hidden it starts announcing react-icons' own title into
       the middle of the row, which nobody sees in review. */
    const glyph = card.querySelector('svg');
    await expect(glyph).toHaveAttribute('aria-hidden', 'true');

    /* The caption is matched at its two ends rather than in full: the timestamp
       between them renders in the viewer's timezone and would differ between
       machines. "Online payment" is the METHOD label - it is a different string
       from the channel title above it, and only one of the two comes from
       `getPaymentCollectionMethodLabel`. */
    const caption = within(card).getByTitle(/^Online payment · /);
    await expect(caption).toHaveAttribute('title', expect.stringContaining(`· by ${LONG_PAYER}`));

    /* Not sanitised by React, so validated by us: the href must be exactly what
       `getSafeStripeRedirectUrl` returned, and the target/rel pair must be
       intact. `target="_blank"` without `rel="noopener"` hands the opened page a
       `window.opener` handle back into the practice's session. */
    const receipt = within(card).getByRole('link', { name: 'Receipt' });
    await expect(receipt).toHaveAttribute('href', 'https://pay.stripe.com/receipts/acct_1H/ch_3Ab');
    await expect(receipt).toHaveAttribute('target', '_blank');
    await expect(receipt).toHaveAttribute('rel', 'noopener noreferrer');

    /* A long payer name must cost the caption, not the row. The caption span is
       the only `flex-1 min-w-0` child, so it is the one that has to give way -
       without the min-width override the flex row would refuse to shrink it and
       push the amount and the receipt link off the card, on exactly the invoices
       where the receipt matters most. */
    await expect(caption.scrollWidth).toBeGreaterThan(caption.clientWidth);
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    await expect(receipt.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fullest version of the block: a Stripe-collected payment with a receipt URL and a ' +
          'payer email, so both optional pieces are present at once. The payer name is deliberately ' +
          'long, because the caption sharing a row with the amount and the link is the layout that ' +
          'actually breaks.',
      },
    },
  },
};

export const PaidAtClinic: Story = {
  name: 'Paid at the clinic',
  args: {
    invoice: invoice({ paymentCollectionMethod: 'PAYMENT_AT_CLINIC' }),
  },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Payments' });
    const card = cardOf(region);

    /* The channel changes the title as well as the glyph. Asserting the ABSENCE
       of the app wording matters more than the presence of this one: a fallthrough
       in `getLedgerChannel` would tell a practice the client paid online when the
       money was taken over the counter. */
    await expect(within(card).getByText('Paid at the clinic')).toBeInTheDocument();
    await expect(within(card).queryByText('Paid in the pet-parent app')).not.toBeInTheDocument();
    // The method label follows it, and is worded differently again.
    await expect(within(card).getByTitle(/^In-person payment · /)).toBeInTheDocument();

    // No Stripe receipt for a desk payment, so the link is absent, not disabled.
    await expect(card.querySelectorAll('a')).toHaveLength(0);
    // Still closes with the amount - only the receipt went.
    await expect(within(card).getByText('$114.00')).toBeInTheDocument();

    /* Two children, as everywhere else now. This story used to be the contrast
       - no payer email, so no confirmation banner - but the banner is gone for
       every case, so what it pins is that nothing reintroduces a claim that a
       receipt was sent. That is the one failure here a practice would repeat
       back to a client. */
    await expect(region.children).toHaveLength(2);
    await expect(region.textContent).not.toContain('Receipt sent to');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same settled invoice taken at the desk. `getLedgerChannel` is shared with the phone ' +
          'record, so this title and glyph are what a client sees at every width. Both optional ' +
          'pieces are gone here, which makes it the shortest form of the block.',
      },
    },
  },
};

export const SettledByPaidAt: Story = {
  name: 'Settled by paidAt alone',
  args: {
    // Status still says pending, but the money landed. `isSettledInvoice` treats
    // any `paidAt` as settled, which is the only reason this renders at all.
    invoice: invoice({ status: 'PENDING', paymentCollectionMethod: legacyMethod('CASH') }),
  },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Payments' });
    const card = cardOf(region);

    /* Renders despite a status outside PAID/REFUNDED. Worth pinning: tightening
       `isSettledInvoice` to the status set alone would hide a recorded payment
       behind a stale status, and the drawer would show no ledger for money the
       practice has already taken. */
    await expect(card).toBeInTheDocument();

    /* An unrecognised collection method still gets a row rather than a blank
       one. Two separate fallbacks fire, and they resolve to different words:
       `getLedgerChannel` gives the neutral title, `getPaymentCollectionMethodLabel`
       title-cases the raw enum into the caption. */
    await expect(within(card).getByText('Payment recorded')).toBeInTheDocument();
    await expect(within(card).getByTitle(/^Cash · /)).toBeInTheDocument();
    // Title-cased, so the raw SCREAMING_CASE value never leaks to the reader.
    await expect(region.textContent).not.toContain('CASH');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A payment recorded against an invoice whose status has not caught up, taken by a method ' +
          'the enum does not name. Both fallbacks are load-bearing rather than defensive padding: ' +
          'between them they are what stops a real payment from rendering as an empty row.',
      },
    },
  },
};

export const UntrustedReceiptUrl: Story = {
  name: 'Refunded, receipt URL rejected',
  args: {
    invoice: invoice({
      status: 'REFUNDED',
      // Contains "stripe.com" but is not a Stripe host - the exact shape a
      // substring check would wave through and `hasAllowedStripeHost` will not.
      stripeReceiptUrl: 'https://pay.stripe.com.receipts-billing.example/ch_3Ab',
    }),
  },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Payments' });
    const card = cardOf(region);

    // REFUNDED is settled, so the ledger is here - the URL is the only casualty.
    await expect(within(card).getByText('Paid in the pet-parent app')).toBeInTheDocument();
    await expect(within(card).getByText('$114.00')).toBeInTheDocument();

    /* No link at all, and the rejected host reaches no attribute either. Asserted
       against the markup rather than against the visible text, because the danger
       is an href a reader never sees until they click it. */
    await expect(card.querySelectorAll('a')).toHaveLength(0);
    await expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    await expect(card.innerHTML).not.toContain('receipts-billing.example');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A refund, carrying a receipt URL that is https but is not hosted by Stripe. The link ' +
          'disappears rather than rendering disabled: an off-host receipt URL on a billing document ' +
          'is a phishing target, and there is nothing useful to show a reader about one.',
      },
    },
  },
};

export const Unsettled: Story = {
  name: 'Unsettled invoice draws nothing',
  args: {
    invoice: invoice({ status: 'AWAITING_PAYMENT', paidAt: undefined }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Nothing at all, not an empty card: the whole section is absent so the
       drawer closes up around it. Asserted against the host element's child
       count, which is the only way to tell "rendered nothing" apart from
       "rendered something the queries happened to miss". */
    await expect(canvas.getByTestId('ledger-host').children).toHaveLength(0);
    await expect(canvas.queryByRole('region', { name: 'Payments' })).not.toBeInTheDocument();

    /* The early return happens BEFORE the payer email is read, so an invoice
       carrying an address it never sent a receipt to says nothing. This is the
       assertion that would catch the guard being moved below the banner. */
    await expect(canvasElement.textContent).not.toContain('Receipt sent to');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state most invoices sit in for their first hours. The component returns `null` ' +
          'outright, which is why the drawer loses a whole section rather than leaving a gap where ' +
          'a ledger would go - and why this story needs a wrapper to have anything to assert on.',
      },
    },
  },
};
