import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import TabletCalendarTitleBand from './TabletCalendarTitleBand';

/** Wednesday 15 July 2026, in the week beginning Monday the 13th. */
const CURRENT_DATE = new Date('2026-07-15T12:00:00.000Z');
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');

/**
 * The band's skin lives in `TabletCalendar.css` behind the 768-1023px range, so
 * the stories pin the `tablet` viewport. At phone width `PhoneCalendar` renders
 * its own title instead and this component is not mounted at all.
 */
const meta = {
  title: 'Appointments/Calendar/TabletCalendarTitleBand',
  component: TabletCalendarTitleBand,
  globals: { viewport: { value: 'tablet', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The tablet-only period line: a serif title naming what is on screen, the appointment ' +
          'count for that period, and the four-swatch status legend. It exists between 768 and ' +
          '1023px only. Every CONTROL - pager, Today, view switch, filters, New, zoom - stays in ' +
          'the shared calendar header, so this band deliberately owns no handler and the two ' +
          'layers cannot fight over the same one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeCalendar: 'day',
    currentDate: CURRENT_DATE,
    weekStart: WEEK_START,
    appointmentCount: 9,
  },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--screen)', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabletCalendarTitleBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayView: Story = {
  name: 'Day',
  play: async ({ canvasElement }) => {
    /* Level 2 specifically: the band sits under the page's own h1, and Storybook's
       preview decorator adds one of its own, so an unqualified heading query is
       ambiguous here. */
    await expect(within(canvasElement).getByRole('heading', { level: 2 })).toBeInTheDocument();
    for (const label of ['Upcoming', 'In progress', 'Done', 'Emergency']) {
      await expect(within(canvasElement).getByText(label)).toBeInTheDocument();
    }
  },
};

export const WeekView: Story = {
  name: 'Week',
  args: { activeCalendar: 'week', appointmentCount: 37 },
};

export const TeamView: Story = {
  name: 'Team',
  args: { activeCalendar: 'team', appointmentCount: 37 },
};

export const NothingBooked: Story = {
  name: 'A period with no appointments',
  args: { appointmentCount: 0 },
  play: async ({ canvasElement }) => {
    // The legend stays: it explains the colours of the grid below, which is still
    // on screen even when the period itself is empty.
    await expect(within(canvasElement).getByText('Emergency')).toBeInTheDocument();
  },
};

export const NoOverflowAtTabletWidth: Story = {
  name: 'Title and legend share the row at 768px',
  args: { activeCalendar: 'week', appointmentCount: 128 },
  play: async () => {
    /* 768px is the narrowest width this band ever renders at, and the title and
       the four-item legend compete for the same row. A three-digit count is the
       widest realistic title, so it is the case that pushes the page sideways
       first if the row stops wrapping. */
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
