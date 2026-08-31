import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import { TIMEZONE_STORAGE_KEY } from '@/app/lib/timezone';
// `yc-table-head` lives here, and the cell inherits its caps and tracking from the
// container rather than declaring them. DayLabels imports the stylesheet for the
// same reason: without it the strip renders at the body scale and none of the type
// contract below is real.
import '@/app/ui/tables/GenericTable/Generictable.css';

import CalendarWeekDayCell from './CalendarWeekDayCell';

/**
 * The cell reads the preferred zone out of localStorage on every render and falls
 * back to Europe/Berlin. A story earlier in the session can have left a different
 * zone behind, which would move both the weekday name and the today branch off the
 * fixtures here - so the key is cleared for the run and put back afterwards.
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
 * Monday 23 February 2026 to Sunday 1 March, each anchored at UTC noon. The
 * weekday and the today test are read in the preferred zone, the numeral comes off
 * the LOCAL date, and noon is far enough from both midnights that the two agree
 * whatever zone the runner sits in. The week deliberately rolls over the month, so
 * the strip carries a one-digit date next to six two-digit ones.
 */
const atNoonUtc = (isoDate: string): Date => new Date(`${isoDate}T12:00:00.000Z`);

const WEEK = [
  '2026-02-23',
  '2026-02-24',
  '2026-02-25',
  '2026-02-26',
  '2026-02-27',
  '2026-02-28',
  '2026-03-01',
].map(atNoonUtc);

const WEDNESDAY = WEEK[2];
const THURSDAY = WEEK[3];

/** 10:30 Berlin on the Wednesday - a different instant to `WEDNESDAY`, so the
 *  today branch has to compare calendar days rather than timestamps. */
const NOW = new Date('2026-02-25T09:30:00.000Z');

/** The band both planners wrap this cell in (WeekDayHeaderRow, DayLabels). */
const Strip = ({ columns, children }: { columns: number; children: ReactNode }) => (
  <div
    className="yc-table-head yc-table-head--static yc-table-head--flush grid min-w-max"
    style={{ gridTemplateColumns: `repeat(${columns}, 96px)` }}
  >
    {children}
  </div>
);

const getStrip = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('.yc-table-head') as HTMLElement;

const getCells = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(getStrip(canvasElement).children) as HTMLElement[];

/** A cell is weekday label then date numeral; only today's numeral wears the disc. */
const weekdayOf = (cell: HTMLElement): HTMLElement => cell.children[0] as HTMLElement;
const numeralOf = (cell: HTMLElement): HTMLElement => cell.children[1] as HTMLElement;

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/* `rounded-full` compiles to `calc(infinity * 1px)`, so the computed radius is an
   enormous number rather than a round one - compare it against the box instead. */
const isDisc = (el: HTMLElement): boolean => {
  const { height } = el.getBoundingClientRect();
  const radius = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return height > 0 && Number.isFinite(radius) && radius >= height / 2;
};

const weekStrip = () => (
  <Strip columns={7}>
    {WEEK.map((day) => (
      <CalendarWeekDayCell key={day.toISOString()} day={day} now={NOW} />
    ))}
  </Strip>
);

const meta = {
  title: 'Appointments/Calendar/CalendarWeekDayCell',
  component: CalendarWeekDayCell,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One column of a week date strip, shared by the Appointments week header and the Tasks ' +
          'planner. Everything the component exists for is in the today branch: a filled 24px ' +
          '`--blue-strong` disc plus a `--nav-active-bg` wash down the column, against a plain ' +
          '14px numeral everywhere else. The Tasks strip used to draw a disc behind EVERY date, ' +
          'which left today with no signal of its own - the one thing the strip is there to tell ' +
          'you - so the stories below assert that exactly one column in seven carries the disc and ' +
          'the wash, and that they land on the same column.',
      },
    },
  },
  tags: ['autodocs'],
  args: { day: WEDNESDAY, now: NOW },
  beforeEach: withDefaultTimeZone,
  render: (args) => (
    <Strip columns={1}>
      <CalendarWeekDayCell {...args} />
    </Strip>
  ),
} satisfies Meta<typeof CalendarWeekDayCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {
  name: 'Today',
  play: async ({ canvasElement }) => {
    const [cell] = getCells(canvasElement);
    const numeral = numeralOf(cell);
    const box = numeral.getBoundingClientRect();

    await expect(numeral).toHaveTextContent('25');
    // 24px round and filled. A disc that loses its fill still reads as a date, so
    // nothing about the layout would give the regression away.
    await expect(Math.round(box.height)).toBe(24);
    await expect(Math.round(box.width)).toBe(24);
    await expect(isDisc(numeral)).toBe(true);
    await expect(getComputedStyle(numeral).fontSize).toBe('13px');

    const discFill = getComputedStyle(numeral).backgroundColor;
    await expect(discFill).not.toBe(TRANSPARENT);

    /* The column wash is a second, weaker signal painted over the band's own
       --screen-2. If it ever resolved to the disc fill the whole column would go
       solid blue, so the two are asserted to be different colours. */
    const wash = getComputedStyle(cell).backgroundColor;
    await expect(wash).not.toBe(TRANSPARENT);
    await expect(wash).not.toBe(discFill);
  },
};

export const PlainWeekday: Story = {
  name: 'A plain weekday',
  args: { day: THURSDAY },
  play: async ({ canvasElement }) => {
    const [cell] = getCells(canvasElement);
    const numeral = numeralOf(cell);

    await expect(numeral).toHaveTextContent('26');
    // No disc, no wash: the whole non-today branch is the absence of both.
    await expect(isDisc(numeral)).toBe(false);
    await expect(getComputedStyle(cell).backgroundColor).toBe(TRANSPARENT);
    // 14px here against the disc's 13px - the numeral shrinks to fit the disc, and
    // that difference is invisible unless both are pinned.
    await expect(getComputedStyle(numeral).fontSize).toBe('14px');
  },
};

export const WeekStrip: Story = {
  name: 'A week strip with one today',
  render: weekStrip,
  parameters: {
    docs: {
      description: {
        story:
          'Monday 23 February to Sunday 1 March 2026, with the Wednesday as today. The month rolls ' +
          'over inside the week, so a one-digit date sits beside two-digit ones in the same band.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const cells = getCells(canvasElement);
    await expect(cells).toHaveLength(7);

    const washed = cells.filter((cell) => getComputedStyle(cell).backgroundColor !== TRANSPARENT);
    const discs = cells.filter((cell) => isDisc(numeralOf(cell)));

    // One signal, on one column, and the same column for both. Seven discs is the
    // exact regression this component was extracted to prevent; a wash on one
    // column and a disc on another is the quieter version of it.
    await expect(washed).toHaveLength(1);
    await expect(discs).toHaveLength(1);
    await expect(washed[0]).toBe(discs[0]);
    await expect(cells.indexOf(discs[0])).toBe(2);

    await expect(numeralOf(cells[6])).toHaveTextContent('1');

    /* The disc is 24px against a 12.6px line box, so it is the one thing that could
       push its own date off the shared baseline. Every numeral starts at the same y
       or the row visibly steps. */
    const tops = cells.map((cell) => numeralOf(cell).getBoundingClientRect().top);
    await expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(0.5);

    /* Digits opt out of the band's uppercase and 0.1em tracking: the trailing
       letter-space is applied after the last glyph too, which pushes a centred
       numeral off centre. The weekday keeps both. */
    const numeralStyle = getComputedStyle(numeralOf(cells[0]));
    await expect(numeralStyle.letterSpacing).toBe('normal');
    await expect(numeralStyle.textTransform).toBe('none');

    const weekdayStyle = getComputedStyle(weekdayOf(cells[0]));
    await expect(weekdayStyle.textTransform).toBe('uppercase');
    await expect(Number.parseFloat(weekdayStyle.letterSpacing)).toBeCloseTo(1.05, 2);
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  render: weekStrip,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const cells = getCells(canvasElement);
    const [today] = cells.filter((cell) => isDisc(numeralOf(cell)));

    const wash = getComputedStyle(today).backgroundColor;
    const band = getComputedStyle(getStrip(canvasElement)).backgroundColor;

    /* --nav-active-bg is a translucent overlay in both themes. If the dark value
       ever collapsed onto --screen-2 the wash would still be "painted" and still
       pass a class-name check, while being invisible on screen. */
    await expect(wash).not.toBe(TRANSPARENT);
    await expect(wash).not.toBe(band);
    await expect(getComputedStyle(numeralOf(today)).backgroundColor).not.toBe(wash);
  },
};
