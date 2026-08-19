import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhoneCalendar from './PhoneCalendar';
import type { Team } from '@/app/features/organization/types/team';
import type { Task } from '@/app/features/tasks/types/task';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';

const ORG_ID = 'org-storybook';
const ME = 'vet-weber';

/**
 * Instants are UTC in the middle of the working day. Every date key this screen
 * derives is computed in the PREFERRED zone (Europe/Berlin, +2 in July), never the
 * browser's, so an 08:00-17:00 UTC fixture keeps its day on any machine - and the
 * context label below reads "Tue 14 Jul" everywhere.
 */
const NOW = new Date('2026-07-14T09:20:00.000Z');
const CURRENT_DATE = new Date('2026-07-14T12:00:00.000Z');
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');

const appointment = (
  id: string,
  name: string,
  startIso: string,
  status: Appointment['status'] = 'UPCOMING'
): Appointment => {
  const startTime = new Date(startIso);
  return {
    id,
    patient: {
      id: `companion-${id}`,
      name,
      species: 'dog',
      breed: 'Beagle',
      parent: { id: `parent-${id}`, name: 'Lena Hartmann' },
    },
    companion: {
      id: `companion-${id}`,
      name,
      species: 'dog',
      breed: 'Beagle',
      parent: { id: `parent-${id}`, name: 'Lena Hartmann' },
    },
    organisationId: ORG_ID,
    lead: { id: ME, name: 'Elena Weber' },
    room: { id: 'room-consult-1', name: 'Consult 1' },
    appointmentType: {
      id: 'type-1',
      name: 'Lameness recheck',
      speciality: { id: 'spec-1', name: 'General practice' },
    },
    appointmentDate: startTime,
    startTime,
    endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
    timeSlot: '10:00 - 10:30',
    durationMinutes: 30,
    status,
    concern: 'Post-op recheck',
  };
};

/** Tuesday's two bookings - the pair the day header counts. */
const DAY_EVENTS: Appointment[] = [
  appointment('appt-1', 'Milo', '2026-07-14T08:00:00.000Z', 'COMPLETED'),
  appointment('appt-2', 'Nala', '2026-07-14T10:30:00.000Z'),
];

/** The rest of the week, so the week and month views have something to bucket. */
const WEEK_EVENTS: Appointment[] = [
  ...DAY_EVENTS,
  appointment('appt-3', 'Juno', '2026-07-15T09:00:00.000Z'),
  appointment('appt-4', 'Otto', '2026-07-15T13:00:00.000Z'),
  appointment('appt-5', 'Bruno', '2026-07-17T11:00:00.000Z'),
];

const TEAM: Team[] = [
  {
    _id: 'team-1',
    practionerId: ME,
    organisationId: ORG_ID,
    name: 'Elena Weber',
    role: 'VETERINARIAN',
    speciality: [],
    status: 'Available',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
];

const TASKS: Task[] = [
  {
    _id: 'task-1',
    organisationId: ORG_ID,
    assignedTo: ME,
    audience: 'EMPLOYEE_TASK',
    source: 'CUSTOM',
    category: 'GENERAL',
    status: 'PENDING',
    name: 'Chase Bruno’s haematology result',
    dueAt: new Date('2026-07-14T13:00:00.000Z'),
  },
];

/**
 * Seeds the three stores this screen reads, and puts them back afterwards.
 *
 * `taskIdsByOrgId` carrying the org key is what keeps the mount off the network:
 * `useLoadTasksForPrimaryOrg` returns at its own `Object.hasOwn` guard, so there is
 * no task service stub anywhere here and the component under review is the real one.
 * `useTeamForPrimaryOrg` and `useCompanionsForPrimaryOrg` are plain selectors with
 * no loader, so seeding is enough for them too.
 */
const seedStores = () => {
  const orgSnapshot = useOrgStore.getState();
  const taskSnapshot = useTaskStore.getState();
  const teamSnapshot = useTeamStore.getState();

  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useTaskStore.setState({
    tasksById: Object.fromEntries(TASKS.map((item) => [item._id, item])),
    taskIdsByOrgId: { [ORG_ID]: TASKS.map((item) => item._id) },
    status: 'loaded',
  });
  useTeamStore.setState({
    teamsById: Object.fromEntries(TEAM.map((item) => [item._id, item])),
    teamIdsByOrgId: { [ORG_ID]: TEAM.map((item) => item._id) },
    status: 'loaded',
  });

  return () => {
    useOrgStore.setState(orgSnapshot);
    useTaskStore.setState(taskSnapshot);
    useTeamStore.setState(teamSnapshot);
  };
};

const meta = {
  title: 'Appointments/Calendar/PhoneCalendar',
  component: PhoneCalendar,
  // A 375px phone. Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was
  // removed in Storybook 10 and is inert - a story pinned the old way renders the
  // desktop branch at full panel width under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The whole phone calendar below 768px, and the four screens it switches between.\n\n' +
          'They are mutually exclusive early returns, not tabs - each branch replaces the last, ' +
          'including the chrome around it, so the four are impossible to see side by side in the ' +
          'running app and only one of the four children (`PhoneMonthOverview`) had a story of its ' +
          'own. What had never been drawn is the SWITCHING: which pill owns which axis, what ' +
          'survives a switch, and what leaks back up to the page.\n\n' +
          'Two pills, two axes. The **mode** pill (Clinic / My day) exists on every clinic screen ' +
          'because `PhoneMyDayRail` owns the toggle on its own screen and the desktop Header is ' +
          'not rendered at this width - without it a phone user could reach My day and never get ' +
          'back. The **view** pill (Day / Week / Month) is clinic-only, and `month` is deliberately ' +
          'NOT pushed back up: the shared `activeCalendar` union has no such value, and widening ' +
          'it would ripple into the desktop Header and all three desktop grids. So switching to ' +
          'Month changes the phone and tells the page nothing, which the story below asserts ' +
          'directly rather than by inspection.\n\n' +
          'The stores are seeded rather than mocked - `useLoadTasksForPrimaryOrg` bails at its own ' +
          'guard once the org key is present, so these mount the real component with no network ' +
          'and no service stub.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointments: WEEK_EVENTS,
    dayEvents: DAY_EVENTS,
    currentDate: CURRENT_DATE,
    setCurrentDate: fn(),
    weekStart: WEEK_START,
    setWeekStart: fn(),
    activeCalendar: 'day',
    setActiveCalendar: fn(),
    onSelectAppointment: fn(),
    onOpenWorkspace: fn(),
    onCreateFromCalendarSlot: fn(),
    canEditAppointments: true,
    currentUserPractitionerId: ME,
    now: NOW,
  },
  decorators: [
    (Story) => (
      <div className="h-[780px] w-full bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
  beforeEach: seedStores,
} satisfies Meta<typeof PhoneCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayView: Story = {
  name: 'Day',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    /* Three derived values in one line: the day formatted in the preferred zone, the
       signed-in vet's name resolved out of the team store by practitioner id, and the
       count of THIS day's bookings rather than the week's. */
    await expect(canvas.getByText('Tue 14 Jul · Elena Weber · 2 booked')).toBeInTheDocument();
    await expect(canvas.getByRole('group', { name: 'Select a day' })).toBeInTheDocument();
    await expect(canvas.getByRole('region', { name: 'Day schedule' })).toBeInTheDocument();

    const viewPill = within(canvas.getByRole('group', { name: 'Calendar view' }));
    await expect(viewPill.getByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(viewPill.getByRole('button', { name: 'Month' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    const modePill = within(canvas.getByRole('group', { name: 'Clinic or my day' }));
    await expect(modePill.getByRole('button', { name: 'Clinic' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // The other three branches are absent, not merely hidden - these are early returns.
    await expect(canvas.queryByRole('region', { name: 'Month overview' })).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'My day' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Previous week' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default branch: any `activeCalendar` that is not `week` or `team` seeds it. A ' +
          'proportional day rail with the empty hours folded, its own date strip rather than a ' +
          'shrunken week header, and both pills above.',
      },
    },
  },
};

export const WeekView: Story = {
  name: 'Week',
  args: { activeCalendar: 'week' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Next week' })).toBeInTheDocument();

    /* The week's own view switcher is a `radiogroup`, not a SegmentedPill - the two
       controls do the same job with different roles, so a keyboard user meets a
       different widget depending on which branch they are in. Worth seeing. */
    const viewRadios = within(canvas.getByRole('radiogroup', { name: 'Calendar view' }));
    await expect(viewRadios.getByRole('radio', { name: 'Week' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(viewRadios.getByRole('radio', { name: 'Day' })).toHaveAttribute(
      'aria-checked',
      'false'
    );

    // The mode pill survives the switch; the day chrome does not.
    await expect(canvas.getByRole('group', { name: 'Clinic or my day' })).toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Schedule' })).toBeNull();
    await expect(canvas.queryByRole('group', { name: 'Select a day' })).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Month overview' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The week as a load list rather than a grid, with its own prev/next pill. Note the view ' +
          'switcher changes role between branches: a `group` of pressed buttons on Day, a ' +
          '`radiogroup` of radios here and on Month.',
      },
    },
  },
};

export const SwitchToMonth: Story = {
  name: 'Switching to Month (stays phone-local)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();

    const viewPill = within(canvas.getByRole('group', { name: 'Calendar view' }));
    await userEvent.click(viewPill.getByRole('button', { name: 'Month' }));

    const monthRegion = canvas.getByRole('region', { name: 'Month overview' });
    await expect(canvas.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Schedule' })).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Day schedule' })).toBeNull();

    /* What the branch actually mounts: a weekday strip and a day grid, both seven
       tracks wide. July 2026 opens on a Wednesday, so the grid pads with two leading
       days and fills five whole weeks - 35 cells, not 31. Asserting the track count
       AND the cell count is what separates a real month grid from seven columns of
       nothing: `grid-cols-7` with 31 children would still report seven tracks. */
    const [weekdayStrip, dayGrid] = Array.from(
      monthRegion.querySelectorAll<HTMLElement>('.grid-cols-7')
    );
    await expect(getComputedStyle(dayGrid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(7);
    await expect(weekdayStrip.children).toHaveLength(7);
    await expect(dayGrid.children).toHaveLength(35);

    /* The assertion this story exists for. `month` is not a member of the shared
       `activeCalendar` union, so `applyClinicView` deliberately skips the callback -
       the phone changes and the page is never told. A future refactor that "tidies"
       that branch by always calling up would put an unhandled value into desktop
       state, and only this check would catch it. */
    await expect(args.setActiveCalendar).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Month is unreachable from any prop: `seedClinicView` maps everything except `week` to ' +
          '`day`, so the only way in is a tap. That is also why `PhoneMonthOverview` having a ' +
          'story of its own was not enough - the branch that mounts it had never been exercised.',
      },
    },
  },
};

export const MyDayView: Story = {
  name: 'My day',
  args: { activeCalendar: 'team' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('region', { name: 'My day' })).toBeInTheDocument();
    // Name and initials both come from the team store lookup on practitioner id.
    await expect(canvas.getByText('Tue 14 Jul · Elena Weber')).toBeInTheDocument();
    await expect(canvas.getByText('EW')).toBeInTheDocument();
    // Two chips, never three: `rounds={[]}` is passed deliberately, because rounds
    // have no model or endpoint in this codebase and a "None due" chip would
    // advertise an affordance that does not exist.
    await expect(canvas.getByText('Appointments')).toBeInTheDocument();
    await expect(canvas.getByText('Tasks')).toBeInTheDocument();
    await expect(canvas.queryByText('Rounds')).toBeNull();

    // The rail owns the mode toggle itself, and there is no view pill here at all -
    // Day/Week/Month is a clinic-only axis.
    await expect(canvas.getByRole('button', { name: 'My day', pressed: true })).toBeInTheDocument();
    await expect(canvas.queryByRole('group', { name: 'Calendar view' })).toBeNull();
    await expect(canvas.queryByRole('heading', { name: 'Schedule' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          "The signed-in vet's own rail, seeded by `activeCalendar === 'team'`. The appointments " +
          'are `dayEvents` narrowed to their `lead.id`, the tasks come from the seeded store via ' +
          '`useTasksAssignedToUser`, and the header is built from the team record rather than ' +
          'from anything the page passed down.',
      },
    },
  },
};

export const ReturnFromMyDay: Story = {
  name: 'Back to Clinic from My day',
  args: { activeCalendar: 'team' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'My day' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Clinic' }));

    /* Back on the clinic axis at whatever view was seeded - `seedClinicView('team')`
       falls through to `day`, so a vet who started on My day lands on the day rail
       rather than on nothing. Unlike the Month switch, this one IS pushed back up,
       because `day` is a real member of the shared union. */
    await expect(canvas.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    await expect(canvas.queryByRole('region', { name: 'My day' })).toBeNull();
    await expect(args.setActiveCalendar).toHaveBeenCalledWith('day');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The return path, and the reason the mode pill is duplicated onto every clinic screen. ' +
          "The rail's own toggle is the only way out of My day at this width, so the two pills " +
          'have to agree about what "Clinic" means - here, the view the phone was last seeded ' +
          'with.',
      },
    },
  },
};
