import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedAppointments from '@/app/features/appointments/pages/Appointments';

const useAppointmentsMock = jest.fn();
const useCompanionsForPrimaryOrgMock = jest.fn();
const useCompanionsParentsForPrimaryOrgMock = jest.fn();
const useLoadCompanionsForPrimaryOrgMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const useSearchParamsMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const useAppointmentStoreMock = jest.fn();
const useTeamForPrimaryOrgMock = jest.fn();
const useAuthStoreMock = jest.fn();

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

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsForPrimaryOrg: () => useCompanionsForPrimaryOrgMock(),
  useCompanionsParentsForPrimaryOrg: () => useCompanionsParentsForPrimaryOrgMock(),
  useLoadCompanionsForPrimaryOrg: () => useLoadCompanionsForPrimaryOrgMock(),
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

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: () => usePrimaryOrgProfileMock(),
}));

jest.mock('@/app/stores/appointmentStore', () => ({
  useAppointmentStore: (selector: any) => useAppointmentStoreMock(selector),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamForPrimaryOrgMock(),
  useLoadTeam: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => useAuthStoreMock(selector),
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
    {props.showAdd ? (
      <button type="button" onClick={() => props.setAddPopup(true)}>
        Add
      </button>
    ) : null}
  </div>
));

jest.mock('@/app/ui/filters/Filters', () => (props: any) => (
  <div data-testid="filters">
    {props.showAddButton ? (
      <button type="button" onClick={props.onAddButtonClick}>
        Add Appointment
      </button>
    ) : null}
  </div>
));

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

jest.mock('@/app/features/appointments/pages/Appointments/Sections/ChangeStatus', () => () => (
  <div data-testid="change-status" />
));

jest.mock('@/app/features/appointments/pages/Appointments/Sections/ChangeRoom', () => () => (
  <div data-testid="change-room" />
));

describe('Appointments page', () => {
  const renderAppointments = async () => {
    await act(async () => {
      render(<ProtectedAppointments />);
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAppointmentStoreMock.mockImplementation((selector: any) =>
      selector({ status: 'succeeded' })
    );
    useTeamForPrimaryOrgMock.mockReturnValue([]);
    useAuthStoreMock.mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    useCompanionsForPrimaryOrgMock.mockReturnValue([]);
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([]);
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'requested',
        isEmergency: true,
        companion: { id: 'c1', name: 'Buddy' },
      },
      {
        id: 'a2',
        status: 'completed',
        isEmergency: false,
        companion: { id: 'c2', name: 'Rex' },
      },
    ]);
    usePermissionsMock.mockReturnValue({
      can: jest.fn(() => true),
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: 'buddy' }));
    useSearchParamsMock.mockReturnValue({
      get: () => null,
    });
    usePrimaryOrgProfileMock.mockReturnValue(null);
  });

  it('renders calendar view by default and toggles to list/board', async () => {
    await renderAppointments();

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

  it('renders board view when profile appointmentView is STATUS_BOARD', async () => {
    usePrimaryOrgProfileMock.mockReturnValue({
      personalDetails: { pmsPreferences: { appointmentView: 'STATUS_BOARD' } },
    });
    await renderAppointments();

    expect(screen.getByTestId('appointment-board')).toBeInTheDocument();
    expect(boardSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        appointments: [expect.objectContaining({ id: 'a1' })],
      })
    );
  });

  it('opens add appointment modal from the list filters row', async () => {
    await renderAppointments();

    fireEvent.click(screen.getByText('List'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Appointment' }));
    expect(addAppointmentSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('opens appointment modal directly on finance section for finance deep links', async () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a2',
        status: 'completed',
        isEmergency: false,
        companion: { id: 'c2', name: 'Rex' },
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

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        showModal: true,
        initialViewIntent: { label: 'finance', subLabel: 'summary' },
      })
    );
  });

  it('opens appointment modal directly on info overview sub-section for info deep links', async () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a2',
        status: 'completed',
        isEmergency: false,
        companion: { id: 'c2', name: 'Rex' },
      },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a2';
        if (key === 'open') return 'info';
        if (key === 'subLabel') return 'history';
        return null;
      },
    });

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        showModal: true,
        initialViewIntent: { label: 'info', subLabel: 'history' },
      })
    );
  });

  it('normalizes overview sub-label for details deep links', async () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a2',
        status: 'completed',
        isEmergency: false,
        companion: { id: 'c2', name: 'Rex' },
      },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a2';
        if (key === 'open') return 'details';
        if (key === 'subLabel') return 'overview';
        return null;
      },
    });

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        showModal: true,
        initialViewIntent: { label: 'info', subLabel: 'history' },
      })
    );
  });
});
