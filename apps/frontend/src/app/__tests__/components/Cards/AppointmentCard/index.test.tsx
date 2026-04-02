import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentCard from '@/app/ui/cards/AppointmentCard';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { Appointment } from '@yosemite-crew/types';

jest.mock('@/app/ui/tables/Appointments', () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: 'pink', color: 'white' })),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: jest.fn(() => 'Jan 06, 2025'),
  formatTimeLabel: jest.fn(() => '09:00 AM'),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (value: string) => value.toUpperCase(),
}));

jest.mock('@/app/lib/appointments', () => ({
  allowCalendarDrag: jest.fn(() => true),
  canAssignAppointmentRoom: jest.fn(() => true),
  canShowStatusChangeAction: jest.fn(() => true),
  getAppointmentCompanionPhotoUrl: jest.fn(() => ''),
  getClinicalNotesIntent: jest.fn(() => ({ label: 'prescription', subLabel: 'subjective' })),
  getClinicalNotesLabel: jest.fn(() => 'Prescription'),
  isRequestedLikeStatus: jest.fn(
    (status: string) => status === 'REQUESTED' || status === 'NO_PAYMENT'
  ),
  normalizeAppointmentStatus: (status: string) => (status === 'NO_PAYMENT' ? 'REQUESTED' : status),
}));

describe('AppointmentCard', () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const getSoapViewIntent: jest.MockedFunction<
    (appointment: Appointment) => AppointmentViewIntent
  > = jest.fn((appointment: Appointment): AppointmentViewIntent => {
    void appointment;
    return {
      label: 'prescription',
      subLabel: 'subjective',
    };
  });

  const appointment: any = {
    status: 'COMPLETED',
    appointmentDate: new Date('2025-01-06T00:00:00Z'),
    startTime: new Date('2025-01-06T09:00:00Z'),
    companion: { name: 'Buddy', parent: { name: 'Sam' }, species: 'dog' },
    appointmentType: { name: 'Checkup' },
    room: { name: 'Room A' },
    lead: { name: 'Dr. Lee' },
    supportStaff: [{ name: 'Taylor' }],
    concern: 'Vaccines',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders appointment details and status', () => {
    render(
      <AppointmentCard
        appointment={appointment}
        handleViewAppointment={handleViewAppointment}
        getSoapViewIntent={getSoapViewIntent}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText('Date / Time:')).toBeInTheDocument();
    expect(screen.getByText('Jan 06, 2025 / 09:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Reason:')).toBeInTheDocument();
    expect(screen.getByText('Vaccines')).toBeInTheDocument();
    expect(screen.getByText('Service:')).toBeInTheDocument();
    expect(screen.getByText('Checkup')).toBeInTheDocument();
    expect(screen.getByText('Room:')).toBeInTheDocument();
    expect(screen.getByText('Room A')).toBeInTheDocument();
    expect(screen.getByText('Lead:')).toBeInTheDocument();
    expect(screen.getByText('Dr. Lee')).toBeInTheDocument();
    expect(screen.getByText('Staff:')).toBeInTheDocument();
    expect(screen.getByText('Taylor')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('calls handlers on view/reschedule', () => {
    render(
      <AppointmentCard
        appointment={appointment}
        handleViewAppointment={handleViewAppointment}
        getSoapViewIntent={getSoapViewIntent}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByTitle('View'));
    fireEvent.click(screen.getByTitle('Reschedule'));

    expect(handleViewAppointment).toHaveBeenCalledWith(appointment);
    expect(handleRescheduleAppointment).toHaveBeenCalledWith(appointment);
  });

  it('renders accept/decline icon actions for requested-like status', () => {
    render(
      <AppointmentCard
        appointment={{ ...appointment, status: 'NO_PAYMENT' }}
        handleViewAppointment={handleViewAppointment}
        getSoapViewIntent={getSoapViewIntent}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByTitle('View')).not.toBeInTheDocument();
  });
});
