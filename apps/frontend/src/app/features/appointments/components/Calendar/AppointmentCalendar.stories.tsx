import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { InternalAxiosRequestConfig } from 'axios';
import type { Appointment } from '@yosemite-crew/types';

import {
  AppointmentFilters,
  AppointmentStatusFilters,
} from '@/app/features/appointments/types/appointments';
import type { Team } from '@/app/features/organization/types/team';
import api from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import AppointmentCalendar from './AppointmentCalendar';

const ORG_ID = 'org-storybook';
const ME = 'vet-weber';
const RAVI = 'vet-patel';
const PRIYA = 'nurse-raman';

/**
 * Instants are UTC in the middle of the working day. Every day key this planner
 * derives is computed in the PREFERRED zone (Europe/Berlin, +2 in July), never
 * the browser's, so an 08:00-11:00 UTC fixture keeps its calendar day on any
 * machine and the two bookings below always land on Tuesday 14 July.
 */
const CURRENT_DATE = new Date('2026-07-14T12:00:00.000Z');
/** Monday. `getWeekDays` runs Mon-Sun, so this is the head of the fixture week. */
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');

const teamMember = (practionerId: string, name: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

/** Three columns, which is what makes the Team view a different shape at all. */
const TEAM: Team[] = [
  teamMember(ME, 'Dr. Elena Weber'),
  teamMember(RAVI, 'Dr. Ravi Patel'),
  teamMember(PRIYA, 'Priya Raman'),
];

const appointment = (
  id: string,
  name: string,
  startIso: string,
  concern: string,
  durationMinutes = 30
): Appointment => {
  const startTime = new Date(startIso);
  const companion = {
    id: `companion-${id}`,
    name,
    species: 'dog',
    breed: 'Beagle',
    parent: { id: `parent-${id}`, name: 'Lena Hartmann' },
  };
  return {
    id,
    patient: companion,
    companion,
    organisationId: ORG_ID,
    lead: { id: ME, name: 'Dr. Elena Weber' },
    room: { id: 'room-consult-1', name: 'Consult 1' },
    appointmentType: {
      id: 'svc-lameness',
      name: 'Lameness recheck',
      speciality: { id: 'spec-general', name: 'General practice' },
    },
    appointmentDate: startTime,
    startTime,
    endTime: new Date(startTime.getTime() + durationMinutes * 60 * 1000),
    timeSlot: `${durationMinutes} minutes`,
    durationMinutes,
    status: 'UPCOMING',
    concern,
  };
};

/** Tuesday's two bookings - the pair the tablet band counts. */
const DAY_EVENTS: Appointment[] = [
  appointment('appt-milo', 'Milo', '2026-07-14T08:00:00.000Z', 'Post-op recheck'),
  appointment('appt-nala', 'Nala', '2026-07-14T10:30:00.000Z', 'Vaccination'),
];

/** One more on the Wednesday so the week view is not just the day view widened. */
const WEEK_EVENTS: Appointment[] = [
  ...DAY_EVENTS,
  appointment('appt-juno', 'Juno', '2026-07-15T09:00:00.000Z', 'Dental check'),
];

/** `TimedEventMarker` titles are "<companion> · <owner surname> • <service> • <concern>". */
const MILO_MARKER_TITLE = 'Milo · Hartmann • Lameness recheck • Post-op recheck';

/**
 * The planner reaches for the API on mount - team availability the moment the
 * Team view opens, and the bookable-slot lookup behind every drag. `axios` talks
 * to the real dev API (`NEXT_PUBLIC_BASE_URL`), so left alone a story would fire
 * cross-origin requests from the canvas and log whatever came back. Swapping the
 * shared instance's adapter answers all of them locally with an empty payload,
 * and the real adapter goes back on unmount.
 */
const withOfflineApi = () => {
  const originalAdapter = api.defaults.adapter;
  api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
    Promise.resolve({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })) as typeof api.defaults.adapter;
  return () => {
    api.defaults.adapter = originalAdapter;
  };
};

/**
 * Seeds the four stores this planner reads, and puts them back afterwards.
 *
 * `taskIdsByOrgId` carrying the org key is what keeps the phone branch off the
 * network: `PhoneCalendar` runs `useLoadTasksForPrimaryOrg`, which returns at its
 * own `Object.hasOwn` guard. The auth status is pinned to `unauthenticated` for
 * the same reason - `useLoadAvailabilities` only fires once a session exists, and
 * leaving it to whatever a neighbouring story left behind would make the dim
 * overlays depend on story order.
 */
const withSeededStores = () => {
  const authSnapshot = useAuthStore.getState();
  const orgSnapshot = useOrgStore.getState();
  const taskSnapshot = useTaskStore.getState();
  const teamSnapshot = useTeamStore.getState();

  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useTeamStore.setState({
    teamsById: Object.fromEntries(TEAM.map((member) => [member._id, member])),
    teamIdsByOrgId: { [ORG_ID]: TEAM.map((member) => member._id) },
    status: 'loaded',
  });
  useTaskStore.setState({ tasksById: {}, taskIdsByOrgId: { [ORG_ID]: [] }, status: 'loaded' });
  // `attributes.sub` is how the planner recognises "you": it resolves the
  // signed-in practitioner id, which seeds the create-appointment prefill and
  // decides which Team column is highlighted.
  useAuthStore.setState({ attributes: { sub: ME }, status: 'unauthenticated' });

  return () => {
    useAuthStore.setState(authSnapshot);
    useOrgStore.setState(orgSnapshot);
    useTaskStore.setState(taskSnapshot);
    useTeamStore.setState(teamSnapshot);
  };
};

/**
 * `useIsPhone` and `useIsTabletCalendar` decide the whole shape of this component
 * from `matchMedia`, and the viewport global only resizes the preview iframe from
 * the Storybook MANAGER - open the story frame on its own, which is what the
 * story runner does, and the media query still answers for the runner's window.
 * Pinning the width answered here is what makes those two branches deterministic
 * in both places; the viewport global is set alongside it so the story also looks
 * right when a human opens it.
 */
const withViewportWidth = (widthPx: number) => () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const max = /\(max-width:\s*(\d+)px\)/.exec(query);
    // Anything that is not a width question (reduced motion, colour scheme) is
    // still answered by the real implementation.
    if (!min && !max) return original.call(globalThis, query);
    const matches = (!min || widthPx >= Number(min[1])) && (!max || widthPx <= Number(max[1]));
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof globalThis.matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
};

const dayGrid = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('section[aria-label="Appointment timeline"]');

const weekGrid = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('section[aria-label^="Appointments week calendar starting"]');

const teamCells = (canvasElement: HTMLElement) =>
  canvasElement.querySelectorAll('section[aria-label^="Appointments slot"]');

const meta = {
  title: 'Appointments/Calendar/AppointmentCalendar',
  component: AppointmentCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The appointments planner: the toolbar, the drag machinery and the switch between the ' +
          'day, week and team grids. Nothing below it decides which view is on screen - ' +
          '`activeCalendar` is a page-level string, and this component is the only place the ' +
          'three grids, the phone rail and the tablet title band are chosen between.\n\n' +
          'Two of those branches are invisible to every prop: `useIsPhone` and ' +
          '`useIsTabletCalendar` read `matchMedia` directly, so below 768px the desktop header ' +
          'and grids are not rendered at all and `PhoneCalendar` takes the whole frame, while ' +
          '768-1023px keeps the real grid and adds a period band above it. The stories pin the ' +
          'width both ways - the viewport global for the eye, a `matchMedia` stub for the ' +
          'assertions - because the global alone only resizes the frame from the manager.\n\n' +
          '`canEditAppointments` is the other cross-cutting branch: it removes the toolbar CTA ' +
          'AND turns every marker undraggable through `isAppointmentDraggable`, which is one ' +
          'permission expressed in two places that can drift apart.\n\n' +
          'What is NOT here is the drag-error banner. `dragError` lives in the drag reducer and ' +
          'is only ever set by a rejected drop, and a drop is only accepted where ' +
          '`getDropAvailabilityIntervals` reports a bookable minute - which is populated from the ' +
          'bookable-slots endpoint. With the API answering empty (as it must in a story) the ' +
          'timeline swallows the drop before the move is planned, so the banner has no reachable ' +
          'state here. The Tasks planner does reach its equivalent; see the TaskCalendar stories.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: DAY_EVENTS,
    allAppointments: WEEK_EVENTS,
    activeCalendar: 'day',
    currentDate: CURRENT_DATE,
    weekStart: WEEK_START,
    canEditAppointments: true,
    filterOptions: AppointmentFilters,
    statusOptions: AppointmentStatusFilters,
    activeFilter: 'all',
    activeStatus: 'all',
    setActiveCalendar: fn(),
    setCurrentDate: fn(),
    setWeekStart: fn(),
    setReschedulePopup: fn(),
    setActiveAppointment: fn(),
    setViewPopup: fn(),
    setDetailPopup: fn(),
    setViewIntent: fn(),
    setChangeStatusPopup: fn(),
    setChangeStatusPreferredStatus: fn(),
    setChangeRoomPopup: fn(),
    setActiveFilter: fn(),
    setActiveStatus: fn(),
    onOpenWorkspace: fn(),
    onCreateFromCalendarSlot: fn(),
    onAddAppointment: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[760px] w-full bg-[var(--page)] p-3">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    const restoreApi = withOfflineApi();
    const restoreStores = withSeededStores();
    return () => {
      restoreStores();
      restoreApi();
    };
  },
} satisfies Meta<typeof AppointmentCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayView: Story = {
  name: 'Day view',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Exactly one grid is mounted. Asserting the day timeline alone would pass
       with all three rendered on top of each other, which is the failure mode a
       switch written as three independent `&&` blocks actually has. */
    await expect(dayGrid(canvasElement)).not.toBeNull();
    await expect(weekGrid(canvasElement)).toBeNull();
    await expect(teamCells(canvasElement)).toHaveLength(0);

    // The toolbar has to agree with what is drawn: the pill is the only thing
    // telling the user which of the three they are looking at.
    const viewPill = within(canvas.getByRole('group', { name: 'Calendar view' }));
    await expect(viewPill.getByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(viewPill.getByRole('button', { name: 'Week' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    /* Editing permission reaches the markers, not just the toolbar. `draggable`
       is derived from `isAppointmentDraggable`, a different code path to
       `showAddButton`, so the two are asserted separately here and in "Without
       edit permission". */
    await expect(canvas.getByRole('button', { name: 'New appointment' })).toBeInTheDocument();
    await expect(canvas.getByTitle(MILO_MARKER_TITLE)).toHaveAttribute('draggable', 'true');

    // The tablet band belongs to 768-1023px only; at the laptop default the
    // header stands alone above the grid.
    await expect(canvas.queryByRole('heading', { level: 2 })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday view. Two bookings on Tuesday 14 July, the toolbar above them, and the ' +
          'single-day timeline underneath.',
      },
    },
  },
};

export const WeekView: Story = {
  name: 'Week view',
  args: { activeCalendar: 'week', filteredList: WEEK_EVENTS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(weekGrid(canvasElement)).not.toBeNull();
    await expect(dayGrid(canvasElement)).toBeNull();

    /* The pager reads "week", and that is a real wire rather than a label:
       `Header` derives `navigatesByWeek` from `activeCalendar === 'week' &&
       !!setWeekStart`, so a container that forgot to pass `setWeekStart` would
       still render the week grid while stepping it one DAY at a time. The Tasks
       planner shipped exactly that bug. */
    await expect(canvas.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Next day' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The seven-day grid. `filterAppointmentsForWeek` scopes the events to the week rather ' +
          'than the day, so the Wednesday booking appears here and nowhere else.',
      },
    },
  },
};

export const TeamView: Story = {
  name: 'Team view (one column per practitioner)',
  args: { activeCalendar: 'team' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(dayGrid(canvasElement)).toBeNull();
    await expect(weekGrid(canvasElement)).toBeNull();

    /* The columns come from the team store, not from a prop, so the count is the
       assertion that the store seeding actually reached the grid: three members
       means the cell count is a multiple of three. */
    const cells = teamCells(canvasElement);
    await expect(cells.length).toBeGreaterThan(0);
    await expect(cells.length % TEAM.length).toBe(0);
    await expect(canvas.getByText('Dr. Elena Weber')).toBeInTheDocument();
    await expect(canvas.getByText('Priya Raman')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The day, split by practitioner. This is the only view that fetches team availability ' +
          'on mount (`useAppointmentViewAvailability`), which is why the stories stub the axios ' +
          'adapter rather than letting it reach the dev API.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // No CTA, because there is nothing this member may create.
    await expect(canvas.queryByRole('button', { name: 'New appointment' })).toBeNull();

    /* The grid is still fully drawn - a receptionist without booking rights must
       still SEE the day. What goes is the drag affordance on every marker, which
       is a separate derivation from the missing button above. */
    await expect(dayGrid(canvasElement)).not.toBeNull();
    await expect(canvas.getByTitle(MILO_MARKER_TITLE)).toHaveAttribute('draggable', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Read-only. `canEditAppointments` is threaded to two different places - `showAddButton` ' +
          'on the toolbar and `isAppointmentDraggable` inside the drag hook - so this story is ' +
          'the one that would catch them disagreeing.',
      },
    },
  },
};

export const Tablet: Story = {
  name: 'Tablet (768): the title band',
  globals: { viewport: { value: 'tablet', isRotated: false } },
  beforeEach: withViewportWidth(800),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The band names the period and counts what is on screen. Both halves matter:
       the count is passed in already scoped to the view (`dayEvents` here,
       `weekEvents` in the week view), so a band that counted `filteredList`
       instead would read "3 appointments" over a two-appointment day. */
    const band = canvas.getByRole('heading', { level: 2 });
    await expect(band).toHaveTextContent('Tue 14 Jul (2 appointments)');

    // The legend is the tablet frame's only status key - the desktop header has
    // no equivalent, so losing it here loses it entirely.
    await expect(canvas.getByText('Upcoming')).toBeInTheDocument();
    await expect(canvas.getByText('Emergency')).toBeInTheDocument();

    // The band is an addition to the desktop chrome, not a replacement: the real
    // grid and the real toolbar are both still here.
    await expect(dayGrid(canvasElement)).not.toBeNull();
    await expect(canvas.getByRole('group', { name: 'Calendar view' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Between 768 and 1023px the frame adds a period line above the grid carrying the ' +
          'visible-period title, its appointment count and the status legend. It deliberately ' +
          'adds no control of its own - every button still lives in the shared `Header` - so the ' +
          'two layers cannot fight over the same handler.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375): the purpose-built rail',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withViewportWidth(375),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Below 768px the desktop chrome is not rendered at all - not hidden, not
       shrunk. "Today" is the cheapest proof: it is a `Header` control and the
       phone frame has no equivalent. */
    await expect(dayGrid(canvasElement)).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Today' })).toBeNull();

    /* Both pills carry the aria-label "Calendar view", so the segments are what
       tell the two frames apart: the phone offers Month and has no Team, because
       'month' is phone-local state that is never pushed back into the shared
       `activeCalendar` union. */
    const viewPill = within(canvas.getByRole('group', { name: 'Calendar view' }));
    await expect(viewPill.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    await expect(viewPill.queryByRole('button', { name: 'Team' })).toBeNull();

    // The rail's own title line, with the day count taken from `dayEvents`.
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('Schedule');
    await expect(canvas.getByText('Tue 14 Jul · Dr. Elena Weber · 2 booked')).toBeInTheDocument();
    await expect(canvas.getByRole('group', { name: 'Clinic or my day' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The phone frame. A time grid cannot shrink to 375px, so the whole desktop branch is ' +
          'skipped and `PhoneCalendar` renders the day as a proportional rail under its own ' +
          'Day/Week/Month switch and a Clinic / My day toggle.',
      },
    },
  },
};
