import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import History from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/History';

const timelineSpy = jest.fn();

jest.mock('@/app/features/companionHistory/components/CompanionHistoryTimeline', () => ({
  __esModule: true,
  default: (props: any) => {
    timelineSpy(props);
    return <div data-testid="timeline">timeline</div>;
  },
}));

describe('Appointment Info History section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes companion and appointment context to timeline with correct return href', () => {
    const appointment: any = {
      id: 'apt-1',
      companion: { id: 'comp-1' },
    };

    render(<History activeAppointment={appointment} />);

    expect(screen.getByTestId('timeline')).toBeInTheDocument();
    const props = timelineSpy.mock.calls[0][0];
    expect(props.companionId).toBe('comp-1');
    expect(props.activeAppointmentId).toBe('apt-1');
    expect(props.compact).toBe(true);
    expect(props.fullPageHref).toContain('/companions/history?');
    expect(props.fullPageHref).toContain('source=appointments');
    expect(props.fullPageHref).toContain('appointmentId=apt-1');
  });
});
