import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { expect, within } from 'storybook/test';

import NowIndicator from './NowIndicator';

/* The real zoomed-in hour row (`getHourRowHeightPx('in')`) and the real gutter:
   the calendar body is a `64px | 1fr | 64px` grid, hour labels on the left and a
   sticky rail on the right. The indicator draws its own copy of that grid, so
   the harness has to use the same three columns or the alignment being asserted
   here is meaningless. */
const HOUR_ROW_HEIGHT = 180;
const HOUR_LABELS = ['9 AM', '10 AM', '11 AM'];
const GRID_WIDTH = 720;
const GRID_HEIGHT = HOUR_LABELS.length * HOUR_ROW_HEIGHT;

/** 09:40 on a grid that starts at 09:00: (40 / 60) * 180. */
const NOW_TOP_PX = 120;

const HourGrid = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div
    data-hour-grid=""
    className="relative overflow-hidden rounded-md bg-neutral-0"
    style={{ width: `${GRID_WIDTH}px`, height: `${GRID_HEIGHT}px` }}
  >
    {HOUR_LABELS.map((label) => (
      <div
        key={label}
        className="grid min-w-max grid-cols-[64px_minmax(0,1fr)_64px]"
        style={{ height: `${HOUR_ROW_HEIGHT}px` }}
      >
        <div className="pr-2 pt-1 text-right text-[11px] leading-none text-[var(--ink-faint)]">
          {label}
        </div>
        <div className="border-t border-card-border" />
        <div className="border-t border-card-border" />
      </div>
    ))}
    {children}
  </div>
);

type Parts = {
  grid: HTMLElement;
  overlay: HTMLElement;
  dot: HTMLElement;
  rule: HTMLElement;
};

const getParts = (canvasElement: HTMLElement): Parts => {
  const grid = canvasElement.querySelector('[data-hour-grid]') as HTMLElement;
  const dot = canvasElement.querySelector('.rounded-full') as HTMLElement;
  /* The rule is the only element carrying an inline border-top-color; matching on
     the inline style rather than on a utility class keeps the query honest if the
     colour is ever moved between --blue and a red "overdue" variant. */
  const rule = canvasElement.querySelector('div[style*="border-top-color"]') as HTMLElement;
  const overlay = dot.closest('div.pointer-events-none') as HTMLElement;
  return { grid, overlay, dot, rule };
};

const meta = {
  title: 'Appointments/Calendar/NowIndicator',
  component: NowIndicator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The blue "now" line the day and user calendars lay over their hour grid. It is two ' +
          'props and no logic, which is exactly why it is worth drawing: everything it does is ' +
          'geometry, and geometry fails silently.\n\n' +
          'The overlay re-declares the calendar body grid (`64px | 1fr | 64px`) so the rule starts ' +
          'where the hour column starts rather than at the left edge of the scroller, and stops ' +
          '`right-2` short of the sticky right rail. The dot is pulled back out of the body on ' +
          '`-left-4`, so it hangs in the hour-label gutter and its right edge lands exactly on the ' +
          'first bookable pixel. Both the dot and the rule are shifted up by half their own height, ' +
          'which is what makes `topPx` mean the centre of the line rather than its top - an ' +
          'off-by-one nobody would see and everybody would trust.\n\n' +
          'The whole layer is `pointer-events-none`. That is load-bearing: it covers every slot in ' +
          'the visible day, and without it the current hour would be the one hour of the day you ' +
          'could not click to book.\n\n' +
          'It also does not clamp. `topPx` is used raw, so at the very top of the range the label ' +
          'and the upper half of the dot sit above the grid, and at the very bottom the dot hangs ' +
          'below it - clipped by the scroll container rather than nudged inwards. The two edge ' +
          'stories draw that rather than describe it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    topPx: NOW_TOP_PX,
    timeLabel: '09:40',
  },
  decorators: [
    (Story) => (
      <HourGrid>
        <Story />
      </HourGrid>
    ),
  ],
} satisfies Meta<typeof NowIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'With a time label (09:40)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { grid, overlay, dot, rule } = getParts(canvasElement);
    const gridRect = grid.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    const ruleRect = rule.getBoundingClientRect();
    const label = canvas.getByText('09:40');
    const labelRect = label.getBoundingClientRect();

    // The layer covers every slot in the day. If it ever swallowed pointer events,
    // the current hour would be the one hour nobody could click to book.
    await expect(getComputedStyle(overlay).pointerEvents).toBe('none');

    // The rule starts at the hour-label gutter, not at the left edge of the
    // scroller, and stops 8px short of the 64px sticky rail on the right.
    await expect(ruleRect.left - gridRect.left).toBeCloseTo(64, 1);
    await expect(gridRect.right - ruleRect.right).toBeCloseTo(72, 1);

    // The 16px dot hangs back into the gutter so that it ends exactly where the
    // bookable body begins - it marks the line, it does not shorten it.
    await expect(dotRect.width).toBeCloseTo(16, 1);
    await expect(dotRect.right).toBeCloseTo(ruleRect.left, 1);

    /* topPx is the CENTRE of the line, not its top: both parts are shifted up by
       half their own height. A change that dropped either translate would move
       the line by one pixel and the dot by eight, and nothing else would fail. */
    await expect(dotRect.top + dotRect.height / 2 - gridRect.top).toBeCloseTo(NOW_TOP_PX, 1);
    await expect(ruleRect.top + ruleRect.height / 2 - gridRect.top).toBeCloseTo(NOW_TOP_PX, 1);

    // The label sits clear above the rule rather than on it.
    await expect(labelRect.bottom).toBeLessThanOrEqual(ruleRect.top);
    await expect(labelRect.left - gridRect.left).toBeCloseTo(76, 1);

    // --blue is the FILL token and carries no contrast requirement ...
    await expect(getComputedStyle(dot).backgroundColor).toBe('rgb(37, 123, 237)');
    /* ... while the label is text, so it resolves --blue-text (#1657c9). The two
       were identical in light mode until the AA fix, and a regression that
       re-pointed the ink back at the fill would look almost right and measure
       3.1:1. */
    await expect(getComputedStyle(label).color).toBe('rgb(22, 87, 201)');
  },
};

export const NoLabel: Story = {
  name: 'Without a time label',
  args: { timeLabel: null },
  play: async ({ canvasElement }) => {
    const { overlay, dot, rule } = getParts(canvasElement);

    /* Asserted on the overlay, not the canvas: the preview decorator injects an
       sr-only <h1> with the story title, so canvasElement is never empty. */
    await expect(overlay.textContent).toBe('');
    await expect(dot).toBeInTheDocument();
    await expect(rule).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The rule and the dot survive without the label. Both current call sites derive the ' +
          'label from the same memo as the position, so they never pass null while the indicator ' +
          'is mounted - this is the branch a caller that already prints the time in its own gutter ' +
          'would take, and this story is the only place it is drawn.',
      },
    },
  },
};

export const NearTop: Story = {
  name: 'At the top of the range (label clipped)',
  args: { topPx: 6, timeLabel: '9:02 AM' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { grid, dot, rule } = getParts(canvasElement);
    const gridRect = grid.getBoundingClientRect();

    // The rule itself is still inside the grid at topPx 6 ...
    await expect(rule.getBoundingClientRect().top).toBeGreaterThanOrEqual(gridRect.top);
    /* ... but nothing is clamped, so both things drawn ABOVE the line spill out of
       the scroller: the dot loses its upper half within the first 8px, and the
       label - offset 115% of its own height - within the first ~12px. At the top
       of a day the reader gets a half-circle and a cropped time. */
    await expect(dot.getBoundingClientRect().top).toBeLessThan(gridRect.top);
    await expect(canvas.getByText('9:02 AM').getBoundingClientRect().top).toBeLessThan(
      gridRect.top
    );
  },
};

export const NearBottom: Story = {
  name: 'At the end of the range (dot half out)',
  args: { topPx: GRID_HEIGHT, timeLabel: '12:00 PM' },
  play: async ({ canvasElement }) => {
    const { grid, dot, rule } = getParts(canvasElement);
    const gridRect = grid.getBoundingClientRect();
    const ruleRect = rule.getBoundingClientRect();

    // The line still resolves to exactly topPx at the far edge - no per-row rounding.
    await expect(ruleRect.top + ruleRect.height / 2 - gridRect.top).toBeCloseTo(GRID_HEIGHT, 1);
    /* And the dot hangs its lower half past the last row, because the translate is
       applied after the raw offset. On the real scroller that is a half-circle at
       the end of the day, which is the same trade-off as the label at the top. */
    await expect(dot.getBoundingClientRect().bottom - gridRect.bottom).toBeCloseTo(8, 1);
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { dot } = getParts(canvasElement);

    // The fill is deliberately the same #257bed in both themes ...
    await expect(getComputedStyle(dot).backgroundColor).toBe('rgb(37, 123, 237)');
    // ... while the ink lightens to #8fb6f5 so the time stays readable on espresso.
    await expect(getComputedStyle(canvas.getByText('09:40')).color).toBe('rgb(143, 182, 245)');
  },
};
