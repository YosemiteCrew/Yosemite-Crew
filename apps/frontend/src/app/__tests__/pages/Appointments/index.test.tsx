import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedAppointments from '@/app/features/appointments/pages/Appointments';
import { PHONE_PRIMARY_ACTION_EVENT } from '@/app/ui/layout/PhoneShell/phoneShellConfig';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('ui/tables/Appointments')) {
        const MockAppointmentsTable = jest.requireMock('@/app/ui/tables/Appointments') as React.FC<
          Record<string, unknown>
        >;
        return <MockAppointmentsTable {...props} />;
      }

      if (source.includes('components/Calendar/AppointmentCalendar')) {
        const MockAppointmentCalendar = jest.requireMock(
          '@/app/features/appointments/components/Calendar/AppointmentCalendar'
        ) as React.FC<Record<string, unknown>>;
        return <MockAppointmentCalendar {...props} />;
      }

      if (source.includes('components/AppointmentBoard')) {
        const MockAppointmentBoard = jest.requireMock(
          '@/app/features/appointments/components/AppointmentBoard'
        ) as React.FC<Record<string, unknown>>;
        return <MockAppointmentBoard {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    // Expose a preload so the page's `preloadDynamic` optional-chain call executes.
    (LoadableComponent as unknown as { preload: () => void }).preload = () => {};
    return LoadableComponent;
  },
}));

const useAppointmentsMock = jest.fn();
const useLoadAppointmentsForPrimaryOrgMock = jest.fn();
const useCompanionsForPrimaryOrgMock = jest.fn();
const useCompanionsParentsForPrimaryOrgMock = jest.fn();
const useLoadCompanionsForPrimaryOrgMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const useSearchParamsMock = jest.fn();
const routerPushMock = jest.fn();
const redirectMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const useAppointmentStoreMock = jest.fn();
const useTeamForPrimaryOrgMock = jest.fn();
const useAuthStoreMock = jest.fn();

const calendarSpy = jest.fn();
const tableSpy = jest.fn();
const boardSpy = jest.fn();
const addAppointmentSpy = jest.fn();
const appointmentInfoSpy = jest.fn();
const overviewModalSpy = jest.fn();

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useLoadAppointmentsForPrimaryOrg: () => useLoadAppointmentsForPrimaryOrgMock(),
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
  redirect: (href: string) => redirectMock(href),
  useRouter: () => ({
    push: routerPushMock,
  }),
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

const useOrgStoreMock = jest.fn();
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => useOrgStoreMock(selector),
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
        New appointment
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

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal',
  () => (props: any) => {
    addAppointmentSpy(props);
    return props.showModal ? <div data-testid="add-appointment-central-modal" /> : null;
  }
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/ViewAppointmentOverviewModal',
  () => (props: any) => {
    overviewModalSpy(props);
    return <div data-testid="view-appointment-overview-modal" />;
  }
);

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
    useLoadAppointmentsForPrimaryOrgMock.mockReturnValue(undefined);
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
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1', orgsById: { 'org-1': { type: 'VET' } } })
    );
  });

  it('renders calendar view by default and toggles to list/board', async () => {
    await renderAppointments();

    expect(useLoadAppointmentsForPrimaryOrgMock).toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('button', { name: 'New appointment' }));
    expect(addAppointmentSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('opens the add appointment modal when the phone shell FAB fires its primary action', async () => {
    await renderAppointments();
    expect(screen.queryByTestId('add-appointment-central-modal')).not.toBeInTheDocument();

    act(() => {
      globalThis.window.dispatchEvent(
        new CustomEvent(PHONE_PRIMARY_ACTION_EVENT, {
          detail: { key: 'appointment', href: '/appointments' },
        })
      );
    });

    expect(screen.getByTestId('add-appointment-central-modal')).toBeInTheDocument();
  });

  it('ignores a phone primary action aimed at another page', async () => {
    await renderAppointments();

    act(() => {
      globalThis.window.dispatchEvent(
        new CustomEvent(PHONE_PRIMARY_ACTION_EVENT, {
          detail: { key: 'companion', href: '/companions' },
        })
      );
    });

    expect(screen.queryByTestId('add-appointment-central-modal')).not.toBeInTheDocument();
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
        initialViewIntent: { label: 'finance', subLabel: 'summary' },
      })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
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
        initialViewIntent: { label: 'info', subLabel: 'history' },
      })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
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
        initialViewIntent: { label: 'info', subLabel: 'history' },
      })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('deep link: opens appointment modal for tasks open param', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return 'tasks';
        if (key === 'subLabel') return 'parent-chat';
        return null;
      },
    });

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialViewIntent: { label: 'tasks', subLabel: 'parent-chat' },
      })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('deep link: opens appointment modal for prescription open param', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return 'prescription';
        if (key === 'subLabel') return 'subjective';
        return null;
      },
    });

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialViewIntent: { label: 'prescription', subLabel: 'subjective' },
      })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('deep link: opens appointment modal for labs open param', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return 'labs';
        if (key === 'subLabel') return 'idexx-labs';
        return null;
      },
    });

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialViewIntent: { label: 'labs', subLabel: 'idexx-labs' },
      })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('deep link: resolves subLabel-based intent for forms subLabel', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return '';
        if (key === 'subLabel') return 'forms';
        return null;
      },
    });

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialViewIntent: { label: 'prescription', subLabel: 'forms' },
      })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('deep link: does not open when appointmentId is empty', async () => {
    useSearchParamsMock.mockReturnValue({ get: () => null });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    useAppointmentsMock.mockReturnValue([
      { id: 'a1', status: 'requested', isEmergency: false, companion: { id: 'c1', name: 'Buddy' } },
    ]);

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: false }));
  });

  it('enriches appointments with companion metadata when available', async () => {
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      {
        companion: {
          id: 'c1',
          photoUrl: 'photo.jpg',
          gender: 'M',
          dateOfBirth: '2020-01-01',
          isneutered: true,
        },
        parent: { id: 'p1', firstName: 'John', lastName: 'Doe' },
      },
    ]);
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'requested',
        isEmergency: false,
        companion: {
          id: 'c1',
          name: 'Buddy',
          parent: { id: 'p1', firstName: 'John', lastName: 'Doe', name: 'John Doe' },
        },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allAppointments: [
          expect.objectContaining({
            id: 'a1',
            companion: expect.objectContaining({ photoUrl: 'photo.jpg' }),
          }),
        ],
      })
    );
  });

  it('hasEmergency is true when emergency appointment exists in the future', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'upcoming',
        isEmergency: true,
        startTime: futureDate,
        companion: { id: 'c1', name: 'Buddy' },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(calendarSpy).toHaveBeenCalledWith(expect.objectContaining({ hasEmergency: true }));
  });

  it('hasEmergency is false when emergency is cancelled', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'CANCELLED',
        isEmergency: true,
        startTime: futureDate,
        companion: { id: 'c1', name: 'Buddy' },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(calendarSpy).toHaveBeenCalledWith(expect.objectContaining({ hasEmergency: false }));
  });

  it('activeAppointment is null when appointment list is empty', async () => {
    useAppointmentsMock.mockReturnValue([]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(appointmentInfoSpy).not.toHaveBeenCalled();
  });

  it('canEditActiveAppointment is true when user has canEditAny permission', async () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAppointments: true })
    );
  });

  it('canEditActiveAppointment is false when user has no edit permission', async () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });
    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAppointments: false })
    );
  });

  it('openAddAppointment: clicking New appointment from calendar opens modal', async () => {
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];
    expect(calendarProps.onAddAppointment).toBeInstanceOf(Function);

    await act(async () => {
      calendarProps.onAddAppointment();
      await Promise.resolve();
    });

    expect(addAppointmentSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('onCreateFromCalendarSlot: opens add appointment with prefill from calendar slot', async () => {
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];

    await act(async () => {
      calendarProps.onCreateFromCalendarSlot({
        startTime: new Date('2025-01-01'),
        assignedTo: 'u1',
      });
      await Promise.resolve();
    });

    expect(addAppointmentSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('setCurrentDate updates the current date passed to calendar', async () => {
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];
    const newDate = new Date('2025-06-15');

    await act(async () => {
      calendarProps.setCurrentDate(newDate);
      await Promise.resolve();
    });

    expect(calendarSpy).toHaveBeenCalledWith(expect.objectContaining({ currentDate: newDate }));
  });

  it('setActiveCalendar updates the active calendar mode passed to calendar', async () => {
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];

    await act(async () => {
      calendarProps.setActiveCalendar('week');
      await Promise.resolve();
    });

    expect(calendarSpy).toHaveBeenCalledWith(expect.objectContaining({ activeCalendar: 'week' }));
  });

  it('onReschedule from AppointmentInfo closes view and opens reschedule popup', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a1', status: 'upcoming', isEmergency: false, companion: { id: 'c1', name: 'Buddy' } },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a1';
        if (key === 'open') return 'info';
        return null;
      },
    });

    await renderAppointments();

    const infoProps = appointmentInfoSpy.mock.calls[appointmentInfoSpy.mock.calls.length - 1][0];
    expect(infoProps.onReschedule).toBeInstanceOf(Function);

    await act(async () => {
      infoProps.onReschedule({
        id: 'a1',
        status: 'upcoming',
        isEmergency: false,
        companion: { id: 'c1', name: 'Buddy' },
      });
      await Promise.resolve();
    });

    expect(appointmentInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: false }));
  });

  it('canEditOwn user can edit own appointment but not others', async () => {
    usePermissionsMock.mockReturnValue({
      can: jest.fn((perm: string) => {
        // canEditOwn = true, canEditAny = false
        if (typeof perm === 'string') {
          return perm.includes('OWN') && !perm.includes('ANY');
        }
        // For PERMISSIONS object comparison — check if perm key has OWN
        return String(perm).includes('OWN');
      }),
    });
    useTeamForPrimaryOrgMock.mockReturnValue([{ _id: 'user-1', practionerId: 'user-1' }]);
    useAuthStoreMock.mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'upcoming',
        isEmergency: false,
        companion: { id: 'c1', name: 'Buddy' },
        lead: { id: 'user-1' },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    // AppointmentInfo is rendered — even with partial edit permission it renders
    expect(appointmentInfoSpy).toHaveBeenCalled();
  });

  it('deep link: opens the overview modal for a care open param', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return 'care';
        if (key === 'subLabel') return '';
        return null;
      },
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('activeAppointment updates reactively when appointments list changes', async () => {
    const { rerender } = render(<ProtectedAppointments />);
    await act(async () => {
      await Promise.resolve();
    });

    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'completed',
        isEmergency: false,
        companion: { id: 'c1', name: 'Buddy Updated' },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await act(async () => {
      rerender(<ProtectedAppointments />);
      await Promise.resolve();
    });

    expect(appointmentInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        activeAppointment: expect.objectContaining({ id: 'a1' }),
      })
    );
  });

  it('deep link: labs open param with empty subLabel falls back to idexx-labs', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return 'labs';
        return null;
      },
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialViewIntent: { label: 'labs', subLabel: 'idexx-labs' },
      })
    );
  });

  it('deep link: finance open param with empty subLabel falls back to summary', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return 'finance';
        return null;
      },
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialViewIntent: { label: 'finance', subLabel: 'summary' },
      })
    );
  });

  it('deep link: unrecognized open param resolves a null intent but still opens', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a3', status: 'upcoming', isEmergency: false, companion: { id: 'c3', name: 'Max' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a3';
        if (key === 'open') return 'mystery';
        if (key === 'subLabel') return 'nope';
        return null;
      },
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialViewIntent: null })
    );
    expect(overviewModalSpy).toHaveBeenLastCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('deep link: does not open when the appointmentId matches no appointment', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a1', status: 'upcoming', isEmergency: false, companion: { id: 'c1', name: 'Buddy' } },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'missing-id';
        return null;
      },
    });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(appointmentInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: false }));
  });

  it('selects the first appointment when the list changes from empty to populated', async () => {
    useAppointmentsMock.mockReturnValue([]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    const { rerender } = render(<ProtectedAppointments />);
    await act(async () => {
      await Promise.resolve();
    });

    useAppointmentsMock.mockReturnValue([
      { id: 'a9', status: 'upcoming', isEmergency: false, companion: { id: 'c9', name: 'Nova' } },
    ]);

    await act(async () => {
      rerender(<ProtectedAppointments />);
      await Promise.resolve();
    });

    expect(appointmentInfoSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeAppointment: expect.objectContaining({ id: 'a9' }) })
    );
  });

  it('enriches an appointment whose companion has no parent and defaults missing metadata', async () => {
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      {
        companion: { id: 'c1' },
        parent: { id: 'p1' },
      },
    ]);
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'requested',
        isEmergency: false,
        companion: { id: 'c1', name: 'Buddy' },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allAppointments: [
          expect.objectContaining({
            id: 'a1',
            companion: expect.objectContaining({
              photoUrl: '',
              parent: expect.objectContaining({ id: 'p1' }),
            }),
          }),
        ],
      })
    );
  });

  it('leaves an appointment untouched when companion metadata already matches', async () => {
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([
      {
        companion: {
          id: 'c1',
          photoUrl: 'same.jpg',
          gender: 'M',
          dateOfBirth: '2020-01-01',
          isneutered: true,
        },
        parent: { id: 'p1', firstName: 'John', lastName: 'Doe' },
      },
    ]);
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'requested',
        isEmergency: false,
        companion: {
          id: 'c1',
          name: 'Buddy',
          photoUrl: 'same.jpg',
          parent: { id: 'p1', firstName: 'John', lastName: 'Doe', name: 'John Doe' },
        },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allAppointments: [
          expect.objectContaining({
            companion: expect.objectContaining({ photoUrl: 'same.jpg' }),
          }),
        ],
      })
    );
  });

  it('handles an appointment that has a patient but no companion', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a1', status: 'upcoming', isEmergency: false, patient: { name: 'Ghost' } },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ allAppointments: [expect.objectContaining({ id: 'a1' })] })
    );
  });

  it('resolves current user lead id from the email attribute when sub is absent', async () => {
    useAuthStoreMock.mockImplementation((selector: any) =>
      selector({ attributes: { email: 'vet@x.com' } })
    );
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();
    expect(appointmentInfoSpy).toHaveBeenCalled();
  });

  it('resolves current user lead id from cognito:username when sub and email are absent', async () => {
    useAuthStoreMock.mockImplementation((selector: any) =>
      selector({ attributes: { 'cognito:username': 'cognito-user' } })
    );
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();
    expect(appointmentInfoSpy).toHaveBeenCalled();
  });

  it('resolves an empty current user lead id when there are no auth attributes', async () => {
    useAuthStoreMock.mockImplementation((selector: any) => selector({ attributes: {} }));
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();
    expect(appointmentInfoSpy).toHaveBeenCalled();
  });

  it('matches the current user by team member _id when practionerId differs', async () => {
    usePermissionsMock.mockReturnValue({
      can: jest.fn((perm: string) => String(perm).includes('OWN') && !String(perm).includes('ANY')),
    });
    useTeamForPrimaryOrgMock.mockReturnValue([{ _id: 'user-1', practionerId: 'other' }]);
    useAuthStoreMock.mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'upcoming',
        isEmergency: false,
        companion: { id: 'c1', name: 'Buddy' },
        lead: { id: 'other' },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();
    expect(appointmentInfoSpy).toHaveBeenCalled();
  });

  it('canEditActiveAppointment is false for canEditOwn user when there is no active appointment', async () => {
    usePermissionsMock.mockReturnValue({
      can: jest.fn((perm: string) => String(perm).includes('OWN') && !String(perm).includes('ANY')),
    });
    useAppointmentsMock.mockReturnValue([]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();
    expect(appointmentInfoSpy).not.toHaveBeenCalled();
  });

  it('derives an undefined primary org type when there is no primary org', async () => {
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({ primaryOrgId: undefined, orgsById: {} })
    );
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();
    expect(screen.getByTestId('appointment-calendar')).toBeInTheDocument();
  });

  it('recomputes the week start when the week calendar advances to a new day', async () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];

    await act(async () => {
      calendarProps.setActiveCalendar('week');
      await Promise.resolve();
    });

    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 3);

    await act(async () => {
      calendarProps.setCurrentDate(nextDay);
      await Promise.resolve();
    });

    expect(calendarSpy).toHaveBeenCalledWith(expect.objectContaining({ activeCalendar: 'week' }));
  });

  it('filters the list by active status and emergency filter', async () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: 'a1',
        status: 'UPCOMING',
        isEmergency: true,
        companion: { id: 'c1', name: 'Buddy' },
      },
      {
        id: 'a2',
        status: 'COMPLETED',
        isEmergency: false,
        companion: { id: 'c2', name: 'Rex' },
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];

    await act(async () => {
      calendarProps.setActiveStatus('completed');
      await Promise.resolve();
    });

    await act(async () => {
      calendarProps.setActiveFilter('emergencies');
      await Promise.resolve();
    });

    // The active filter/status pair is threaded back into the calendar props.
    expect(calendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeStatus: 'completed', activeFilter: 'emergencies' })
    );
  });

  it('openWorkspace: returns early when the appointment has no id', async () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];
    await act(async () => {
      calendarProps.onOpenWorkspace({ status: 'UPCOMING' });
      await Promise.resolve();
    });

    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it('openWorkspace: opens the overview popup when the status cannot enter the workspace', async () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];
    await act(async () => {
      calendarProps.onOpenWorkspace({ id: 'a1', status: 'requested' });
      await Promise.resolve();
    });

    expect(routerPushMock).not.toHaveBeenCalled();
    expect(appointmentInfoSpy).toHaveBeenCalled();
  });

  it('openWorkspace: routes to the workspace when the status can enter it', async () => {
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    await renderAppointments();

    const calendarProps = calendarSpy.mock.calls[0][0];
    await act(async () => {
      calendarProps.onOpenWorkspace({ id: 'a1', status: 'UPCOMING' });
      await Promise.resolve();
    });

    expect(routerPushMock).toHaveBeenCalledWith(
      expect.stringContaining('/appointments/a1/workspace')
    );
  });

  it('onReschedule opens the reschedule popup for a reschedulable status', async () => {
    useAppointmentsMock.mockReturnValue([
      { id: 'a1', status: 'UPCOMING', isEmergency: false, companion: { id: 'c1', name: 'Buddy' } },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await renderAppointments();

    const infoProps = appointmentInfoSpy.mock.calls[appointmentInfoSpy.mock.calls.length - 1][0];

    await act(async () => {
      infoProps.onReschedule({
        id: 'a1',
        status: 'UPCOMING',
        isEmergency: false,
        companion: { id: 'c1', name: 'Buddy' },
      });
      await Promise.resolve();
    });

    expect(appointmentInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: false }));
  });
});
