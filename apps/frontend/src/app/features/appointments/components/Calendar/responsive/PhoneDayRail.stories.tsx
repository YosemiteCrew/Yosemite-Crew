import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhoneDayRail from './PhoneDayRail';

const ORG_ID = 'org-storybook';
/** 15 July 2026, as LOCAL calendar parts - see `makeAppointment`. */
const DAY_PARTS = [2026, 6, 15] as const;

type Seed = {
  minutes: number;
  durationMinutes?: number;
  name: string;
  status: Appointment['status'];
  concern?: string;
  room?: string;
};

/**
 * The rail places a block from the LOCAL hour and minute of `startTime`, so the
 * fixtures are built with the local `Date` constructor rather than a `Z` literal.
 * A UTC literal slides by the runner's offset - on a UTC+2 machine an 08:30Z
 * booking lands at 10:30 and the 14:00 and 15:00 ones fall out of the 08:00-16:00
 * window entirely, so these stories passed or failed depending on the timezone
 * they ran in.
 */
const makeAppointment = (seed: Seed, index: number): Appointment => {
  const hour = Math.floor(seed.minutes / 60);
  const minute = seed.minutes % 60;
  const startTime = new Date(DAY_PARTS[0], DAY_PARTS[1], DAY_PARTS[2], hour, minute, 0, 0);
  const durationMinutes = seed.durationMinutes ?? 30;

  return {
    id: `appt-${index}`,
    patient: {
      id: `companion-${index}`,
      name: seed.name,
      species: 'dog',
      breed: 'Beagle',
      parent: { id: `parent-${index}`, name: 'Lena Hartmann' },
    },
    lead: { id: 'vet-1', name: 'Dr. Weber' },
    room: { id: `room-${index}`, name: seed.room ?? 'Consult 1' },
    appointmentType: {
      id: 'type-1',
      name: 'Annual check-up',
      speciality: { id: 'spec-1', name: 'General practice' },
    },
    organisationId: ORG_ID,
    appointmentDate: startTime,
    startTime,
    endTime: new Date(startTime.getTime() + durationMinutes * 60 * 1000),
    timeSlot: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    durationMinutes,
    status: seed.status,
    concern: seed.concern,
    isEmergency: false,
  };
};

const build = (seeds: Seed[]): Appointment[] => seeds.map(makeAppointment);

/** A normal morning: three back-to-back, then a gap, then the afternoon. */
const DAY = build([
  { minutes: 8 * 60 + 30, name: 'Poppy', status: 'COMPLETED', concern: 'Vaccination' },
  { minutes: 9 * 60, name: 'Milo', status: 'IN_PROGRESS', concern: 'Lameness recheck' },
  { minutes: 9 * 60 + 30, name: 'Nala', status: 'CHECKED_IN', concern: 'Dental' },
  { minutes: 14 * 60, name: 'Rufus', status: 'UPCOMING', concern: 'Post-op recheck' },
  { minutes: 15 * 60, name: 'Juno', status: 'REQUESTED', concern: 'Skin' },
]);

/** Two at once, so the rail has to split into lanes rather than stack them. */
const OVERLAPPING = build([
  { minutes: 10 * 60, durationMinutes: 60, name: 'Otto', status: 'UPCOMING', room: 'Consult 1' },
  {
    minutes: 10 * 60 + 15,
    durationMinutes: 45,
    name: 'Sasha',
    status: 'CHECKED_IN',
    room: 'Theatre',
  },
]);

/** The rail is a phone surface, and its blocks are positioned as percentages of
 *  a fixed height, so the story has to give it a real box to lay out inside. */
const Phone = (Story: React.ComponentType) => (
  <div className="mx-auto w-[375px] bg-[var(--screen)] p-4">
    <div style={{ height: 520 }}>
      <Story />
    </div>
  </div>
);

const meta = {
  title: 'Appointments/Calendar/PhoneDayRail',
  component: PhoneDayRail,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The single day as a vertical rail, sized to a phone. An hour that nobody booked is not ' +
          'worth a full hour of screen, so consecutive empty hours FOLD into one band that offers ' +
          'to book them - which is what lets a whole clinic day fit one screen without shrinking ' +
          'the appointments that are actually in it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointments: DAY,
    nowMinutes: 9 * 60 + 20,
    onSelectAppointment: fn(),
  },
  decorators: [Phone],
} satisfies Meta<typeof PhoneDayRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A clinic day',
  play: async ({ canvasElement }) => {
    const blocks = canvasElement.querySelectorAll('[data-testid="day-rail-block"]');
    await expect(blocks).toHaveLength(5);

    // The now marker is inside the window, so both halves of it render.
    await expect(canvasElement.querySelector('[data-testid="day-rail-now-line"]')).not.toBeNull();

    // Nothing leaks sideways: the blocks are positioned with calc() against the
    // rail's own width, which is the part that breaks first at 375px.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

export const QuietHoursFold: Story = {
  name: 'The empty middle of the day folds away',
  play: async ({ canvasElement }) => {
    // 10:00-14:00 is the one run of empty hours long enough to fold.
    const folds = canvasElement.querySelectorAll('[data-testid="day-rail-fold"]');
    await expect(folds).toHaveLength(1);
    await expect(within(canvasElement).getAllByText(/free · folded/)).toHaveLength(1);
  },
};

export const BookIntoAFold: Story = {
  name: 'Booking into the folded band',
  args: { onBookFold: fn(), onExpandFold: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('button', { name: 'Book' })[0]);
    await expect(args.onBookFold).toHaveBeenCalledTimes(1);

    // A fold only ever collapses EMPTY hours, so expanding it reveals blank space -
    // Book is the action that matters on a free band, and expanding is secondary.
    await userEvent.click(canvas.getAllByRole('button', { name: /free · folded/ })[0]);
    await expect(args.onExpandFold).toHaveBeenCalledTimes(1);
  },
};

export const FoldIsInertWithoutHandlers: Story = {
  name: 'No handlers: the band is a label, not a dead button',
  play: async ({ canvasElement }) => {
    const fold = canvasElement.querySelector('[data-testid="day-rail-fold"]');
    await expect(fold?.querySelector('button')).toBeNull();
    await expect(within(canvasElement).queryByRole('button', { name: 'Book' })).toBeNull();
  },
};

export const StartVisit: Story = {
  name: 'A checked-in patient can be started',
  args: { onStartVisit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Exactly one appointment is CHECKED_IN, so exactly one pill appears - the
    // action must not offer itself on completed or upcoming blocks.
    const start = canvas.getAllByRole('button', { name: 'Start visit' });
    await expect(start).toHaveLength(1);
    await userEvent.click(start[0]);
    await expect(args.onStartVisit).toHaveBeenCalledTimes(1);
  },
};

export const Overlapping: Story = {
  name: 'Two at once split into lanes',
  args: { appointments: OVERLAPPING, nowMinutes: null },
  play: async ({ canvasElement }) => {
    const blocks = [...canvasElement.querySelectorAll('[data-testid="day-rail-block"]')];
    await expect(blocks).toHaveLength(2);

    /* Side by side, not stacked: on a 375px rail two lanes are already narrow, so
       the failure worth catching is them collapsing onto the same left offset and
       hiding one appointment behind the other. */
    const lefts = blocks.map((b) => Math.round(b.getBoundingClientRect().left));
    await expect(new Set(lefts).size).toBe(2);
    for (const block of blocks) {
      await expect(block.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    }
  },
};

export const NothingBooked: Story = {
  name: 'An empty day',
  args: { appointments: [], nowMinutes: null },
  play: async ({ canvasElement }) => {
    // The whole window folds into one free band, and that band's own label already
    // says the day is empty - so the empty-state copy must NOT also be laid over it.
    await expect(canvasElement.querySelectorAll('[data-testid="day-rail-block"]')).toHaveLength(0);
    await expect(within(canvasElement).queryByText('Nothing booked today.')).toBeNull();
    await expect(within(canvasElement).getByText(/free · folded/)).toBeInTheDocument();
  },
};

export const OutsideTheWindow: Story = {
  name: 'An 06:30 booking is dropped, not squashed in',
  args: {
    appointments: build([{ minutes: 6 * 60 + 30, name: 'Bruno', status: 'UPCOMING' }]),
    nowMinutes: null,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-testid="day-rail-block"]')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The rail draws a fixed 08:00-16:00 window. Anything outside it is dropped rather than ' +
          'clamped to the edge, because a block pinned to the top of the rail would read as an ' +
          '08:00 appointment. Callers that need earlier hours widen `dayWindow` instead.',
      },
    },
  },
};
