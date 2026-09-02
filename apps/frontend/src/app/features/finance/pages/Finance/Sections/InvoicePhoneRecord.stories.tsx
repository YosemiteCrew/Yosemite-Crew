import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';

import InvoicePhoneRecord from './InvoicePhoneRecord';

const ORG_ID = 'org-avenger-park';
const APPOINTMENT_ID = 'appointment-8842';
const PARENT_ID = 'parent-sky-doe';

const patient: Appointment['patient'] = {
  id: 'companion-kizie',
  name: 'Kizie',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: PARENT_ID, name: 'Sky Doe' },
};

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  organisationId: ORG_ID,
  patient,
  companion: patient,
  appointmentType: {
    id: 'type-dental',
    name: 'Dental consultation',
    speciality: { id: 'spec-dentistry', name: 'Dentistry' },
  },
  appointmentDate: new Date('2026-08-12T09:30:00.000Z'),
  startTime: new Date('2026-08-12T09:30:00.000Z'),
  endTime: new Date('2026-08-12T10:00:00.000Z'),
  timeSlot: '09:30 AM',
  durationMinutes: 30,
  status: 'COMPLETED',
};

/**
 * `formatMoney` runs at `maximumFractionDigits: 0`, so every figure here is a whole
 * number on purpose - a 92.65 total would print as "$93" and make the assertions read
 * as though the arithmetic were wrong.
 *
 * Fixed instants throughout: the formatters pin the en-US locale and
 * `getPreferredTimeZone` falls back to Europe/Berlin with no timezone token stored,
 * so nothing here drifts with the machine running it.
 */
const PAID_INVOICE: Invoice = {
  id: 'a1b2c3d4e5f60718293a4b5c',
  organisationId: ORG_ID,
  appointmentId: APPOINTMENT_ID,
  parentId: PARENT_ID,
  metadata: { invoiceNumber: 'INV-2026-0142' },
  items: [
    { id: 'line-1', name: 'Dental consultation', quantity: 1, unitPrice: 60, total: 60 },
    { id: 'line-2', name: 'Scale and polish', quantity: 1, unitPrice: 45, total: 45 },
  ],
  subtotal: 105,
  discountTotal: 10,
  taxPercent: 20,
  taxTotal: 19,
  totalAmount: 114,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  status: 'PAID',
  pdfUrl: 'https://d2il6osz49gpup.cloudfront.net/invoices/INV-2026-0142.pdf',
  stripeReceiptUrl: 'https://pay.stripe.com/receipts/example',
  paidAt: new Date('2026-08-12T10:15:00.000Z'),
  createdAt: new Date('2026-08-12T10:02:00.000Z'),
  updatedAt: new Date('2026-08-12T10:15:00.000Z'),
};

/**
 * The bordered card holding the billed lines, the tax band and the total.
 *
 * The payment card shares its `rounded-[14px]` radius, so this deliberately takes the
 * FIRST match - the items card is always above it in the sheet, and on an unsettled
 * invoice the payment card does not exist at all.
 */
const itemsCard = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('.rounded-\\[14px\\]') as HTMLElement;

/**
 * The row holding the two full-width actions, or null when it was not rendered.
 *
 * Selected by the row's OWN classes rather than by walking up from an action: the
 * guard under review is on the container (`{(pdfUrl || (appointment &&
 * onOpenAppointment)) && ...}`), and a helper that starts from a child can only ever
 * return null once both children are gone - which would pass whether the row
 * disappeared or stayed behind as an empty 10px gap. `pt-1` alone is not unique in
 * this component (the header row carries it too), so the gap is part of the match.
 */
const actionRow = (canvasElement: HTMLElement): HTMLElement | null =>
  canvasElement.querySelector('.flex.gap-2\\.5.pt-1');

const meta = {
  title: 'Finance/InvoicePhoneRecord',
  component: InvoicePhoneRecord,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The invoice record as it is drawn below 768px: a 36px-avatar header, one bordered card ' +
          'holding the billed lines and ending in a `--screen-2` tax band and a 20px total, a ' +
          'payment row, a finalized note, and up to two full-width actions. It replaces the ' +
          'desktop record entirely rather than reflowing it - none of the desktop sections exist ' +
          'here.\n\n' +
          'Three of its states had never been drawn, and each is a whole block appearing or ' +
          'vanishing rather than a style change:\n\n' +
          '**Unsettled.** `isSettledInvoice` is `PAID`/`REFUNDED` *or* any invoice carrying ' +
          '`paidAt`. Below that bar the payment card AND the "Receipt sent to ..." note both ' +
          'disappear - so an awaiting-payment invoice is a shorter sheet, not one with an empty ' +
          'ledger. This is the state most invoices are in while anyone is actually looking at ' +
          'them.\n\n' +
          '**No billed items.** The card keeps its tax and total rows and swaps the lines for one ' +
          'faint sentence, so the sheet still reads as a bill rather than collapsing to a ' +
          'heading. A counter sale with a manual total lands here.\n\n' +
          '**The PDF action.** Gated on `invoice.pdfUrl`, which the document renderer writes - ' +
          'absent for the whole window between an invoice being created and its PDF existing. It ' +
          'is a real `<a target="_blank" rel="noopener noreferrer">` and it shares the row with ' +
          '"Open appointment" at a deliberate **1 : 1.4** ratio, so the CTA reads as the primary ' +
          'action. Lose either control and the survivor takes the whole width; lose both and the ' +
          'row itself is not rendered.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    titleId: 'invoice-phone-title',
    invoice: PAID_INVOICE,
    appointment: APPOINTMENT,
    currency: 'USD',
    statusLabel: 'Paid',
    statusTone: 'success',
    payerName: 'Sky Doe',
    onClose: fn(),
    onOpenAppointment: fn(),
  },
  // Pinned as a GLOBAL on the meta, so every story here renders at phone width.
  // `parameters.viewport.defaultViewport` was removed in Storybook 10: it still
  // type-checks, still plays and still passes, at the full panel width - which for a
  // component whose whole reason to exist is the phone would prove nothing at all.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="min-h-[640px] bg-[var(--screen)] px-4 py-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoicePhoneRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Settled: Story = {
  name: 'Paid invoice',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The header: number from metadata, status badge, and the composed subtitle.
    const heading = canvas.getByRole('heading', { name: '#INV-2026-0142' });
    await expect(heading).toHaveAttribute('id', 'invoice-phone-title');
    await expect(canvas.getByText('Paid')).toBeInTheDocument();
    await expect(canvas.getByText('Kizie · Doe · Aug 12, 2026')).toBeInTheDocument();

    /* The card is one stack of rows, and the row COUNT is what says the structure held:
       two lines, a discount band, a tax band and the total. A missing band does not
       break the layout - it just quietly drops a figure out of the bill. */
    const card = itemsCard(canvasElement);
    await expect(card.children).toHaveLength(5);
    await expect(card.children[0]).toHaveTextContent('Dental consultation');
    await expect(card.children[0]).toHaveTextContent('$60');
    await expect(card.children[1]).toHaveTextContent('Scale and polish');
    await expect(card.children[1]).toHaveTextContent('$45');
    // The discount is its own SIGNED row here - the desktop summary prints it unsigned
    // in a labelled table instead.
    await expect(card.children[2]).toHaveTextContent('-$10');
    // The tax label folds the percent in without a middle dot ("Tax 20%", where the
    // desktop summary says "Tax · 20%").
    await expect(card.children[3]).toHaveTextContent('Tax 20%');
    await expect(card.children[3]).toHaveTextContent('$19');
    await expect(card.children[4]).toHaveTextContent('Total');
    await expect(card.children[4]).toHaveTextContent('$114');

    /* Once, not twice. Unlike the desktop ledger, the phone payment row prints NO
       amount - the total above it is the only figure on the sheet, which is the
       difference a reviewer comparing the two records would look for first. */
    await expect(canvas.getAllByText('$114')).toHaveLength(1);

    // The payment row names the channel rather than saying "payment recorded", and
    // the caption is matched at its two ends because the timestamp between them
    // renders in the viewer's timezone.
    await expect(canvas.getByText('Paid in the pet-parent app')).toBeInTheDocument();
    await expect(canvas.getByTitle(/^Online payment · /)).toBeInTheDocument();
    await expect(canvas.getByTitle(/ · Sky Doe$/)).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Receipt' })).toBeInTheDocument();

    // The finalized note, with the payer's stored email.
    await expect(canvas.getByText('Receipt sent to sky.doe@example.com')).toBeInTheDocument();

    // Two actions and the close control.
    await expect(
      canvas.getByRole('link', { name: 'Download invoice #INV-2026-0142 PDF' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Open appointment' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only state in which every block renders at once, so it is the layout reference for ' +
          'the rest: a settled invoice with two lines, a discount, tax at 20%, a Stripe receipt ' +
          'and a rendered PDF.',
      },
    },
  },
};

export const Unsettled: Story = {
  name: 'Awaiting payment: two blocks vanish',
  args: {
    invoice: {
      ...PAID_INVOICE,
      metadata: { invoiceNumber: 'INV-2026-0163' },
      status: 'AWAITING_PAYMENT',
      paymentCollectionMethod: 'PAYMENT_LINK',
      paidAt: undefined,
      stripeReceiptUrl: undefined,
    },
    statusLabel: 'Awaiting payment',
    statusTone: 'info',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { name: '#INV-2026-0163' })).toBeInTheDocument();
    await expect(canvas.getByText('Awaiting payment')).toBeInTheDocument();

    /* Both settled-only blocks are gone. Asserted separately because they are gated by
       two different conditions on the same flag - `settled` for the payment card,
       `settled && email` for the note - and a regression in either one alone would
       claim money had been taken. The channel title is checked rather than the card's
       class, since `getLedgerChannel` still returns a title for an unsettled invoice
       and would happily render one. */
    await expect(canvas.queryByText('Paid in the pet-parent app')).not.toBeInTheDocument();
    await expect(canvas.queryByText(/^Online payment · /)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('link', { name: 'Receipt' })).not.toBeInTheDocument();
    await expect(canvas.queryByText(/^Receipt sent to /)).not.toBeInTheDocument();

    /* The bill itself is untouched - the sheet is SHORTER, not different. Same five
       rows, same figures, so nothing about the amount owed changes with the state. */
    const card = itemsCard(canvasElement);
    await expect(card.children).toHaveLength(5);
    await expect(card.children[4]).toHaveTextContent('$114');
    await expect(canvas.getAllByText('$114')).toHaveLength(1);

    // The actions row survives: a PDF can exist for an unpaid invoice, and the
    // appointment route never depended on payment at all.
    await expect(
      canvas.getByRole('link', { name: 'Download invoice #INV-2026-0163 PDF' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Open appointment' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Where most invoices sit for their first hours, and the frame that had never been ' +
          'drawn. Nothing on this sheet says money is owed except the absence of the payment card ' +
          'and the status badge - there is no outstanding figure on the phone record the way ' +
          'there is on the desktop summary panel.',
      },
    },
  },
};

export const SettledWithoutEmail: Story = {
  name: 'Settled, but no email on file',
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The payment card stays and the note goes. The two blocks are separately gated,
       and the note additionally trims its email - so a stored value of whitespace
       drops it exactly like a missing one, rather than rendering "Receipt sent to ".
       That trim is the reason this story passes spaces instead of undefined. */
    await expect(canvas.getByText('Paid in the pet-parent app')).toBeInTheDocument();
    await expect(canvas.queryByText(/^Receipt sent to /)).not.toBeInTheDocument();

    // The ledger keeps its whole caption, timestamp and payer included, so the sheet
    // still says who paid - it just no longer claims anyone was emailed about it.
    await expect(canvas.getByTitle(/^Online payment · /)).toBeInTheDocument();
    await expect(canvas.getByTitle(/ · Sky Doe$/)).toBeInTheDocument();

    // The Receipt link is on the payment card, not the note, so it survives - the
    // reader can still reach the Stripe receipt with no address to have sent it to.
    await expect(canvas.getByRole('link', { name: 'Receipt' })).toBeInTheDocument();

    // And the bill is byte-for-byte the settled story's: five rows ending in $114.
    // The email is a payer detail, not an invoice one, and nothing else moves with it.
    const card = itemsCard(canvasElement);
    await expect(card.children).toHaveLength(5);
    await expect(card.children[4]).toHaveTextContent('Total');
    await expect(card.children[4]).toHaveTextContent('$114');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A pet parent registered at the desk with a phone number and no email. The invoice is ' +
          'paid, the receipt exists, and nobody was sent it - which is what the missing note ' +
          'actually means and what makes it worth showing beside the settled story.',
      },
    },
  },
};

export const NoBilledItems: Story = {
  name: 'No billed items',
  args: {
    invoice: {
      ...PAID_INVOICE,
      metadata: { invoiceNumber: 'INV-2026-0009' },
      items: [],
      subtotal: 0,
      discountTotal: 0,
      taxPercent: undefined,
      taxTotal: 0,
      totalAmount: 0,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Three rows, not one sentence. The empty state replaces only the line items - the
       tax band and the total row still render, so the card keeps its shape and the
       sheet still reads as a bill. Asserting the row count is what separates that from
       a card that collapsed to a single message. */
    const card = itemsCard(canvasElement);
    await expect(card.children).toHaveLength(3);
    await expect(canvas.getByText('No billed items recorded.')).toBeInTheDocument();
    // The discount row is gone as well, because the discount is zero rather than
    // absent - a `-$0` band would read as a bug.
    await expect(canvas.queryByText('Discount')).not.toBeInTheDocument();

    // The tax label loses its percent suffix when the invoice carries none.
    await expect(card.children[1]).toHaveTextContent('Tax');
    await expect(card.children[1]).not.toHaveTextContent('Tax 20%');

    /* A zero invoice prints figures rather than dashes - twice, once in the tax band
       and once in the total - because a dash in a billing document reads as unknown
       rather than as nothing owed. */
    await expect(canvas.getAllByText('$0')).toHaveLength(2);
    await expect(card.children[2]).toHaveTextContent('Total');

    // The empty state is an <output>, so it is announced rather than being a silent
    // paragraph that appeared after a fetch.
    await expect(canvas.getByRole('status')).toHaveTextContent('No billed items recorded.');
  },
  parameters: {
    docs: {
      description: {
        story:
          'An invoice with a total and no lines - a counter sale keyed as one amount, or a record ' +
          'whose items failed to load. The sheet cannot tell those apart, and neither can the ' +
          'reader: the sentence is the same either way.',
      },
    },
  },
};

export const ActionRatio: Story = {
  name: 'The two actions share the row 1 : 1.4',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const pdf = canvas.getByRole('link', { name: 'Download invoice #INV-2026-0142 PDF' });
    const open = canvas.getByRole('button', { name: 'Open appointment' });

    /* `flex-1` against `flex-[1.4]`. The ratio is the whole design intent - the CTA has
       to read as the primary action without being the only one - and it is invisible
       in a class list once the two buttons are in different files. Measured with
       getBoundingClientRect because that is the border box; getComputedStyle().width
       would report the content box and under-read the outlined PDF pill by its border
       on each side. */
    const pdfWidth = pdf.getBoundingClientRect().width;
    const openWidth = open.getBoundingClientRect().width;
    await expect(openWidth / pdfWidth).toBeGreaterThan(1.3);
    await expect(openWidth / pdfWidth).toBeLessThan(1.5);

    // One line, side by side, with the CTA on the right.
    await expect(pdf.getBoundingClientRect().top).toBe(open.getBoundingClientRect().top);
    await expect(open.getBoundingClientRect().left).toBeGreaterThan(
      pdf.getBoundingClientRect().right
    );
    // Both are 44px tall - the phone tap target, not the 36px desktop pill - and both
    // are inside the row rather than overflowing it.
    await expect(Math.round(pdf.getBoundingClientRect().height)).toBe(44);
    await expect(Math.round(open.getBoundingClientRect().height)).toBe(44);
    const row = actionRow(canvasElement) as HTMLElement;
    await expect(row.children).toHaveLength(2);
    await expect(Math.round(open.getBoundingClientRect().right)).toBeLessThanOrEqual(
      Math.round(row.getBoundingClientRect().right)
    );

    /* The two controls are wired to different things, and the difference matters:
       "Open appointment" raises `onOpenAppointment` and must NOT also close the sheet -
       the caller dismisses it after pushing the route, which is why these are two
       separate props. The PDF is an ordinary anchor and reaches no handler at all, so
       the sheet stays open behind the new tab. */
    await userEvent.click(open);
    await expect(args.onOpenAppointment).toHaveBeenCalledTimes(1);
    await expect(args.onClose).not.toHaveBeenCalled();
    await expect(pdf).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(pdf).toHaveAttribute('target', '_blank');
    await expect(pdf).toHaveAttribute(
      'href',
      'https://d2il6osz49gpup.cloudfront.net/invoices/INV-2026-0142.pdf'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the row is about 343px wide, so the split lands near 139 / 194. Both controls ' +
          'are 44px tall rather than the desktop 36 - this is the one place the record changes ' +
          'geometry rather than only layout.',
      },
    },
  },
};

export const PdfOnly: Story = {
  name: 'PDF alone takes the whole row',
  args: { appointment: undefined, onOpenAppointment: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.queryByRole('button', { name: 'Open appointment' })
    ).not.toBeInTheDocument();
    // No appointment also means no subtitle: `buildSubtitle` falls back to the invoice
    // date alone rather than dropping the line entirely.
    await expect(canvas.getByText('Aug 12, 2026')).toBeInTheDocument();

    /* The survivor is still `flex-1` in a row of one, so it stretches to the full
       width instead of staying at its 1-of-2.4 share. Compared against its own parent
       rather than a pixel count, so the assertion states the rule. */
    const pdf = canvas.getByRole('link', { name: 'Download invoice #INV-2026-0142 PDF' });
    const row = pdf.parentElement as HTMLElement;
    await expect(row.children).toHaveLength(1);
    await expect(Math.round(pdf.getBoundingClientRect().width)).toBe(
      Math.round(row.getBoundingClientRect().width)
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'An invoice with a rendered document and nothing to open. The full-width PDF pill is a ' +
          'different frame from the paired one above and worth seeing, because a lone outlined ' +
          'button across the sheet reads as the primary action even though it is styled as the ' +
          'secondary.',
      },
    },
  },
};

export const NoActions: Story = {
  name: 'No PDF, no appointment: the row is gone',
  args: {
    invoice: { ...PAID_INVOICE, pdfUrl: undefined },
    appointment: undefined,
    onOpenAppointment: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The whole row is unrendered rather than rendered empty - the guard is on the
       container, not on the two children - so the sheet ends on the finalized note
       with no dangling 10px gap under it. */
    await expect(canvas.queryByRole('link', { name: /^Download invoice/ })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Open appointment' })
    ).not.toBeInTheDocument();
    await expect(actionRow(canvasElement)).toBeNull();

    // Close is still there; it lives in the header, not in the action row.
    await expect(canvas.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // And the record is otherwise complete - this is a fully paid invoice.
    await expect(canvas.getByText('Receipt sent to sky.doe@example.com')).toBeInTheDocument();

    /* Four blocks, and the sheet ENDS on the note. The record root is a `gap-3` column,
       so a row that rendered empty would still add a fourth gap under the note and a
       fifth child here - which is exactly the difference between a guard on the
       container and a guard on its two children. */
    const record = canvasElement.querySelector('.flex.flex-col.gap-3.pb-1') as HTMLElement;
    await expect(record.children).toHaveLength(4);
    await expect(record.lastElementChild).toHaveTextContent('Receipt sent to sky.doe@example.com');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A settled counter sale whose document never rendered: nothing left to do on the sheet ' +
          'except read it and close it. The only way out is the 30px circle in the top right, ' +
          'which is the smallest tap target on the record.',
      },
    },
  },
};
