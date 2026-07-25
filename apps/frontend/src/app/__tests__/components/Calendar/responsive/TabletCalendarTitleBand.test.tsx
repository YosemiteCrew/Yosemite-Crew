import React from 'react';
import { render, screen } from '@testing-library/react';

import TabletCalendarTitleBand from '@/app/features/appointments/components/Calendar/responsive/TabletCalendarTitleBand';

const WEEK_START = new Date(2026, 6, 6);
const CURRENT_DATE = new Date(2026, 6, 7);

const renderBand = (props: Partial<React.ComponentProps<typeof TabletCalendarTitleBand>> = {}) =>
  render(
    <TabletCalendarTitleBand
      activeCalendar="week"
      currentDate={CURRENT_DATE}
      weekStart={WEEK_START}
      appointmentCount={41}
      {...props}
    />
  );

describe('TabletCalendarTitleBand', () => {
  it('names the ISO week and its count in the week view', () => {
    renderBand();

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Week 28 (41 appointments)'
    );
  });

  it('names the day in the day and team views', () => {
    renderBand({ activeCalendar: 'team', appointmentCount: 14 });

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Tue 7 Jul (14 appointments)'
    );
  });

  it('drops the count when the period is empty', () => {
    renderBand({ appointmentCount: 0 });

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Week 28');
    expect(heading).not.toHaveTextContent('appointments');
  });

  it('renders the four-status legend', () => {
    renderBand();

    ['Upcoming', 'In progress', 'Done', 'Emergency'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('renders no interactive control, so it cannot fight the shared header', () => {
    renderBand();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
