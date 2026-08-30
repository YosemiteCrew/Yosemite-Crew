import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Appointment, Invoice, UserOrganization } from '@yosemite-crew/types';

import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import Details from './Details';

const ORG_ID = 'org-storybook-finance';
const APPOINTMENT_ID = 'appt-finance-details-1';

/* Every displayed date goes through `formatDateInPreferredTimeZone`, which pins the
   formatter to Europe/Berlin whenever nothing is stored under `yc_preferred_timezone`
   - so unlike a calendar fixture, a Date built from LOCAL components here would render
   differently on a runner in another zone. A UTC instant is the deterministic form:
   09:30Z is 10:30 in Berlin on 12 March, before the DST switch. */
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
  appointmentDate: APPOINTMENT_DATE,
  startTime: APPOINTMENT_DATE,
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
  paymentStatus: 'UNPAID',
  ...over,
});

const buildInvoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-4001',
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
 * A vet membership. `usePermissions` recomputes the effective set from `roleCode`
 * against the shipped role table rather than trusting any stored snapshot, and every
 * role in that table carries `billing:view:any` - so revoking it is the only honest
 * way to build the denied story.
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
 * - org store: answers `usePermissions` through `membershipsByOrgId`, and keys the
 *   invoice lookup through `primaryOrgId`. `status: 'loaded'` matters as much as the
 *   membership - left `idle`, `PermissionGate` reports `isLoading` and renders its
 *   skeleton, which here is `null`, so the whole section silently disappears.
 * - invoice store: `useInvoicesForPrimaryOrgAppointment` reads `invoiceIdsByOrgId`
 *   then filters by appointment id, so both maps have to agree.
 * - subscription store: the only source of the billing currency. Seeded to EUR
 *   precisely because it is not the `'USD'` fallback - a component that hardcoded a
 *   dollar sign would still pass a story seeded with USD.
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
  title: 'Appointments/Finance/Details',
  component: Details,
  parameters: {
    layout: 'padded',
    // `Fallback` renders PermissionDeniedState, which calls `useRouter` at render time
    // for its request-access route - without the app router the denied story throws.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The invoice list in the appointment Finance tab: one always-open accordion per ' +
          'invoice, each ending in the shared payment action row.\n\n' +
          'Three things here are decided by code rather than by the data passed in. The ' +
          'section is wrapped in a `PermissionGate` on `billing:view:any` whose fallback is ' +
          'the inline permission notice, so a role without it gets a sentence rather than an ' +
          'empty tab. Amounts are formatted against the **organisation subscription ' +
          "currency**, not the invoice's own `currency` field and not a hardcoded dollar - " +
          'every story below seeds EUR to keep that honest. And a cancelled appointment ' +
          'settled in cash raises a refund disclaimer above the list, because a cash refund ' +
          'cannot be issued through Stripe and has to be handled by the practice.\n\n' +
          'The disclaimer has two triggers: `paymentStatus === PAID_CASH` on the appointment, ' +
          'or any invoice collected via `PAYMENT_AT_CLINIC` that is settled. Only the second ' +
          'is reachable from the shipped types - see the story below.',
      },
    },
  },
  tags: ['autodocs'],
  args: { activeAppointment: buildAppointment() },
  beforeEach: seed(),
} satisfies Meta<typeof Details>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingInvoice: Story = {
  name: 'One pending invoice',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const invoice = accordionFor(canvas, 'Invoice 1');

    // Every row read by position, so a value drifting into the neighbouring row fails.
    await expect(rowValue(invoice, 'Appointment ID:')).toBe(APPOINTMENT_ID);
    await expect(rowValue(invoice, 'Date:')).toBe('Mar 12, 2026');
    await expect(rowValue(invoice, 'Subtotal:')).toBe('€240');
    await expect(rowValue(invoice, 'Discount:')).toBe('€0');
    await expect(rowValue(invoice, 'Tax:')).toBe('€18');
    await expect(rowValue(invoice, 'Amount:')).toBe('€258');
    // The org subscription currency, not the '$' fallback and not the invoice's own field.
    await expect(invoice.textContent).not.toContain('$');

    // SCREAMING_CASE never reaches the pill, and PAYMENT_LINK is spelled for humans.
    await expect(rowValue(invoice, 'Status:')).toBe('Pending');
    await expect(rowValue(invoice, 'Payment method:')).toBe('Online payment');
    await expect(invoice.textContent).not.toContain('PENDING');
    await expect(invoice.textContent).not.toContain('PAYMENT_LINK');

    // The action row in full: a third action appearing here would slip past two
    // named getByRole calls without changing either of them.
    await expect(
      within(invoice)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
    ).toEqual(['Invoice 1', 'Pay in cash', 'Generate & Mail link']);
    await expect(canvas.queryByText(CASH_REFUND_DISCLAIMER)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state: an unsettled invoice opened by default, with the cash and ' +
          'payment-link actions underneath. The accordion is rendered with `isEditing` forced ' +
          'true and `showEditIcon` false, so the header carries no edit affordance - the only ' +
          'control on it is the disclosure itself.',
      },
    },
  },
};

export const PaidInvoice: Story = {
  name: 'Paid invoice with a receipt',
  beforeEach: seed({
    invoices: [
      buildInvoice({
        status: 'PAID',
        paidAt: new Date('2026-03-12T11:05:00.000Z'),
        stripeReceiptUrl: 'https://example.invalid/receipt/inv-4001',
      }),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const invoice = accordionFor(canvas, 'Invoice 1');

    await expect(rowValue(invoice, 'Status:')).toBe('Paid');
    await expect(rowValue(invoice, 'Amount:')).toBe('€258');
    // The receipt branch short-circuits the action row, so Download is the whole of it.
    await expect(
      within(invoice)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
    ).toEqual(['Invoice 1', 'Download']);
    // A settled invoice must not still offer to take the money again.
    await expect(within(invoice).queryByRole('button', { name: 'Pay in cash' })).toBeNull();
    await expect(canvas.queryByText(CASH_REFUND_DISCLAIMER)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Once Stripe has issued a receipt the action row collapses to a single Download ' +
          'pill. Nothing about the invoice rows changes - only the actions do, which is why ' +
          'the status pill is asserted alongside them.',
      },
    },
  },
};

export const TwoInvoices: Story = {
  name: 'Two invoices on one appointment',
  beforeEach: seed({
    invoices: [
      buildInvoice({ id: 'inv-4001', totalAmount: 258, status: 'PAID' }),
      buildInvoice({
        id: 'inv-4002',
        subtotal: 60,
        taxTotal: 5,
        totalAmount: 65,
        status: 'AWAITING_PAYMENT',
        createdAt: new Date('2026-03-13T08:15:00.000Z'),
      }),
    ],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Numbering comes from the map index, not from any field on the invoice, so it is
    // only ever right by accident of store order - worth pinning.
    const first = accordionFor(canvas, 'Invoice 1');
    const second = accordionFor(canvas, 'Invoice 2');
    await expect(first).not.toBe(second);

    // Each accordion shows its own invoice. A keying mistake would render the same one
    // twice and every "the amount is on screen" assertion would still pass.
    await expect(rowValue(first, 'Amount:')).toBe('€258');
    await expect(rowValue(first, 'Status:')).toBe('Paid');
    await expect(rowValue(second, 'Amount:')).toBe('€65');
    await expect(rowValue(second, 'Status:')).toBe('Awaiting payment');
    await expect(rowValue(second, 'Date:')).toBe('Mar 13, 2026');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A re-invoiced appointment. The heading is `Invoice ${i + 1}` over the store order, ' +
          'so the list is not sorted by date or by status - the second card here is the newer ' +
          'one only because it was seeded second.',
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
    const disclaimer = canvas.getByText(CASH_REFUND_DISCLAIMER);

    // It has to sit ABOVE the invoices: the point of the notice is that it is read
    // before anyone starts looking for a refund control that does not exist.
    const invoice = accordionFor(canvas, 'Invoice 1');
    await expect(
      disclaimer.compareDocumentPosition(invoice) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await expect(rowValue(invoice, 'Payment method:')).toBe('In-person payment');
    await expect(rowValue(invoice, 'Status:')).toBe('Paid');
    // Settled: no action row at all, so there is nothing here that could take a payment
    // or issue the refund the notice is telling the reader to handle by hand.
    await expect(
      within(invoice)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
    ).toEqual(['Invoice 1']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The refund disclaimer, reached through the invoice: `PAYMENT_AT_CLINIC` plus a ' +
          'settled status on a cancelled appointment.\n\n' +
          'The other trigger the code checks - `paymentStatus === PAID_CASH` on the ' +
          'appointment - cannot be built from the shipped types at all: ' +
          "`AppointmentPaymentStatus` is `'PAID' | 'UNPAID'`, so that comparison is dead " +
          'against a correctly typed appointment and only the invoice path can raise the ' +
          'notice.',
      },
    },
  },
};

export const NoInvoices: Story = {
  name: 'No invoices yet',
  /* No appointment id, deliberately. `useInvoicesForPrimaryOrgAppointment` fires a real
     finance read whenever the filtered list comes back empty, and Storybook has no API to
     answer it; an id-less appointment takes the hook's early return instead and renders
     the identical empty branch offline. */
  args: { activeAppointment: buildAppointment({ id: undefined }) },
  beforeEach: seed({ invoices: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.queryByText(CASH_REFUND_DISCLAIMER)).not.toBeInTheDocument();

    /* Absence on its own proves nothing - a component that threw on mount leaves the same
       empty canvas. So state it positively: the section still renders its scroll container,
       and the column inside it holds zero children. That is "mounted and contributed no
       invoices", which a crash cannot fake. */
    const landmark = canvasElement.querySelector('main') as HTMLElement;
    await expect(landmark.children).toHaveLength(2);
    const section = landmark.children[1] as HTMLElement;
    await expect(section.firstElementChild?.children).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An appointment nobody has billed yet. The tab is not empty by accident - the ' +
          'scroll container is still there, waiting - but it offers no way to raise the first ' +
          'invoice, which is done from the Info tab.',
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

    // The invoice is in the store and still must not render - the gate wraps the list,
    // it does not merely hide the amounts.
    await expect(canvas.queryByRole('button', { name: 'Invoice 1' })).toBeNull();
    await expect(canvasElement.textContent).not.toContain('€258');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A membership with `billing:view:any` revoked, with an invoice sitting in the store ' +
          'the whole time. The fallback is the compact inline notice rather than the full ' +
          'centered card, because this is a panel inside a tab and not a whole route.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const invoice = accordionFor(canvas, 'Invoice 1');

    /* Each row is `justify-between` with an unwrapped label and a right-aligned value, so
       at 375px the pair either fits or pushes the card sideways. Measured on the accordion
       rather than on the page: the modal this lives in scrolls vertically only, and a row
       that overflows is clipped rather than reachable. */
    await expect(invoice.scrollWidth).toBeLessThanOrEqual(invoice.clientWidth);
    await expect(rowValue(invoice, 'Amount:')).toBe('€258');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same invoice at 375px, where the label/value rows have the least room. The ' +
          'appointment id is the longest value on the card and the one that decides whether ' +
          'the row wraps or overflows.',
      },
    },
  },
};
