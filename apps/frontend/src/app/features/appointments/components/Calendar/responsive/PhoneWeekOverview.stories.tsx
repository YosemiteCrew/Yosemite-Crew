import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhoneWeekOverview, { type PhoneCalendarView } from './PhoneWeekOverview';

const ORG_ID = 'org-storybook';
const NAMES = ['Poppy', 'Milo', 'Nala', 'Rufus', 'Juno', 'Otto', 'Sasha', 'Bruno'];

/**
 * Status drives the bar's segments, so the fixture spreads them deliberately
 * rather than cycling: a row whose load is all one colour would not show that the
 * bar is actually segmented.
 */
const STATUSES: Appointment['status'][] = [
  'COMPLETED',
  'COMPLETED',
  'IN_PROGRESS',
  'UPCOMING',
  'UPCOMING',
  'CHECKED_IN',
];

const makeAppointment = (dateKey: string, index: number): Appointment => {
  const hour = String(8 + index).padStart(2, '0');
  const startTime = new Date(`${dateKey}T${hour}:30:00.000Z`);
  return {
    id: `${dateKey}-${index}`,
    patient: {
      id: `companion-${dateKey}-${index}`,
      name: NAMES[index % NAMES.length],
      species: 'dog',
      breed: 'Beagle',
      parent: { id: `parent-${index}`, name: 'Lena Hartmann' },
    },
    lead: { id: 'vet-1', name: 'Dr. Weber' },
    room: { id: 'room-1', name: 'Consult 1' },
    appointmentType: {
      id: 'type-1',
      name: 'Annual check-up',
      speciality: { id: 'spec-1', name: 'General practice' },
    },
    organisationId: ORG_ID,
    appointmentDate: startTime,
    startTime,
    endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
    timeSlot: `${hour}:30`,
    durationMinutes: 30,
    status: STATUSES[index % STATUSES.length],
    isEmergency: false,
  };
};

const day = (dateKey: string, count: number): Appointment[] =>
  Array.from({ length: count }, (_, index) => makeAppointment(dateKey, index));

/** Monday 13 July 2026. */
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');

const WEEK: Appointment[] = [
  ...day('2026-07-13', 5),
  ...day('2026-07-14', 9),
  ...day('2026-07-15', 12),
  ...day('2026-07-16', 3),
  ...day('2026-07-17', 6),
  ...day('2026-07-18', 2),
];

/** The overview is a phone surface; a desktop-width canvas stretches the rows. */
const Phone = (Story: React.ComponentType) => (
  <div className="mx-auto w-[375px] bg-[var(--screen)] p-4">
    <Story />
  </div>
);

const meta = {
  title: 'Appointments/Calendar/PhoneWeekOverview',
  component: PhoneWeekOverview,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The week on a phone: seven rows, each carrying its day as a proportional load bar plus ' +
          'a summary line, under a Day | Week | Month control and a week stepper. An hour grid ' +
          'does not survive a 375px column, so the week reads as "how full is each day" instead ' +
          'of "what is at 10:15". Fully prop-driven - the caller owns navigation.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    weekStart: WEEK_START,
    appointments: WEEK,
    selectedDate: new Date('2026-07-15T12:00:00.000Z'),
    defaultCapacity: 12,
    view: 'week',
    onViewChange: fn(),
    onSelectDay: fn(),
    onPreviousWeek: fn(),
    onNextWeek: fn(),
  },
  decorators: [Phone],
} satisfies Meta<typeof PhoneWeekOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A normal week',
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('.yc-pwo-row');
    await expect(rows).toHaveLength(7);

    // The full day (12 of 12) fills its bar; the quiet day does not. That ratio is
    // the only thing the row communicates, so it has to be visibly different.
    const full = canvasElement.querySelector('[data-testid="load-bar-2026-07-15"]');
    const quiet = canvasElement.querySelector('[data-testid="load-bar-2026-07-18"]');
    const filled = (bar: Element | null) =>
      [...(bar?.children ?? [])].reduce(
        (sum, seg) => sum + Number.parseFloat((seg as HTMLElement).style.width || '0'),
        0
      );
    await expect(filled(full)).toBeGreaterThan(filled(quiet));

    // And nothing pushes the page sideways at phone width.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

export const ClosedDay: Story = {
  name: 'Sunday is closed',
  args: {
    dayMeta: { '2026-07-19': { isClosed: true } },
  },
  play: async ({ canvasElement }) => {
    // A closed day has nothing to open, so it is a plain row and NOT a button -
    // a tappable row that leads to an empty day is worse than an inert one.
    const rows = [...canvasElement.querySelectorAll('.yc-pwo-row')];
    const closed = rows.at(-1);
    await expect(closed?.tagName).toBe('DIV');
    await expect(rows.filter((r) => r.tagName === 'BUTTON')).toHaveLength(6);
  },
};

export const FlaggedDays: Story = {
  name: 'Notes, cover gaps and room to book',
  args: {
    dayMeta: {
      '2026-07-14': { vetsOff: ['Dr. Keller'], note: 'OR block am' },
      '2026-07-16': { hasRoomToBook: true },
      '2026-07-17': { walkInCount: 4, note: 'Open clinic 09:00-13:00' },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The summary line is where a phone user gets the context a desktop grid shows spatially: ' +
          'who is off, whether there is room left, and which hours are held for walk-ins.',
      },
    },
  },
};

/** Holds the view the way the calendar page does, so the pill really switches. */
const ControlledOverview = (args: React.ComponentProps<typeof PhoneWeekOverview>) => {
  const [view, setView] = useState<PhoneCalendarView>(args.view ?? 'week');
  return (
    <PhoneWeekOverview
      {...args}
      view={view}
      onViewChange={(next) => {
        setView(next);
        args.onViewChange?.(next);
      }}
    />
  );
};

export const SwitchingView: Story = {
  name: 'Day | Week | Month',
  render: (args) => <ControlledOverview {...args} />,
  play: async ({ args, canvasElement }) => {
    // The Day | Week | Month control is a radiogroup, so the segments are radios -
    // that is what tells a screen reader one of three views is selected.
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('radio', { name: 'Week' })).toBeChecked();
    await userEvent.click(canvas.getByRole('radio', { name: 'Day' }));
    await expect(args.onViewChange).toHaveBeenCalledWith('day');
    await expect(canvas.getByRole('radio', { name: 'Day' })).toBeChecked();
  },
};

export const Stepping: Story = {
  name: 'Moving between weeks',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Previous week' }));
    await expect(args.onPreviousWeek).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Next week' }));
    await expect(args.onNextWeek).toHaveBeenCalledTimes(1);
  },
};

export const NoNavigation: Story = {
  name: 'Without week handlers the arrows are disabled',
  args: { onPreviousWeek: undefined, onNextWeek: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Disabled rather than hidden: the pill keeps its shape, so the label does not
    // jump position when a caller supplies only one direction.
    await expect(canvas.getByRole('button', { name: 'Previous week' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Next week' })).toBeDisabled();
  },
};

export const EmptyWeek: Story = {
  name: 'Nothing booked all week',
  args: { appointments: [] },
  play: async ({ canvasElement }) => {
    // Seven rows still, each reading empty. Collapsing to one message would lose
    // the ability to tap into a day and book.
    await expect(canvasElement.querySelectorAll('.yc-pwo-row')).toHaveLength(7);
  },
};
