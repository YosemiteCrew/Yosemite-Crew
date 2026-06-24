import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Appointments from '@/app/ui/tables/Appointments';

const acceptAppointmentMock = jest.fn();
const cancelAppointmentMock = jest.fn();
const rejectAppointmentMock = jest.fn();
const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

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
  getPreferredNextAppointmentStatus: jest.fn(() => 'UPCOMING'),
  getClinicalNotesLabel: jest.fn(() => 'Medical Records'),
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
        id: 'c1',
        name: 'Buddy',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };

    const setActiveAppointment = jest.fn();
    const setChangeStatusPopup = jest.fn();
    const setChangeStatusPreferredStatus = jest.fn();

    render(
      <Appointments
        filteredList={[appointment]}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
      />
    );

    fireEvent.click(screen.getByText('accept-icon').closest('button')!);
    fireEvent.click(screen.getByText('cancel-icon').closest('button')!);

    // Accept now opens the change-status modal so a lead/support can be assigned.
    expect(acceptAppointmentMock).not.toHaveBeenCalled();
    expect(setActiveAppointment).toHaveBeenCalledWith(appointment);
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);
    expect(rejectAppointmentMock).toHaveBeenCalledWith(appointment);
    expect(cancelAppointmentMock).not.toHaveBeenCalled();
  });

  it('handles view/reschedule actions', () => {
    const appointment: any = {
      id: 'a2',
      status: 'COMPLETED',
      organisationId: 'org-1',
      appointmentType: { id: 'svc-1', speciality: { id: 'spec-1' } },
      companion: {
        id: 'c2',
        name: 'Buddy',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };
    const setActiveAppointment = jest.fn();
    const setDetailPopup = jest.fn();
    const setViewIntent = jest.fn();
    const setReschedulePopup = jest.fn();

    render(
      <Appointments
        filteredList={[appointment]}
        setActiveAppointment={setActiveAppointment}
        setDetailPopup={setDetailPopup}
        setViewIntent={setViewIntent}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByTitle('Open appointment overview'));
    fireEvent.click(screen.getByText('view-icon').closest('button')!);
    fireEvent.click(screen.getByText('reschedule-icon').closest('button')!);

    expect(pushMock).toHaveBeenCalledWith(
      '/companions/history?companionId=c2&source=appointments&appointmentId=a2&backTo=%2Fappointments'
    );
    expect(setActiveAppointment).toHaveBeenCalledWith(appointment);
    expect(setDetailPopup).toHaveBeenCalledWith(true);
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it('routes table quick actions to workspace steps', () => {
    const appointment: any = {
      id: 'a4',
      status: 'COMPLETED',
      organisationId: 'org-1',
      appointmentType: { id: 'svc-1', speciality: { id: 'spec-1' } },
      companion: {
        id: 'c4',
        name: 'Milo',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };

    render(<Appointments filteredList={[appointment]} canEditAppointments />);

    fireEvent.click(screen.getByText('soap-icon').closest('button')!);
    fireEvent.click(screen.getByText('finance-icon').closest('button')!);
    fireEvent.click(screen.getByText('labs-icon').closest('button')!);

    expect(pushMock).toHaveBeenCalledWith('/appointments/a4/workspace?step=SOAP');
    expect(pushMock).toHaveBeenCalledWith('/appointments/a4/workspace?step=INVOICE');
    expect(pushMock).toHaveBeenCalledWith('/appointments/a4/workspace?step=DIAGNOSTICS');
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
        id: 'c3',
        name: 'Buddy',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };

    render(<Appointments filteredList={[appointment]} canEditAppointments />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('shows room unit and mode pill in the room column for inpatient appointments', () => {
    const appointment: any = {
      id: 'a5',
      status: 'UPCOMING',
      appointmentKind: 'INPATIENT',
      appointmentType: { name: 'Hospitalization' },
      room: { id: 'room-1', name: 'Ward 1', unitName: 'Kennel A' },
      appointmentDate: '2025-01-06T09:00:00.000Z',
      startTime: '2025-01-06T09:00:00.000Z',
      companion: {
        id: 'c5',
        name: 'Nala',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };

    render(<Appointments filteredList={[appointment]} canEditAppointments />);

    expect(screen.getByText('Ward 1')).toBeInTheDocument();
    expect(screen.getByText('Kennel A')).toBeInTheDocument();
    expect(screen.getByText('Inpatient')).toBeInTheDocument();
  });
});
