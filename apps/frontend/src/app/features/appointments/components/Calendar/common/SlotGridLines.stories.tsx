import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import type { ReactNode } from 'react';

import SlotGridLines from './SlotGridLines';

/**
 * The overlay is `absolute inset-0`, so it draws nothing at all without a
 * positioned box of exactly one hour's height. 180px is the real zoomed-in hour
 * row (`getHourRowHeightPx('in')`), which is what makes the percentage tops
 * land on round numbers: 25% of 180 is 45px.
 */
const HOUR_ROW_HEIGHT = 180;

const HourRow = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div style={{ paddingBottom: 24 }}>
    <div
      data-story-hour-row
      className="relative w-[280px]"
      style={{ height: `${HOUR_ROW_HEIGHT}px`, background: 'var(--screen)' }}
    >
      {children}
    </div>
  </div>
);

/** Offset of a rule from the top of its hour row, in whole pixels. */
const offsetsOf = (canvasElement: HTMLElement) => {
  const row = canvasElement.querySelector('[data-story-hour-row]') as HTMLElement;
  const top = row.getBoundingClientRect().top;
  return Array.from(canvasElement.querySelectorAll('.border-t')).map((line) =>
    Math.round((line as HTMLElement).getBoundingClientRect().top - top)
  );
};

const rulesOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll('.border-t')) as HTMLElement[];

const borderColorOf = (line: HTMLElement) => globalThis.getComputedStyle(line).borderTopColor;

/**
 * Reads the alpha out of whichever form the engine serialises the resolved
 * colour in - `rgba(r, g, b, a)` or `color(srgb r g b / a)`. The slot rule is a
 * `color-mix(... 55%, transparent)`, so its alpha is the whole point: a
 * regression to a flat token would come back fully opaque and look identical in
 * a screenshot at this size.
 */
const alphaOf = (color: string): number => {
  const rgba = /^rgba?\(([^)]+)\)$/.exec(color);
  if (rgba) {
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length >= 4 ? Number(parts[3]) : 1;
  }
  const slashed = /\/\s*([\d.]+)%?\s*\)$/.exec(color);
  if (slashed) return color.includes('%)') ? Number(slashed[1]) / 100 : Number(slashed[1]);
  return 1;
};

/**
 * The contrast the file exists to protect: the hour rule is the frame's own
 * opaque `--hairline`, the slot rules are the same ink diluted. A flat
 * `--divider` would be darker than the hour rule in light and lighter in dark,
 * so both halves have to be checked in both themes.
 */
const expectSlotRuleSofterThanHourRule = async (canvasElement: HTMLElement) => {
  const [hourRule, firstSlotRule] = rulesOf(canvasElement);
  const hourColor = borderColorOf(hourRule);
  const slotColor = borderColorOf(firstSlotRule);
  await expect(alphaOf(hourColor)).toBe(1);
  await expect(alphaOf(slotColor)).toBeLessThan(1);
  await expect(slotColor).not.toBe(hourColor);
  return hourColor;
};

const meta = {
  title: 'Appointments/Calendar/SlotGridLines',
  component: SlotGridLines,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The rules drawn inside one hour cell of the user and week calendars. It is three ' +
          'decisions and no markup worth looking at: an opaque hour rule at the top of the cell, ' +
          'one diluted rule per slot offset positioned as a percentage of the hour, and - only ' +
          'when this hour is `lastVisibleHour` - a second opaque rule at `top-full` that closes ' +
          'the bottom of the grid. Nothing else in the calendar draws that closing rule, so if it ' +
          'stops rendering the last row simply runs off into the page and no test notices.\n\n' +
          'The slot rules take `color-mix(in srgb, var(--hairline) 55%, transparent)` rather than ' +
          '`--divider`, which is deliberate and easy to "tidy" away: `--divider` is darker than ' +
          '`--hairline` in light and lighter in dark, so it would read as heavier than the hour ' +
          'rule in one theme and lighter in the other. The dilution stays a consistent step ' +
          'softer in both, which is why the dark story asserts the same relation rather than a ' +
          'screenshot.\n\n' +
          'Every story draws into a 180px box, the real zoomed-in hour row height, so the ' +
          'percentage tops are checkable in whole pixels.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    userId: 'staff-1',
    hour: 9,
    lastVisibleHour: 17,
    slotOffsetMinutes: [15, 30, 45],
  },
  decorators: [
    (Story) => (
      <HourRow>
        <Story />
      </HourRow>
    ),
  ],
} satisfies Meta<typeof SlotGridLines>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MidGridHour: Story = {
  name: '09:00 with quarter-hour rules',
  play: async ({ canvasElement }) => {
    // One hour rule plus three slot rules, and no closing rule: 09:00 is not the
    // last visible hour, so a fifth line here would double-draw the boundary the
    // next cell already owns.
    await expect(offsetsOf(canvasElement)).toEqual([0, 45, 90, 135]);
    const hourColor = await expectSlotRuleSofterThanHourRule(canvasElement);
    // --hairline in the light theme. Pinned so a literal colour cannot creep in
    // and pass the softer-than check on its own.
    await expect(hourColor).toBe('rgb(229, 220, 207)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The ordinary cell. The offsets are percentages of the hour, so 15/30/45 minutes land at ' +
          '45/90/135px in a 180px row - a rule written in minutes rather than percent would sit at ' +
          '15px and still look plausible in isolation.',
      },
    },
  },
};

export const LastVisibleHour: Story = {
  name: '17:00, the closing rule',
  args: { hour: 17 },
  play: async ({ canvasElement }) => {
    const offsets = offsetsOf(canvasElement);
    // The extra rule sits at the FOOT of the row (top-full = 180px), not at its
    // top, so the grid is closed rather than having its last hour drawn twice.
    await expect(offsets).toEqual([0, 45, 90, 135, 180]);
    const rules = rulesOf(canvasElement);
    // The closing rule is a frame rule, so it takes the opaque hour colour - a
    // copy-paste of the slot style would leave the bottom of the calendar
    // visibly weaker than every other hour line.
    await expect(borderColorOf(rules[4])).toBe(borderColorOf(rules[0]));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one branch in the file: `hour === lastVisibleHour` adds a rule at `top-full`. It is ' +
          'the bottom edge of the whole timeline, and it is drawn by the last cell rather than by ' +
          'the frame.',
      },
    },
  },
};

export const HalfHourSlots: Story = {
  name: 'Half-hour rules only',
  args: { slotOffsetMinutes: [30] },
  play: async ({ canvasElement }) => {
    await expect(offsetsOf(canvasElement)).toEqual([0, 90]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 30-minute slot step gives a single rule at the midpoint. The component takes the ' +
          'offsets it is handed and never derives them, so this is the whole difference between a ' +
          '30-minute and a 15-minute calendar.',
      },
    },
  },
};

export const NoSlotRules: Story = {
  name: 'Hour rule only',
  args: { slotOffsetMinutes: [] },
  play: async ({ canvasElement }) => {
    // An hourly calendar still needs its hour rule; an empty offsets array must
    // not take the frame line with it.
    await expect(offsetsOf(canvasElement)).toEqual([0]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a 60-minute step renders. `useSlotOffsetMinutes` returns an empty array for any ' +
          'step of 60 or more, and the hour rule has to survive that.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme keeps the slot rule softer',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await expect(offsetsOf(canvasElement)).toEqual([0, 45, 90, 135]);
    const hourColor = await expectSlotRuleSofterThanHourRule(canvasElement);
    // The token actually flipped rather than the rules being painted in a light
    // literal that survives the theme switch.
    await expect(hourColor).toBe('rgb(64, 54, 43)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same cell on the espresso ground. Both rules re-resolve from `--hairline`, and the ' +
          'slot rule keeps its 55% dilution, so the hierarchy between the hour line and the slot ' +
          'lines is the same step in both themes.',
      },
    },
  },
};
