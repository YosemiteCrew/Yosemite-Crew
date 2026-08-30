import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';

import type { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import type { Task } from '@/app/features/tasks/types/task';
import { setPreferredTimeZone } from '@/app/lib/timezone';
import DayCalendar from './DayCalendar';

const ORG_ID = 'org-storybook';
const ZOOM_IN_HOUR_PX = 180;
const ZOOM_OUT_HOUR_PX = 34;

/** Tuesday 14 July 2026. Local parts, never a UTC literal - see the note below. */
const at = (day: number, hour: number, minute: number) => new Date(2026, 6, day, hour, minute);
const DAY = at(14, 0, 0);

const TIMEZONE_STORAGE_KEY = 'yc_preferred_timezone';

/**
 * Pin the calendar's preferred zone to the zone this browser is already in.
 *
 * Every placement decision in this grid runs through `getHourInPreferredTimeZone`
 * and `isOnPreferredTimeZoneCalendarDay`, which read a token out of localStorage
 * and fall back to Europe/Berlin. So a fixture written as `'...T09:20:00.000Z'`
 * lands in the 09:00 row only for a runner sitting on UTC+0, and the 11:00 row on
 * a machine in Berlin - the story passes or fails by geography. Pinning the
 * preferred zone to the device zone lets every fixture below be built from local
 * parts (`new Date(2026, 6, 14, 9, 20)`), which is the one construction that means
 * the same wall-clock time everywhere. The previous token is restored on unmount
 * because the key is shared with every other story in this Storybook.
 */
const withDeviceTimeZone = () => {
  const previous = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  setPreferredTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return () => {
    if (previous === null) globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    else globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, previous);
  };
};

const DISPLAY_NAMES: Record<string, string> = {
  'practitioner-elena': 'Dr. Elena Weber',
  'practitioner-ravi': 'Dr. Ravi Patel',
};

const task = (id: string, name: string, dueAt: Date, overrides: Partial<Task> = {}): Task => ({
  _id: id,
  organisationId: ORG_ID,
  assignedTo: 'practitioner-elena',
  assignedBy: 'practitioner-ravi',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  status: 'PENDING',
  name,
  dueAt,
  ...overrides,
});

const FLUIDS = 'Bruno · fluids rate check';
const MEDS = 'Juno · post-op meds';
const ROUND = 'Ward round · kennels';

const TASKS: Task[] = [
  task('task-fluids', FLUIDS, at(14, 9, 20)),
  // 25 minutes after the one above, and a task block is 30 minutes, so these two
  // overlap and have to share the column in two lanes.
  task('task-meds', MEDS, at(14, 9, 45)),
  task('task-round', ROUND, at(14, 14, 5)),
  /* The day filter's own test case. `events` is whatever the page fetched for the
     range, not for this day, so the grid has to drop the ones that are not on it.
     Same hour as the first task, so a filter that compared hours and forgot the
     date would stack it on top of Bruno and look plausible. */
  task('task-next-day', 'Nala · suture check', at(15, 9, 20)),
];

const TODAY = new Date();
const todayAt = (hour: number, minute: number) =>
  new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), hour, minute);

const DRAG_LABEL = 'Nala · suture check';
/* 09:00-11:00. Handed over as minutes-of-day rather than instants, so the bands
   below sit in the same rows in every timezone. */
const OPEN_MORNING: DropAvailabilityInterval[] = [{ startMinute: 9 * 60, endMinute: 11 * 60 }];

/** Every hour cell of the grid, top row first. `TaskSlot` is the only labelled section. */
const hourSlots = (canvasElement: HTMLElement): HTMLElement[] => [
  ...canvasElement.querySelectorAll<HTMLElement>('section[aria-label^="Tasks slot"]'),
];

/** One task chip. The popover contract is what makes the chip button findable. */
const chips = (root: ParentNode): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]'),
];

/**
 * The positioned frame around a chip: `TaskMarker` puts the top/left/width/height
 * on the wrapper and lets the button fill it, so the wrapper is what carries the
 * lane geometry.
 */
const chipFrame = (button: HTMLElement): HTMLElement => button.parentElement as HTMLElement;

/** The 64px time gutter belonging to one hour row. */
const hourGutter = (slot: HTMLElement): HTMLElement => {
  const row = (slot.parentElement as HTMLElement).parentElement as HTMLElement;
  return row.firstElementChild as HTMLElement;
};

/** Droppable bands. The only token they paint with that nothing else uses. */
const bands = (root: ParentNode): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('[class*="calendar-availability-overlay"]'),
];

const topWithin = (child: HTMLElement, parent: HTMLElement): number =>
  child.getBoundingClientRect().top - parent.getBoundingClientRect().top;

/**
 * The grid scrolls itself to the first task on mount, with `behavior: 'smooth'`
 * unless the browser asks for reduced motion. A play function that measures on the
 * next tick reads a position mid-flight, and worse, any scroll event closes an open
 * popover - so wait for every calendar scroller to stop moving first.
 */
const settleAutoScroll = async (canvasElement: HTMLElement) => {
  const scrollers = [
    ...canvasElement.querySelectorAll<HTMLElement>('[data-calendar-scroll="true"]'),
  ];
  let previous: number[] = scrollers.map(() => Number.NaN);
  await waitFor(
    () => {
      const current = scrollers.map((element) => element.scrollTop);
      const settled = current.every((value, index) => value === previous[index]);
      previous = current;
      expect(settled).toBe(true);
    },
    // Well past the default 1000ms: on today's date the grid scrolls to the now
    // line rather than to 09:00, which on an afternoon is most of a 4320px rail
    // and takes longer than a second to animate.
    { timeout: 8000, interval: 100 }
  );
};

/** Hover-opened, portalled to `document.body`, so it is outside `canvasElement`. */
const openTaskPopover = async (chip: HTMLElement): Promise<HTMLElement> => {
  const box = chip.getBoundingClientRect();
  /* `fireEvent` rather than `userEvent.hover`: the popover is positioned from the
     pointer coordinates carried on the event, and this way they are stated rather
     than inferred from where a synthetic pointer happened to land. */
  fireEvent.mouseEnter(chip, {
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  });
  return waitFor(() => {
    const dialog = globalThis.document.querySelector<HTMLElement>(
      'dialog[data-popover-panel="true"]'
    );
    expect(dialog).not.toBeNull();
    return dialog as HTMLElement;
  });
};

const meta = {
  title: 'Appointments/Calendar/TaskDayCalendar',
  component: DayCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The single-day tasks planner: a fixed 24-hour rail, its own inline day stepper, and one ' +
          'column of `TaskSlot` cells. `TaskSlot` has a story of its own, but everything around it ' +
          'here does not - the hour rail, the zoom modes, the now line, the day filter and the ' +
          'stepper wiring all live in this file and had never been rendered on their own.\n\n' +
          'Two things are worth reading closely. The rail is 24 rows whatever the day holds, so an ' +
          'empty day is 4320px of scroll rather than a short list - which is why the grid scrolls ' +
          'itself to the first task on mount instead of leaving you at midnight. And the day ' +
          'filter is a preferred-timezone comparison, not a local one: a task is on this day if ' +
          "its `dueAt` falls on the same calendar date **in the practice's zone**, so the same " +
          'task list draws a different grid for a clinic in Berlin and one in Denver.\n\n' +
          'The now line is drawn here rather than by the shared `NowIndicator` component the Team ' +
          'tab uses, which is how the same page ended up with three different treatments of the ' +
          'same line. This copy is `--blue` with a 7px dot; the Team tab renders `NowIndicator`, ' +
          'whose dot is 16px.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    events: TASKS,
    date: DAY,
    zoomMode: 'in',
    canEditTasks: true,
    slotStepMinutes: 15,
    draggedTaskDurationMinutes: 30,
    handleViewTask: fn(),
    handleChangeStatusTask: fn(),
    handleRescheduleTask: fn(),
    setCurrentDate: fn(),
    onCreateTaskAt: fn(),
    onTaskDropAt: fn(),
    onTaskDragStart: fn(),
    onTaskDragEnd: fn(),
    onDragHoverTarget: fn(),
    canDragTask: () => true,
    resolveDisplayName: (memberId?: string) => DISPLAY_NAMES[memberId ?? ''] ?? '-',
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] w-full max-w-[820px] bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
  beforeEach: withDeviceTimeZone,
} satisfies Meta<typeof DayCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A day with tasks',
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const slots = hourSlots(canvasElement);

    // A full-day rail: midnight to 23:00 whatever the day holds. The appointment
    // calendars narrow their window to the booked hours; this one does not.
    await expect(slots).toHaveLength(24);
    await expect(Math.round(slots[0].getBoundingClientRect().height)).toBe(ZOOM_IN_HOUR_PX);

    /* Three chips, not four. The fourth fixture is due at the same hour on the NEXT
       day, so it is proof that the grid filters on the calendar date and not on the
       hour alone. */
    await expect(chips(canvasElement)).toHaveLength(3);
    await expect(within(slots[14]).getByText(ROUND)).toBeInTheDocument();

    const fluids = chipFrame(within(slots[9]).getByText(FLUIDS).closest('button') as HTMLElement);
    const meds = chipFrame(within(slots[9]).getByText(MEDS).closest('button') as HTMLElement);

    /* A chip is positioned by its due MINUTE inside its hour, not pinned to the top
       of the row: 09:20 is a third of the way down a 180px row, 09:45 three
       quarters. Round the row to a flat 180px band and the two chips land on top of
       each other with nothing failing. */
    await expect(topWithin(fluids, slots[9])).toBeCloseTo(60, 0);
    await expect(topWithin(meds, slots[9])).toBeCloseTo(135, 0);

    /* They overlap in time, so they take a lane each: equal widths, side by side,
       together spanning the column. Asserted as a relation rather than as a pixel
       count so it holds at any panel width. */
    const fluidsBox = fluids.getBoundingClientRect();
    const medsBox = meds.getBoundingClientRect();
    await expect(medsBox.width).toBeCloseTo(fluidsBox.width, 0);
    await expect(fluidsBox.right).toBeLessThanOrEqual(medsBox.left + 0.5);
    await expect(medsBox.right - fluidsBox.left).toBeCloseTo(fluidsBox.width + medsBox.width, 0);

    /* 15-minute step labels only exist while a step is at least 14px tall, which a
       180px hour clears at 45px. The zoomed-out story below is the other side. */
    const gutter = hourGutter(slots[9]);
    await expect(gutter).toHaveTextContent('9:00 AM');
    await expect(gutter).toHaveTextContent('9:15 AM');
    await expect(gutter).toHaveTextContent('9:45 AM');

    // 14 July 2026 is not today, so the now line must be absent entirely - not
    // parked at midnight, which is what a missing null check would look like.
    await expect(canvasElement.querySelector('[class*="size-[7px]"]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fixed Tuesday with three tasks, two of them inside the same hour. The fourth fixture ' +
          'is due at 09:20 the following day and is deliberately not drawn: the events array ' +
          'handed to this grid is whatever the page fetched for the visible range, so dropping ' +
          "the days either side of this one is the grid's own job.",
      },
    },
  },
};

export const EmptyDay: Story = {
  name: 'A day with nothing scheduled',
  args: { events: [] },
  play: async ({ args, canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const canvas = within(canvasElement);
    const slots = hourSlots(canvasElement);

    // The rail does not collapse: 24 rows and 4320px of scroll for an empty day.
    await expect(slots).toHaveLength(24);
    await expect(chips(canvasElement)).toHaveLength(0);
    const scroller = canvasElement.querySelector<HTMLElement>(
      '[data-calendar-scroll="true"]'
    ) as HTMLElement;
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    await expect(hourGutter(slots[0])).toHaveTextContent('12:00 AM');
    await expect(hourGutter(slots[23])).toHaveTextContent('11:00 PM');

    /* Every hour is a create target. The button is invisible and fills the cell, so
       the minute comes from where in the cell the click landed: a quarter down the
       11:00 row is 11:15, which is 675 minutes past midnight. An absolute
       minute-of-day, not a minute-within-the-hour - the caller has no other way to
       know which row was clicked. */
    const create = within(slots[11]).getByRole('button', { name: /^Create task on / });
    const box = slots[11].getBoundingClientRect();
    fireEvent.click(create, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 4,
    });
    await expect(args.onCreateTaskAt).toHaveBeenCalledWith(DAY, 675, undefined);

    /* The stepper is the only other thing to do on an empty day, and it reports a
       functional update rather than a date, so the assertion has to run the updater.
       Applied to the rendered day it must step one day each way - a swapped pair of
       handlers looks identical until you do this. */
    await fireEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await fireEvent.click(canvas.getByRole('button', { name: 'Previous' }));
    await expect(args.setCurrentDate).toHaveBeenCalledTimes(2);
    const [[forward], [back]] = args.setCurrentDate.mock.calls as [
      [(previous: Date) => Date],
      [(previous: Date) => Date],
    ];
    await expect(forward(DAY).getDate()).toBe(DAY.getDate() + 1);
    await expect(back(DAY).getDate()).toBe(DAY.getDate() - 1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Nothing booked, and the grid is unchanged: the same 24 rows, the same gutter, the same ' +
          'invisible full-cell create button in every one of them. This is where the create and ' +
          'stepper wiring is read, because they are the only two things an empty day offers.',
      },
    },
  },
};

export const ZoomedOut: Story = {
  name: 'Zoomed out (34px hours)',
  args: { zoomMode: 'out' },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const slots = hourSlots(canvasElement);

    await expect(slots).toHaveLength(24);
    await expect(Math.round(slots[9].getBoundingClientRect().height)).toBe(ZOOM_OUT_HOUR_PX);

    /* A 15-minute step is 8.5px here, under the 14px floor, so the sub-hour labels
       are dropped and the gutter carries the hour alone. Exact match, because the
       failure being guarded against is the labels still rendering and overprinting
       each other in an 34px box. */
    await expect(hourGutter(slots[9]).textContent).toBe('9:00 AM');

    /* The chip loses its text at this zoom - the marker renders no children at all -
       so the only thing naming it is the `title`. Worth pinning: a task at this zoom
       is a coloured pill, and if the title went with the text the pill would be
       unidentifiable by pointer or by screen reader. */
    const zoomedChips = chips(canvasElement);
    await expect(zoomedChips).toHaveLength(3);
    const fluids = canvasElement.querySelector<HTMLElement>(
      `button[title^="${FLUIDS}"]`
    ) as HTMLElement;
    await expect(fluids).not.toBeNull();
    await expect(fluids.textContent).toBe('');

    // 30 minutes of a 34px hour is 17px, clamped to the 12px ceiling the marker
    // applies in this mode, so a chip never grows into the row below it.
    await expect(Math.round(chipFrame(fluids).getBoundingClientRect().height)).toBe(12);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole day at 34px an hour, which is the zoom the planner opens at on a short ' +
          'screen. Two things only exist here: the gutter drops its 15-minute labels, and the task ' +
          'chip drops its text and becomes a titled pill.',
      },
    },
  },
};

export const Today: Story = {
  name: 'Today (the now line)',
  args: {
    date: TODAY,
    events: [
      task('task-today-fluids', FLUIDS, todayAt(9, 20)),
      task('task-today-round', ROUND, todayAt(14, 5)),
    ],
  },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const slots = hourSlots(canvasElement);

    /* Polled rather than read once: `useCalendarNow` re-renders the grid on the
       minute, so the line can be committed a tick after the play function starts. */
    const dot = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('[class*="size-[7px]"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });

    /* Where the line sits, not merely that it exists. The overlay is absolutely
       positioned over the same hour rail the cells are laid on, and the 8px top
       offset it is given is exactly the rail's own top padding, so the line has to
       land at now's minute inside now's hour row. Tolerance because the clock keeps
       moving: an hour is 180px, so a minute is 3px and the seconds hand alone can
       account for that much between render and measurement. */
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const dotBox = dot.getBoundingClientRect();
    const dotCentre = dotBox.top + dotBox.height / 2;
    const expected = slots[0].getBoundingClientRect().top + (minutes / 60) * ZOOM_IN_HOUR_PX;
    await expect(Math.abs(dotCentre - expected)).toBeLessThan(7);

    // The line carries a clock label, which is what makes it readable when the row
    // it crosses is scrolled half out of view.
    const label = dot.parentElement as HTMLElement;
    await expect(label.textContent).toMatch(/^\d{1,2}:\d{2}/);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same grid on the current date, which is the only state in which the now line is ' +
          'drawn at all. It also changes where the view opens: with a now position the mount-time ' +
          'auto-scroll parks on the line instead of on the first task.\n\n' +
          'This story reads the live clock on purpose. Freezing it would hide the one thing the ' +
          'line has to get right, which is agreeing with the hour rail it is drawn over rather ' +
          'than with the rail the appointments calendar uses.',
      },
    },
  },
};

export const TaskActions: Story = {
  name: 'Hovering a task (three actions)',
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const slots = hourSlots(canvasElement);
    const chip = within(slots[9]).getByText(FLUIDS).closest('button') as HTMLElement;

    await expect(chip).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(chip).toHaveAttribute('aria-expanded', 'false');

    const popover = await openTaskPopover(chip);
    const panel = within(popover);
    await expect(chip).toHaveAttribute('aria-expanded', 'true');
    await expect(chip).toHaveAttribute('aria-controls', popover.id);

    // All three actions, because `canEditTasks` is true and a PENDING task can be
    // both moved on and rescheduled.
    await expect(panel.getByRole('button', { name: 'View task' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Change task status' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Reschedule task' })).toBeInTheDocument();

    /* The assignee ids are resolved through the caller's own lookup. Without it the
       card prints the raw practitioner id, which is what shipped before
       `resolveDisplayName` was threaded through the grid. */
    await expect(panel.getByText('Dr. Elena Weber')).toBeInTheDocument();
    await expect(panel.getByText('Dr. Ravi Patel')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The detail card, which only exists while a chip is hovered or focused and is portalled ' +
          'to `document.body` rather than drawn inside the grid. Read together with the story ' +
          'below: the two differ by one prop, and the difference is three buttons.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditTasks: false },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const slots = hourSlots(canvasElement);

    // Nothing is hidden from a viewer: the chips, the times and the create targets
    // are all still drawn, so the day still reads correctly.
    await expect(chips(canvasElement)).toHaveLength(3);

    const chip = within(slots[9]).getByText(FLUIDS).closest('button') as HTMLElement;
    const panel = within(await openTaskPopover(chip));

    /* The permission gate lives in the popover footer and nowhere else. View
       survives; the two mutating actions are removed rather than disabled, so a
       viewer is never offered a control that answers with a toast. */
    await expect(panel.getByRole('button', { name: 'View task' })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Change task status' })).toBeNull();
    await expect(panel.queryByRole('button', { name: 'Reschedule task' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same day for someone without task edit permission. The grid is identical - this is ' +
          'a read gate on the actions, not on the data - and only the popover footer changes.\n\n' +
          'Note what the gate does not cover: the invisible create button in every hour cell is ' +
          'still rendered and still calls back, because `onCreateTaskAt` is supplied by the page ' +
          'rather than gated here. Whether a viewer should be able to start a task they cannot ' +
          'then edit is a decision this story makes visible.',
      },
    },
  },
};

export const DragInFlight: Story = {
  name: 'A task in flight (bands and the drop)',
  args: {
    draggedTaskId: 'task-next-day',
    draggedTaskLabel: DRAG_LABEL,
    getDropAvailabilityIntervals: fn((_date: Date) => OPEN_MORNING),
  },
  play: async ({ args, canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const slots = hourSlots(canvasElement);

    /* The day grid has one column and no assignee, so the availability lookup is
       called with the date alone. The team grid calls the same prop with two
       arguments, and a provider written for that shape has to cope with the second
       one missing here. */
    await expect(args.getDropAvailabilityIntervals).toHaveBeenCalled();
    await expect(
      args.getDropAvailabilityIntervals.mock.calls.every((call) => call.length === 1)
    ).toBe(true);

    /* 09:00-11:00 open with a 30-minute task in hand paints three bands, not two.
       The last one is the half hour after the window closes, because a task may
       legally START at the final open minute - drop the `+ duration` term and the
       11:00 row silently stops accepting a drop it should accept. */
    const painted = bands(canvasElement);
    await expect(painted).toHaveLength(3);
    await expect(bands(slots[9])).toHaveLength(1);
    await expect(bands(slots[10])).toHaveLength(1);
    await expect(bands(slots[11])).toHaveLength(1);
    await expect(Math.round(bands(slots[9])[0].getBoundingClientRect().height)).toBe(
      ZOOM_IN_HOUR_PX
    );
    await expect(Math.round(bands(slots[11])[0].getBoundingClientRect().height)).toBe(
      ZOOM_IN_HOUR_PX / 2
    );

    // The rest of the day is closed and says so by drawing nothing.
    await expect(bands(slots[8])).toHaveLength(0);
    await expect(bands(slots[12])).toHaveLength(0);

    const target = slots[10];
    let box = target.getBoundingClientRect();
    fireEvent.dragOver(target, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    await expect(args.onDragHoverTarget).toHaveBeenCalledWith(DAY, undefined);

    /* Re-read the rect: `onDragOver` runs the edge auto-scroll, so the cell may have
       moved between the hover and the drop. Reusing the stale rect would aim the
       drop at a different minute and the assertion below would fail for a reason
       that has nothing to do with the drop. */
    box = target.getBoundingClientRect();
    fireEvent.drop(target, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    // Halfway down the 10:00 row is 10:30, reported as 630 minutes past midnight
    // and with no assignee, since a single-day grid has no column to name.
    await expect(args.onTaskDropAt).toHaveBeenCalledWith(DAY, 630, undefined);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A task picked up somewhere else on the page and dragged over this day. Two layers ' +
          'appear that have no resting render at all: the solid bands marking where a drop is ' +
          'allowed, and (once the pointer is over a cell) the dashed ghost naming the task in ' +
          'flight.\n\n' +
          'The bands are computed per hour cell rather than sliced from the day, which is why the ' +
          '11:00 row is half shaded even though the window closes at 11:00. The minute reported ' +
          'on the drop is snapped to five and then pulled to the nearest open interval within ' +
          'twelve minutes; drag further out than that and the drop is refused silently, with no ' +
          'message and no callback.',
      },
    },
  },
};
