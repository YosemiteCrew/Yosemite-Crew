import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhoneMyDayRail from './PhoneMyDayRail';
import type { MyDayRound } from './myDayRail';
import type { Task } from '@/app/features/tasks/types/task';

const ORG_ID = 'org-storybook';

/**
 * Every instant here is built with the LOCAL constructor rather than an ISO string.
 * `formatRailTime` and `isSameCalendarDay` both read local getters, so a UTC fixture
 * would render a different clock time on a machine in another zone - and half the
 * rail would fall off the day entirely for anyone east of Greenwich.
 */
const at = (hour: number, minute: number): Date => new Date(2026, 6, 14, hour, minute, 0, 0);

const NOW = at(9, 20);

const appointment = (
  id: string,
  name: string,
  start: Date,
  durationMinutes: number,
  status: Appointment['status'],
  service: string
): Appointment => ({
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
  room: { id: 'room-consult-1', name: 'Consult 1' },
  appointmentType: {
    id: 'type-1',
    name: service,
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  appointmentDate: start,
  startTime: start,
  endTime: new Date(start.getTime() + durationMinutes * 60 * 1000),
  timeSlot: `${start.getHours()}:${start.getMinutes()}`,
  durationMinutes,
  status,
  concern: 'Post-op recheck',
});

const task = (id: string, name: string, dueAt: Date, status: Task['status'] = 'PENDING'): Task => ({
  _id: id,
  organisationId: ORG_ID,
  assignedTo: 'vet-1',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'GENERAL',
  name,
  dueAt,
  status,
});

/**
 * An undated task. `dueAt` is typed as a required `Date`, but the API can send
 * nothing, and `toRailDate` answers null for anything it cannot use - which is
 * precisely how a task reaches the "Anytime today" tray.
 *
 * The missing value is spelled as an absent field rather than as
 * `new Date(Number.NaN)`. Both reach the same `toRailDate` -> null branch, so the
 * component sees no difference, but an invalid Date cannot survive Storybook's
 * own handling of `args`: the arg serialisers call `toISOString()` on every
 * `Date` they walk, which throws `RangeError: Invalid time value` and killed this
 * story with `storyThrewException` before its play function ever ran. The
 * component was never involved.
 */
const undatedTask = (id: string, name: string, status: Task['status'] = 'PENDING'): Task => ({
  ...task(id, name, NOW, status),
  // The cast is the point: the type promises a Date the API does not always send.
  dueAt: undefined as unknown as Date,
});

const APPOINTMENTS: Appointment[] = [
  appointment('appt-1', 'Milo', at(8, 30), 30, 'COMPLETED', 'Lameness recheck'),
  appointment('appt-2', 'Nala', at(9, 45), 30, 'UPCOMING', 'Dental scale and polish'),
];

const WARD_ROUND: MyDayRound = {
  id: 'round-1',
  title: 'Kennels round',
  dueAt: at(10, 0),
  items: [
    { id: 'item-1', label: 'Bruno · analgesia check', status: 'SIGNED' },
    { id: 'item-2', label: 'Juno · fluids rate', status: 'DUE' },
    { id: 'item-3', label: 'Otto · post-op obs', status: 'DUE' },
  ],
};

const UNDATED_ROUND: MyDayRound = {
  id: 'round-2',
  title: 'Isolation walk-round',
  items: [
    { id: 'iso-1', label: 'Sasha · barrier nursing', status: 'DUE' },
    { id: 'iso-2', label: 'Kira · temperature', status: 'DUE' },
  ],
};

const meta = {
  title: 'Appointments/Calendar/PhoneMyDayRail',
  component: PhoneMyDayRail,
  // A 375px phone. Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was
  // removed in Storybook 10 and is inert, so a story pinned the old way renders
  // the full panel width under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The signed-in vet's own day: appointments, tasks and ward rounds threaded onto one " +
          'chronological rail, with a now-marker dividing what has happened from what has not.\n\n' +
          'Three of its branches had never been drawn. The **empty day** is the state a locum ' +
          'sees on their first morning and a part-timer sees on every day off, and it is the only ' +
          'state where the rail has to say something rather than show something. The **"Anytime ' +
          'today" tray** is a horizontally scrolling pill row rather than a card stack, and it ' +
          'only exists when something on the day carries no time at all - which no fixture with ' +
          'tidy timestamps ever produces. The **ward-round rows** carry a per-item action that ' +
          'swaps between a `Sign` button and a `Signed` pill, so a round part-way through is the ' +
          'only render where both appear together.\n\n' +
          'Rounds have no backend model, type or endpoint anywhere in the monorepo - ' +
          '`MyDayRound` is a presentation-only shape, and `PhoneCalendar` passes `rounds={[]}`. ' +
          'These stories are therefore the only place the round rows exist at all, which is ' +
          'exactly why they are worth pinning down before the domain type lands.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    now: NOW,
    contextLabel: 'Tue 14 Jul · Dr. Weber',
    userInitials: 'EW',
    view: 'my-day',
    appointments: APPOINTMENTS,
    tasks: [],
    rounds: [],
    onViewChange: fn(),
    onOpenWorkspace: fn(),
    onSelectAppointment: fn(),
    onToggleTask: fn(),
    onOpenRound: fn(),
    onSignRoundItem: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] w-full bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneMyDayRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingScheduled: Story = {
  name: 'Empty day',
  args: { appointments: [], tasks: [], rounds: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Nothing scheduled today.')).toBeInTheDocument();

    /* The summary chips do NOT disappear with the rail - they are the frame the empty
       message sits inside, and both report "None today" rather than a bare 0. The
       Rounds chip is suppressed entirely, because rounds have no backend yet and a
       permanent "None due" would advertise an affordance that does not exist. */
    const appointmentsChip = canvas.getByText('Appointments').parentElement as HTMLElement;
    const chipRow = appointmentsChip.parentElement as HTMLElement;
    await expect(chipRow.children).toHaveLength(2);
    // Read per chip rather than as a page-wide count: two "None today" strings
    // anywhere would pass a count, including both of them inside one chip.
    await expect(within(appointmentsChip).getByText('None today')).toBeInTheDocument();
    const tasksChip = canvas.getByText('Tasks').parentElement as HTMLElement;
    await expect(within(tasksChip).getByText('None today')).toBeInTheDocument();
    await expect(canvas.queryByText('Rounds')).toBeNull();

    // No thread means nothing for the now-marker to divide, so it is not drawn -
    // a line across empty space would mark nothing.
    await expect(canvasElement.querySelector('[data-testid="my-day-now-marker"]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The day with nothing on it. The header, the view toggle and both summary chips stay, so ' +
          'the screen still reads as "your day" rather than as a failed load - the distinction ' +
          'matters, because an empty rail and a broken fetch would otherwise look identical.',
      },
    },
  },
};

export const AnytimeTray: Story = {
  name: 'Anytime today tray',
  args: {
    tasks: [
      task('task-1', 'Call Mrs Hartmann with bloods', at(11, 0)),
      undatedTask('task-2', 'Restock consult 1 sharps bin'),
      undatedTask('task-3', 'Sign off yesterday’s lab requests', 'COMPLETED'),
    ],
    rounds: [UNDATED_ROUND],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The heading counts the tray, not the day: two undated tasks and one undated
       round. An appointment can never land here - it always carries a start time -
       so this group is tasks and rounds only. */
    await expect(canvas.getByText('Anytime today · 3')).toBeInTheDocument();

    const tray = canvas.getByText('Anytime today · 3').nextElementSibling as HTMLElement;
    const pills = Array.from(tray.querySelectorAll('button'));
    await expect(pills).toHaveLength(3);
    // Sorted tasks-then-rounds, then by id - so the tray is stable whatever order
    // the API returned.
    await expect(pills[0]).toHaveTextContent('Restock consult 1 sharps bin');
    await expect(pills[1]).toHaveTextContent('Sign off yesterday’s lab requests');
    await expect(pills[2]).toHaveTextContent('Isolation walk-round · 2 due');
    // A pill row, not a card stack: it scrolls sideways rather than growing the page.
    await expect(getComputedStyle(tray).overflowX).toBe('auto');

    /* The dated task stayed on the thread rather than falling into the tray, and the
       chip counts BOTH - three tasks in the summary, three minus one on the rail. */
    await expect(canvas.getByText('Call Mrs Hartmann with bloods')).toBeInTheDocument();
    await expect(canvas.getByText('3 · on track')).toBeInTheDocument();
    // 09:45 is the first non-terminal appointment at or after 09:20.
    await expect(canvas.getByText('2 · next 09:45')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A day carrying three things with no time on them. They are pulled off the chronological ' +
          'thread into a `mt-auto` pill tray pinned to the bottom of the scroll area, so they ' +
          'never break the reading order of the timed rail above.\n\n' +
          'The undated tasks here carry no `dueAt` at all, which is what the API actually sends ' +
          'for a task with no due date - the field is typed as a required `Date`, so the absent ' +
          'case can only be spelled as a cast. `toRailDate` folds it, null and an unparseable ' +
          'date onto the same null. A completed pill keeps its ticked box; the tray is a to-do ' +
          'row, not a filter.',
      },
    },
  },
};

export const WardRoundPartlySigned: Story = {
  name: 'Ward round (Sign / Signed)',
  args: {
    tasks: [],
    rounds: [WARD_ROUND],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The heading counts what is still owed, not the round's size: 3 items, 2 due.
    await expect(canvas.getByText('Kennels round · 2 due')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Open ward' })).toBeInTheDocument();

    /* The per-item action is the surface: DUE items get a filled `Sign` button, SIGNED
       items get a static pill. Two of one and one of the other in the same round is
       the only render where the pair can be compared, and it is unreachable from any
       fixture that has every item in the same state. */
    const signButtons = canvas.getAllByRole('button', { name: 'Sign' });
    await expect(signButtons).toHaveLength(2);

    const signed = canvas.getByText('Signed');
    // A pill, not a disabled button - there is nothing left to do to a signed item,
    // so it must not be focusable or clickable.
    await expect(signed.tagName).toBe('SPAN');
    await expect(canvas.queryByRole('button', { name: 'Signed' })).toBeNull();

    // Rows keep the round's own order, so the signed item stays first.
    await expect(canvas.getByText('Bruno · analgesia check')).toBeInTheDocument();
    await expect(canvas.getByText('Juno · fluids rate')).toBeInTheDocument();

    await userEvent.click(signButtons[0]);
    // The handler is given the round AND the item id - the row alone is not enough
    // to identify what was signed.
    await expect(args.onSignRoundItem).toHaveBeenCalledWith(WARD_ROUND, 'item-2');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 10:00 ward round threaded into the rail between the morning appointments, part-way ' +
          'signed. Each item is a hairline-separated row inside one card, and the trailing control ' +
          'is the whole state machine: `Sign` while due, a `Signed` pill once done.\n\n' +
          'The card also carries an "Open ward" escape hatch, because signing three items one at ' +
          'a time on a phone is the exception - the rail is a prompt that the round exists, not ' +
          'the place the round is worked through.',
      },
    },
  },
};
