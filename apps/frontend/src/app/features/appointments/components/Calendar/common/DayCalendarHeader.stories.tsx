import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import DayCalendarHeader from './DayCalendarHeader';

const getHeader = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('.yc-table-head') as HTMLElement;

const weekdayOf = (header: HTMLElement): HTMLElement => header.children[0] as HTMLElement;
const numeralOf = (header: HTMLElement): HTMLElement => header.children[1] as HTMLElement;

const centreX = (el: HTMLElement): number => {
  const box = el.getBoundingClientRect();
  return box.left + box.width / 2;
};

/**
 * The header is 20px-padded on both sides, so its border-box centre is also its
 * content centre - anything centred inside it lines up with the middle of the
 * band.
 */
const assertCentred = async (header: HTMLElement, el: HTMLElement) => {
  await expect(Math.abs(centreX(el) - centreX(header))).toBeLessThan(0.5);
};

const meta = {
  title: 'Appointments/Calendar/DayCalendarHeader',
  component: DayCalendarHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The day grid's column header. It carries the `yc-table-head` recipe - 10.5px/700, " +
          '0.1em tracking, uppercase - so the day strip belongs to the same system as every PIMS ' +
          'table header. This and the week strip used to restate that band by hand at ' +
          '9.5px/700/0.08em and drifted away from it; the stories pin the numbers so a third ' +
          'value cannot creep back in.\n\n' +
          'Two opt-outs matter as much as the recipe. The digits drop the uppercase and the ' +
          'tracking, because the trailing letter-space is applied after the last glyph and shoves ' +
          'a centred numeral off centre. And `--static` removes the sticky position: the scrolling ' +
          'section is a SIBLING of this header, not an ancestor, so `top: 0` has nothing to ' +
          'resolve against.',
      },
    },
  },
  tags: ['autodocs'],
  args: { weekday: 'Wednesday', dateNumber: 25 },
} satisfies Meta<typeof DayCalendarHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A double-digit date',
  play: async ({ canvasElement }) => {
    const header = getHeader(canvasElement);
    const weekday = weekdayOf(header);
    const numeral = numeralOf(header);

    // The band itself: the shared table-header recipe, not a hand-rolled copy.
    const bandStyle = getComputedStyle(weekday);
    await expect(bandStyle.fontSize).toBe('10.5px');
    await expect(bandStyle.fontWeight).toBe('700');
    await expect(bandStyle.textTransform).toBe('uppercase');
    await expect(Number.parseFloat(bandStyle.letterSpacing)).toBeCloseTo(1.05, 2);

    // The digits opt out of both. A regression here is a 1px drift - invisible in
    // review, and only ever noticed as "the numbers look off centre".
    const numeralStyle = getComputedStyle(numeral);
    await expect(numeralStyle.fontSize).toBe('14px');
    await expect(numeralStyle.textTransform).toBe('none');
    await expect(numeralStyle.letterSpacing).toBe('normal');

    /* Sticky would resolve against the wrong container here and strand the band
       mid-panel, so `--static` is part of the contract rather than a tidy-up. */
    await expect(getComputedStyle(header).position).toBe('static');

    await assertCentred(header, weekday);
    await assertCentred(header, numeral);
  },
};

export const SingleDigit: Story = {
  name: 'A single-digit date',
  args: { weekday: 'Sunday', dateNumber: 1 },
  play: async ({ canvasElement }) => {
    const header = getHeader(canvasElement);
    const numeral = numeralOf(header);

    await expect(numeral).toHaveTextContent('1');
    /* One glyph is where a trailing letter-space does the most damage: it is half
       the box, so the numeral sits visibly left of the weekday above it. */
    await assertCentred(header, numeral);
    await assertCentred(header, weekdayOf(header));
  },
};

export const NarrowColumn: Story = {
  name: 'A narrow column',
  decorators: [
    (Story) => (
      <div style={{ width: 120, background: 'var(--screen)' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "A 120px shell leaves 80px of content between the recipe's 20px gutters - narrower than " +
          'an uppercase, tracked "WEDNESDAY". The label has to clip rather than wrap: wrapping is ' +
          'what grows the whole band by a line and pushes the grid below it out of alignment.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const header = getHeader(canvasElement);
    const weekday = weekdayOf(header);
    const numeral = numeralOf(header);

    const contentWidth = header.getBoundingClientRect().width - 40;
    await expect(weekday.getBoundingClientRect().width).toBeLessThanOrEqual(contentWidth + 0.5);

    // One 12.6px line, never two. Two would be ~25px and would take the band with it.
    await expect(weekday.getBoundingClientRect().height).toBeLessThan(20);

    // Clipping, with an ellipsis, is what makes the nowrap safe.
    const weekdayStyle = getComputedStyle(weekday);
    await expect(weekdayStyle.whiteSpace).toBe('nowrap');
    await expect(weekdayStyle.overflow).toBe('hidden');
    await expect(weekdayStyle.textOverflow).toBe('ellipsis');

    // The numeral is the one thing that must stay readable at this width.
    await assertCentred(header, numeral);
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const header = getHeader(canvasElement);

    /* The weekday is --ink-faint and the date --ink: two deliberately different
       inks. Dark mode redefines both, and the pair collapsing into one flat colour
       would lose the hierarchy while every class name still looked correct. */
    const label = getComputedStyle(weekdayOf(header)).color;
    const numeral = getComputedStyle(numeralOf(header)).color;
    await expect(label).not.toBe(numeral);

    // ...and neither may land on the band's own background.
    const band = getComputedStyle(header).backgroundColor;
    await expect(label).not.toBe(band);
    await expect(numeral).not.toBe(band);
  },
};
