import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { ReactNode } from 'react';

import TaskDropOverlays from './TaskDropOverlays';

/** 10:00. The component works in minutes-of-day, so the hour it sits in starts at 600. */
const HOUR_START_MINUTE = 600;
/** `getHourRowHeightPx('in')` / `getHourRowHeightPx('out')` - the two real row heights. */
const HOUR_HEIGHT = 180;
const ZOOM_OUT_HOUR_HEIGHT = 34;

const DRAG_LABEL = 'Juno · post-op observations';

/**
 * Every element this component renders is `absolute`, so without a positioned box of
 * exactly one hour's height there is nothing to measure it against and nothing to look
 * at. The ground is `--screen`, the surface the tasks grid actually paints, so the
 * translucent band and ghost fills are read over the colour they ship on.
 */
const HourCell = ({ height, children }: Readonly<{ height: number; children: ReactNode }>) => (
  <div
    data-hour-cell=""
    className="relative w-[260px] bg-[var(--screen)]"
    style={{ height: `${height}px` }}
  >
    {children}
  </div>
);

const hourCell = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[data-hour-cell]') as HTMLElement;

/** The band class is an arbitrary value, so it is matched on the token substring. */
const availabilityBands = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(
    canvasElement.querySelectorAll<HTMLElement>('[class*="calendar-availability-overlay"]')
  );

const offsetFromCellTop = (canvasElement: HTMLElement, el: HTMLElement): number =>
  el.getBoundingClientRect().top - hourCell(canvasElement).getBoundingClientRect().top;

/** label -> the dashed band -> the anchor carrying `top`. */
const ghostParts = (canvasElement: HTMLElement, label: string) => {
  const text = within(canvasElement).getByText(label);
  const band = text.parentElement as HTMLElement;
  return { band, anchor: band.parentElement as HTMLElement };
};

const meta = {
  title: 'Appointments/Calendar/TaskDropOverlays',
  component: TaskDropOverlays,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The two drag affordances of the tasks planner, drawn together. `TaskSlot` mounts the ' +
          'whole layer behind `{draggedTaskId && ...}`, so it exists only between pointerdown and ' +
          'drop: no snapshot or Chromatic frame has ever held one, and both branches are pure ' +
          'inline pixel arithmetic - the shape of defect that ships silently.\n\n' +
          'The two branches are independent. The **bands** are handed in already computed ' +
          '(`{top, height}` in pixels) and are passed straight to `style`, so the story asserts ' +
          'the pass-through and the `left-1 right-1` inset that keeps a band off the column edge. ' +
          'The **ghost** is computed here: `top` is `((dropPreviewMinute - hourStartMinute) / 60) ' +
          '* height`, and its height is the dragged duration floored at 5 minutes and then floored ' +
          'again at 12px so a short task is still a visible band rather than a hairline.\n\n' +
          "Note what is NOT here: unlike the appointment grid's `DropPreviewOverlay`, which " +
          'clamps the ghost to `60 - (minute % 60)`, this one has no clamp to the end of the hour ' +
          'at all - see "Ghost overhangs the hour". The two calendars also disagree on the floor, ' +
          '12px here against 14px there.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    availabilitySegments: [{ top: 45, height: 135 }],
    dropPreviewMinute: null,
    draggedTaskLabel: DRAG_LABEL,
    draggedTaskDurationMinutes: 30,
    hourStartMinute: HOUR_START_MINUTE,
    height: HOUR_HEIGHT,
  },
  decorators: [
    (Story, context) => (
      <HourCell height={context.args.height}>
        <Story />
      </HourCell>
    ),
  ],
} satisfies Meta<typeof TaskDropOverlays>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BandsOnly: Story = {
  name: 'Bands only (drag started, nothing hovered)',
  play: async ({ canvasElement }) => {
    const bands = availabilityBands(canvasElement);
    await expect(bands).toHaveLength(1);

    // The pixels are handed in, not derived - a band that ignored either value would
    // still be a plausible-looking rectangle, so both are measured rather than trusted.
    await expect(offsetFromCellTop(canvasElement, bands[0])).toBeCloseTo(45, 0);
    await expect(bands[0].getBoundingClientRect().height).toBeCloseTo(135, 0);

    /* `left-1 right-1`: 4px of air each side. Without the inset the band would sit flush
       against the day column's border and read as a filled cell rather than an overlay. */
    const cellWidth = hourCell(canvasElement).getBoundingClientRect().width;
    await expect(bands[0].getBoundingClientRect().width).toBeCloseTo(cellWidth - 8, 0);

    // No pointer has entered the cell yet, so the landing ghost is absent entirely -
    // this is the resting half of the drag, and it is a real state a nurse sees.
    await expect(canvasElement.querySelector('.border-dashed')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A task is in flight and the day is open 10:15-10:45. The band already carries the ' +
          "dragged duration in its foot (that is `TaskSlot`'s arithmetic, not this component's), " +
          'which is why 30 minutes of availability paints 135px of a 180px hour.',
      },
    },
  },
};

export const BandAndGhost: Story = {
  name: 'Band and ghost (hovering 10:30)',
  args: { dropPreviewMinute: 630 },
  play: async ({ canvasElement }) => {
    const { band, anchor } = ghostParts(canvasElement, DRAG_LABEL);

    // 10:30 is half an hour past 10:00, so half of a 180px row.
    await expect(offsetFromCellTop(canvasElement, anchor)).toBeCloseTo(90, 0);
    // 30 minutes at 3px a minute.
    await expect(band.getBoundingClientRect().height).toBeCloseTo(90, 0);
    // Dashed, not solid: the outline is the ONLY thing distinguishing "where this drop
    // lands" from "where drops are allowed" once the two fills overlap.
    await expect(getComputedStyle(band).borderTopStyle).toBe('dashed');

    // The ghost is added to the band, never swapped in - both layers are on screen at
    // once, and the band under it is untouched.
    await expect(availabilityBands(canvasElement)).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both layers at once, which is the state the nurse actually sees mid-gesture. The ghost ' +
          "carries the dragged task's own name so it can be told apart from the chips already in " +
          'the grid.',
      },
    },
  },
};

export const GhostWithoutLabel: Story = {
  name: 'Ghost with no label and no bands',
  args: { availabilitySegments: [], dropPreviewMinute: HOUR_START_MINUTE, draggedTaskLabel: null },
  play: async ({ canvasElement }) => {
    /* Exact string, not /task/i: the preview decorator injects an sr-only <h1> reading
       "Appointments/Calendar/TaskDropOverlays - Ghost with no label and no bands", which
       a loose regex matches instead of the fallback under test. */
    const { anchor } = ghostParts(canvasElement, 'Task');

    // Landing exactly on the hour: (600 - 600) / 60 * 180 === 0.
    await expect(offsetFromCellTop(canvasElement, anchor)).toBeCloseTo(0, 0);

    /* The two branches are independent. A day with no open interval in this hour draws
       no band at all, and the ghost still renders - which is the honest reading of the
       props, but it does mean the grid will happily preview a drop into a closed hour. */
    await expect(availabilityBands(canvasElement)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A drag carrying no label falls back to the bare word "Task" rather than an ' +
          'unidentifiable dashed box, and an hour with no availability segments still draws the ' +
          'ghost - the two branches do not gate each other.',
      },
    },
  },
};

export const ShortDragFloor: Story = {
  name: 'Zoomed out, 5-minute task (12px floor)',
  args: {
    height: ZOOM_OUT_HOUR_HEIGHT,
    availabilitySegments: [{ top: 0, height: ZOOM_OUT_HOUR_HEIGHT }],
    dropPreviewMinute: 620,
    draggedTaskDurationMinutes: 5,
  },
  play: async ({ canvasElement }) => {
    const { band, anchor } = ghostParts(canvasElement, DRAG_LABEL);

    /* 5 minutes of a 34px hour is 2.8px, so `Math.max(12, ...)` takes over and the ghost
       claims more than a third of the row for a twelfth of an hour. That overstatement is
       deliberate - a 3px band is invisible - but it is only defensible while someone has
       actually seen it, and until this story nobody had. */
    await expect(band.getBoundingClientRect().height).toBeCloseTo(12, 0);
    await expect(band.getBoundingClientRect().height).toBeGreaterThan((5 / 60) * 34);

    // 20 minutes down a 34px row.
    await expect(offsetFromCellTop(canvasElement, anchor)).toBeCloseTo((20 / 60) * 34, 0);

    // At this zoom the band beneath fills the whole hour, so the ghost is a third of its
    // height and the dashed outline is carrying the entire distinction.
    await expect(availabilityBands(canvasElement)[0].getBoundingClientRect().height).toBeCloseTo(
      34,
      0
    );
  },
};

export const GhostOverhangsTheHour: Story = {
  name: 'Ghost overhangs the hour (no clamp)',
  args: {
    availabilitySegments: [{ top: 0, height: HOUR_HEIGHT }],
    dropPreviewMinute: 645,
    draggedTaskDurationMinutes: 45,
  },
  play: async ({ canvasElement }) => {
    const { band, anchor } = ghostParts(canvasElement, DRAG_LABEL);
    const cellBottom = hourCell(canvasElement).getBoundingClientRect().bottom;

    // 10:45 is three quarters down the row.
    await expect(offsetFromCellTop(canvasElement, anchor)).toBeCloseTo(135, 0);
    // 45 minutes at 3px a minute, with nothing subtracting the 15 minutes actually left
    // in the hour, so the ghost runs 90px past the foot of its own cell and into the
    // 11:00 row. `DropPreviewOverlay` clamps this case; this copy does not.
    await expect(band.getBoundingClientRect().height).toBeCloseTo(135, 0);
    await expect(band.getBoundingClientRect().bottom - cellBottom).toBeCloseTo(90, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The branch the appointment calendar has and this one does not. A 45-minute task ' +
          'previewed at :45 has 15 minutes of its own hour left, but the ghost is sized from the ' +
          'duration alone, so it spills into the hour below and overlaps whatever that row is ' +
          'already drawing. Nothing crashes and no test notices - it is only visible drawn.',
      },
    },
  },
};
