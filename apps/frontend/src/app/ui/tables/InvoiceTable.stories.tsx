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
          '`filteredList.length === 0` inside the card band - and it used to print different copy ' +
          'from the tables above it: **"No invoices match the current filters."** against ' +
          '`GenericTable`’s "Looks like a quiet day… for now.", so an empty finance page said one ' +
          'thing on a laptop and another on a phone with both sentences in the DOM at every ' +
          'width. All three bands now derive the same sentence from `itemNoun`.\n\n' +
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

    /* One sentence across all three bands now. It used to be two: the phone said
       "No invoices match the current filters." - blaming filters even with none
       applied - while the tables said "Looks like a quiet day… for now.". */
    const messages = canvas.getAllByText('No invoices yet');
    await expect(messages).toHaveLength(3);
    await expect(within(phone).getByText('No invoices yet')).toBeVisible();
    await expect(
      canvas.queryByText('No invoices match the current filters.')
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText('Looks like a quiet day… for now.')).not.toBeInTheDocument();

    // Still an <output aria-live>: the phone band is the one empty state on this
    // page a screen reader is told about. A hidden band is not announced, so the
    // three mounted copies do not talk over each other.
    const live = within(phone).getByText('No invoices yet').closest('output');
    await expect(live).not.toBeNull();
    await expect(live).toHaveAttribute('aria-live', 'polite');

    /* Both table bands are still mounted, and only `display: none` separates them
       from this one. Asserted because it is the whole reason the phone branch
       went unnoticed. */
    await expect(desktop).not.toBeVisible();
    await expect(tablet).not.toBeVisible();
    await expect(within(desktop).getByText('No invoices yet')).not.toBeVisible();
    await expect(within(tablet).getByText('No invoices yet')).not.toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface: an empty finance list at 375. All three bands now render the same ' +
          'derived empty state, so the sentence no longer depends on window width. The phone ' +
          'band keeps its `output`/`aria-live` wrapper, so it stays the one empty state here ' +
          'that is announced.',
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
    // The phone band is mounted here too, one `display: none` away.
    await expect(phone).not.toBeVisible();
    await expect(within(phone).getByText('No invoices yet')).not.toBeVisible();

    // All three bands carry the same sentence, whichever one is on screen.
    await expect(canvas.getAllByText('No invoices yet')).toHaveLength(3);

    // Scoped to a band rather than filtered by visibility: the same sentence now
    // exists three times, and this names WHICH copy the reader is looking at.
    await expect(within(desktop).getByText('No invoices yet')).toBeVisible();
    await expect(within(tablet).getByText('No invoices yet')).not.toBeVisible();

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
