import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';

import { InvoiceStatusFilters } from '@/app/features/finance/types/invoice';
import { computeFinanceMetrics } from '@/app/lib/financeMetrics';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import PhoneInvoiceList from './PhoneInvoiceList';

const ORG_ID = 'org-avenger-park';

const appointment = (
  id: string,
  companionName: string,
  ownerName: string,
  service: string,
  date: string
): Appointment => {
  const patient: Appointment['patient'] = {
    id: `companion-${companionName.toLowerCase()}`,
    name: companionName,
    species: 'dog',
    breed: 'Beagle',
    parent: { id: `parent-${ownerName.split(' ')[0].toLowerCase()}`, name: ownerName },
  };
  return {
    id,
    organisationId: ORG_ID,
    patient,
    companion: patient,
    appointmentType: {
      id: `type-${service}`,
      name: service,
      speciality: { id: 'spec-general', name: 'General practice' },
    },
    // Fixed instants throughout. Every formatter pins en-US and
    // `getPreferredTimeZone` falls back to Europe/Berlin with no timezone token
    // stored, so nothing rendered here drifts with the machine running it.
    appointmentDate: new Date(date),
    startTime: new Date(date),
    endTime: new Date(date),
    timeSlot: '09:30 AM',
    durationMinutes: 30,
    status: 'COMPLETED',
  };
};

const APPOINTMENTS: Appointment[] = [
  appointment(
    'appointment-8842',
    'Kizie',
    'Sky Doe',
    'Dental consultation',
    '2026-08-12T09:30:00.000Z'
  ),
  appointment('appointment-8851', 'Milo', 'Aria Blake', 'Vaccination', '2026-08-13T11:00:00.000Z'),
  appointment(
    'appointment-8860',
    'Nala',
    'Ines Ferrer',
    'Orthopaedic review',
    '2026-08-14T08:15:00.000Z'
  ),
];

const invoice = (over: Partial<Invoice> & Pick<Invoice, 'id' | 'status'>): Invoice => ({
  organisationId: ORG_ID,
  items: [],
  subtotal: 0,
  totalAmount: 0,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  createdAt: new Date('2026-08-12T10:02:00.000Z'),
  updatedAt: new Date('2026-08-12T10:02:00.000Z'),
  ...over,
});

/**
 * Three invoices chosen to cover every branch the card has: both border treatments
 * and all three footnotes.
 *
 * `formatMoney` runs at `maximumFractionDigits: 0`, so every figure is a whole number
 * on purpose - a 92.65 total would print as "$93" and make the assertions read as
 * though the arithmetic were wrong.
 */
const PAID = invoice({
  id: 'a1b2c3d4e5f60718293a4b5c',
  appointmentId: 'appointment-8842',
  metadata: { invoiceNumber: 'INV-2026-0142' },
  totalAmount: 114,
  subtotal: 105,
  status: 'PAID',
  paidAt: new Date('2026-08-12T10:15:00.000Z'),
  createdAt: new Date('2026-08-12T10:02:00.000Z'),
});

const UNPAID = invoice({
  id: 'b2c3d4e5f60718293a4b5c6d',
  appointmentId: 'appointment-8851',
  metadata: { invoiceNumber: 'INV-2026-0163' },
  totalAmount: 240,
  subtotal: 240,
  status: 'AWAITING_PAYMENT',
  paymentCollectionMethod: 'PAYMENT_LINK',
  createdAt: new Date('2026-08-13T11:20:00.000Z'),
});

const PART_PAID = invoice({
  id: 'c3d4e5f60718293a4b5c6d7e',
  appointmentId: 'appointment-8860',
  metadata: { invoiceNumber: 'INV-2026-0171' },
  totalAmount: 300,
  subtotal: 300,
  depositCollectedAmount: 50,
  status: 'AWAITING_PAYMENT',
  paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
  createdAt: new Date('2026-08-14T08:30:00.000Z'),
});

const INVOICES = [PAID, UNPAID, PART_PAID];

/**
 * A fixed "now" so `collectedThisWeek` is deterministic: the metric only counts PAID
 * invoices settled inside the trailing seven days, and `Date.now()` would drop the
 * paid one out of the window the moment this file is a week old.
 */
const NOW = Date.parse('2026-08-14T09:00:00.000Z');
const METRICS = computeFinanceMetrics(INVOICES, NOW);

/**
 * Seeds the one store the list reads. `useAppointmentsForPrimaryOrg` is a pure
 * selector - the hook that fetches (`useLoadAppointmentsForPrimaryOrg`) is separate
 * and this component does not call it - so seeding is the whole of the setup and the
 * list under review is the real one, with no service stubbed.
 */
const seed = (appointments: Appointment[] = APPOINTMENTS) => {
  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, appointments);
};

/**
 * Resolves a design token to the colour the browser actually paints, so a story can
 * say "the unpaid rail is --warn" rather than only "it differs from its neighbour".
 *
 * It appends a probe, so it is a DOM MUTATION and must never run inside a `waitFor`
 * callback: testing-library retries through a MutationObserver, and a callback that
 * mutates then throws re-queues itself forever - wedging the tab instead of failing.
 * Every caller resolves first and polls only the read.
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

/** One invoice card, by the accessible name the whole card carries. */
const card = (canvasElement: HTMLElement, numberLabel: string): HTMLElement =>
  within(canvasElement).getByRole('button', { name: `View invoice ${numberLabel}` });

/** Every invoice card currently rendered, in list order. */
const cards = (canvasElement: HTMLElement): HTMLElement[] =>
  within(canvasElement).queryAllByRole('button', { name: /^View invoice / });

/** The status-pill rail and the box that scrolls it. */
const rail = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByRole('group', { name: 'Filter invoices by status' });

const meta = {
  title: 'Finance/PhoneInvoiceList',
  component: PhoneInvoiceList,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The whole Finance screen below 768px, and none of it had ever been drawn. Above that ' +
          'width the page renders a seven-column `InvoiceTable`; below it `useIsPhone` swaps in ' +
          'this component instead, so nothing here shares markup with the desktop list and no ' +
          'desktop screenshot covers it.\n\n' +
          'Three surfaces exist only here.\n\n' +
          '**Two KPI tiles.** "Collected · wk" and "Outstanding", in an always-two-column grid. ' +
          'They are the phone replacement for the desktop subtitle line, and the outstanding ' +
          'figure is tinted `--warn-text` while the collected one is plain `--ink` - the only ' +
          'colour signal on the screen that money is owed.\n\n' +
          '**A horizontally scrolling pill rail.** The seven backend statuses do not fit in 375px, ' +
          'so the rail is an `overflow-x-auto` strip with the scrollbar hidden. There is no ' +
          'gradient, no arrow and no visible track, which means the only hint that statuses ' +
          'continue past "Paid" is the pill clipped at the right edge.\n\n' +
          '**Three-line invoice cards.** Number and date, then avatar + identity + amount, then ' +
          'an optional footnote. Unpaid rows carry a 3px `--warn` left border, and "unpaid" here ' +
          'means outstanding **and** no deposit - a part-paid invoice loses the border and gains ' +
          'a "Deposit $50 applied" footnote instead, which is the distinction the stories pin ' +
          'down.\n\n' +
          'The identity line is worth reading closely: it composes as ' +
          '`{owner first name} / {companion} · {owner surname} · {service}`, so a single line ' +
          'mixes a slash and two middle dots and names the owner twice.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: INVOICES,
    statusOptions: InvoiceStatusFilters,
    activeStatus: 'all',
    setActiveStatus: fn(),
    metrics: METRICS,
    currency: 'USD',
    onViewInvoice: fn(),
  },
  // Pinned as a GLOBAL on the meta, so every story renders at phone width.
  // `parameters.viewport.defaultViewport` was removed in Storybook 10: a story using
  // it still renders, still plays and still passes - at 1280px, which for a component
  // the app only mounts below 768 would prove the opposite of what it claims.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: () => {
    seed();
  },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--page)] px-3.5 py-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneInvoiceList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  name: 'The phone finance list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The KPI tiles. Two tracks and two children: the grid is `grid-cols-2` with no
       responsive variant, so it must stay two-across at 375 - a one-track template
       would stack them and push the whole list below the fold. */
    const collected = canvas.getByText('Collected · wk');
    const tiles = collected.closest('.grid') as HTMLElement;
    await expect(getComputedStyle(tiles).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(tiles.children).toHaveLength(2);

    /* The figures are computed by `computeFinanceMetrics` against a fixed "now", not
       written by hand: $114 collected (one PAID invoice inside the trailing week) and
       $490 outstanding (240 owed in full, plus 250 still owed on the part-paid one -
       the settled invoice contributes nothing). */
    await expect(tiles.children[0]).toHaveTextContent('$114');
    await expect(tiles.children[1]).toHaveTextContent('Outstanding');
    await expect(tiles.children[1]).toHaveTextContent('$490');

    /* Outstanding is tinted and Collected is not, and that is the entire visual
       difference between the two tiles. Resolved BEFORE the poll, never inside it -
       `resolveToken` mutates the DOM. Polled because the tiles inherit
       `transition-colors` from the theme and a single synchronous read can catch an
       interpolated value. */
    const warnInk = resolveToken(canvasElement, '--warn-text');
    const ink = resolveToken(canvasElement, '--ink');
    // Scoped to the tiles: "$114" is printed twice on this screen, once here and once
    // on the paid invoice's card, and an unscoped query would find both and throw.
    const outstandingFigure = within(tiles).getByText('$490');
    const collectedFigure = within(tiles).getByText('$114');
    await waitFor(() => {
      expect(getComputedStyle(outstandingFigure).color).toBe(warnInk);
      expect(getComputedStyle(collectedFigure).color).toBe(ink);
    });

    /* The rail carries all seven backend statuses, and it OVERFLOWS at this width -
       which is the behaviour, not a defect. Asserted through scrollWidth rather than
       by counting pixels, so it states the rule and holds at 375 and 430 alike. */
    const group = rail(canvasElement);
    await expect(within(group).getAllByRole('button')).toHaveLength(7);
    const scroller = group.parentElement as HTMLElement;
    await expect(getComputedStyle(scroller).overflowX).toBe('auto');
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);

    // Three cards, in list order, each named by its invoice.
    await expect(cards(canvasElement)).toHaveLength(3);
    const paid = within(card(canvasElement, '#INV-2026-0142'));
    await expect(paid.getByText('Paid')).toBeInTheDocument();
    /* The identity line, in full. It reads `{owner first name} / {companion} ·
       {owner surname} · {service}` - one line, three separators, the owner named
       twice. Asserted verbatim because that is the string a reviewer should look at
       and decide about, not a fragment that would pass on half of it. */
    await expect(paid.getByText('Sky / Kizie · Doe · Dental consultation')).toBeInTheDocument();
    await expect(paid.getByText('$114')).toBeInTheDocument();
    // Footnote branch 1: settled, so the payment method stands in for a balance.
    await expect(paid.getByText('Online payment')).toBeInTheDocument();

    const unpaid = within(card(canvasElement, '#INV-2026-0163'));
    await expect(unpaid.getByText('Aria / Milo · Blake · Vaccination')).toBeInTheDocument();
    await expect(unpaid.getByText('$240')).toBeInTheDocument();
    // Footnote branch 2: nothing collected and nothing settled, so no footnote at all.
    await expect(unpaid.queryByText('Online payment')).not.toBeInTheDocument();

    const partPaid = within(card(canvasElement, '#INV-2026-0171'));
    // Footnote branch 3: a deposit outranks both other cases.
    await expect(partPaid.getByText('Deposit $50 applied')).toBeInTheDocument();
    await expect(partPaid.getByText('$300')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting list: one settled invoice, one wholly unpaid, one part-paid. All three ' +
          'footnote branches and both border treatments are on screen at once, which no single ' +
          'real screen would guarantee.',
      },
    },
  },
};

export const UnpaidBorder: Story = {
  name: 'The --warn rail marks unpaid rows',
  play: async ({ canvasElement }) => {
    /* "Unpaid" is `outstanding > 0 AND no deposit collected`, not simply "not paid".
       So exactly ONE of these three cards gets the rail: the part-paid invoice still
       owes $250 and does not. That is the assertion worth having - a naive
       `status !== 'PAID'` would light two rows and look entirely reasonable. */
    const warn = resolveToken(canvasElement, '--warn');
    const hairline = resolveToken(canvasElement, '--hairline');
    const unpaid = card(canvasElement, '#INV-2026-0163');
    const paid = card(canvasElement, '#INV-2026-0142');
    const partPaid = card(canvasElement, '#INV-2026-0171');

    await waitFor(() => {
      expect(getComputedStyle(unpaid).borderLeftColor).toBe(warn);
      expect(getComputedStyle(paid).borderLeftColor).toBe(hairline);
      expect(getComputedStyle(partPaid).borderLeftColor).toBe(hairline);
    });

    // The rail is 3px against the 1px hairline on the other three edges, which is what
    // makes it read as a marker rather than as a thicker card.
    await expect(getComputedStyle(unpaid).borderLeftWidth).toBe('3px');
    await expect(getComputedStyle(unpaid).borderTopWidth).toBe('1px');
    await expect(getComputedStyle(paid).borderLeftWidth).toBe('1px');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 3px stripe is the only per-row signal on this screen - there is no outstanding ' +
          'figure on a card - so which rows get it is a product decision as much as a visual one. ' +
          'A part-paid invoice reads as settled here and says so only in its footnote.',
      },
    },
  },
};

export const FilteredToUnpaid: Story = {
  name: 'Filtered to awaiting payment',
  args: {
    activeStatus: 'awaiting_payment',
    filteredList: [UNPAID, PART_PAID],
  },
  play: async ({ canvasElement }) => {
    const group = rail(canvasElement);
    const pills = within(group).getAllByRole('button');

    /* The active pill is the ONLY one painted: `getStatusPillStyle` returns a
       transparent background for everything unselected, and lets the option's own
       token set through for the selected one. So the rail's whole state is carried by
       one background colour, with no ring, weight change or underline to back it up.
       Read after the transition rather than in the same frame - these pills carry
       `transition-opacity` and the badge inside them `transition-colors`. */
    const active = within(group).getByRole('button', { name: 'Awaiting payment' });
    const inactive = within(group).getByRole('button', { name: 'Paid' });
    await expect(active).toHaveAttribute('aria-pressed', 'true');
    await expect(inactive).toHaveAttribute('aria-pressed', 'false');
    await expect(pills.filter((pill) => pill.getAttribute('aria-pressed') === 'true')).toHaveLength(
      1
    );

    const activeBadge = active.querySelector('.yc-status-pill') as HTMLElement;
    const inactiveBadge = inactive.querySelector('.yc-status-pill') as HTMLElement;
    await waitFor(() => {
      expect(getComputedStyle(inactiveBadge).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(activeBadge).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    // The list is filtered by the PAGE, not here - this component renders whatever
    // `filteredList` holds - so the two remaining cards are the proof the story is
    // showing a coherent state rather than a mismatched pill and list.
    await expect(cards(canvasElement)).toHaveLength(2);
    await expect(card(canvasElement, '#INV-2026-0163')).toBeInTheDocument();
    await expect(
      within(canvasElement).queryByRole('button', { name: 'View invoice #INV-2026-0142' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The rail keeps its own scroll position, so on a narrow phone the active pill can be ' +
          'off-screen: "Awaiting payment" is the third of seven and already sits near the right ' +
          'edge at 375px. Nothing scrolls it into view when the filter changes.',
      },
    },
  },
};

export const ChoosingAFilter: Story = {
  name: 'Tapping a pill and a card',
  play: async ({ canvasElement, args }) => {
    const group = rail(canvasElement);

    await userEvent.click(within(group).getByRole('button', { name: 'Paid' }));
    /* The KEY, not the label. The page filters on a lowercased status key, so a pill
       that passed its display name would match nothing and silently empty the list. */
    await expect(args.setActiveStatus).toHaveBeenCalledTimes(1);
    await expect(args.setActiveStatus).toHaveBeenCalledWith('paid');

    /* The component is controlled: `activeStatus` is still 'all', so the pill it just
       pressed is still unpressed and the list is unchanged. A page that forgot to echo
       the callback back into state would look exactly like this. */
    await expect(within(group).getByRole('button', { name: 'Paid' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(cards(canvasElement)).toHaveLength(3);

    /* The whole card is one button, so the tap target is the full three-line row
       rather than a chevron - and it hands back the invoice OBJECT, which is what
       lets the page open the record sheet without a second lookup. */
    await userEvent.click(card(canvasElement, '#INV-2026-0171'));
    await expect(args.onViewInvoice).toHaveBeenCalledTimes(1);
    await expect(args.onViewInvoice).toHaveBeenCalledWith(PART_PAID);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both interactions the screen has. Neither writes anything - the page owns the filter ' +
          'state and the record sheet - so this list is pure presentation and stays that way ' +
          'however long it gets.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No invoices match',
  args: { filteredList: [], activeStatus: 'refunded' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('No invoices match the current filters.')).toBeInTheDocument();
    await expect(cards(canvasElement)).toHaveLength(0);

    /* The tiles and the rail survive an empty list, and they must: the tiles are
       computed from ALL invoices rather than the filtered ones, so "$490 outstanding"
       above an empty list is correct rather than contradictory - and the rail is the
       only way back out of a filter that matched nothing. */
    await expect(canvas.getByText('$490')).toBeInTheDocument();
    await expect(within(rail(canvasElement)).getAllByRole('button')).toHaveLength(7);

    // The empty state is an <output>, announced politely, so a filter change that
    // empties the list is spoken rather than silently blanking the screen.
    const empty = canvas.getByRole('status');
    await expect(empty).toHaveAttribute('aria-live', 'polite');
    await expect(empty).toHaveTextContent('No invoices match the current filters.');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reachable in one tap: "Refunded" matches nothing in most practices. The sentence names ' +
          'filters rather than invoices, which is the right call here - the KPI tiles above it ' +
          'are still showing money, so "no invoices" alone would read as a data failure.',
      },
    },
  },
};

export const UnlinkedInvoice: Story = {
  name: 'An invoice with no appointment',
  args: {
    filteredList: [
      invoice({
        id: 'd4e5f60718293a4b5c6d7e8f',
        metadata: { invoiceNumber: 'INV-2026-0009' },
        appointmentId: undefined,
        totalAmount: 42,
        subtotal: 42,
        status: 'PENDING',
        paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
        createdAt: new Date('2026-08-14T08:45:00.000Z'),
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    const row = within(card(canvasElement, '#INV-2026-0009'));

    /* No appointment means no owner, no companion and no service, so the identity line
       is empty and falls back to one word. It is the middle line of the card - the
       widest one - and it is the only thing that would have said whose bill this is. */
    await expect(row.getByText('Unlinked invoice')).toBeInTheDocument();

    // Everything else still renders: number, date, status and amount are all read off
    // the invoice itself rather than the appointment.
    await expect(row.getByText('$42')).toBeInTheDocument();
    await expect(row.getByText('Pending')).toBeInTheDocument();
    /* The avatar falls back to the species default rather than disappearing, which is
       why the amount still sits at the same distance from the left edge. Queried as a
       plain <img> - it is decorative (`alt=""`), so it is out of the accessibility
       tree and no role query reaches it. */
    const unlinkedCard = card(canvasElement, '#INV-2026-0009');
    await expect(unlinkedCard.querySelector('img')).not.toBeNull();

    // A PENDING invoice with no deposit is unpaid, so it takes the --warn rail.
    const warn = resolveToken(canvasElement, '--warn');
    await waitFor(() => {
      expect(getComputedStyle(unlinkedCard).borderLeftColor).toBe(warn);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A counter sale, or an invoice whose appointment was deleted. The card degrades to the ' +
          'invoice number and the amount - which on a phone list of a dozen rows is very little ' +
          'to identify it by, and worth deciding whether the payer should be read from ' +
          '`invoice.parentId` instead.',
      },
    },
  },
};
