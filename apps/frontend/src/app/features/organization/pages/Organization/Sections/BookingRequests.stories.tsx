import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import {
  bookingRequestsApi,
  type BookingRequest,
} from '@/app/features/organization/services/bookingRequestsApiService';
import { useOrgStore } from '@/app/stores/orgStore';
import BookingRequests from './BookingRequests';

const ORG_ID = 'org-storybook-booking';

/**
 * Local times, built field by field. `formatWhen` renders with
 * `toLocaleDateString`/`toLocaleTimeString`, so a UTC literal would slide by the
 * runner's offset and put a story's row on a different day depending on where it
 * is opened. Nothing below asserts the formatted stamp for the same reason.
 */
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 8, day, hour, minute).toISOString();

const request = (over: Partial<BookingRequest> & Pick<BookingRequest, 'id'>): BookingRequest => ({
  serviceName: 'Vaccination',
  requestedStart: at(2, 9, 30),
  requestedEnd: at(2, 10, 0),
  durationMinutes: 30,
  ownerName: 'Marie Dubois',
  ownerEmail: 'marie@example.com',
  ownerPhone: null,
  petName: 'Nala',
  petSpecies: 'Dog',
  concern: null,
  status: 'CONFIRMED',
  confirmedAt: at(1, 8, 0),
  createdAt: at(1, 7, 55),
  ...over,
});

/** Two still awaiting the practice, one already booked, one declined. */
const MIXED: BookingRequest[] = [
  request({
    id: 'req-nala',
    ownerPhone: '+33 6 12 34 56 78',
    concern: 'Limping on the left hind leg since Sunday.',
  }),
  request({
    id: 'req-otto',
    serviceName: 'Dental check',
    petName: 'Otto',
    petSpecies: 'Cat',
    ownerName: 'Sam Fields',
    ownerEmail: 'sam@example.com',
    requestedStart: at(2, 14, 0),
    durationMinutes: 45,
  }),
  request({
    id: 'req-pip',
    status: 'BOOKED',
    serviceName: 'Nail clip',
    petName: 'Pip',
    petSpecies: 'Rabbit',
    ownerName: 'Ada Werner',
    ownerEmail: 'ada@example.com',
    requestedStart: at(3, 11, 15),
  }),
  request({
    id: 'req-remy',
    status: 'DECLINED',
    serviceName: 'Second opinion',
    petName: 'Remy',
    ownerName: 'Jon Reid',
    ownerEmail: 'jon@example.com',
    requestedStart: at(4, 16, 45),
  }),
];

/** A request that is issued and never answers, for the in-flight branches. */
const neverSettles = <T,>() => new Promise<T>(() => {});

/** What `setStatus` was actually asked to write, in order. */
const recorder: { statusCalls: Array<[string, string, string]> } = { statusCalls: [] };

/**
 * The section reads `primaryOrgId` off the org store and everything else through
 * `bookingRequestsApi`, which goes to the real axios client. Both are swapped
 * here and both are put back on unmount, so a story cannot leak an org id or a
 * stubbed transport into the next one.
 *
 * The api object's methods are reassigned rather than the module being mocked:
 * the component calls `bookingRequestsApi.list(...)` at call time, so the swap
 * lands whichever order the modules happen to evaluate in.
 */
const withBookingApi = (options: {
  list: () => Promise<BookingRequest[]>;
  setStatus?: () => Promise<void>;
  orgId?: string | null;
}) => {
  const { list, setStatus, orgId = ORG_ID } = options;

  return () => {
    const storeSnapshot = useOrgStore.getState();
    const realList = bookingRequestsApi.list;
    const realSetStatus = bookingRequestsApi.setStatus;

    recorder.statusCalls = [];
    useOrgStore.setState({ primaryOrgId: orgId, status: 'loaded' });

    bookingRequestsApi.list = () => list();
    bookingRequestsApi.setStatus = (organisationId, requestId, status) => {
      recorder.statusCalls.push([organisationId, requestId, status]);
      return setStatus ? setStatus() : Promise.resolve();
    };

    return () => {
      bookingRequestsApi.list = realList;
      bookingRequestsApi.setStatus = realSetStatus;
      useOrgStore.setState(storeSnapshot);
    };
  };
};

const meta = {
  title: 'Organization/BookingRequests',
  component: BookingRequests,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Confirmed requests from the public booking page - the record a pet owner ends up in ' +
          'after they submit the form and click the link in their email.\n\n' +
          'Four render branches share one card and only one of them can be on screen at a time: ' +
          'loading, a load failure, the empty state, and the list. None of them were reachable ' +
          'anywhere in Storybook, because the section returns `null` without a `primaryOrgId` and ' +
          'otherwise talks to the API on mount. These stories seed the store and swap the two api ' +
          'methods for canned answers.\n\n' +
          'The row actions are the part that changes data. "Mark booked" and "Decline" both call ' +
          '`setStatus` and then rewrite the row in place - a request is not an appointment, so ' +
          'nothing is created in the diary and the count in the header is derived from the same ' +
          'array rather than stored. While a write is in flight `busyId` disables the buttons on ' +
          'that row, and a rejected write leaves the row exactly as it was.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[420px] w-[820px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: withBookingApi({ list: () => Promise.resolve(MIXED) }),
} satisfies Meta<typeof BookingRequests>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Loading',
  beforeEach: withBookingApi({ list: () => neverSettles<BookingRequest[]>() }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Loading requests…')).toBeInTheDocument();
    /* The three other branches are gated on `!loading`, so none of them may be
       drawn underneath it. The empty copy in particular would otherwise flash on
       every load and tell the practice it has no requests before it knows. */
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(canvas.queryByText(/^No booking requests yet/)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'The list could not be loaded',
  beforeEach: withBookingApi({ list: () => Promise.reject(new Error('offline')) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // role=alert, so the failure is announced rather than only coloured. The
    // section has no retry of its own, and the copy says so.
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent(
      'Could not load booking requests. Reload the page to try again.'
    );

    /* A failed load must not read as "no requests yet". They are the same empty
       card to look at and opposite things to act on - one means nobody has
       booked, the other means the practice cannot see who has. */
    await expect(canvas.queryByText(/^No booking requests yet/)).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'No requests yet',
  beforeEach: withBookingApi({ list: () => Promise.resolve([]) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      await canvas.findByText(
        'No booking requests yet. Confirmed requests from your public booking page appear here.'
      )
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    // No list and no summary line - the "N awaiting you" sentence belongs to the
    // populated branch only, so an empty org never sees "0 awaiting you".
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
    await expect(canvas.queryByText(/awaiting you/)).not.toBeInTheDocument();
  },
};

export const List: Story = {
  name: 'Four requests, two awaiting the practice',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rows = await canvas.findAllByRole('listitem');
    await expect(rows).toHaveLength(4);

    // The header count is `status === 'CONFIRMED'`, not the row count, so it is
    // the sentence that disagrees with the list when either side is changed.
    await expect(canvas.getByText(/^2 awaiting you\./)).toBeInTheDocument();

    // Actions belong to CONFIRMED rows only; the other two report a label.
    await expect(canvas.getAllByRole('button', { name: 'Mark booked' })).toHaveLength(2);
    await expect(canvas.getAllByRole('button', { name: 'Decline' })).toHaveLength(2);
    await expect(canvas.getAllByRole('button')).toHaveLength(4);
    await expect(canvas.getByText('Booked')).toBeInTheDocument();
    await expect(canvas.getByText('Declined')).toBeInTheDocument();
    /* CONFIRMED is the one status with no label of its own - the buttons are the
       label. "Awaiting you" is in the STATUS_LABEL map but unreachable, which is
       worth knowing before someone deletes the entry as dead. */
    await expect(canvas.queryByText('Awaiting you')).not.toBeInTheDocument();

    await expect(canvas.getByText('Nala (Dog) · Vaccination')).toBeInTheDocument();
    await expect(canvas.getByText('Otto (Cat) · Dental check')).toBeInTheDocument();

    /* The owner line appends the phone only when there is one, and the separator
       is part of the same conditional - so a missing phone must not leave a
       trailing "·" hanging off the email. */
    await expect(
      canvas.getByText('Marie Dubois · marie@example.com · +33 6 12 34 56 78')
    ).toBeInTheDocument();
    await expect(canvas.getByText('Sam Fields · sam@example.com')).toBeInTheDocument();

    // The concern is the owner's own words and only rendered when they wrote any.
    await expect(
      canvas.getByText('Limping on the left hind leg since Sunday.')
    ).toBeInTheDocument();

    // Duration lives in the same node as the local time stamp, which is why only
    // its tail is asserted.
    await expect(canvas.getByText(/· 45 min$/)).toBeInTheDocument();
  },
};

export const MarkBooked: Story = {
  name: 'Marking a request booked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rows = await canvas.findAllByRole('listitem');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Mark booked' }));

    // Scoped to the org and the row, and the status is sent as the SCREAMING_CASE
    // the API stores rather than the label the row shows.
    await expect(recorder.statusCalls).toEqual([[ORG_ID, 'req-nala', 'BOOKED']]);

    /* The row is rewritten from the local array once the write resolves - no
       refetch - so the buttons give way to the label and the header count follows
       from the same array. A component that only re-read the server would leave
       this row unchanged and the count stale. */
    await waitFor(async () => {
      await expect(canvas.getAllByRole('button', { name: 'Mark booked' })).toHaveLength(1);
    });
    await expect(canvas.getAllByText('Booked')).toHaveLength(2);
    await expect(canvas.getByText(/^1 awaiting you\./)).toBeInTheDocument();
    // Still four rows: marking one booked records what the practice did, it does
    // not remove the request from the list.
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
  },
};

export const WriteInFlight: Story = {
  name: 'A row while its write is in flight',
  beforeEach: withBookingApi({
    list: () => Promise.resolve(MIXED),
    setStatus: () => neverSettles<void>(),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rows = await canvas.findAllByRole('listitem');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Decline' }));

    // `busyId` disables BOTH buttons on the row being written, so the same
    // request cannot be marked booked and declined in two clicks.
    await waitFor(async () => {
      await expect(within(rows[0]).getByRole('button', { name: 'Decline' })).toBeDisabled();
    });
    await expect(within(rows[0]).getByRole('button', { name: 'Mark booked' })).toBeDisabled();

    /* The second CONFIRMED row keeps its enabled buttons, but `update` returns
       early while any write is in flight - so this click looks accepted and does
       nothing. Pinned as it behaves, not as it reads: an enabled control that
       silently drops the click is the part to fix if this ever gets revisited. */
    await expect(within(rows[1]).getByRole('button', { name: 'Mark booked' })).toBeEnabled();
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Mark booked' }));
    await expect(recorder.statusCalls).toEqual([[ORG_ID, 'req-nala', 'DECLINED']]);
  },
};

export const WriteFailed: Story = {
  name: 'The write was rejected',
  beforeEach: withBookingApi({
    list: () => Promise.resolve(MIXED),
    setStatus: () => Promise.reject(new Error('500')),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rows = await canvas.findAllByRole('listitem');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Mark booked' }));

    await expect(recorder.statusCalls).toEqual([[ORG_ID, 'req-nala', 'BOOKED']]);

    /* Nothing moves optimistically: the row keeps its buttons and the header keeps
       its count, so the failure toast is not contradicted by a list that already
       shows the request as booked. */
    await waitFor(async () => {
      await expect(within(rows[0]).getByRole('button', { name: 'Mark booked' })).toBeEnabled();
    });
    await expect(canvas.getAllByRole('button', { name: 'Mark booked' })).toHaveLength(2);
    await expect(canvas.getByText(/^2 awaiting you\./)).toBeInTheDocument();
    // Exactly one "Booked" label, the row that was already booked before this
    // story clicked anything - the rejected row did not quietly join it.
    await expect(canvas.getAllByText('Booked')).toHaveLength(1);
  },
};

export const NoPrimaryOrg: Story = {
  name: 'Without a primary organisation',
  beforeEach: withBookingApi({ list: () => Promise.resolve(MIXED), orgId: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Nothing renders at all - not an empty card. There is no org to scope a
       request to, so an empty "no requests yet" here would be a claim the
       component cannot make. Queried by heading level: the preview decorator
       puts an h1 in the canvas, and the card's own title is the h2. */
    await expect(canvas.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    await expect(canvas.queryByText('Booking requests')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: rows stack',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findAllByRole('listitem');
    // Each row carries an unbroken email address and the pair of action pills, so
    // this is where the card either wraps or pushes the page sideways.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Below sm each row drops its `sm:flex-row`, so the two action pills sit under the ' +
          'request detail rather than beside it.',
      },
    },
  },
};
