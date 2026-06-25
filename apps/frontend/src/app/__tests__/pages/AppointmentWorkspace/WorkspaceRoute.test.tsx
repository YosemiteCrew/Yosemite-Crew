import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import WorkspaceRoute from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceRoute';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { isAppointmentRevampEnabled } from '@/app/lib/featureFlags';
import { getAppointmentCompanion } from '@/app/lib/appointments';
import {
  useAppointmentsForPrimaryOrg,
  useLoadAppointmentsForPrimaryOrg,
} from '@/app/hooks/useAppointments';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockStartRouteLoader = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('@/app/lib/featureFlags', () => ({
  isAppointmentRevampEnabled: jest.fn(),
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: jest.fn(),
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: () => mockStartRouteLoader(),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace', () => ({
  __esModule: true,
  default: ({ appointment }: { appointment: Appointment }) => (
    <div data-testid="workspace">Workspace for {getAppointmentCompanion(appointment).name}</div>
  ),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ testId }: { testId: string }) => <div data-testid={testId}>Loading</div>,
}));

const makeAppointment = (id = 'appt-1'): Appointment => ({
  id,
  patient: {
    id: 'comp-1',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  companion: {
    id: 'comp-1',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  organisationId: 'org-1',
  appointmentDate: new Date('2026-06-03T10:00:00Z'),
  startTime: new Date('2026-06-03T10:00:00Z'),
  timeSlot: '10:00',
  durationMinutes: 30,
  endTime: new Date('2026-06-03T10:30:00Z'),
  status: 'IN_PROGRESS',
});

const mockAppointments = (appointments: Appointment[]) => {
  (useAppointmentsForPrimaryOrg as jest.Mock).mockReturnValue(appointments);
};

describe('WorkspaceRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppointmentStore.setState({
      appointmentsById: {},
      appointmentIdsByOrgId: {},
      status: 'loaded',
      error: null,
      lastFetchedAt: null,
    });
    (isAppointmentRevampEnabled as jest.Mock).mockReturnValue(true);
    (useLoadAppointmentsForPrimaryOrg as jest.Mock).mockReturnValue(undefined);
    mockAppointments([]);
  });

  it('redirects back to appointments when the revamp flag is disabled', () => {
    (isAppointmentRevampEnabled as jest.Mock).mockReturnValue(false);

    const { container } = render(<WorkspaceRoute appointmentId="appt-1" />);

    expect(container).toBeEmptyDOMElement();
    expect(mockReplace).toHaveBeenCalledWith('/appointments');
  });

  it('renders the workspace for the matching appointment', () => {
    mockAppointments([makeAppointment()]);

    render(<WorkspaceRoute appointmentId="appt-1" />);

    expect(screen.getByTestId('workspace')).toHaveTextContent('Workspace for Gigi');
    expect(useLoadAppointmentsForPrimaryOrg).toHaveBeenCalled();
  });

  it('blocks workspace entry for cancelled appointments', () => {
    mockAppointments([{ ...makeAppointment(), status: 'CANCELLED' }]);

    render(<WorkspaceRoute appointmentId="appt-1" />);

    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
    expect(
      screen.getByText('Cancelled appointments cannot be opened in the clinical workspace.')
    ).toBeInTheDocument();
  });

  it('shows the loader while appointments are still loading', () => {
    useAppointmentStore.setState({ status: 'loading' });

    render(<WorkspaceRoute appointmentId="missing" />);

    expect(screen.getByTestId('workspace-loader')).toBeInTheDocument();
  });

  it('shows not-found fallback and navigates back to appointments', () => {
    render(<WorkspaceRoute appointmentId="missing" />);

    expect(screen.getByText('Appointment not found.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to appointments/i }));

    expect(mockStartRouteLoader).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/appointments');
  });
});
