import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhoneMonthOverview from './PhoneMonthOverview';
import type { PhoneMonthCell } from './phoneMonthModel';

const ORG_ID = 'org-storybook';

const NAMES = [
  'Poppy',
  'Milo',
  'Nala',
  'Rufus',
  'Juno',
  'Otto',
  'Sasha',
  'Bruno',
  'Kira',
  'Frankie',
  'Toby',
  'Hazel',
];

const TYPES = [
  'Annual check-up',
  'Dental scale and polish',
  'Lameness recheck',
  'Vaccination',
  'Post-op recheck',
];

const STATUSES: Appointment['status'][] = [
  'UPCOMING',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'REQUESTED',
];

const LEADS = ['Dr. Weber', 'Dr. Osei', 'Dr. Lindqvist'];
const ROOMS = ['Consult 1', 'Consult 2', 'Theatre'];

/**
 * Times are set at 08:00-19:00 UTC on purpose: the model buckets appointments by
 * their date key in the *preferred* timezone (Europe/Berlin by default), so a
 * midday instant can never slide into the neighbouring day and move a dot.
 */
const makeAppointment = (dateKey: string, index: number, isEmergency = false): Appointment => {
  const dayOfMonth = Number(dateKey.slice(8, 10));
  const name = NAMES[(dayOfMonth + index) % NAMES.length];
  const hour = String(8 + index).padStart(2, '0');
  const startTime = new Date(`${dateKey}T${hour}:30:00.000Z`);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

  return {
    id: `${dateKey}-${index}`,
    patient: {
      id: `companion-${dateKey}-${index}`,
      name,
      species: 'dog',
      breed: 'Beagle',
      parent: { id: `parent-${index}`, name: 'Lena Hartmann' },
    },
    lead: { id: `vet-${index % LEADS.length}`, name: LEADS[index % LEADS.length] },
    room: { id: `room-${index % ROOMS.length}`, name: ROOMS[index % ROOMS.length] },
    appointmentType: {
      id: `type-${index % TYPES.length}`,
      name: TYPES[index % TYPES.length],
      speciality: { id: 'spec-1', name: 'General practice' },
    },
    organisationId: ORG_ID,
    appointmentDate: startTime,
    startTime,
    endTime,
    timeSlot: `${hour}:30`,
    durationMinutes: 30,
    status: STATUSES[index % STATUSES.length],
    isEmergency,
  };
};

const day = (dateKey: string, count: number, emergencyIndex = -1): Appointment[] =>
  Array.from({ length: count }, (_, index) =>
    makeAppointment(dateKey, index, index === emergencyIndex)
  );

/**
 * July 2026 starts on a Wednesday, so the Monday-first grid borrows 29-30 June
 * and runs to 2 August - which is what makes the padding-cell story below a real
 * case rather than a contrivance.
 */
const JULY_APPOINTMENTS: Appointment[] = [
  ...day('2026-07-02', 3),
  ...day('2026-07-06', 6),
  ...day('2026-07-07', 9),
  ...day('2026-07-08', 12, 2),
  ...day('2026-07-13', 4),
  ...day('2026-07-14', 5, 1),
  ...day('2026-07-15', 2),
  ...day('2026-07-21', 7),
  ...day('2026-07-28', 1),
  // Belongs to the trailing padding cell, so the grid must ignore it entirely.
  ...day('2026-08-02', 3),
];

const MONTH = new Date('2026-07-14T12:00:00.000Z');
/** Pinned so `isToday` / `isPast` never drift with the machine clock. */
const TODAY = new Date('2026-07-14T12:00:00.000Z');

/** The overview is a phone surface; a desktop-width canvas stretches the dot grid. */
const Phone = (Story: React.ComponentType) => (
  <div className="mx-auto w-[375px] bg-[var(--screen)] p-4">
    <Story />
  </div>
);

/** Holds `selectedDate` the way the calendar page does, so a tap actually reveals the peek. */
const ControlledMonth = ({
  monthDate,
  appointments,
  today,
}: {
  monthDate: Date;
  appointments: readonly Appointment[];
  today: Date;
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  return (
    <PhoneMonthOverview
      monthDate={monthDate}
      appointments={appointments}
      today={today}
      selectedDate={selectedDate}
      onSelectDay={(cell: PhoneMonthCell) => setSelectedDate(new Date(`${cell.dateKey}T12:00:00Z`))}
      onOpenDay={fn()}
      onViewChange={fn()}
      onMonthChange={fn()}
    />
  );
};

const meta = {
  title: 'Appointments/Calendar/PhoneMonthOverview',
  component: PhoneMonthOverview,
  decorators: [Phone],
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    chromatic: { viewports: [375] },
    docs: {
      description: {
        component:
          'The month view as a phone can actually hold it: each day drops its event chips and ' +
          'keeps only load dots, and the selected day expands underneath into a peek list.\n\n' +
          'That peek is the point of this file. It renders only when `selectedDate` resolves to a ' +
          'cell in the grid, which in the app happens after a tap - so the entire lower half of ' +
          'this component had never been drawn. It is the same shape of gap that let four layout ' +
          'bugs ship on this branch: a popover whose `grid-template-columns` used a comma and so ' +
          'collapsed six children into one column, and two calendar overlays carrying an orphaned ' +
          'grid child that doubled their height. Both were post-interaction, and both are exactly ' +
          'the kind of thing a rendered peek would have exposed.\n\n' +
          'What the peek contains, verified in `phoneMonthModel`: at most `DAY_PEEK_LIMIT` = 3 ' +
          'rows, sorted by start time, then a `+N more · swipe up` line for the remainder. Each ' +
          'row is a 3-column flex - a 34px tabular-nums time, a truncating title/subtitle stack, ' +
          'and a status badge - and an emergency row swaps the whole badge for a red EMERGENCY ' +
          'chip and takes a 3px `--danger` left edge. A day with no appointments still renders its ' +
          'header ("0 appointments") with no rows at all, and a padding cell borrowed from the ' +
          'next month always reports zero even when that date has appointments, because the grid ' +
          'never buckets outside-month days.\n\n' +
          'The stories pin `today` and `monthDate` to July 2026 so `isToday`, `isPast` and the ' +
          'busiest-week rollup are stable rather than drifting with the machine clock.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    monthDate: MONTH,
    appointments: JULY_APPOINTMENTS,
    today: TODAY,
    onSelectDay: fn(),
    onOpenDay: fn(),
    onViewChange: fn(),
    onMonthChange: fn(),
  },
} satisfies Meta<typeof PhoneMonthOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DotGridOnly: Story = {
  name: 'No day selected',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The grid is always 35 cells here (2 leading + 31 + 2 trailing).
    const day = canvas.getByRole('button', { name: '2026-07-08 · 12 appointments' });
    await expect(day).toBeVisible();

    /* The month is a `grid-cols-7`, and the comment above is only true if the template
       actually resolves. Assert seven tracks and a whole number of weeks: a dropped
       template reflows 35 cells into one column, which still renders every day and
       still passes a by-name query. */
    const monthGrid = day.parentElement as HTMLElement;
    await expect(getComputedStyle(monthGrid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(
      7
    );
    await expect(monthGrid.children).toHaveLength(35);
    // Nothing below the grid until a day is chosen.
    await expect(canvas.queryByRole('button', { name: /open day/i })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state, and everything a story used to show. Each cell carries 1-3 dots by ' +
          'load band (<=6, <=10, heavier), the last dot turning `--danger` when the day holds an ' +
          'emergency; past days read `--status-completed-border` green, live days `--blue`.',
      },
    },
  },
};

export const TapRevealsPeek: Story = {
  name: 'Tap a day (peek opens)',
  render: () => (
    <ControlledMonth monthDate={MONTH} appointments={JULY_APPOINTMENTS} today={TODAY} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /open day/i })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: '2026-07-08 · 12 appointments' }));

    // Assert the peek has real content, not just that a day flipped aria-pressed:
    // a header, three rows, the overflow line and the Open day affordance.
    expect(await canvas.findByText('Wed 8 · 12 appointments')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /open day/i })).toBeInTheDocument();
    await expect(canvas.getByText('+9 more · swipe up')).toBeInTheDocument();
    await expect(canvas.getByText('EMERGENCY')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The interaction itself, through a controlled wrapper because the component owns no ' +
          'selection state. Twelve appointments collapse to three rows plus `+9 more · swipe up`, ' +
          'and the tapped cell swaps its plain number for a 26px `--blue-strong` disc with a glow ' +
          'shadow - a shape that only exists in the selected branch.',
      },
    },
  },
};

export const BusyDayPeek: Story = {
  name: 'Peek: busy day (+N more)',
  args: { selectedDate: new Date('2026-07-08T12:00:00.000Z') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Wed 8 · 12 appointments')).toBeInTheDocument();
    await expect(canvas.getByText('+9 more · swipe up')).toBeInTheDocument();
    // Only the first three of the twelve are listed.
    await expect(canvas.getByText(/^Kira · /)).toBeInTheDocument();
    await expect(canvas.getByText(/^Frankie · /)).toBeInTheDocument();
    await expect(canvas.getByText(/^Toby · /)).toBeInTheDocument();
    await expect(canvas.queryByText(/^Hazel · /)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case, driven straight from `selectedDate`. Rows are cut at three regardless ' +
          'of how heavy the day is, so the peek can never push the dot grid off screen - the count ' +
          'lives in the header line and the remainder in the `+N more` footer.',
      },
    },
  },
};

export const EmergencyPeek: Story = {
  name: 'Peek: emergency row',
  args: { selectedDate: new Date('2026-07-14T12:00:00.000Z') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Tue 14 · 5 appointments')).toBeInTheDocument();
    await expect(canvas.getByText('+2 more · swipe up')).toBeInTheDocument();
    await expect(canvas.getByText('EMERGENCY')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Today, selected. One row is an emergency, which replaces its status badge with the ' +
          'danger-toned EMERGENCY chip, tints the time column `--danger-text` and adds the 3px left ' +
          'edge - three changes on one row that only compose correctly beside ordinary rows.',
      },
    },
  },
};

export const EmptyDayPeek: Story = {
  name: 'Peek: day with nothing booked',
  args: { selectedDate: new Date('2026-07-20T12:00:00.000Z') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Mon 20 · 0 appointments')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /open day/i })).toBeInTheDocument();
    await expect(canvas.queryByText(/more · swipe up$/)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A free day still opens the peek: the header and the Open day link render with no rows ' +
          'between them. There is no illustrated empty state, so this is the branch where the ' +
          'section can look broken if the gap collapses - worth having on screen.',
      },
    },
  },
};

export const PaddingDayPeek: Story = {
  name: 'Peek: next-month padding cell',
  args: { selectedDate: new Date('2026-08-02T12:00:00.000Z') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 2 August has three appointments in the fixture, and the peek must still
    // report zero: outside-month cells are padding, never load.
    await expect(canvas.getByText('Sun 2 · 0 appointments')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: '2026-08-02 · 0 appointments' })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The trailing cell borrowed from August. Its date genuinely has appointments in this ' +
          'fixture and the peek still reports none, because a padding day is drawn as scaffolding ' +
          'for the week row rather than as a day you can load. Selecting one is reachable - the ' +
          'cell is a button like any other - so the zero is a state a reader can actually hit.',
      },
    },
  },
};

export const DayView: Story = {
  name: 'Segmented pill on Day',
  args: { view: 'day', selectedDate: new Date('2026-07-14T12:00:00.000Z') },
  parameters: {
    docs: {
      description: {
        story:
          'The view switch is presentational here - the component always draws the month - so this ' +
          'story exists to show the pill honouring a value it does not itself act on. The parent ' +
          'swaps the whole component out on change.',
      },
    },
  },
};
