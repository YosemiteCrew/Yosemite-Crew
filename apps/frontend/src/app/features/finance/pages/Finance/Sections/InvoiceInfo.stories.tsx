import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';

import type { StoredParent } from '@/app/features/companions/pages/Companions/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import InvoiceInfo from './InvoiceInfo';

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

const PARENT: StoredParent = {
  id: PARENT_ID,
  firstName: 'Sky',
  lastName: 'Doe',
  email: 'sky.doe@example.com',
  phoneNumber: '+44 7700 900142',
  address: {
    addressLine: '14 Fell Lane',
    city: 'Keswick',
    postalCode: 'CA12 4DP',
    country: 'GB',
  },
  createdFrom: 'pms',
};

/**
 * Every value the drawer shows beyond `activeInvoice` is read out of a plain
 * Zustand store - the appointment from `appointmentStore`, the payer from
 * `parentStore`, the currency from `subscriptionStore` via `orgStore`. None of
 * those hooks fetches on read, so seeding them is the whole of the setup and the
 * drawer under review is the real one, with no service stubbed.
 */
const seedStores = (parent: StoredParent | null = PARENT) => {
  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, [APPOINTMENT]);
  useParentStore.getState().setParents(parent ? [parent] : []);
};

/**
 * `formatMoney` runs at `maximumFractionDigits: 0`, so every figure below is a
 * whole number on purpose - a 92.65 total would print as "$93" and make the
 * assertions read as though the arithmetic were wrong.
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
  stripeReceiptUrl: 'https://pay.stripe.com/receipts/example',
  paidAt: new Date('2026-08-12T10:15:00.000Z'),
  createdAt: new Date('2026-08-12T10:02:00.000Z'),
  updatedAt: new Date('2026-08-12T10:15:00.000Z'),
};

/**
 * The panel portals to `document.body`, so none of it is inside `canvasElement`,
 * and a closed dialog stays MOUNTED without its `open` attribute - absence has to
 * be asserted against `dialog[open]`, never against the text.
 */
const openDrawer = (): HTMLElement => {
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) throw new Error('No open dialog on document.body.');
  return dialog as HTMLElement;
};

const section = (dialog: HTMLElement, label: string): HTMLElement | null =>
  dialog.querySelector(`section[aria-label="${label}"]`);

/** Resolved grid tracks, rounded to whole pixels so subpixel noise cannot fail a match. */
const tracks = (el: HTMLElement): number[] =>
  getComputedStyle(el)
    .gridTemplateColumns.trim()
    .split(/\s+/)
    .map((track) => Math.round(Number.parseFloat(track)));

/**
 * Every billed-items row, header band excluded. Both carry the same four-track
 * template as separate inline styles, so they are compared rather than trusted.
 */
const itemRows = (items: HTMLElement): HTMLElement[] =>
  [...items.querySelectorAll('.grid')].filter(
    (el) => !el.classList.contains('yc-table-head')
  ) as HTMLElement[];

/**
 * Resolves a design token to the colour the browser actually paints, so a story
 * can say "outstanding is the warn ink" rather than only "it is not the same
 * colour as the total". Throws on an unresolved token: `var(--typo)` computes to
 * transparent, which would otherwise quietly match anything else that also
 * computes to transparent and turn the assertion into a no-op.
 */
const resolveToken = (host: HTMLElement, token: string): string => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  host.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  if (value === 'rgba(0, 0, 0, 0)') {
    throw new Error(`Token ${token} resolved to transparent - it does not exist here.`);
  }
  return value;
};

/** The value span of a summary row, read off its label rather than by figure. */
const summaryValue = (summary: HTMLElement, label: string): HTMLElement => {
  const value = within(summary).getByText(label).nextElementSibling;
  if (!value) throw new Error(`Summary row "${label}" has no value beside it.`);
  return value as HTMLElement;
};

const meta = {
  title: 'Finance/InvoiceInfo',
  component: InvoiceInfo,
  parameters: {
    layout: 'fullscreen',
    // `goToAppointmentFinance` calls next/navigation's useRouter during render.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The invoice detail drawer behind every "View" in Finance - six sections assembled from ' +
          'five section components, and it had no story at all. It opens on a click, so nothing ' +
          'about it was reviewable except by driving the live app with real invoice data.\n\n' +
          'It is two entirely different records, not one responsive layout. Above 768px it is a ' +
          '`centered` Modal at `lg` (840px) holding the desktop record: header, billed-items ' +
          'table, payment ledger, summary panel and billed-to card in a two-column grid. Below ' +
          '768px `useIsPhone` swaps the whole body for `InvoicePhoneRecord` - a single stacked ' +
          'block ending in a --screen-2 tax row and a big total - and the Modal itself re-forms ' +
          'into a bottom sheet with a grabber. The phone story is the only place that record is ' +
          'ever drawn.\n\n' +
          'Three things are conditional and easy to miss. The **payment ledger renders only for a ' +
          'settled invoice** (`PAID`/`REFUNDED`, or any invoice carrying `paidAt`), so an ' +
          'awaiting-payment invoice is a shorter panel rather than one with an empty ledger. ' +
          '**Outstanding is tinted** - `--warn-text` while money is owed, `--success-text` at ' +
          'zero, and the stories resolve those tokens rather than compare the two figures to each ' +
          'other. And the **billed-items grid is a CSS grid pretending to be a table**: the header ' +
          'band and every row carry the same four-track template as an inline style, with nothing ' +
          'enforcing that they agree.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeInvoice: PAID_INVOICE,
  },
  beforeEach: () => {
    seedStores();
  },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--screen)] p-6">
        <p className="text-[13px] text-[var(--ink-muted)]">
          The Finance table sits behind the scrim, so the backdrop blur and tint are visible.
        </p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paid: Story = {
  name: 'Paid invoice',
  play: async ({ canvasElement }) => {
    const dialog = await waitFor(openDrawer);
    const panel = within(dialog);

    // The header takes the number from metadata, not from the opaque id.
    await expect(panel.getByRole('heading', { name: '#INV-2026-0142' })).toBeInTheDocument();
    await expect(panel.getByText('Paid')).toBeInTheDocument();

    /* The two-column split is keyed on the VIEWPORT (`lg:` = 1024px), not on the
       840px panel it lives in - so it collapses to one column in a narrow window
       while the panel itself is unchanged. Reading the track count is the only
       way to tell which of the two a screenshot is showing, and the child count
       is what says both columns were actually filled. */
    const items = section(dialog, 'Billed items') as HTMLElement;
    const split = items.closest('.grid') as HTMLElement;
    await expect(tracks(split)).toHaveLength(2);
    await expect(split.children).toHaveLength(2);

    /* Header band and rows carry the same four-track template as separate inline
       styles. Nothing keeps them in step, and a drifted header does not break -
       it just stops sitting above its own column, which is invisible in code
       review and obvious here. */
    const head = items.querySelector('.yc-table-head') as HTMLElement;
    const rows = itemRows(items);
    await expect(head.children).toHaveLength(4);
    await expect(rows).toHaveLength(2);
    await expect(tracks(head)).toHaveLength(4);
    await expect(tracks(rows[0])).toEqual(tracks(head));
    await expect(tracks(rows[1])).toEqual(tracks(head));

    /* Four cells per row, in the header's order: name, qty, gross, amount. The
       row only reads correctly if the cell count matches the track count - a
       missing cell shifts every figure one column left under the wrong heading. */
    for (const row of rows) {
      await expect(row.children).toHaveLength(4);
    }
    await expect(rows[0].children[0]).toHaveTextContent('Dental consultation');
    await expect(rows[0].children[3]).toHaveTextContent('$60');
    await expect(rows[1].children[0]).toHaveTextContent('Scale and polish');
    await expect(rows[1].children[3]).toHaveTextContent('$45');

    // Summary arithmetic, in full: subtotal - discount + tax = total.
    const summarySection = section(dialog, 'Invoice summary') as HTMLElement;
    const summary = within(summarySection);
    await expect(summaryValue(summarySection, 'Subtotal')).toHaveTextContent('$105');
    await expect(summaryValue(summarySection, 'Discount')).toHaveTextContent('$10');
    // The tax row takes the percent into its label when the invoice carries one.
    await expect(summary.getByText('Tax · 20%')).toBeInTheDocument();
    await expect(summaryValue(summarySection, 'Tax · 20%')).toHaveTextContent('$19');

    /* Every summary row is a label span followed by its value span, so the value
       is read off the label rather than by searching for the figure - which would
       silently pass by matching the same amount printed in the ledger. */
    const total = summaryValue(summarySection, 'Total');
    const outstanding = summaryValue(summarySection, 'Outstanding');
    await expect(total).toHaveTextContent('$114');

    /* Settled, so outstanding is zero AND carries the success ink rather than the
       warn ink. The zero alone would pass with the tint broken, and "different
       from the total" would pass on any colour at all, so both are resolved
       against their tokens - inside waitFor, because the panel fades in. */
    await expect(outstanding).toHaveTextContent('$0');
    await waitFor(() => {
      expect(getComputedStyle(outstanding).color).toBe(resolveToken(dialog, '--success-text'));
      expect(getComputedStyle(total).color).toBe(resolveToken(dialog, '--ink'));
    });

    // The ledger names the channel rather than saying "payment recorded".
    const paymentsSection = section(dialog, 'Payments') as HTMLElement;
    const payments = within(paymentsSection);
    await expect(payments.getByText('Paid in the pet-parent app')).toBeInTheDocument();
    await expect(payments.getByText('$114')).toBeInTheDocument();
    await expect(payments.getByRole('link', { name: 'Receipt' })).toBeInTheDocument();

    /* And NO "Receipt sent to ..." line, even though a payer email is on file.
       It was removed in #2609 because it was never evidence of anything: nothing
       in the product emails an invoice receipt, `receipt_email` is never set on
       the PaymentIntent, and the invoice carries no delivery state - so it also
       appeared for cash and pay-at-clinic settlements, where no receipt exists
       at all. The Stripe link asserted above is the real signal. This story kept
       asserting the deleted line; it now asserts the decision, as the
       awaiting-payment story below already does. */
    await expect(panel.queryByText(/^Receipt sent to /)).not.toBeInTheDocument();

    // Billed-to is composed from the stored parent, not from the appointment.
    const billedTo = within(section(dialog, 'Billed to') as HTMLElement);
    await expect(billedTo.getByText('Sky Doe')).toBeInTheDocument();
    await expect(billedTo.getByText('14 Fell Lane, CA12 4DP Keswick')).toBeInTheDocument();
    await expect(billedTo.getByText('sky.doe@example.com · +44 7700 900142')).toBeInTheDocument();

    // Nothing the drawer renders is inside the story root; this is the proof.
    await expect(within(canvasElement).queryByText('#INV-2026-0142')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The complete desktop record: a settled invoice with two lines, a discount, tax at 20% ' +
          'and a Stripe receipt. This is the only state in which all six sections render at once, ' +
          'so it is the layout reference for the rest.',
      },
    },
  },
};

export const AwaitingPayment: Story = {
  name: 'Awaiting payment (no ledger)',
  args: {
    activeInvoice: {
      ...PAID_INVOICE,
      metadata: { invoiceNumber: 'INV-2026-0163' },
      status: 'AWAITING_PAYMENT',
      paymentCollectionMethod: 'PAYMENT_LINK',
      paidAt: undefined,
      stripeReceiptUrl: undefined,
    },
  },
  play: async () => {
    const dialog = await waitFor(openDrawer);
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { name: '#INV-2026-0163' })).toBeInTheDocument();
    await expect(panel.getByText('Awaiting payment')).toBeInTheDocument();

    /* `InvoicePaymentLedger` returns null outright for an unsettled invoice, so
       the whole section is absent rather than empty - and with it the "Receipt
       sent to ..." confirmation, which would otherwise claim a receipt exists. */
    await expect(section(dialog, 'Payments')).toBeNull();
    await expect(panel.queryByText(/^Receipt sent to /)).not.toBeInTheDocument();

    /* Outstanding is the full total here and carries the warn ink, which is the
       single strongest signal in the panel that money is owed. Same figure in
       both rows, so only the resolved token separates them. */
    const summarySection = section(dialog, 'Invoice summary') as HTMLElement;
    const total = summaryValue(summarySection, 'Total');
    const outstanding = summaryValue(summarySection, 'Outstanding');
    await expect(outstanding).toHaveTextContent('$114');
    await expect(total).toHaveTextContent('$114');
    await waitFor(() => {
      expect(getComputedStyle(outstanding).color).toBe(resolveToken(dialog, '--warn-text'));
      expect(getComputedStyle(total).color).toBe(resolveToken(dialog, '--ink'));
    });

    /* Everything else is unchanged - the panel is SHORTER, not different. Both
       remaining sections are checked by their content rather than by existing,
       because a section that renders empty would still be non-null. */
    const items = section(dialog, 'Billed items') as HTMLElement;
    const head = items.querySelector('.yc-table-head') as HTMLElement;
    const rows = itemRows(items);
    await expect(rows).toHaveLength(2);
    await expect(tracks(rows[0])).toEqual(tracks(head));
    await expect(rows[0].children[0]).toHaveTextContent('Dental consultation');
    const billedTo = within(section(dialog, 'Billed to') as HTMLElement);
    await expect(billedTo.getByText('Sky Doe')).toBeInTheDocument();
    await expect(billedTo.getByText('sky.doe@example.com · +44 7700 900142')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state most invoices are in for their first hours. Worth putting beside the paid ' +
          'story: the panel loses a whole section rather than showing an empty one, which is why ' +
          'the summary and billed-to cards move up rather than the layout leaving a gap.',
      },
    },
  },
};

export const PaidAtClinic: Story = {
  name: 'Paid at the clinic',
  args: {
    activeInvoice: {
      ...PAID_INVOICE,
      metadata: { invoiceNumber: 'INV-2026-0171' },
      paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
      stripeReceiptUrl: undefined,
    },
  },
  play: async () => {
    const dialog = await waitFor(openDrawer);
    const payments = within(section(dialog, 'Payments') as HTMLElement);

    /* The channel is derived from `paymentCollectionMethod`, and it changes the
       glyph as well as the title - an over-the-counter payment must not read as
       though the client paid in the pet-parent app. */
    await expect(payments.getByText('Paid at the clinic')).toBeInTheDocument();
    await expect(payments.queryByText('Paid in the pet-parent app')).not.toBeInTheDocument();
    // No Stripe receipt for a desk payment, so the link is absent, not disabled.
    await expect(payments.queryByRole('link', { name: 'Receipt' })).not.toBeInTheDocument();
    // The row still closes with the amount; only the receipt link went.
    await expect(payments.getByText('$114')).toBeInTheDocument();
    /* The caption names the method and the payer. Matched at its two ends rather
       than in full, because the timestamp between them renders in the viewer's
       timezone and would differ between machines. */
    await expect(payments.getByTitle(/^In-person payment · /)).toBeInTheDocument();
    await expect(payments.getByTitle(/ · by Sky Doe$/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same settled invoice taken at the desk. `getLedgerChannel` is shared with the phone ' +
          'record, so this title and glyph are what a client sees at every width.',
      },
    },
  },
};

export const NoItemsNoContact: Story = {
  name: 'Unlinked, no items, no contact',
  args: {
    activeInvoice: {
      ...PAID_INVOICE,
      metadata: { invoiceNumber: 'INV-2026-0009' },
      appointmentId: undefined,
      parentId: undefined,
      items: [],
      subtotal: 0,
      discountTotal: 0,
      taxPercent: undefined,
      taxTotal: 0,
      totalAmount: 0,
    },
  },
  beforeEach: () => {
    seedStores(null);
  },
  play: async () => {
    const dialog = await waitFor(openDrawer);
    const panel = within(dialog);

    /* The header band still renders above the empty state, with its full
       four-track template - so the panel keeps its column structure instead of
       collapsing to a bare sentence - and there are no rows under it at all,
       which is what separates "no items" from "a row of blanks". */
    const items = section(dialog, 'Billed items') as HTMLElement;
    const head = items.querySelector('.yc-table-head') as HTMLElement;
    await expect(head.children).toHaveLength(4);
    await expect(tracks(head)).toHaveLength(4);
    await expect(itemRows(items)).toHaveLength(0);
    await expect(panel.getByText('No billed items recorded for this invoice.')).toBeInTheDocument();

    // No stored parent and no appointment to fall back to.
    await expect(panel.getByText('No billing contact on file.')).toBeInTheDocument();

    /* With no appointment there is no companion, no subtitle and no route to
       open - so the header action disappears rather than pushing a dead link. */
    await expect(panel.queryByRole('button', { name: 'Open appointment' })).not.toBeInTheDocument();

    // The tax row loses its percent suffix when the invoice carries none.
    const summarySection = section(dialog, 'Invoice summary') as HTMLElement;
    await expect(within(summarySection).getByText('Tax')).toBeInTheDocument();

    /* A zero invoice still prints figures rather than dashes, and nothing is
       owed on it - so Outstanding takes the success ink even though no money
       ever moved. That is the one place the tint is not a payment signal. */
    const total = summaryValue(summarySection, 'Total');
    const outstanding = summaryValue(summarySection, 'Outstanding');
    await expect(total.textContent).toBe('$0');
    await expect(outstanding.textContent).toBe('$0');
    await waitFor(() => {
      expect(getComputedStyle(outstanding).color).toBe(resolveToken(dialog, '--success-text'));
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'An over-the-counter sale with nothing attached: no appointment, no stored parent and no ' +
          'lines. Three separate fallbacks fire at once, and each one is prose rather than a dash, ' +
          'because a dash in a billing document reads as a zero.',
      },
    },
  },
};

export const OpensAppointment: Story = {
  name: 'Open appointment closes the drawer',
  play: async ({ args }) => {
    const dialog = await waitFor(openDrawer);
    const panel = within(dialog);

    /* The button only exists because the invoice resolved to a real appointment,
       and the header meta is the visible proof of that resolution: companion,
       owner surname, service, date. Without it, a passing click assertion would
       not tell you WHICH appointment the drawer thinks it is on. */
    await expect(panel.getByText(/^Kizie · Doe · Dental consultation · /)).toBeInTheDocument();

    const open = panel.getByRole('button', { name: 'Open appointment' });
    await expect(args.setShowModal).not.toHaveBeenCalled();

    await userEvent.click(open);

    /* The handler pushes `/appointments?...&open=finance&subLabel=summary` and
       then closes the drawer, in that order. The route is Storybook's mocked
       router, so the close is the observable half - and it matters: leaving the
       drawer open would strand a modal over the appointment workspace. Once,
       not twice: a second call would mean the click was double-handled. */
    await waitFor(() => {
      expect(args.setShowModal).toHaveBeenCalledWith(false);
    });
    await expect(args.setShowModal).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one navigation the drawer owns. It is a real `<button>` rather than a link because ' +
          'it has to close the drawer as well as route, and the query it builds is what makes the ' +
          'appointment workspace land on the Finance step rather than at the top.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the record becomes a sheet',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert - a story using it renders the 1280px desktop
  // record under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    const dialog = await waitFor(openDrawer);
    const panel = within(dialog);

    /* `useIsPhone` is false during SSR and the first client render, so both the
       sheet chrome and the phone record are post-mount swaps - poll for them
       rather than reading once. */
    await waitFor(() => {
      expect(dialog.className).toContain('yc-phone-sheet');
    });

    /* The grabber is measured, not merely found. Its geometry lives inside the
       `max-width: 767px` block in Sheet.css, so a 44x5 pill is proof that the
       phone rules actually applied - a class name in the DOM would still be
       there with the viewport pin inert and the sheet CSS never matching. */
    const grabber = dialog.querySelector('.yc-phone-sheet-grabber') as HTMLElement;
    await expect(grabber).not.toBeNull();
    const grabberStyle = getComputedStyle(grabber);
    await expect(grabberStyle.width).toBe('44px');
    await expect(grabberStyle.height).toBe('5px');
    // The sheet spans the viewport, and the viewport really is phone-sized.
    const viewportWidth = document.documentElement.clientWidth;
    await expect(viewportWidth).toBeLessThanOrEqual(430);
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(viewportWidth);

    /* A different record, not a reflow: every desktop section is gone, including
       the ones whose text survives, so asserting on the section landmarks rather
       than on words is what actually proves the swap. */
    await expect(section(dialog, 'Billed items')).toBeNull();
    await expect(section(dialog, 'Invoice summary')).toBeNull();
    await expect(section(dialog, 'Billed to')).toBeNull();

    // The stacked block: both lines, the tax row, and the big total.
    await expect(panel.getByRole('heading', { name: '#INV-2026-0142' })).toBeInTheDocument();
    await expect(panel.getByText('Dental consultation')).toBeInTheDocument();
    await expect(panel.getByText('Scale and polish')).toBeInTheDocument();
    // The phone record breaks the discount out as its own signed row.
    await expect(panel.getByText('-$10')).toBeInTheDocument();
    await expect(panel.getByText('Tax 20%')).toBeInTheDocument();
    /* Once, not twice: unlike the desktop ledger, the phone payment row prints no
       amount at all - the total above it is the only figure on the sheet. */
    await expect(panel.getAllByText('$114')).toHaveLength(1);
    await expect(panel.getByText('Total').nextElementSibling).toHaveTextContent('$114');
    // The phone ledger still names the channel, it just drops the amount.
    await expect(panel.getByText('Paid in the pet-parent app')).toBeInTheDocument();

    // Two full-width actions, per the phone sheet rule.
    await expect(panel.getByRole('button', { name: 'Open appointment' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px `InvoiceInfo` renders `InvoicePhoneRecord` instead of the desktop record, and ' +
          'the Modal re-forms into a bottom sheet with a grabber. Two details only exist here: the ' +
          'discount gets its own signed row on a --screen-2 band, and the tax label drops the ' +
          'middle dot ("Tax 20%", not "Tax · 20%").',
      },
    },
  },
};
