import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhoneDayStrip from './PhoneDayStrip';
import { describeContrast, measureContrast } from './contrastProbe';

const ORG_ID = 'org-storybook';
const NAMES = ['Poppy', 'Milo', 'Nala', 'Rufus', 'Juno', 'Otto', 'Sasha', 'Bruno'];
const STATUSES: Appointment['status'][] = ['UPCOMING', 'CHECKED_IN', 'COMPLETED', 'IN_PROGRESS'];

/**
 * Midday UTC instants: the strip buckets by date key in the clinic's preferred
 * zone, so an 08:00-15:00 booking can never slide into the neighbouring day and
 * move a dot to the wrong cell.
 */
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

/** Monday 13 July 2026. Pinned so `isToday` / `isPast` never drift with the clock. */
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');
const TODAY = new Date('2026-07-15T12:00:00.000Z');

/** Mon and Tue are behind TODAY, Wed is today, Thu-Sun ahead. Fri is empty. */
const WEEK: Appointment[] = [
  ...day('2026-07-13', 4),
  ...day('2026-07-14', 2),
  ...day('2026-07-15', 6),
  ...day('2026-07-16', 1),
  ...day('2026-07-18', 3),
  ...day('2026-07-19', 1),
];

/** The strip is a phone surface; a desktop-width canvas stretches the seven cells. */
const Phone = (Story: React.ComponentType) => (
  <div className="mx-auto w-[375px] bg-[var(--screen)] p-4">
    <Story />
  </div>
);

const meta = {
  title: 'Appointments/Calendar/PhoneDayStrip',
  component: PhoneDayStrip,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The phone day selector: the week as seven tappable load cells rather than a shrunken ' +
          'week header. Each cell stacks weekday over date over up to three load dots, past days ' +
          'read as done in green and today onwards reads live in blue, and an empty day recedes ' +
          'so the busy end of the week is visible without reading a single number.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    weekStart: WEEK_START,
    appointments: WEEK,
    selectedDate: TODAY,
    today: TODAY,
    onSelectDay: fn(),
  },
  decorators: [Phone],
} satisfies Meta<typeof PhoneDayStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A week with today selected',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const strip = canvas.getByRole('group', { name: 'Select a day' });
    const cells = within(strip).getAllByRole('button');
    await expect(cells).toHaveLength(7);

    // Exactly one selected, and it is the one the caller passed.
    const pressed = cells.filter((c) => c.getAttribute('aria-pressed') === 'true');
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toHaveAttribute('aria-current', 'date');

    /* Seven cells across 375px minus the page gutters is the tightest row on the
       calendar screen. They have to share the width evenly and stay on one line -
       a wrap here would push the day rail below the fold. */
    const tops = cells.map((c) => Math.round(c.getBoundingClientRect().top));
    await expect(new Set(tops).size).toBe(1);
    const widths = cells.map((c) => Math.round(c.getBoundingClientRect().width));
    await expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);

    /* The selected cell is a fixed tint, so its ink cannot be checked by eye in
       one theme and assumed in the other - it is identical in both. Both labels
       shipped under AA (2.98:1 weekday, 4.09:1 date) because the fill was
       `--blue`, which is #257bed in light AND dark, under literal white.
       Measured on the composited pixels: a class-name assertion here would stay
       green through exactly that regression. */
    const selected = pressed[0];
    for (const [label, node] of [
      ['weekday', selected.querySelector('.yc-day-strip__weekday')],
      ['date', selected.querySelector('.yc-day-strip__date')],
    ] as const) {
      await expect(node).not.toBeNull();
      const reading = measureContrast(node as Element);
      await expect(
        reading.ratio,
        describeContrast(`selected day ${label}`, reading)
      ).toBeGreaterThanOrEqual(reading.required);
    }
  },
};

export const DotsCapAtThree: Story = {
  name: 'A six-booking day still shows three dots',
  play: async ({ canvasElement }) => {
    // The dots are a load HINT, not a count; six appointments must not render six
    // dots and blow the cell's width out.
    const busy = canvasElement.querySelector('[data-testid="day-strip-dots-2026-07-15"]');
    await expect(busy?.children.length).toBeLessThanOrEqual(3);

    // The accessible name still carries the real number for anyone who needs it.
    await expect(
      within(canvasElement).getByRole('button', { name: /15 · 6 appointments/ })
    ).toBeInTheDocument();
  },
};

export const QuietDay: Story = {
  name: 'A day with nothing booked',
  play: async ({ canvasElement }) => {
    const empty = canvasElement.querySelector('[data-testid="day-strip-dots-2026-07-17"]');
    await expect(empty?.children.length).toBe(0);
    // The cell is still tappable - booking INTO an empty day is the common case.
    await expect(
      within(canvasElement).getByRole('button', { name: /17 · 0 appointments/ })
    ).toBeEnabled();
  },
};

/** Holds `selectedDate` the way the calendar page does, so a tap really moves it. */
const ControlledStrip = (args: React.ComponentProps<typeof PhoneDayStrip>) => {
  const [selected, setSelected] = useState(args.selectedDate);
  return (
    <PhoneDayStrip
      {...args}
      selectedDate={selected}
      onSelectDay={(date) => {
        setSelected(date);
        args.onSelectDay?.(date);
      }}
    />
  );
};

export const Selecting: Story = {
  name: 'Tapping a day moves the selection',
  render: (args) => <ControlledStrip {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /18 · 3 appointments/ }));
    await expect(args.onSelectDay).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: /18 · 3 appointments/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // And the day that WAS selected has let go of it.
    await expect(canvas.getByRole('button', { name: /15 · 6 appointments/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  },
};

export const NothingBookedAllWeek: Story = {
  name: 'An empty week',
  args: { appointments: [] },
  play: async ({ canvasElement }) => {
    // Seven quiet cells rather than an empty-state message: the strip is a
    // navigation control, and it has to stay navigable on a blank week.
    await expect(
      within(canvasElement).getByRole('group', { name: 'Select a day' })
    ).toBeInTheDocument();
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(7);
  },
};

/* The contrast assertion in `Default` runs in ONE theme, and it is not the one
   that matters. `preview.ts` `initialGlobals` pins only `viewport`, so the theme
   decorator falls to its `'light'` default and every play function in this file
   measures the light ramp.

   The selected cell is `--blue-strong`, which is theme-aware: #1657c9 light
   (6.48:1) and #2f74d9 dark (4.54:1). **Dark is the side with 0.045 of headroom
   over AA**, and it was the side nothing exercised - the justification for
   pinning it with a test was written into the PR that shipped it, and the test
   only covered the comfortable half.

   A story global beats a URL/toolbar override, so pinning it here is not
   advisory. */
export const DarkSelectedCell: Story = {
  name: 'Dark: the selected cell still clears AA',
  globals: { viewport: { value: 'mobile', isRotated: false }, theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const strip = canvas.getByRole('group', { name: 'Select a day' });
    const selected = within(strip)
      .getAllByRole('button')
      .find((cell) => cell.getAttribute('aria-pressed') === 'true');
    await expect(selected).toBeDefined();

    // The theme really is dark - otherwise this is the light assertion twice.
    await expect(document.documentElement.dataset.theme).toBe('dark');

    for (const [label, node] of [
      ['weekday', (selected as HTMLElement).querySelector('.yc-day-strip__weekday')],
      ['date', (selected as HTMLElement).querySelector('.yc-day-strip__date')],
    ] as const) {
      await expect(node).not.toBeNull();
      const reading = measureContrast(node as Element);
      await expect(
        reading.ratio,
        describeContrast(`dark selected day ${label}`, reading)
      ).toBeGreaterThanOrEqual(reading.required);
    }
  },
};
