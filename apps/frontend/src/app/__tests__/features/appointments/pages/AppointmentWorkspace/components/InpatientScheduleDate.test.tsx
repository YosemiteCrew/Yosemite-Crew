/**
 * Proves the COMPONENT anchors its date label, not just the helper it calls.
 *
 * A lib-level test on the helper stays green if InpatientSchedule is reverted to
 * formatting `selectedDate` directly, so the regression this guards needs the
 * rendered output. The clock is pinned so the assertion is independent of when
 * the suite runs, and the preferred zone is set far enough west that a raw
 * local-midnight format would land on the previous day.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InpatientSchedule from '@/app/features/appointments/pages/AppointmentWorkspace/components/InpatientSchedule';
import { setPreferredTimeZone } from '@/app/lib/timezone';

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: () => <div />,
}));

const baseProps = {
  tasks: [],
  readOnly: true,
  assigneeOptions: [],
  onAddTask: jest.fn(),
  onViewTask: jest.fn(),
  onAssignTask: jest.fn(),
  onStatusChange: jest.fn(),
};

describe('InpatientSchedule date label', () => {
  afterEach(() => {
    jest.useRealTimers();
    globalThis.localStorage?.clear();
  });

  it('shows the selected calendar day, not the day the raw instant lands on', () => {
    // Noon UTC on 15 Aug: comfortably 15 Aug in every zone, so "today" is
    // unambiguous whatever the runner's zone is.
    jest.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 7, 15, 12, 0, 0)));
    expect(setPreferredTimeZone('America/Los_Angeles')).toBe(true);

    render(<InpatientSchedule {...baseProps} />);

    // The component builds `selectedDate` as a browser-local midnight. Rendering
    // that instant directly in Los Angeles would print "Aug 14" on any runner at
    // or east of UTC; the anchored label must say Aug 15.
    expect(screen.getByText(/Aug 15, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Aug 14, 2026/)).not.toBeInTheDocument();
  });
});
