import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, within } from 'storybook/test';

import TaskSlot from './TaskSlot';
import type { Task } from '@/app/features/tasks/types/task';

const ORG_ID = 'org-storybook';

/** The 10:00 row of the tasks week grid, zoomed in: 180px an hour, so 3px a minute. */
const HOUR = 10;
const HOUR_HEIGHT = 180;
const ZOOM_OUT_HOUR_HEIGHT = 34;
const DROP_DATE = new Date('2026-07-14T00:00:00.000Z');

const task = (id: string, name: string, minuteOfHour: number): Task => ({
  _id: id,
  organisationId: ORG_ID,
  assignedTo: 'vet-weber',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'GENERAL',
  status: 'PENDING',
  name,
  // Only the MINUTE within the hour positions a chip, and every timezone this app
  // supports is a whole-hour offset, so the chip lands on the same pixel everywhere.
  dueAt: new Date(`2026-07-14T10:${String(minuteOfHour).padStart(2, '0')}:00.000Z`),
});

const SLOT_TASKS: Task[] = [task('task-1', 'Bruno · fluids rate check', 20)];

const DRAG_LABEL = 'Juno · post-op observations';

const getSlotSection = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('section[aria-label^="Tasks slot"]') as HTMLElement;

/** The band uses an arbitrary-value class, so it is matched on the token substring. */
const getAvailabilityBands = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(
    canvasElement.querySelectorAll<HTMLElement>('[class*="calendar-availability-overlay"]')
  );

const offsetFromSlotTop = (canvasElement: HTMLElement, el: HTMLElement): number =>
  el.getBoundingClientRect().top - getSlotSection(canvasElement).getBoundingClientRect().top;

const meta = {
  title: 'Appointments/Calendar/TaskSlot',
  component: TaskSlot,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One hour cell of the tasks planner, and the `TaskDropOverlays` layer it mounts only ' +
          'while a task is being dragged.\n\n' +
          'The whole layer is behind `{draggedTaskId && ...}`, so it has no resting render at all: ' +
          'no snapshot, unit test or Chromatic frame has ever contained a droppable band or the ' +
          'preview ghost that names the task in flight. It is also a near-copy of the appointment ' +
          "calendar's equivalent with quietly different constants - a 6px minimum band against " +
          "Slot's 4px, a 12px minimum ghost against `DropPreviewOverlay`'s 14px, and no clamp to " +
          'the end of the hour on the ghost at all. Two calendars, two sets of numbers, one ' +
          'gesture; the only way to see them disagree is to draw both.\n\n' +
          'As in the appointment grid, the band is the availability interval clipped to this hour ' +
          "with its foot extended by the dragged task's duration - a task may legally START at " +
          'the last open minute. That is why an interval belonging to the hour ABOVE still paints ' +
          'inside this cell.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    slotEvents: SLOT_TASKS,
    height: HOUR_HEIGHT,
    hour: HOUR,
    dayIndex: 0,
    length: 6,
    dropDate: DROP_DATE,
    zoomMode: 'in',
    permissions: { canEditTasks: true },
    draggedTaskDurationMinutes: 30,
    handleViewTask: fn(),
    handleChangeStatusTask: fn(),
    handleRescheduleTask: fn(),
    canDragTask: () => true,
    onTaskDragStart: fn(),
    onTaskDragEnd: fn(),
    onTaskDropAt: fn(),
    onDragHoverTarget: fn(),
    resolveDisplayName: () => 'Dr. Elena Weber',
  },
  decorators: [
    (Story) => (
      <div className="w-[260px] bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskSlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Resting (no drag)',
  args: {
    dropAvailabilityIntervals: [{ startMinute: 615, endMinute: 645 }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The chip sits at its due minute: 10:20 is a third down a 180px row, so 60px.
       Its height is not the 30-minute block (90px) but 88px - the block minus the
       2px the layout takes back so consecutive chips do not touch. Both numbers are
       the baseline the overlay geometry below is read against. */
    const chipLabel = canvas.getByText('Bruno · fluids rate check');
    const chip = chipLabel.closest('.absolute') as HTMLElement;
    await expect(offsetFromSlotTop(canvasElement, chip)).toBeCloseTo(60, 0);
    await expect(chip.getBoundingClientRect().height).toBeCloseTo(88, 0);

    // The due time is rendered in the preferred zone (10:20 UTC is 12:20 Berlin).
    // Matched on a prefix because the AM/PM separator Intl emits is a narrow
    // no-break space, not the space this file could type.
    await expect(canvas.getByText(/^Due: 12:20/)).toBeInTheDocument();

    /* Two controls: the chip itself and the hover-revealed "View task" shortcut that
       sits on top of it. The shortcut is always in the tree at opacity 0, so it is
       reachable by keyboard even when the pointer never arrives. */
    await expect(canvas.getAllByRole('button')).toHaveLength(2);
    await expect(chipLabel.closest('button')).toHaveAttribute('draggable', 'true');
    await expect(canvas.getByRole('button', { name: 'View task' })).toBeInTheDocument();

    // The drop affordance is not drawn. Availability is already supplied here and
    // still paints nothing, which is the gate this file exists to document.
    await expect(getAvailabilityBands(canvasElement)).toHaveLength(0);
    await expect(canvasElement.querySelector('.border-dashed')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The cell as every existing frame holds it: a 10:20 task chip in the 10:00 row, no ' +
          'overlays. Everything below differs from this by one prop.',
      },
    },
  },
};

export const DragInFlight: Story = {
  name: 'Drag in flight (band clipped to the hour)',
  args: {
    draggedTaskId: 'task-2',
    draggedTaskLabel: DRAG_LABEL,
    dropAvailabilityIntervals: [{ startMinute: 615, endMinute: 645 }],
  },
  play: async ({ canvasElement }) => {
    const bands = getAvailabilityBands(canvasElement);
    await expect(bands).toHaveLength(1);

    // 10:15 is a quarter down a 180px row.
    await expect(offsetFromSlotTop(canvasElement, bands[0])).toBeCloseTo(45, 0);
    /* The interval closes at 10:45, but a 30-minute task starting at 10:45 is legal,
       so the foot runs to 11:15 and is clipped at the hour: 135px, not the 90px the
       interval alone would give. A band that stopped at the interval end would tell
       the nurse they cannot drop at 10:45, when they can. */
    await expect(bands[0].getBoundingClientRect().height).toBeCloseTo(135, 0);
    // Nothing has hovered the cell yet, so there is no landing ghost.
    await expect(canvasElement.querySelector('.border-dashed')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A task is in flight over a cell open 10:15-10:45. The band starts at the interval and ' +
          'runs to the end of the hour, because the dragged duration is added to the interval ' +
          'foot before the clip.',
      },
    },
  },
};

export const SpilloverFromPreviousHour: Story = {
  name: 'Drag in flight (spill from the hour above)',
  args: {
    draggedTaskId: 'task-2',
    draggedTaskLabel: DRAG_LABEL,
    dropAvailabilityIntervals: [{ startMinute: 540, endMinute: 585 }],
  },
  play: async ({ canvasElement }) => {
    const bands = getAvailabilityBands(canvasElement);
    /* The interval is 09:00-09:45 and this is the 10:00 cell, so on a naive reading
       nothing should paint here. It does, correctly: a 30-minute task dropped at 09:45
       runs to 10:15, so the first quarter of this hour is a valid landing zone. Drop
       the `+ duration` term and this band vanishes with no test noticing. */
    await expect(bands).toHaveLength(1);
    await expect(offsetFromSlotTop(canvasElement, bands[0])).toBeCloseTo(0, 0);
    await expect(bands[0].getBoundingClientRect().height).toBeCloseTo(45, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The least obvious branch, and the reason segments are computed per cell rather than ' +
          'sliced from the day: an availability interval that closes in the PREVIOUS hour still ' +
          'paints a band at the top of this one.',
      },
    },
  },
};

export const DropPreviewGhost: Story = {
  name: 'Drop preview ghost (drag over 10:30)',
  args: {
    draggedTaskId: 'task-2',
    draggedTaskLabel: DRAG_LABEL,
    dropAvailabilityIntervals: [{ startMinute: 615, endMinute: 645 }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const section = getSlotSection(canvasElement);
    const rect = section.getBoundingClientRect();

    /* The minute is derived from the pointer's ratio down the cell's own rect, so the
       pointer is placed by that ratio rather than a raw pixel. Dispatched here, above
       any `waitFor`: a dispatch inside a retried callback re-queues on every mutation
       and wedges the tab instead of failing. */
    fireEvent.dragOver(section, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    const label = await canvas.findByText(DRAG_LABEL);
    const band = label.parentElement as HTMLElement;
    const anchor = band.parentElement as HTMLElement;

    // 10:30 falls inside 10:15-10:45, so `calcNearestAvailableMinute` returns it
    // unchanged and the ghost sits on the half-hour rule: 90px of 180px.
    await expect(offsetFromSlotTop(canvasElement, anchor)).toBeCloseTo(90, 0);
    // 30 minutes at 3px a minute. Note there is no clamp to the end of the hour here,
    // unlike the appointment calendar's ghost - a 45-minute task dropped at :45 would
    // hang over the row below.
    await expect(band.getBoundingClientRect().height).toBeCloseTo(90, 0);
    await expect(getComputedStyle(band).borderTopStyle).toBe('dashed');
    // The band stays underneath; the ghost is added to it, not swapped in.
    await expect(getAvailabilityBands(canvasElement)).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both drag layers at once, which is the state the nurse actually sees: the solid band ' +
          'says where a drop is allowed, the dashed ghost says where THIS drop would land, and it ' +
          "carries the dragged task's own label so the two can be told apart mid-gesture.\n\n" +
          'The minute is snapped through `calcNearestAvailableMinute`, which rounds to five and ' +
          'then pulls to the nearest interval within a 12-minute tolerance. Drag further than ' +
          'that from anything open and no ghost draws at all - the gesture simply refuses, with ' +
          'no message.',
      },
    },
  },
};

export const ZoomedOutGhost: Story = {
  name: 'Zoomed out ghost (12px floor, fallback label)',
  args: {
    zoomMode: 'out',
    height: ZOOM_OUT_HOUR_HEIGHT,
    slotEvents: [],
    draggedTaskId: 'task-2',
    draggedTaskLabel: null,
    draggedTaskDurationMinutes: 5,
    dropAvailabilityIntervals: [{ startMinute: 600, endMinute: 660 }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const section = getSlotSection(canvasElement);
    const rect = section.getBoundingClientRect();

    fireEvent.dragOver(section, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    // A drag with no label falls back to the bare word "Task" rather than an
    // unidentifiable dashed box. Exact string: the preview decorator's sr-only <h1>
    // reads "Appointments/Calendar/TaskSlot - Zoomed out ghost (12px floor, fallback
    // label)", which a loose regex would match instead.
    const label = await canvas.findByText('Task');
    const band = label.parentElement as HTMLElement;

    /* 5 minutes on a 34px hour is 2.8px, so the 12px floor takes over - the ghost is
       more than a third of the row it sits in, four times the time it represents.
       That is deliberate (a 3px band is invisible) but it is only defensible while
       someone has seen it, which no frame ever had. */
    await expect(band.getBoundingClientRect().height).toBeCloseTo(12, 0);
    await expect(offsetFromSlotTop(canvasElement, band.parentElement as HTMLElement)).toBeCloseTo(
      17,
      0
    );
    // The band under it fills the whole zoomed-out hour, so the two are almost the
    // same size - the visual distinction rests entirely on the dashed outline.
    const bands = getAvailabilityBands(canvasElement);
    await expect(bands).toHaveLength(1);
    await expect(bands[0].getBoundingClientRect().height).toBeCloseTo(34, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same gesture in the zoomed-out planner, where an hour is 34px. Two things only ' +
          "visible here: the ghost's 12px height floor, which at this zoom overstates a " +
          "5-minute task by a factor of four, and the `|| 'Task'` fallback for a drag that " +
          'carries no label.',
      },
    },
  },
};
