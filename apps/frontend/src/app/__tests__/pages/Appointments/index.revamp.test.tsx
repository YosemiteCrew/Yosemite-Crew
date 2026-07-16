import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedAppointments from '@/app/features/appointments/pages/Appointments';

// Covers the central add modal, the overview modal, and the deep-link
// workspace redirect.
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
    (LoadableComponent as unknown as { preload: () => void }).preload = () => {};
    return LoadableComponent;
  },
}));

const useAppointmentsMock = jest.fn();
const useLoadAppointmentsForPrimaryOrgMock = jest.fn();
const useCompanionsParentsForPrimaryOrgMock = jest.fn();
const useLoadCompanionsForPrimaryOrgMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const useSearchParamsMock = jest.fn();
const routerPushMock = jest.fn();
const redirectMock = jest.fn();
const usePrimaryOrgProfileMock = jest.fn();
const useTeamForPrimaryOrgMock = jest.fn();
const useAuthStoreMock = jest.fn();
const useOrgStoreMock = jest.fn();

const calendarSpy = jest.fn();
const appointmentInfoSpy = jest.fn();
const centralModalSpy = jest.fn();
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
  useRouter: () => ({ push: routerPushMock }),
}));

jest.mock('@/app/hooks/useProfiles', () => ({
  usePrimaryOrgProfile: () => usePrimaryOrgProfileMock(),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamForPrimaryOrgMock(),
  useLoadTeam: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => useAuthStoreMock(selector),
}));

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

jest.mock('@/app/features/appointments/components/AppointmentBoard', () => () => (
  <div data-testid="appointment-board" />
));

jest.mock('@/app/ui/tables/Appointments', () => () => <div data-testid="appointments-table" />);

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
    centralModalSpy(props);
    return <div data-testid="add-appointment-central-modal" />;
  }
);

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/ViewAppointmentOverviewModal',
  () => (props: any) => {
    overviewModalSpy(props);
    return <div data-testid="view-appointment-overview-modal" />;
  }
);

describe('Appointments page (workspace + overview modals)', () => {
  const renderAppointments = async () => {
    await act(async () => {
      render(<ProtectedAppointments />);
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTeamForPrimaryOrgMock.mockReturnValue([]);
    useAuthStoreMock.mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    useCompanionsParentsForPrimaryOrgMock.mockReturnValue([]);
    useLoadAppointmentsForPrimaryOrgMock.mockReturnValue(undefined);
    useAppointmentsMock.mockReturnValue([
      { id: 'a1', status: 'UPCOMING', isEmergency: false, companion: { id: 'c1', name: 'Buddy' } },
    ]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));
    useSearchParamsMock.mockReturnValue({ get: () => null });
    usePrimaryOrgProfileMock.mockReturnValue(null);
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1', orgsById: { 'org-1': { type: 'VET' } } })
    );
  });

  it('renders the central add modal and overview modal', async () => {
    await renderAppointments();

    expect(centralModalSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: false }));
    expect(overviewModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeAppointment: expect.objectContaining({ id: 'a1' }) })
    );
  });

  it('deep link with a workspace-eligible status redirects to the workspace route', async () => {
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => {
        if (key === 'appointmentId') return 'a1';
        if (key === 'open') return 'info';
        return null;
      },
    });

    await renderAppointments();

    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining('/appointments/a1/workspace')
    );
  });

  it('overview modal onOpenDetails routes to the workspace and closes the overview', async () => {
    await renderAppointments();

    const overviewProps = overviewModalSpy.mock.calls[overviewModalSpy.mock.calls.length - 1][0];
    expect(overviewProps.onOpenDetails).toBeInstanceOf(Function);

    await act(async () => {
      overviewProps.onOpenDetails(
        { id: 'a1', status: 'UPCOMING', companion: { id: 'c1', name: 'Buddy' } },
        { label: 'info', subLabel: 'appointment' }
      );
      await Promise.resolve();
    });

    expect(routerPushMock).toHaveBeenCalledWith(
      expect.stringContaining('/appointments/a1/workspace')
    );
  });

  it('onReschedule closes the detail popup', async () => {
    await renderAppointments();

    const infoProps = appointmentInfoSpy.mock.calls[appointmentInfoSpy.mock.calls.length - 1][0];
    expect(infoProps.onReschedule).toBeInstanceOf(Function);

    await act(async () => {
      infoProps.onReschedule({
        id: 'a1',
        status: 'UPCOMING',
        isEmergency: false,
        companion: { id: 'c1', name: 'Buddy' },
      });
      await Promise.resolve();
    });

    expect(screen.getByTestId('appointment-info')).toBeInTheDocument();
  });
});
