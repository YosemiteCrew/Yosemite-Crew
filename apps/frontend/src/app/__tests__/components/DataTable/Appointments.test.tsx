import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Appointments from '@/app/ui/tables/Appointments';

const acceptAppointmentMock = jest.fn();
const cancelAppointmentMock = jest.fn();
const rejectAppointmentMock = jest.fn();

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  acceptAppointment: (...args: any[]) => acceptAppointmentMock(...args),
  cancelAppointment: (...args: any[]) => cancelAppointmentMock(...args),
  rejectAppointment: (...args: any[]) => rejectAppointmentMock(...args),
}));

jest.mock('@/app/lib/appointments', () => ({
  allowReschedule: jest.fn(() => true),
  allowCalendarDrag: jest.fn(() => true),
  canAssignAppointmentRoom: jest.fn(() => true),
  canShowStatusChangeAction: jest.fn(() => true),
  getClinicalNotesLabel: jest.fn(() => 'Prescription'),
  getAppointmentCompanionPhotoUrl: jest.fn(() => ''),
  isRequestedLikeStatus: jest.fn(
    (status: string) => status === 'REQUESTED' || status === 'NO_PAYMENT'
  ),
  normalizeAppointmentStatus: (status: string) => (status === 'NO_PAYMENT' ? 'REQUESTED' : status),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: jest.fn(() => 'Jan 06, 2025'),
  formatTimeLabel: jest.fn(() => '09:00 AM'),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (value: string) => value.toUpperCase(),
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="table">
      {data.map((item: any) => (
        <div key={item.id}>
          {columns.map((col: any) => (
            <div key={col.key || col.label}>{col.render ? col.render(item) : item[col.key]}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/cards/AppointmentCard', () => ({
  __esModule: true,
  default: ({ appointment }: any) => <div data-testid="appointment-card">{appointment.id}</div>,
}));

jest.mock('react-icons/fa', () => ({
  FaCheckCircle: () => <span>accept-icon</span>,
}));

jest.mock('react-icons/io', () => ({
  IoIosCloseCircle: () => <span>cancel-icon</span>,
  IoIosCalendar: () => <span>reschedule-icon</span>,
}));

jest.mock('react-icons/io5', () => ({
  IoEyeOutline: () => <span>view-icon</span>,
  IoDocumentTextOutline: () => <span>soap-icon</span>,
  IoCardOutline: () => <span>finance-icon</span>,
}));

jest.mock('react-icons/md', () => ({
  MdMeetingRoom: () => <span>room-icon</span>,
  MdOutlineAutorenew: () => <span>change-status-icon</span>,
  MdScience: () => <span>labs-icon</span>,
}));

describe('Appointments table', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles accept/cancel actions for requested appointments', async () => {
    const appointment: any = {
      id: 'a1',
      status: 'REQUESTED',
      companion: {
        name: 'Buddy',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };

    render(<Appointments filteredList={[appointment]} canEditAppointments />);

    fireEvent.click(screen.getByText('accept-icon').closest('button')!);
    fireEvent.click(screen.getByText('cancel-icon').closest('button')!);

    expect(acceptAppointmentMock).toHaveBeenCalledWith(appointment);
    expect(rejectAppointmentMock).toHaveBeenCalledWith(appointment);
    expect(cancelAppointmentMock).not.toHaveBeenCalled();
  });

  it('handles view/reschedule actions', () => {
    const appointment: any = {
      id: 'a2',
      status: 'COMPLETED',
      companion: {
        name: 'Buddy',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };
    const setActiveAppointment = jest.fn();
    const setViewPopup = jest.fn();
    const setViewIntent = jest.fn();
    const setReschedulePopup = jest.fn();

    render(
      <Appointments
        filteredList={[appointment]}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setViewIntent={setViewIntent}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByTitle('Open appointment history'));
    fireEvent.click(screen.getByText('view-icon').closest('button')!);
    fireEvent.click(screen.getByText('reschedule-icon').closest('button')!);

    expect(setActiveAppointment).toHaveBeenCalledWith(appointment);
    expect(setViewPopup).toHaveBeenCalledWith(true);
    expect(setViewIntent).toHaveBeenCalledWith({ label: 'info', subLabel: 'history' });
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it('shows empty state for mobile list', () => {
    render(<Appointments filteredList={[]} canEditAppointments={false} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows a dash when support staff is empty in table view', () => {
    const appointment: any = {
      id: 'a3',
      status: 'UPCOMING',
      concern: 'Checkup',
      appointmentType: { name: 'Exam' },
      room: { name: 'Room 1' },
      appointmentDate: '2025-01-06T09:00:00.000Z',
      startTime: '2025-01-06T09:00:00.000Z',
      lead: { name: 'Dr. Lee' },
      supportStaff: [],
      companion: {
        name: 'Buddy',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };

    render(<Appointments filteredList={[appointment]} canEditAppointments />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
