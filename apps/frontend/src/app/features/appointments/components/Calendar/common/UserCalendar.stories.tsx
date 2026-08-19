import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { AvailabilityInterval } from '@/app/features/appointments/components/Calendar/common/calendarInteractionProps';
import type { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import UserCalendar from './UserCalendar';

const ORG_ID = 'org-storybook';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const PRIYA = 'practitioner-priya';

const teamMember = (practionerId: string, name: string, todayAppointment: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  todayAppointment,
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

/** Three columns, which is what makes the per-member shading a per-member question at all. */
const TEAM: Team[] = [
  teamMember(ELENA, 'Dr. Elena Marsh', '4'),
  teamMember(RAVI, 'Dr. Ravi Patel', '2'),
  teamMember(PRIYA, 'Priya Raman', '0'),
];

/**
 * Availability is handed in as minute-of-day numbers, never as instants, so the
 * visible hour window below is the same in every timezone. Elena works two split
 * shifts, Ravi one, and Priya is off - three shapes that produce three different
 * dim patterns from one render.
 *
 * `getVisibleHourRange` pads the extremes (540 and 720) by 30 minutes and snaps to
 * the hour, so the window is 08:00-13:00 - six hour rows at 180px each zoomed in.
 * Every count in the play functions is derived from that window, which is why these
 * stories deliberately pass NO events: an appointment is an instant, it is read in
 * the preferred zone, and in a zone far enough from Europe/Berlin it would widen the
 * window and move every number here.
 */
const WORKING_WINDOWS: Record<string, AvailabilityInterval[]> = {
  [ELENA]: [
    { startMinute: 9 * 60, endMinute: 10 * 60 },
    { startMinute: 11 * 60, endMinute: 12 * 60 },
  ],
  [RAVI]: [{ startMinute: 10 * 60, endMinute: 11 * 60 + 30 }],
  [PRIYA]: [],
};

const NO_WINDOWS: AvailabilityInterval[] = [];

/** Stable module-level references: the calendar memoises on this callback's identity. */
const workingWindows = (_date: Date, practitionerId?: string): AvailabilityInterval[] =>
  WORKING_WINDOWS[practitionerId ?? ''] ?? NO_WINDOWS;

const noWindows = (): AvailabilityInterval[] => NO_WINDOWS;

const DAY = new Date('2026-03-12T10:00:00.000Z');

/**
 * One booking, used only by the stories that do not count hour rows. Its start is
 * the same instant as the rendered day, so `isOnPreferredTimeZoneCalendarDay` holds
 * in any zone and the marker always lands inside the window it helped compute.
 */
const APPOINTMENT: Appointment = {
  id: 'appt-user-calendar-1',
  patient: {
    id: 'companion-poppy',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-maya', name: 'Maya Whitfield' },
  },
  companion: {
    id: 'companion-poppy',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-maya', name: 'Maya Whitfield' },
  },
  organisationId: ORG_ID,
  lead: { id: ELENA, name: 'Dr. Elena Marsh' },
  appointmentType: {
    id: 'svc-dental-consult',
    name: 'Dental consultation',
    speciality: { id: 'spec-dentistry', name: 'Dentistry' },
  },
  appointmentDate: DAY,
  startTime: DAY,
  endTime: new Date(DAY.getTime() + 30 * 60 * 1000),
  timeSlot: '30 minutes',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Lameness recheck',
};

const MARKER_TITLE = 'Poppy · Whitfield • Dental consultation • Lameness recheck';

const HOUR_ROW_PX = 180;

/**
 * Every member-hour cell in document order. The calendar nests hour rows outside
 * team columns, so this list runs hour by hour, three cells at a time.
 *
 * The cell itself carries no test hook, but each one wraps exactly one `Slot`, and
 * `Slot`'s section is labelled - so the labelled section's parent is the cell.
 */
const memberCells = (canvasElement: HTMLElement): HTMLElement[] =>
  [...canvasElement.querySelectorAll<HTMLElement>('section[aria-label^="Appointments slot"]')].map(
    (slot) => slot.parentElement as HTMLElement
  );

/** The cells of one team column, top hour first. */
const columnCells = (canvasElement: HTMLElement, memberIndex: number): HTMLElement[] =>
  memberCells(canvasElement).filter(
    (cell) => [...(cell.parentElement as HTMLElement).children].indexOf(cell) === memberIndex
  );

/**
 * The dim rectangles inside one cell. They have no class of their own worth
 * matching - `pointer-events-none absolute left-0 right-0 z-1` describes half the
 * calendar - so the identifier is the one token only they paint with.
 */
const dimsIn = (cell: HTMLElement): HTMLElement[] => [
  ...cell.querySelectorAll<HTMLElement>('[style*="calendar-dim-overlay"]'),
];

const dimsForMember = (canvasElement: HTMLElement, memberIndex: number): HTMLElement[] =>
  columnCells(canvasElement, memberIndex).flatMap((cell) => dimsIn(cell));

/** The grid that lays the team columns out inside one hour row. */
const teamGrid = (canvasElement: HTMLElement): HTMLElement =>
  columnCells(canvasElement, 0)[0].parentElement as HTMLElement;

const totalHeight = (elements: HTMLElement[]): number =>
  elements.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);

const meta = {
  title: 'Appointments/Calendar/UserCalendar',
  component: UserCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The day-by-practitioner planner: one column per team member, and behind every column a ' +
          'layer of **dim rectangles marking the hours that member is not working**. That layer ' +
          'had never been drawn.\n\n' +
          'It is gated twice, and both gates are shut at rest. `availabilityLoaded` defaults to ' +
          '`false`, and `getVisibleAvailabilityIntervals` is an optional prop - so a UserCalendar ' +
          'mounted with neither computes `unavailableByMember` as three empty arrays and paints ' +
          'nothing. Every snapshot of this view that has ever existed is the undimmed one: a grid ' +
          'in which 3am and 3pm look equally bookable.\n\n' +
          'The two gates are **not** symmetrical, which is the thing worth reviewing here. ' +
          '`computeUnavailableSegments` only consults `availabilityLoaded` when the member has no ' +
          'intervals at all. A member with a shift shades the moment the intervals arrive, ' +
          'regardless of the flag; a member with the day off shades only once the flag flips. So ' +
          'during the load there is a real, reachable frame in which the busiest column is greyed ' +
          'correctly and the empty column reads as open all day. "Before availability lands" below ' +
          'is that frame.\n\n' +
          'Geometry is exact rather than approximate. An hour row is 180px zoomed in ' +
          '(`getHourRowHeightPx`), segments are clamped to the hour they fall in and positioned as ' +
          'percentages, so a shift ending at 11:30 leaves a 90px rectangle in the 11:00 row and a ' +
          'full 180px one in every row after it. The stories assert those pixels, the per-column ' +
          'counts, and the z-order the layer sits in - the dim is `z-1`, the hour rules are ' +
          '`z-10`, and an appointment marker is `z-20`, so a booking is never greyed out by the ' +
          'shading behind it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    events: [],
    date: DAY,
    canEditAppointments: true,
    // Auto-scroll parks the viewport on the first event or on the default focus
    // minute, which would make the visible slice of a 1080px grid depend on the
    // wall clock. Pinned to the top instead.
    skipAutoScroll: true,
    handleViewAppointment: fn(),
    handleDetailAppointment: fn(),
    handleRescheduleAppointment: fn(),
    handleChangeRoomAppointment: fn(),
    handleAcceptAppointment: fn(),
    canDragAppointment: () => true,
    onAppointmentDragStart: fn(),
    onAppointmentDragEnd: fn(),
    onAppointmentDropAt: fn(),
    onDragHoverTarget: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[680px] w-full max-w-[1080px] bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    const orgSnapshot = useOrgStore.getState();
    const teamSnapshot = useTeamStore.getState();
    const authSnapshot = useAuthStore.getState();

    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAM);
    /* Seeded rather than left alone. `UserLabels` paints the column header in
       --blue-text when `attributes.sub` matches a member's practitioner id, and
       other story files in this Storybook seed that same singleton with real
       practitioner ids. Without an explicit value here, which column reads as "you"
       depends on which story you happened to open first. This id is nobody on the
       team, so no column is highlighted in any order. */
    useAuthStore.setState({ attributes: { sub: 'practitioner-not-on-this-team' } });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useTeamStore.setState(teamSnapshot);
      useAuthStore.setState(authSnapshot);
    };
  },
} satisfies Meta<typeof UserCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'At rest (no availability wired)',
  args: { events: [APPOINTMENT] },
  play: async ({ canvasElement }) => {
    const cells = memberCells(canvasElement);
    // Three columns in every hour row, so the cell count is always a multiple of 3.
    await expect(cells.length).toBeGreaterThan(0);
    await expect(cells.length % 3).toBe(0);

    /* The whole finding, in one line: with no interval provider and the flag
       false, not a single rectangle is painted anywhere in the grid. */
    await expect(cells.flatMap((cell) => dimsIn(cell))).toHaveLength(0);

    const grid = teamGrid(canvasElement);
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(3);
    await expect(grid.children).toHaveLength(3);

    // The rest of the calendar is fully drawn, which is what makes the missing
    // layer easy to miss: markers, rules and headers all render.
    await expect(within(canvasElement).getByTitle(MARKER_TITLE)).toBeInTheDocument();
    await expect(within(canvasElement).getByText('Dr. Elena Marsh')).toBeInTheDocument();
    await expect(within(canvasElement).getByText('Priya Raman')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The planner as every existing snapshot holds it. Priya has no bookings and no hours, ' +
          'Elena has one appointment, and the two columns are drawn identically - both plain, both ' +
          'reading as open for the full window. This is the baseline the next three stories are ' +
          'read against.',
      },
    },
  },
};

export const WorkingHours: Story = {
  name: 'Availability loaded (three shift shapes)',
  args: {
    getVisibleAvailabilityIntervals: workingWindows,
    getDropAvailabilityIntervals: workingWindows,
    availabilityLoaded: true,
  },
  play: async ({ canvasElement }) => {
    const rows = memberCells(canvasElement).length / 3;
    // 08:00-13:00: the availability extremes (09:00 and 12:00) padded by 30
    // minutes and snapped to the hour.
    await expect(rows).toBe(6);

    const elena = dimsForMember(canvasElement, 0);
    const ravi = dimsForMember(canvasElement, 1);
    const priya = dimsForMember(canvasElement, 2);

    /* Counts, not presence. Elena's two shifts leave three gaps, but the 12:00-14:00
       tail crosses an hour boundary and is clamped into two rectangles, so four.
       Ravi's single shift leaves two gaps that clamp into five. Priya's empty
       interval list becomes one segment across the whole window - one rectangle per
       row. A change that stopped closing the trailing gap would show up here as
       3 / 4 / 6 rather than as a silently bookable evening. */
    await expect(elena).toHaveLength(4);
    await expect(ravi).toHaveLength(5);
    await expect(priya).toHaveLength(6);

    /* Total dimmed height is the real reviewable number: of the six hours on
       screen Elena is free for two, Ravi for one and a half, Priya for none. */
    await expect(Math.round(totalHeight(elena))).toBe(4 * HOUR_ROW_PX);
    await expect(Math.round(totalHeight(ravi))).toBe(4.5 * HOUR_ROW_PX);
    await expect(Math.round(totalHeight(priya))).toBe(rows * HOUR_ROW_PX);

    // Ravi's shift ends at 11:30, so his third rectangle is the half-hour tail of
    // the 11:00 row - the only partial one in the grid.
    await expect(Math.round(ravi[0].getBoundingClientRect().height)).toBe(HOUR_ROW_PX);
    await expect(Math.round(ravi[2].getBoundingClientRect().height)).toBe(HOUR_ROW_PX / 2);
    await expect(Math.round(ravi[3].getBoundingClientRect().height)).toBe(HOUR_ROW_PX);

    // `left-0 right-0`: a rectangle spans its own column and stops there.
    const firstCell = columnCells(canvasElement, 2)[0];
    await expect(Math.round(priya[0].getBoundingClientRect().width)).toBe(
      Math.round(firstCell.getBoundingClientRect().width)
    );

    /* The wash itself. Polled rather than read once: the rectangle carries an
       inline `transition: opacity 0.25s ease`, so a play function can arrive
       mid-transition. The channels are asserted rather than the exact
       serialisation of `rgba(0, 0, 0, 0.045)` - what the design owns is "black at
       about 4.5%", not how a browser prints three decimal places. */
    await waitFor(() => {
      const background = getComputedStyle(priya[0]).backgroundColor;
      const alpha = Number(/^rgba\(0, 0, 0, ([\d.]+)\)$/.exec(background)?.[1]);
      expect(alpha).toBeGreaterThan(0.03);
      expect(alpha).toBeLessThan(0.06);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The loaded state, with three deliberately different shift shapes in one render: a split ' +
          'shift, a shift that ends mid-hour, and a day off.\n\n' +
          'The mid-hour end is the case worth looking at. Segments are clamped to the hour row ' +
          'they fall in and sized as a percentage of it, so 11:30 is a 90px rectangle sitting on ' +
          'the bottom half of the 11:00 row with no rule of its own to land on - the sub-hour grid ' +
          'lines are drawn at the 15-minute steps by a separate layer, and nothing guarantees a ' +
          'shift boundary coincides with one.',
      },
    },
  },
};

export const BeforeAvailabilityLands: Story = {
  name: 'Before availability lands (asymmetric gate)',
  args: {
    getVisibleAvailabilityIntervals: workingWindows,
    getDropAvailabilityIntervals: workingWindows,
    availabilityLoaded: false,
  },
  play: async ({ canvasElement }) => {
    // The window is computed from the same intervals, so the grid is identical to
    // the loaded story: six rows. Only the shading differs.
    await expect(memberCells(canvasElement).length / 3).toBe(6);

    await expect(dimsForMember(canvasElement, 0)).toHaveLength(4);
    await expect(dimsForMember(canvasElement, 1)).toHaveLength(5);
    /* Priya's column: identical props, identical intervals (none), and no shading
       at all - because `computeUnavailableSegments` returns `[]` for an empty
       interval list until the flag flips. Her day off is indistinguishable from a
       fully open day for as long as the load takes. */
    await expect(dimsForMember(canvasElement, 2)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same intervals as the story above with `availabilityLoaded` still `false` - the ' +
          'frame the planner actually renders while the availability request is in flight.\n\n' +
          'Elena and Ravi are shaded exactly as they will be when the flag flips, because their ' +
          'segments are derived from intervals that are already here. Priya is not shaded at all. ' +
          'The flag is doing one job only: distinguishing "this member has no hours today" from ' +
          '"we do not know this member\'s hours yet", and it only reaches the render in the second ' +
          'case. A reviewer should decide whether an unknown column should stay plain, or whether ' +
          'the whole grid should hold its shading back until the flag is true - the two columns ' +
          'here disagree about which it is.',
      },
    },
  },
};

export const ClosedDay: Story = {
  name: 'Clinic closed (dim under a marker)',
  args: {
    events: [APPOINTMENT],
    getVisibleAvailabilityIntervals: noWindows,
    getDropAvailabilityIntervals: noWindows,
    availabilityLoaded: true,
    onCreateAppointmentAt: fn(),
  },
  play: async ({ canvasElement }) => {
    const cells = memberCells(canvasElement);
    await expect(cells.length).toBeGreaterThan(0);
    // Nobody has hours, so every cell in the grid carries exactly one full-row
    // rectangle - the count is the same whatever window the event produces.
    cells.forEach((cell) => {
      expect(dimsIn(cell)).toHaveLength(1);
      expect(Math.round(dimsIn(cell)[0].getBoundingClientRect().height)).toBe(HOUR_ROW_PX);
    });

    /* Stacking, read off the three layers that share one cell. Nothing here creates
       a stacking context, so the marker's z-20 competes directly with the dim's
       z-1: a booking on a closed day is drawn at full strength over the wash, not
       greyed out with it. */
    const markerBox = canvasElement.querySelector<HTMLElement>(
      'section[aria-label^="Appointments slot"] div.z-20'
    ) as HTMLElement;
    const markerCell = (markerBox.closest('section') as HTMLElement).parentElement as HTMLElement;
    const dim = dimsIn(markerCell)[0];
    const hourRules = markerCell.querySelector<HTMLElement>('div.z-10') as HTMLElement;

    await expect(getComputedStyle(dim).zIndex).toBe('1');
    await expect(getComputedStyle(hourRules).zIndex).toBe('10');
    await expect(getComputedStyle(markerBox).zIndex).toBe('20');
    await expect(within(markerCell).getByTitle(MARKER_TITLE)).toBeInTheDocument();

    /* The booking affordance underneath. `SlotCreateButton` is an invisible
       full-slot button and the wash is `pointer-events-none`, so the wash covers
       the button's whole box without intercepting a single click on it - a closed
       hour still takes a booking click, and only `tryCreateAppointmentAt`'s own
       guard (a warning toast) turns it away. */
    const createButton = within(markerCell).getByRole('button', {
      name: /^Create appointment on /,
    });
    await expect(getComputedStyle(dim).pointerEvents).toBe('none');
    const dimBox = dim.getBoundingClientRect();
    const buttonBox = createButton.getBoundingClientRect();
    await expect(dimBox.top).toBeLessThanOrEqual(buttonBox.top);
    await expect(dimBox.bottom).toBeGreaterThanOrEqual(buttonBox.bottom);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Availability loaded and nobody rostered: the whole grid washes out. This is the render ' +
          'that shows the layer is decoration over a live surface rather than a mask.\n\n' +
          'Two facts a reviewer should weigh. The appointment marker sits above the wash at ' +
          '`z-20`, which is right - a booking that already exists on a closed day must stay ' +
          'legible. The invisible create button also sits above it, and the wash is ' +
          '`pointer-events-none`, so every dimmed minute still accepts a click and answers with a ' +
          '"Slot unavailable" toast. Whether shading that reads as disabled should behave as ' +
          'clickable is a design decision, and this is the first story in which it is visible.',
      },
    },
  },
};

export const NarrowColumns: Story = {
  name: 'Phone width (170px column floor)',
  args: {
    getVisibleAvailabilityIntervals: workingWindows,
    getDropAvailabilityIntervals: workingWindows,
    availabilityLoaded: true,
  },
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10: it still type-checks and still renders, at the full panel width,
  // proving nothing. `mobile` is the 375px preset registered in .storybook/preview.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const grid = teamGrid(canvasElement);
    const columnWidths = [...grid.children].map(
      (column) => (column as HTMLElement).getBoundingClientRect().width
    );

    /* Both halves of the grid contract, because either one alone can pass while
       the layout is wrong: three declared tracks with a column missing still
       reads as three tracks, and three children in a one-track grid stack. */
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(3);
    await expect(grid.children).toHaveLength(3);
    await expect(columnWidths).toHaveLength(3);
    // `getCalendarColumnGridStyle(3, 170)` - the floor is what keeps a name and a
    // subline legible, and it is the reason this view scrolls sideways instead of
    // squeezing. Measured off the box, not `getComputedStyle().width`, which would
    // report the content box.
    columnWidths.forEach((width) => {
      expect(width).toBeGreaterThanOrEqual(170);
    });
    await expect(Math.round(columnWidths.reduce((sum, width) => sum + width, 0))).toBe(
      Math.round(grid.getBoundingClientRect().width)
    );

    // 3 x 170 plus the two 64px gutters is 638px against a 375px viewport, so the
    // outer container is genuinely scrollable rather than merely allowed to be.
    const scroller = canvasElement.querySelector<HTMLElement>(
      '[data-calendar-scroll="true"]'
    ) as HTMLElement;
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);

    /* The time gutter is `sticky left-0`, which is the only thing keeping the hour
       readable once the grid is scrolled. Its text is the full label set for the
       first row: the hour plus the three 15-minute steps, which only render because
       a 180px row leaves 45px per step. */
    const gutter = canvasElement.querySelector<HTMLElement>(
      'div.sticky.left-0.z-20'
    ) as HTMLElement;
    await expect(getComputedStyle(gutter).position).toBe('sticky');
    await expect(gutter).toHaveTextContent('8:00 AM');
    await expect(gutter).toHaveTextContent('8:15 AM');
    await expect(gutter).toHaveTextContent('8:45 AM');

    // The shading survives the narrow layout unchanged - it is positioned in
    // percentages, so it tracks the column rather than a pixel width.
    await expect(dimsForMember(canvasElement, 2)).toHaveLength(6);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same loaded grid at 375px. Nothing about this view re-forms for a phone: the ' +
          'columns hit their 170px floor, the container scrolls horizontally, and the time gutter ' +
          'and the day band stay pinned with `sticky left-0`.\n\n' +
          'Worth reviewing together with the shading, because the two interact: a wash positioned ' +
          'with `left-0 right-0` inside a 170px column is a much denser stripe than the same wash ' +
          'in a 300px one, and the 15-minute rules underneath it stay at full contrast either way.',
      },
    },
  },
};
