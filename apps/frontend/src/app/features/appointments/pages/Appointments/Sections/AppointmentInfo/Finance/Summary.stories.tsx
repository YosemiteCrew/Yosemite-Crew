import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Appointment, Invoice, UserOrganization } from '@yosemite-crew/types';

import {
  createEmptyFormData,
  type FormDataProps,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import Summary from './Summary';

const ORG_ID = 'org-storybook-finance';
const APPOINTMENT_ID = 'appt-finance-summary-1';

/* Dates render through `formatDateInPreferredTimeZone`, which pins the formatter to
   Europe/Berlin whenever nothing is stored under `yc_preferred_timezone` - so a Date
   built from LOCAL components would render differently on a runner in another zone.
   A UTC instant is the deterministic form: 09:30Z is 10:30 in Berlin on 12 March,
   before the DST switch. */
const APPOINTMENT_DATE = new Date('2026-03-12T09:30:00.000Z');

const buildAppointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentType: {
    id: 'type-ortho',
    name: 'Orthopaedic consult',
    speciality: { id: 'spec-ortho', name: 'Orthopaedics' },
  },
  lead: { id: 'vet-1', name: 'Dr Amelia Okafor' },
  appointmentDate: APPOINTMENT_DATE,
  startTime: APPOINTMENT_DATE,
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
  paymentStatus: 'UNPAID',
  concern: 'Limping on the left hind leg',
  ...over,
});

const buildInvoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-5001',
  organisationId: ORG_ID,
  appointmentId: APPOINTMENT_ID,
  items: [],
  subtotal: 240,
  discountTotal: 0,
  taxTotal: 18,
  totalAmount: 258,
  currency: 'EUR',
  paymentCollectionMethod: 'PAYMENT_LINK',
  status: 'PENDING',
  createdAt: new Date('2026-03-12T09:45:00.000Z'),
  updatedAt: new Date('2026-03-12T09:45:00.000Z'),
  ...over,
});

/**
 * The draft totals the bill builder holds while a visit is still being priced. Every
 * number here is deliberately different from every invoice number above, so the story
 * that has both can prove which of the two the panel is reading.
 */
const DRAFT_TOTALS: FormDataProps = {
  ...createEmptyFormData(),
  subTotal: '80',
  discount: '5',
  tax: '6',
  total: '81',
};

/**
 * A vet membership. `usePermissions` recomputes the effective set from `roleCode` against
 * the shipped role table rather than trusting any stored snapshot, and every role in that
 * table carries `billing:view:any` - so revoking it is the only honest way to build the
 * denied story.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
  revokedPermissions: revoked,
});

/**
 * Seeds the three stores this section reads, and restores all three on unmount.
 *
 * - org store: answers `usePermissions` through `membershipsByOrgId` and keys the invoice
 *   lookup through `primaryOrgId`. `status: 'loaded'` matters as much as the membership -
 *   left `idle`, `PermissionGate` reports `isLoading` and renders its skeleton, which here
 *   is `null`, so the whole section silently disappears.
 * - invoice store: `useInvoicesForPrimaryOrgAppointment` reads `invoiceIdsByOrgId` then
 *   filters by appointment id, so both maps have to agree.
 * - subscription store: the only source of the billing currency. Seeded to EUR precisely
 *   because it is not the `'USD'` fallback - a panel that hardcoded a dollar sign would
 *   still pass a story seeded with USD.
 */
const seed =
  ({
    invoices = [buildInvoice()],
    revoked = [],
  }: { invoices?: Invoice[]; revoked?: string[] } = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const invoiceSnapshot = useInvoiceStore.getState();
    const subscriptionSnapshot = useSubscriptionStore.getState();

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    useInvoiceStore.setState({
      invoicesById: Object.fromEntries(invoices.map((invoice) => [String(invoice.id), invoice])),
      invoiceIdsByOrgId: { [ORG_ID]: invoices.map((invoice) => String(invoice.id)) },
      status: 'loaded',
    });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'EUR' } },
      status: 'loaded',
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useInvoiceStore.setState(invoiceSnapshot);
      useSubscriptionStore.setState(subscriptionSnapshot);
    };
  };

/** The Accordion root: header row > title button, so two levels up from the button. */
const accordionFor = (canvas: ReturnType<typeof within>, title: string): HTMLElement =>
  canvas.getByRole('button', { name: title }).parentElement?.parentElement as HTMLElement;

/** The bordered Pay card: the "Pay" heading sits in the row that heads it. */
const payPanel = (canvas: ReturnType<typeof within>): HTMLElement =>
  canvas.getByText('Pay').parentElement?.parentElement as HTMLElement;

/**
 * The value rendered beside a label, read as the label's next sibling rather than by
 * searching for the value text. Label and value are separate divs in a `justify-between`
 * row, so a swapped pair, a value landing in the wrong row, or a row losing its value
 * entirely all read as "the text is somewhere on screen" to a plain text query.
 */
const rowValue = (scope: HTMLElement, label: string): string =>
  within(scope).getByText(label).nextElementSibling?.textContent?.trim() ?? '';

const CASH_REFUND_DISCLAIMER =
  'This appointment was paid in cash and is now cancelled. Any refund, if applicable, ' +
  'should be handled directly by the service provider.';

const meta = {
  title: 'Appointments/Finance/Summary',
  component: Summary,
  parameters: {
    layout: 'padded',
    // `Fallback` renders PermissionDeniedState, which calls `useRouter` at render time
    // for its request-access route - without the app router the denied story throws.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The top of the appointment Finance tab: the appointment details accordion, then ' +
          'the bordered Pay card with the totals and the payment actions.\n\n' +
          'The Pay card is not a view of the props it is given. It resolves **one** invoice ' +
          'to act on - the newest of `PENDING` / `AWAITING_PAYMENT`, falling back to the ' +
          'newest invoice of any status - and once it has one, that invoice replaces the ' +
          'draft totals in `formData` outright. So the same `formData` renders different ' +
          'numbers depending on what is in the invoice store, and the invoice that supplies ' +
          'them is not necessarily the latest one. Both halves of that have a story below.\n\n' +
          'Amounts are formatted against the organisation subscription currency, not the ' +
          "invoice's own `currency` field and not a hardcoded dollar; every story seeds EUR " +
          'to keep that honest. The whole section sits behind a `billing:view:any` gate whose ' +
          'fallback is the inline permission notice.',
      },
    },
  },
  tags: ['autodocs'],
  args: { activeAppointment: buildAppointment(), formData: DRAFT_TOTALS },
  beforeEach: seed(),
} satisfies Meta<typeof Summary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PayableInvoice: Story = {
  name: 'Payable invoice',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = payPanel(canvas);

    // The invoice wins over formData. Seeded draft totals are 80/5/6/81, so every row
    // below would read the other set if the useMemo fell through to `formData`.
    await expect(rowValue(panel, 'Subtotal:')).toBe('€240');
    await expect(rowValue(panel, 'Discount:')).toBe('€0');
    await expect(rowValue(panel, 'Tax:')).toBe('€18');
    await expect(rowValue(panel, 'Estimated total:')).toBe('€258');
    // The org subscription currency, not the '$' fallback.
    await expect(panel.textContent).not.toContain('$');

    await expect(rowValue(panel, 'Payment method:')).toBe('Online payment');
    await expect(rowValue(panel, 'Status:')).toBe('Pending');
    await expect(panel.textContent).not.toContain('PAYMENT_LINK');

    // The full control set of the section. The accordion is an EditableAccordion, but it
    // is rendered with `showEditIcon` false and no `onSave`, so there is no pencil and no
    // Save/Cancel pair - the details are read-only here however editable the primitive is.
    await expect(canvas.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
      'Appointments details',
      'Pay in cash',
      'Generate & Mail link',
    ]);

    const details = accordionFor(canvas, 'Appointments details');
    await expect(rowValue(details, 'Service')).toBe('Orthopaedic consult');
    await expect(rowValue(details, 'Reason')).toBe('Limping on the left hind leg');
    await expect(rowValue(details, 'Date')).toBe('Mar 12, 2026');
    await expect(rowValue(details, 'Time')).toBe('10:30 AM');
    await expect(rowValue(details, 'Lead')).toBe('Dr Amelia Okafor');
    // The status option label, not the stored enum.
    await expect(rowValue(details, 'Status')).toBe('In progress');
    await expect(details.textContent).not.toContain('IN_PROGRESS');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday state: one unsettled invoice, so the Pay card shows its amounts, its ' +
          'method and its status, and offers both ways to collect. The details accordion ' +
          'above renders every field as a read row.',
      },
    },
  },
};

export const NoInvoiceYet: Story = {
  name: 'No invoice yet - draft totals',
  /* No appointment id, deliberately. `useInvoicesForPrimaryOrgAppointment` fires a real
     finance read whenever the filtered list comes back empty, and Storybook has no API to
     answer it; an id-less appointment takes the hook's early return instead and renders
     the identical no-invoice branch offline. */
  args: { activeAppointment: buildAppointment({ id: undefined }) },
  beforeEach: seed({ invoices: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = payPanel(canvas);

    // With no invoice the panel falls back to the bill builder's draft, run through
    // `toNumberSafe` - so these are the strings from formData, formatted as money.
    await expect(rowValue(panel, 'Subtotal:')).toBe('€80');
    await expect(rowValue(panel, 'Discount:')).toBe('€5');
    await expect(rowValue(panel, 'Tax:')).toBe('€6');
    await expect(rowValue(panel, 'Estimated total:')).toBe('€81');

    // Method and status are invoice-only rows and must not render a dash placeholder.
    await expect(within(panel).queryByText('Payment method:')).toBeNull();
    await expect(within(panel).queryByText('Status:')).toBeNull();

    // The actions still render, and are inert: there is no invoice id to act on. Present
    // but disabled is the shipped behaviour, and it is exactly the pair that would break
    // silently if the guard moved from `isDisabled` to a conditional render.
    await expect(canvas.getByRole('button', { name: 'Pay in cash' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Generate & Mail link' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An appointment still being priced. `totals` reads `formData` instead of an ' +
          'invoice, which is why the card is headed "Estimated total" rather than a due ' +
          'amount, and both collect actions are disabled until an invoice exists.',
      },
    },
  },
};

export const PayableIsNotTheLatest: Story = {
  name: 'Payable invoice is not the latest one',
  beforeEach: seed({
    invoices: [
      buildInvoice({
        id: 'inv-5001',
        status: 'PAID',
        totalAmount: 258,
        createdAt: new Date('2026-03-14T08:00:00.000Z'),
        paidAt: new Date('2026-03-14T08:05:00.000Z'),
      }),
      buildInvoice({
        id: 'inv-5002',
        status: 'AWAITING_PAYMENT',
        subtotal: 60,
        taxTotal: 5,
        totalAmount: 65,
        createdAt: new Date('2026-03-12T09:45:00.000Z'),
      }),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = payPanel(canvas);

    /* `payableInvoice ?? latestInvoice`: the PAID invoice is newer, so a resolver that only
       sorted by date would show €258 and a Paid pill, and the money still owed would
       disappear from the tab. The unsettled one has to win. */
    await expect(rowValue(panel, 'Status:')).toBe('Awaiting payment');
    await expect(rowValue(panel, 'Estimated total:')).toBe('€65');
    await expect(panel.textContent).not.toContain('€258');

    await expect(canvas.getByRole('button', { name: 'Pay in cash' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Generate & Mail link' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A re-invoiced appointment where the newest invoice is already settled and an older ' +
          'one is still owed. The card resolves the payable invoice first and only falls back ' +
          'to the newest when nothing is payable, so the outstanding amount stays on screen.',
      },
    },
  },
};

export const SettledInvoice: Story = {
  name: 'Settled invoice with a receipt',
  beforeEach: seed({
    invoices: [
      buildInvoice({
        status: 'PAID',
        paidAt: new Date('2026-03-12T11:05:00.000Z'),
        stripeReceiptUrl: 'https://example.invalid/receipt/inv-5001',
      }),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = payPanel(canvas);

    await expect(rowValue(panel, 'Status:')).toBe('Paid');
    await expect(rowValue(panel, 'Estimated total:')).toBe('€258');

    // The receipt branch short-circuits the action row: one Download pill, and nothing
    // that could take the money a second time.
    await expect(canvas.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
      'Appointments details',
      'Download',
    ]);
    await expect(canvas.queryByText(CASH_REFUND_DISCLAIMER)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Paid through Stripe. The totals still read off the invoice - the card does not ' +
          'clear once settled - and the only action left is the receipt.',
      },
    },
  },
};

export const CancelledPaidInCash: Story = {
  name: 'Cancelled after a cash payment',
  args: { activeAppointment: buildAppointment({ status: 'CANCELLED' }) },
  beforeEach: seed({
    invoices: [
      buildInvoice({
        status: 'PAID',
        paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
        paidAt: new Date('2026-03-12T11:05:00.000Z'),
      }),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = payPanel(canvas);
    const disclaimer = canvas.getByText(CASH_REFUND_DISCLAIMER);

    // Inside the Pay card, not floating above the section - it is an answer to "how do I
    // refund this", so it belongs next to the payment rows it is talking about.
    await expect(panel.contains(disclaimer)).toBe(true);

    await expect(rowValue(panel, 'Payment method:')).toBe('In-person payment');
    await expect(rowValue(panel, 'Status:')).toBe('Paid');
    // Settled, so no action row at all: nothing here can take a payment, and nothing here
    // can issue the refund the notice is telling the reader to handle by hand.
    await expect(canvas.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
      'Appointments details',
    ]);
    // The appointment status reaches the accordion as a label, not as the raw enum.
    await expect(rowValue(accordionFor(canvas, 'Appointments details'), 'Status')).toBe(
      'Cancelled'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The refund disclaimer, reached through the invoice: `PAYMENT_AT_CLINIC` plus a ' +
          'settled status on a cancelled appointment.\n\n' +
          'The other trigger the code checks - `paymentStatus === PAID_CASH` on the ' +
          'appointment - cannot be built from the shipped types: `AppointmentPaymentStatus` ' +
          "is `'PAID' | 'UNPAID'`, so that comparison is dead against a correctly typed " +
          'appointment and only the invoice path can raise the notice.',
      },
    },
  },
};

export const NoBillingViewPermission: Story = {
  name: 'Without billing:view:any',
  beforeEach: seed({ revoked: ['billing:view:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The notice names the real role off the membership, so a broken role lookup shows
    // "your current role" here and nobody can tell who to ask for access.
    await expect(
      canvas.getByText("Your role (Veterinarian) can't view this section.")
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Request access' })).toBeEnabled();

    // The gate wraps the whole section, accordion included - not just the amounts.
    await expect(canvas.queryByRole('button', { name: 'Appointments details' })).toBeNull();
    await expect(canvas.queryByText('Pay')).toBeNull();
    await expect(canvasElement.textContent).not.toContain('€258');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A membership with `billing:view:any` revoked, with a payable invoice sitting in ' +
          'the store the whole time. The fallback is the compact inline notice rather than ' +
          'the full centered card, because this is a panel inside a tab and not a whole route.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = payPanel(canvas);

    /* The Pay header pairs a label with a fixed 120px Stripe lockup, and every row below is
       `justify-between` with a right-aligned value. At 375px that either fits or pushes the
       card sideways; the tab scrolls vertically only, so an overflowing row is clipped
       rather than reachable. */
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    await expect(canvas.getByAltText('Powered by stripe')).toBeVisible();
    await expect(rowValue(panel, 'Estimated total:')).toBe('€258');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same payable invoice at 375px, where the Pay header has the least room to fit ' +
          'its label beside the Stripe lockup.',
      },
    },
  },
};
