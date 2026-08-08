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

jest.mock(
  'react-icons/io',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/fa',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/md',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

/* The row's action rail is a single overflow kebab now, so every row action has
   to be reached through its menu. The menu closes on select, hence the reopen
   before each subsequent action. */
const openRowMenu = (companionName: string) =>
  fireEvent.click(screen.getByLabelText(`Actions for ${companionName}`));

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

    openRowMenu('Buddy');
    fireEvent.click(screen.getByTestId('FaCheckCircle').closest('button')!);
    openRowMenu('Buddy');
    fireEvent.click(screen.getByTestId('IoIosCloseCircle').closest('button')!);

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
    openRowMenu('Buddy');
    fireEvent.click(screen.getByTestId('IoEyeOutline').closest('button')!);
    openRowMenu('Buddy');
    fireEvent.click(screen.getByTestId('IoIosCalendar').closest('button')!);

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

    openRowMenu('Milo');
    fireEvent.click(screen.getByTestId('IoDocumentTextOutline').closest('button')!);
    openRowMenu('Milo');
    fireEvent.click(screen.getByTestId('IoCardOutline').closest('button')!);
    openRowMenu('Milo');
    fireEvent.click(screen.getByTestId('MdScience').closest('button')!);

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

  it('renders the desktop status cell through the protected shared pill class', () => {
    const appointment: any = {
      id: 'a6',
      status: 'IN_PROGRESS',
      companion: {
        id: 'c6',
        name: 'Ruby',
        species: 'dog',
        parent: { name: 'Jamie' },
      },
    };

    render(<Appointments filteredList={[appointment]} canEditAppointments />);

    const statusPill = screen.getByText('IN_PROGRESS');
    expect(statusPill).toHaveClass('yc-status-pill', 'text-[10px]', 'leading-[normal]');
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
    const modePill = screen.getByText('Inpatient').closest('[title="Inpatient"]') as HTMLElement;
    expect(modePill).toHaveClass('mt-1', 'rounded-full!', 'text-[10px]', 'uppercase');
    expect(modePill).not.toHaveClass('h-6');
    expect(modePill).toHaveStyle({ backgroundColor: 'var(--color-pill-info-bg)' });
  });
});
