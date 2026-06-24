import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAppointmentLockWindow } from '@/app/hooks/useAppointmentLockWindow';
import { setSavedLockWindow } from '@/app/lib/appointmentLockWindow';

const Probe = () => {
  const window = useAppointmentLockWindow();
  return (
    <div>
      out:{window.outpatientHours}|in:{window.inpatientHours}
    </div>
  );
};

describe('useAppointmentLockWindow', () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
  });

  it('returns the default window when nothing is saved', () => {
    render(<Probe />);
    expect(screen.getByText('out:24|in:24')).toBeInTheDocument();
  });

  it('reflects a saved window and live-updates on change', () => {
    setSavedLockWindow({ outpatientHours: 6, inpatientHours: 30 });
    render(<Probe />);
    expect(screen.getByText('out:6|in:30')).toBeInTheDocument();

    act(() => {
      setSavedLockWindow({ outpatientHours: 9, inpatientHours: 9 });
    });
    expect(screen.getByText('out:9|in:9')).toBeInTheDocument();
  });
});
