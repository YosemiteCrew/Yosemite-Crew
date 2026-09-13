import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CalendarWeekDayCell from '@/app/features/appointments/components/Calendar/common/CalendarWeekDayCell';
import { setPreferredTimeZone } from '@/app/lib/timezone';

// The preferred timezone falls back to Europe/Berlin when localStorage is empty,
// which makes every assertion below independent of the host machine's zone.
beforeEach(() => {
  window.localStorage.clear();
});

describe('CalendarWeekDayCell (#1868)', () => {
  it('reads the day-of-month from the same preferred-timezone conversion as the weekday label', () => {
    // Jan 14 12:00 UTC is already Jan 15 in Kiritimati (UTC+14, no DST). The
    // weekday label was already preferred-zone-aware; the date numeral used to
    // read the browser's own `getDate()` instead, so the two could disagree.
    setPreferredTimeZone('Pacific/Kiritimati');
    const day = new Date(Date.UTC(2026, 0, 14, 12, 0));
    const now = day;

    render(<CalendarWeekDayCell day={day} now={now} />);

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('14')).not.toBeInTheDocument();
  });

  it('agrees with the weekday label in a zone far behind UTC too', () => {
    // Jan 15 09:00 UTC is still Jan 14 in Midway (UTC-11, no DST).
    setPreferredTimeZone('Pacific/Midway');
    const day = new Date(Date.UTC(2026, 0, 15, 9, 0));

    render(<CalendarWeekDayCell day={day} now={day} />);

    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.queryByText('15')).not.toBeInTheDocument();
  });
});
