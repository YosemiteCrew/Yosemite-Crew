import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';

import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import InvoiceTable from './InvoiceTable';

const ORG_ID = 'org-invoice-table-story';

const appointment = (id: string, name: string, parent: string): Appointment => {
  const patient: Appointment['patient'] = {
    id: `companion-${id}`,
    name,
    species: 'Dog',
    breed: 'Beagle',
    parent: { id: `parent-${id}`, name: parent },
  };
  return {
    id,
    organisationId: ORG_ID,
    patient,
    companion: patient,
    appointmentDate: new Date('2026-08-12T09:30:00.000Z'),
    startTime: new Date('2026-08-12T09:30:00.000Z'),
    endTime: new Date('2026-08-12T10:00:00.000Z'),
    timeSlot: '09:30 AM',
    durationMinutes: 30,
    status: 'COMPLETED',
  };
};

const APPOINTMENTS = [
  appointment('appointment-1', 'Kizie', 'Sky Doe'),
  appointment('appointment-2', 'Bailey', 'Marta Lang'),
];

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'a1b2c3d4e5f60718293a4b5c',
  organisationId: ORG_ID,
  appointmentId: 'appointment-1',
  items: [
    { name: 'General consultation', quantity: 1, unitPrice: 60, total: 60 },
    { name: 'Rabies vaccination', quantity: 1, unitPrice: 35, total: 35 },
  ],
  subtotal: 95,
  discountTotal: 0,
  taxTotal: 7.65,
  totalAmount: 102.65,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  status: 'PAID',
  createdAt: new Date('2026-08-12T10:15:00.000Z'),
  updatedAt: new Date('2026-08-12T10:15:00.000Z'),
  ...over,
});

const INVOICES: Invoice[] = [
  invoice(),
  invoice({
    id: 'b2c3d4e5f60718293a4b5c6d',
    appointmentId: 'appointment-2',
    status: 'AWAITING_PAYMENT',
    paymentCollectionMethod: 'PAYMENT_LINK',
    taxTotal: 0,
    totalAmount: 95,
  }),
];

/**
 * Both stores are plain Zustand stores with no provider and no fetch on read, so
 * seeding them outside React is the whole of the setup. The table resolves the
 * parent and patient names itself from `invoice.appointmentId`, and the money
 * formatter reads the org currency, which falls back to USD with no subscription.
 */
const seedStores = () => {
  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, APPOINTMENTS);
};

/**
 * The three bands, in DOM order: desktop table, tablet table, phone cards. Finance
 * deliberately avoids the shared `.table-list`/`.card-list` classes, so the bands
 * are plain Tailwind siblings of one wrapper and are addressed positionally.
 */
const bands = (canvasElement: HTMLElement) => {
  const wrapper = canvasElement.querySelector('.table-wrapper') as HTMLElement;
  const [desktop, tablet, phone] = [...wrapper.children] as HTMLElement[];
  return { desktop, tablet, phone };
};

const meta = {
  title: 'Tables/InvoiceTable',
  component: InvoiceTable,
  parameters: {
    layout: 'padded',
    // The Date cell pushes to /appointments through next/navigation's router.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The finance list, which is three separate renderings of one array rather than one ' +
          'responsive table: a ten-column ledger above 1280, a six-column tablet table between 768 ' +
          'and 1279 (Services and Date fold into the identity sub-line, Subtotal/Discount/Tax fold ' +
          'under Total), and a card band below 768. All three are always in the DOM; Tailwind ' +
          'hides two of them.\n\n' +
          'That is why the phone band’s empty state had never been drawn. It is its own branch - ' +
          '`filteredList.length === 0` inside the card band - and it prints different copy from the ' +
          'tables above it: **"No invoices match the current filters."** against `GenericTable`’s ' +
          '"Looks like a quiet day… for now." An empty finance page therefore says one thing on a ' +
          'laptop and another on a phone, and both sentences are in the DOM at every width.\n\n' +
          'It is also the only one of the three that announces itself: it is an `<output ' +
          'aria-live="polite">`, so a filter change that empties the list is spoken on a phone and ' +
          'silent on a desktop.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: INVOICES,
    setActiveInvoice: fn(),
    setViewInvoice: fn(),
  },
  beforeEach: seedStores,
  decorators: [
    (Story) => (
      <div className="h-[520px] bg-[var(--screen)] p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PhoneEmpty: Story = {
  name: 'Phone: no invoices match',
  args: { filteredList: [] },
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 - it still type-checks and still plays, and renders the full
  // panel width, which for this component means the DESKTOP band under a name
  // promising a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { desktop, tablet, phone } = bands(canvasElement);

    const message = canvas.getByText('No invoices match the current filters.');
    await expect(message).toBeVisible();
    // An <output>, not a div: it is the only empty state on this page that a
    // screen reader is told about when a filter empties the list.
    await expect(message.tagName).toBe('OUTPUT');
    await expect(message).toHaveAttribute('aria-live', 'polite');
    await expect(phone.children).toHaveLength(1);

    /* The two table bands are still mounted, still carrying their own - different -
       empty copy, and only `display: none` separates them from this one. Asserted
       because it is the whole reason this branch went unnoticed. */
    await expect(desktop).not.toBeVisible();
    await expect(tablet).not.toBeVisible();
    const quietDay = canvas.getAllByText('Looks like a quiet day… for now.');
    await expect(quietDay).toHaveLength(2);
    await expect(quietDay[0]).not.toBeVisible();
    await expect(quietDay[1]).not.toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface: an empty finance list at 375. The copy is about the FILTERS, not ' +
          'about the practice being quiet, which is the more useful of the two sentences and the ' +
          'one only phone users get.',
      },
    },
  },
};

export const PhoneCards: Story = {
  name: 'Phone: the card band',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { phone } = bands(canvasElement);

    // The other side of the same branch: with rows, the <output> does not exist
    // at all - so the empty state cannot be a leftover node with its text swapped.
    await expect(
      canvas.queryByText('No invoices match the current filters.')
    ).not.toBeInTheDocument();
    await expect(phone.children).toHaveLength(2);
    await expect(phone).toBeVisible();

    /* Each card resolves its own names out of the appointment store rather than off the
       invoice, which is what makes the seeded appointments load-bearing - and it splits
       the owner across two lines while doing it. `getCompanionNameFromAppointments`
       runs `formatCompanionNameWithOwnerLastName`, so the heading is the pet plus the
       owner's LAST name; `getParentNameFromAppointments` runs `getOwnerFirstName`, so
       the "Parent:" line under it is the FIRST name only. A card seeded with "Kizie" and
       "Sky Doe" therefore reads "Kizie · Doe" over "Sky", and the owner's full name is
       nowhere on it. */
    await expect(canvas.getByText('Kizie · Doe')).toBeVisible();
    await expect(canvas.getByText('Bailey · Lang')).toBeVisible();
    await expect(canvas.getByText('Sky')).toBeVisible();
    await expect(canvas.getByText('Marta')).toBeVisible();

    /* The bare fixture strings are asserted ABSENT rather than left unmentioned. Both
       halves of the split are silent when they break - dropping the owner suffix or
       widening the parent line to the full name still renders a perfectly plausible
       card - so the only thing that catches either is naming what must NOT be there. */
    await expect(canvas.queryByText('Kizie')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Sky Doe')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two invoices as cards. Cards are `w-full` below `sm`, so on a phone the band is a single ' +
          'column however many invoices there are.',
      },
    },
  },
};

export const DesktopEmpty: Story = {
  name: 'Desktop: the other empty state',
  args: { filteredList: [] },
  // 1440 rather than the 1280 laptop preset: the desktop band is `xl:flex`, and
  // at exactly 1280 a preview scrollbar can take the viewport under the breakpoint
  // and silently swap which band this story is about.
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { desktop, tablet, phone } = bands(canvasElement);

    await expect(desktop).toBeVisible();
    await expect(tablet).not.toBeVisible();
    // The phone sentence is mounted here too, one `display: none` away.
    await expect(phone).not.toBeVisible();
    await expect(canvas.getByText('No invoices match the current filters.')).not.toBeVisible();

    // Scoped to the desktop band rather than filtered by visibility: the same
    // sentence exists twice, and this names WHICH copy the reader is looking at.
    await expect(within(desktop).getByText('Looks like a quiet day… for now.')).toBeVisible();
    await expect(within(tablet).getByText('Looks like a quiet day… for now.')).not.toBeVisible();

    /* Column counts, so the two table bands are provably the ledger and the
       pruned one rather than the same markup twice: ten columns of ledger against
       six columns of "what you need to chase money". */
    await expect(desktop.querySelectorAll('thead th')).toHaveLength(10);
    await expect(tablet.querySelectorAll('thead th')).toHaveLength(6);
    await expect(within(desktop).getByText('Subtotal')).toBeInTheDocument();
    await expect(within(tablet).queryByText('Subtotal')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same empty list one breakpoint up, kept next to the phone story so the two sentences ' +
          'can be read together. The header row survives the empty state in both tables, so the ' +
          'column pruning is visible with no data at all.',
      },
    },
  },
};
