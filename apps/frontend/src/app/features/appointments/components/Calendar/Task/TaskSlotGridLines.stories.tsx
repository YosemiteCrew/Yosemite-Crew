import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import type { ReactNode } from 'react';

import TaskSlotGridLines from './TaskSlotGridLines';

/** `getHourRowHeightPx('in')` - the zoomed-in row the planner spends its life in. */
const HOUR_HEIGHT = 180;

/**
 * The rules are `absolute inset-0` inside their hour cell, so they need a positioned box
 * of exactly one hour's height. The ground is `--screen`, the surface the tasks grid
 * paints - which matters more here than anywhere else, because the defect this file
 * records was a rule that was present, correct in structure, and invisible on it.
 */
const HourCell = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div
    data-hour-cell=""
    className="relative w-[260px] bg-[var(--screen)]"
    style={{ height: `${HOUR_HEIGHT}px` }}
  >
    {children}
  </div>
);

const hourCell = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[data-hour-cell]') as HTMLElement;

/**
 * The rules in render order: the hour boundary, then each slot step, then the closing
 * rule if this is the last visible hour. Read off the container rather than by class,
 * because "which rule is this" is a position question and classes cannot answer it.
 */
const gridRules = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(hourCell(canvasElement).firstElementChild?.children ?? []) as HTMLElement[];

const topOffsets = (canvasElement: HTMLElement): number[] => {
  const cellTop = hourCell(canvasElement).getBoundingClientRect().top;
  return gridRules(canvasElement).map((rule) =>
    Math.round(rule.getBoundingClientRect().top - cellTop)
  );
};

type Rgba = { r: number; g: number; b: number; a: number };

/**
 * Chromium serialises `color-mix(in srgb, ...)` as either `rgba(...)` or
 * `color(srgb r g b / a)` depending on version, and the sub-hour rules are a colour-mix.
 * Asserting on the string would pin the browser build rather than the design.
 */
const parseColor = (value: string): Rgba => {
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
  const scale = value.startsWith('color(') ? 255 : 1;
  const [r = 0, g = 0, b = 0, a = 1] = parts;
  return { r: r * scale, g: g * scale, b: b * scale, a };
};

const channel = (value: number): number => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = ({ r, g, b }: Rgba): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** The rule is translucent, so what the eye judges is the composite over the ground. */
const contrastOnGround = (rule: Rgba, ground: Rgba): number => {
  const composite = {
    r: rule.a * rule.r + (1 - rule.a) * ground.r,
    g: rule.a * rule.g + (1 - rule.a) * ground.g,
    b: rule.a * rule.b + (1 - rule.a) * ground.b,
    a: 1,
  };
  const [light, dark] = [relativeLuminance(composite), relativeLuminance(ground)].sort(
    (x, y) => y - x
  );
  return (light + 0.05) / (dark + 0.05);
};

/**
 * Asserts a sub-hour rule is actually on screen: the same warm ink as the hour boundary,
 * carried at 55%, and separable from the ground it is drawn on.
 *
 * The 1.05 floor is set just above the measured failure. On the pre-redesign ramp these
 * rules were `--color-calendar-line-soft` - #e9edf3, a COOL grey - which came out at
 * 1.01:1 on the warm bone ground in light and on espresso in dark. The rules were in the
 * DOM, at the right pixels, with the right widths, and no one could see them. A colour
 * regression here fails every human check and no automated one.
 */
const expectVisibleRule = async (canvasElement: HTMLElement) => {
  const rules = gridRules(canvasElement);
  const ground = parseColor(getComputedStyle(hourCell(canvasElement)).backgroundColor);
  const hourRule = parseColor(getComputedStyle(rules[0]).borderTopColor);
  const slotRule = parseColor(getComputedStyle(rules[1]).borderTopColor);

  // Warm, not cool: on this ground a blue-grey rule is the exact shape of the regression.
  await expect(hourRule.r).toBeGreaterThan(hourRule.b);
  await expect(slotRule.r).toBeGreaterThan(slotRule.b);

  // One ink at two strengths. A separate token for the sub-hour rules is how they drifted
  // off the ramp last time, so they are asserted to BE the hairline, not merely to differ.
  await expect(Math.round(slotRule.r)).toBe(Math.round(hourRule.r));
  await expect(Math.round(slotRule.g)).toBe(Math.round(hourRule.g));
  await expect(Math.round(slotRule.b)).toBe(Math.round(hourRule.b));
  await expect(slotRule.a).toBeCloseTo(0.55, 2);

  await expect(contrastOnGround(slotRule, ground)).toBeGreaterThan(1.05);
  // The hour boundary is the stronger of the two - the hierarchy is the whole point.
  await expect(contrastOnGround(hourRule, ground)).toBeGreaterThan(
    contrastOnGround(slotRule, ground)
  );
};

const meta = {
  title: 'Appointments/Calendar/TaskSlotGridLines',
  component: TaskSlotGridLines,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The rules behind the task chips: one at the hour boundary, one per slot step, and a ' +
          'closing rule on the last visible hour only.\n\n' +
          "This file's own comment records why it needs drawing. It was a private copy of " +
          '`common/SlotGridLines` still on the pre-redesign cool ramp: ' +
          '`--color-calendar-line-soft`, #e9edf3, a cool grey on the warm bone ground and #302820 ' +
          'in dark - 1.01:1 on the slot surface. The rules were in the DOM at the correct pixels ' +
          'and were simply not visible, which is a defect no structural test can hold. The play ' +
          'functions here measure the colour off the rendered element and composite it over the ' +
          'ground rather than checking a class name.\n\n' +
          'Geometry is measured too: the offsets are percentages of the hour, so the same array ' +
          'lands on different pixels at each zoom, and the closing rule sits at `top-full` - one ' +
          'row height DOWN, outside its own box - which is easy to lose in a refactor and leaves ' +
          'the grid with no bottom edge.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    hour: 10,
    slotOffsetMinutes: [15, 30, 45],
    isLastVisibleHour: false,
  },
  decorators: [
    (Story) => (
      <HourCell>
        <Story />
      </HourCell>
    ),
  ],
} satisfies Meta<typeof TaskSlotGridLines>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidGrid: Story = {
  name: 'Mid-grid hour (15-minute steps)',
  play: async ({ canvasElement }) => {
    // Four rules: the hour boundary plus :15, :30, :45. No fifth - a closing rule on
    // every hour would double every boundary in the grid.
    await expect(gridRules(canvasElement)).toHaveLength(4);
    await expect(topOffsets(canvasElement)).toEqual([0, 45, 90, 135]);

    // Full-bleed, unlike the drop bands which inset by 4px each side: a rule that
    // stopped short would read as a divider inside the cell rather than a grid line.
    const cell = hourCell(canvasElement).getBoundingClientRect();
    for (const rule of gridRules(canvasElement)) {
      await expect(rule.getBoundingClientRect().width).toBeCloseTo(cell.width, 0);
    }

    await expectVisibleRule(canvasElement);
  },
};

export const LastVisibleHour: Story = {
  name: 'Last visible hour (closing rule)',
  args: { hour: 18, isLastVisibleHour: true },
  play: async ({ canvasElement }) => {
    const offsets = topOffsets(canvasElement);
    await expect(offsets).toHaveLength(5);

    /* The closing rule is `top-full`: a full row height DOWN, so it lands on the foot of
       the cell rather than inside it. Without it the last hour of the day has an open
       bottom edge and the grid stops mid-air - and because it is the only rule outside
       its own box, a container that gained `overflow-hidden` would clip it away silently. */
    await expect(offsets[4]).toBe(HOUR_HEIGHT);
    await expect(offsets.slice(0, 4)).toEqual([0, 45, 90, 135]);
  },
};

export const HalfHourSteps: Story = {
  name: 'Half-hour steps',
  args: { slotOffsetMinutes: [30] },
  play: async ({ canvasElement }) => {
    // The step array is the whole configuration: two rules, and the one sub-hour rule
    // sits at the midpoint because the offset is a percentage of the hour, not a pixel.
    await expect(topOffsets(canvasElement)).toEqual([0, 90]);
    await expectVisibleRule(canvasElement);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A practice on 30-minute slots. `useSlotOffsetMinutes` builds this array from the ' +
          "organisation's step, and a step of 60 or more yields an empty array - an hour with its " +
          'boundary rule and nothing between.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    /* The half that actually shipped broken. On espresso the old sub-hour rule measured
       1.01:1 and the grid read as an empty column; the same measurement is taken here
       against the dark tokens, since a token block can flip one ink and forget the other. */
    const ground = parseColor(getComputedStyle(hourCell(canvasElement)).backgroundColor);
    await expect(relativeLuminance(ground)).toBeLessThan(0.2);

    await expectVisibleRule(canvasElement);
    await expect(topOffsets(canvasElement)).toEqual([0, 45, 90, 135]);
  },
};
