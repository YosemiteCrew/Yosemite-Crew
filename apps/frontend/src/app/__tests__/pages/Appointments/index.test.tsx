import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedAppointments from '@/app/features/appointments/pages/Appointments';

const useAppointmentsMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const useSearchParamsMock = jest.fn();

const calendarSpy = jest.fn();
const tableSpy = jest.fn();
const boardSpy = jest.fn();
const addAppointmentSpy = jest.fn();
const appointmentInfoSpy = jest.fn();

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/widgets/TitleCalendar', () => (props: any) => (
  <div>
    <button type="button" onClick={() => props.setActiveView('calendar')}>
      Calendar
    </button>
    <button type="button" onClick={() => props.setActiveView('list')}>
      List
    </button>
    <button type="button" onClick={() => props.setAddPopup(true)}>
      Add
    </button>
  </div>
));

jest.mock('@/app/ui/filters/Filters', () => () => <div data-testid="filters" />);

jest.mock(
  '@/app/features/appointments/components/Calendar/AppointmentCalendar',
  () => (props: any) => {
    calendarSpy(props);
    return <div data-testid="appointment-calendar" />;
  }
);

jest.mock('@/app/features/appointments/components/AppointmentBoard', () => (props: any) => {
  boardSpy(props);
  return <div data-testid="appointment-board" />;
});

jest.mock('@/app/ui/tables/Appointments', () => (props: any) => {
  tableSpy(props);
  return <div data-testid="appointments-table" />;
});

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AddAppointment',
  () => (props: any) => {
    addAppointmentSpy(props);
    return props.showModal ? <div data-testid="add-appointment" /> : null;
  }
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo',
  () => (props: any) => {
    appointmentInfoSpy(props);
    return <div data-testid="appointment-info" />;
  }
);

jest.mock('@/app/features/appointments/pages/Appointments/Sections/Reschedule', () => () => (
  <div data-testid="reschedule" />
));

describe('Appointments page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'requested',
        isEmergency: true,
        companion: { name: 'Buddy' },
      },
      {
        id: 'a2',
        status: 'completed',
        isEmergency: false,
        companion: { name: 'Rex' },
      },
    ]);
    usePermissionsMock.mockReturnValue({
      can: jest.fn(() => true),
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: 'buddy' }));
    useSearchParamsMock.mockReturnValue({
      get: () => null,
    });
  });

  it('renders board view by default and toggles to calendar/list', () => {
    render(<ProtectedAppointments />);

    expect(screen.getByTestId('appointment-board')).toBeInTheDocument();
    expect(boardSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        appointments: [expect.objectContaining({ id: 'a1' })],
      })
    );

    fireEvent.click(screen.getByText('Calendar'));
    expect(screen.getByTestId('appointment-calendar')).toBeInTheDocument();
    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ id: 'a1' })],
      })
    );

    fireEvent.click(screen.getByText('List'));
    expect(screen.getByTestId('appointments-table')).toBeInTheDocument();
    expect(tableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ id: 'a1' })],
      })
    );
  });

  it('opens add appointment modal when add is clicked', () => {
    render(<ProtectedAppointments />);

    fireEvent.click(screen.getByText('Add'));
    expect(addAppointmentSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('opens appointment modal directly on finance section for finance deep links', () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a2',
        status: 'completed',
        isEmergency: false,
        companion: { name: 'Rex' },
      },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a2';
        if (key === 'open') return 'finance';
        if (key === 'subLabel') return 'summary';
        return null;
      },
    });

    render(<ProtectedAppointments />);

    expect(appointmentInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        showModal: true,
        initialViewIntent: { label: 'finance', subLabel: 'summary' },
      })
    );
  });
});
