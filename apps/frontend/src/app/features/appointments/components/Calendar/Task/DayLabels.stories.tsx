import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import DayLabels from './DayLabels';

/** Monday of a fixed week, plus today, so one column always shows the today state. */
const weekFrom = (start: Date) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

const startOfThisWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const COLUMNS: React.CSSProperties = {
  gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
};

const meta = {
  title: 'Appointments/Calendar/DayLabels',
  component: DayLabels,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The Tasks planner's week date strip, and the reason this story exists.\n\n" +
          'It used to put a filled 40px disc behind **every** date with the weekday beside it ' +
          'at 16px near-black, while the Appointments strip stacks a small caps weekday over a ' +
          'bare numeral and reserves the disc for today. Two consequences: the row read as seven ' +
          'grey buttons at roughly 1.5x the type size, and because every date already wore a ' +
          'disc, "today" had no signal left - the one thing the strip exists to tell you.\n\n' +
          'It now matches `common/WeekCalendar.tsx:190-231` day for day: the `yc-table-head` ' +
          'recipe (10.5px / 700 / +0.1em caps) that every other PIMS table header uses, a ' +
          'hairline between columns, `--nav-active-bg` washing the today column and a 24px ' +
          '`--blue-strong` disc on the today numeral alone.\n\n' +
          'Flip the theme toolbar: the strip is the surface where the two calendars diverged ' +
          'most, so it is also where a regression would show first.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    days: weekFrom(startOfThisWeek()),
    currentDate: startOfThisWeek(),
    columnsStyle: COLUMNS,
  },
} satisfies Meta<typeof DayLabels>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThisWeek: Story = {
  name: 'This week (one column is today)',
};

export const NoTodayInRange: Story = {
  name: 'A week that does not contain today',
  args: { days: weekFrom(new Date(2024, 5, 10)), currentDate: new Date(2024, 5, 10) },
  parameters: {
    docs: {
      story:
        'Every column in its resting state. Nothing carries a disc or a wash here, which is ' +
        'exactly the contrast that makes the today column legible in the story above.',
    },
  },
};
