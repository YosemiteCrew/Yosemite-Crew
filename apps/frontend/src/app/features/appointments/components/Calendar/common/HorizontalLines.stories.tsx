import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import {
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from '@/app/features/appointments/components/Calendar/helpers';
import { TIMEZONE_STORAGE_KEY } from '@/app/lib/timezone';

import HorizontalLines from './HorizontalLines';

/**
 * Both the now-indicator's position and its label are read in the PREFERRED zone,
 * not the runner's, so a zone left in localStorage by an earlier story would move
 * the line to a different pixel and rename the label. Cleared for the run (the
 * default is Europe/Berlin) and put back afterwards.
 */
const withDefaultTimeZone = () => {
  const previous = globalThis.localStorage?.getItem(TIMEZONE_STORAGE_KEY) ?? null;
  globalThis.localStorage?.removeItem(TIMEZONE_STORAGE_KEY);

  return () => {
    if (previous === null) {
      globalThis.localStorage?.removeItem(TIMEZONE_STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(TIMEZONE_STORAGE_KEY, previous);
    }
  };
};

/**
 * Tuesday 17 February 2026. Every instant here is a UTC literal on purpose: this
 * component never reads a local hour, it reads the preferred zone, so pinning the
 * instants pins the Berlin wall clock (winter, UTC+1) and the geometry with it.
 * 09:30Z is 10:30 Berlin - 630 minutes past midnight.
 */
const DAY = new Date('2026-02-17T12:00:00.000Z');
const NOW_INSIDE = new Date('2026-02-17T09:30:00.000Z');
const NOW_BEFORE_WINDOW = new Date('2026-02-17T05:00:00.000Z');
const NOW_NEXT_DAY = new Date('2026-02-18T09:30:00.000Z');

const NOW_MINUTES = 630;

/** 08:00-18:00, the window a clinic day actually collapses to. */
const OPEN = 8 * 60;
const CLOSE = 18 * 60;

/**
 * The rules are absolutely positioned, so they need a `position: relative` parent
 * with the height the same arithmetic produces. That parent is a 2400px column at
 * the default zoom, which is why DayCalendar hangs it inside a scrolling section
 * rather than letting it set the page height.
 */
const TimelineGrid = (args: ComponentProps<typeof HorizontalLines>) => {
  const pixelsPerStep = args.pixelsPerStep ?? PIXELS_PER_STEP;
  const height = ((args.windowEnd - args.windowStart) / MINUTES_PER_STEP) * pixelsPerStep;

  return (
    <div style={{ height: 420, overflowY: 'auto', background: 'var(--screen)' }}>
      {/* The now dot hangs 5px into the left gutter, so the grid is inset. */}
      <div
        data-timeline-grid
        style={{ position: 'relative', height, marginLeft: 56, marginRight: 16 }}
      >
        <HorizontalLines {...args} />
      </div>
    </div>
  );
};

const getGrid = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[data-timeline-grid]') as HTMLElement;

/** The indicator is the only child that stacks above the rules. */
const isIndicator = (el: Element): boolean => el.className.includes('z-10');

const getIndicator = (grid: HTMLElement): HTMLElement | undefined =>
  Array.from(grid.children).find(isIndicator) as HTMLElement | undefined;

const getRules = (grid: HTMLElement): HTMLElement[] =>
  Array.from(grid.children).filter((el) => !isIndicator(el)) as HTMLElement[];

const topOf = (grid: HTMLElement, el: HTMLElement): number =>
  el.getBoundingClientRect().top - grid.getBoundingClientRect().top;

/**
 * Hour rules and sub-hour rules differ only by colour: the sub-hour rule is the
 * hairline mixed 55% into transparent. The frame's own two rules are drawn in the
 * hour colour deliberately - they ARE the window's first and last hour lines - so
 * they sort into the same ladder.
 */
const splitRulesByWeight = (grid: HTMLElement) => {
  const rules = getRules(grid);
  const hourColour = getComputedStyle(rules[0]).borderTopColor;
  const tops = (list: HTMLElement[]) => list.map((el) => topOf(grid, el)).sort((a, b) => a - b);

  return {
    hourTops: tops(rules.filter((el) => getComputedStyle(el).borderTopColor === hourColour)),
    slotTops: tops(rules.filter((el) => getComputedStyle(el).borderTopColor !== hourColour)),
    hourColour,
  };
};

const assertHourLadder = async (tops: number[], count: number, hourPx: number) => {
  await expect(tops).toHaveLength(count);
  for (const [index, top] of tops.entries()) {
    // An evenly spaced ladder from 0 is the whole contract. A pixelsPerStep that
    // is applied to the height but not to the rules still draws a plausible grid.
    await expect(top).toBeCloseTo(index * hourPx, 1);
  }
};

const meta = {
  title: 'Appointments/Calendar/HorizontalLines',
  component: HorizontalLines,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The rules behind a day column: a frame, an hour rule per whole hour inside the window, ' +
          'a weaker rule per sub-hour slot, and the now-indicator. Three of those four are ' +
          'conditional. Sub-hour rules disappear entirely once `slotStepMinutes` reaches 60. The ' +
          "indicator is drawn only when `now` falls on the column's calendar day AND inside the " +
          'window, and its offset is rescaled by `pixelsPerStep / PIXELS_PER_STEP` while every ' +
          'other line is computed from `pixelsPerStep` directly - two routes to one pixel, which ' +
          'is exactly how a now-line ends up an hour out at a zoom level nobody screenshotted.\n\n' +
          'Every fixture is a UTC instant and the window is minutes-since-midnight, so the ' +
          'geometry below is the same in any runner timezone.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    date: DAY,
    now: NOW_INSIDE,
    windowStart: OPEN,
    windowEnd: CLOSE,
  },
  beforeEach: withDefaultTimeZone,
  render: (args) => <TimelineGrid {...args} />,
} satisfies Meta<typeof HorizontalLines>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default zoom: one 5-minute step is 20px, so an hour is 240px. */
const HOUR_PX = (60 / MINUTES_PER_STEP) * PIXELS_PER_STEP;

export const Default: Story = {
  name: 'Business hours, now inside the window',
  play: async ({ canvasElement }) => {
    const grid = getGrid(canvasElement);
    const { hourTops, slotTops, hourColour } = splitRulesByWeight(grid);

    // 08:00 to 18:00 is ten hours: eleven rules counting both frame edges.
    await assertHourLadder(hourTops, 11, HOUR_PX);

    // Three sub-hour rules per hour, at 15, 30 and 45 past, and never doubled onto
    // an hour line - the loop `continue`s on the hour and it is easy to lose.
    await expect(slotTops).toHaveLength(30);
    const offsets = [...new Set(slotTops.map((top) => Math.round(top % HOUR_PX)))].sort(
      (a, b) => a - b
    );
    await expect(offsets).toEqual([60, 120, 180]);

    const indicator = getIndicator(grid) as HTMLElement;
    await expect(indicator).toBeTruthy();
    // 10:30 Berlin is 150 minutes into the window: 30 steps, 600px.
    await expect(topOf(grid, indicator)).toBeCloseTo(
      ((NOW_MINUTES - OPEN) / MINUTES_PER_STEP) * PIXELS_PER_STEP,
      1
    );

    // Label, dot and rule. The label is formatted in the preferred zone, so it
    // reads 10:30 rather than the runner's 09:30 UTC.
    const [label, dot, rule] = Array.from(indicator.children) as HTMLElement[];
    await expect((label.textContent ?? '').replace(/\s/g, ' ')).toBe('10:30 AM');

    const dotBox = dot.getBoundingClientRect();
    await expect(Math.round(dotBox.width)).toBe(7);
    await expect(Math.round(dotBox.height)).toBe(7);

    /* The now rule is 2px in --blue against the 1px hairline grid. Same width or
       same colour as an hour rule and it stops being findable at a glance. */
    const ruleStyle = getComputedStyle(rule);
    await expect(ruleStyle.borderTopWidth).toBe('2px');
    await expect(ruleStyle.borderTopColor).not.toBe(hourColour);
  },
};

export const NowBeforeTheWindow: Story = {
  name: 'Now is outside the window',
  args: { now: NOW_BEFORE_WINDOW },
  play: async ({ canvasElement }) => {
    const grid = getGrid(canvasElement);

    // 06:00 Berlin, two hours before the column opens. The indicator would
    // otherwise be clamped onto the top frame and read as "it is 08:00".
    await expect(getIndicator(grid)).toBeUndefined();

    // The rest of the grid is untouched - the absence is the indicator's alone.
    const { hourTops } = splitRulesByWeight(grid);
    await assertHourLadder(hourTops, 11, HOUR_PX);
  },
};

export const NowOnAnotherDay: Story = {
  name: 'A column that is not today',
  args: { now: NOW_NEXT_DAY },
  play: async ({ canvasElement }) => {
    const grid = getGrid(canvasElement);

    /* Same clock time, next calendar day. Without the day check every column of a
       week would carry a now-line at the same height, which looks entirely
       plausible until you notice Thursday claims to be now as well. */
    await expect(getIndicator(grid)).toBeUndefined();
  },
};

export const HourRulesOnly: Story = {
  name: 'Hour rules only (60-minute slots)',
  args: { slotStepMinutes: 60 },
  play: async ({ canvasElement }) => {
    const grid = getGrid(canvasElement);
    const { hourTops, slotTops } = splitRulesByWeight(grid);

    // A 60-minute step returns early rather than drawing a second rule on top of
    // every hour line, which is what the `minute % 60` skip alone would leave.
    await expect(slotTops).toHaveLength(0);
    await assertHourLadder(hourTops, 11, HOUR_PX);
  },
};

export const ZoomedOutFullDay: Story = {
  name: 'Full day, zoomed out',
  args: {
    windowStart: 0,
    windowEnd: 24 * 60,
    pixelsPerStep: 4,
    slotStepMinutes: 30,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Midnight to midnight at 4px a step, so an hour is 48px and the whole day is 1152px. ' +
          'The now-indicator takes a different route to its offset than the rules do - it is ' +
          'computed at the default 20px step and then rescaled - so this is the story that would ' +
          'catch the two drifting apart.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const grid = getGrid(canvasElement);
    const zoomedHourPx = (60 / MINUTES_PER_STEP) * 4;
    const { hourTops, slotTops } = splitRulesByWeight(grid);

    await expect(Math.round(grid.getBoundingClientRect().height)).toBe(1152);

    // 23 hour rules inside the day, plus the two frame edges at 00:00 and 24:00.
    await assertHourLadder(hourTops, 25, zoomedHourPx);

    // One rule at each half hour, 24 of them, all at the half-hour offset.
    await expect(slotTops).toHaveLength(24);
    const offsets = [...new Set(slotTops.map((top) => Math.round(top % zoomedHourPx)))];
    await expect(offsets).toEqual([zoomedHourPx / 2]);

    const indicator = getIndicator(grid) as HTMLElement;
    await expect(indicator).toBeTruthy();
    // 630 minutes at 4px a step is 504px, not the 2520px the default zoom implies.
    await expect(topOf(grid, indicator)).toBeCloseTo((NOW_MINUTES / MINUTES_PER_STEP) * 4, 1);
  },
};
