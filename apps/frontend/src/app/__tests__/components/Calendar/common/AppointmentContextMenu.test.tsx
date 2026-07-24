import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentContextMenu from '@/app/features/appointments/components/Calendar/common/AppointmentContextMenu';
import {
  assignEncounterUnit,
  changeAppointmentStatus,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

let mockOrgState: { orgsById: Record<string, any> } = { orgsById: {} };
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(mockOrgState),
}));

jest.mock('@/app/lib/appointments', () => ({
  allowReschedule: jest.fn(() => true),
  canAssignAppointmentRoom: jest.fn(() => true),
  canShowStatusChangeAction: jest.fn(() => true),
  getAllowedAppointmentStatusTransitions: jest.fn((status: string) =>
    status === 'REQUESTED' ? ['UPCOMING', 'CANCELLED'] : ['CHECKED_IN', 'CANCELLED']
  ),
  getClinicalNotesIntent: jest.fn(() => ({ label: 'prescription', subLabel: 'subjective' })),
  getClinicalNotesLabel: jest.fn(() => 'Clinical notes'),
  isRequestedLikeStatus: jest.fn(
    (status: string) => status === 'REQUESTED' || status === 'NO_PAYMENT'
  ),
  normalizeAppointmentStatus: jest.fn((status: string) =>
    status === 'NO_PAYMENT' ? 'REQUESTED' : status
  ),
  toStatusLabel: jest.fn((status: string) => status),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: jest.fn(() => [
    { id: 'room-1', name: 'Room 1' },
    { id: 'room-2', name: 'Room 2' },
  ]),
}));

jest.mock('@/app/features/organization/services/roomService', () => ({
  loadRoomsForOrgPrimaryOrg: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  assignEncounterUnit: jest.fn(),
  changeAppointmentStatus: jest.fn(),
  updateAppointment: jest.fn(),
}));

const mockInitEncounter = jest.fn();
const mockSetRoomUnit = jest.fn();
let mockWorkspaceState: Record<string, any> = {
  initEncounter: mockInitEncounter,
  setRoomUnit: mockSetRoomUnit,
  encountersById: {},
};
jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: (selector: any) => selector(mockWorkspaceState),
}));

let mockRoomState = {
  roomUnitsById: {} as Record<string, any>,
  roomUnitIdsByRoomId: {} as Record<string, string[]>,
  setRoomUnitOccupied: jest.fn(),
};
jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: Object.assign((selector: any) => selector(mockRoomState), {
    getState: () => mockRoomState,
  }),
}));

jest.mock('react-icons/io5', () => ({
  IoChevronForward: () => <span>chevron</span>,
}));

describe('AppointmentContextMenu', () => {
  const baseAppointment: any = {
    id: 'appt-1',
    status: 'COMPLETED',
    companion: { id: 'comp-1', name: 'Buddy' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgState = { orgsById: {} };
    mockWorkspaceState = {
      initEncounter: mockInitEncounter,
      setRoomUnit: mockSetRoomUnit,
      encountersById: {},
    };
    mockRoomState = {
      roomUnitsById: {},
      roomUnitIdsByRoomId: {},
      setRoomUnitOccupied: jest.fn(),
    };
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(globalThis, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 900,
    });
  });

  it('routes companion overview actions to the full-screen page', () => {
    render(
      <AppointmentContextMenu
        appointment={baseAppointment}
        canEditAppointments
        menuRef={{ current: null }}
        menuStyle={{ top: 20, left: 20, width: 280 }}
        handleViewAppointment={jest.fn()}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Open companion overview' }));

    expect(pushMock).toHaveBeenCalledWith(
      '/companions/history?companionId=comp-1&source=appointments&appointmentId=appt-1&backTo=%2Fappointments'
    );
  });

  it('shows a status submenu and updates status inline', async () => {
    render(
      <AppointmentContextMenu
        appointment={{ ...baseAppointment, status: 'UPCOMING' }}
        canEditAppointments
        menuRef={{ current: null }}
        menuStyle={{ top: 20, left: 20, width: 280 }}
        handleViewAppointment={jest.fn()}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /Change status/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'CHECKED_IN' }));
    });

    expect(changeAppointmentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-1' }),
      'CHECKED_IN'
    );
  });

  it('does not expose inline status changes for requested appointments', () => {
    render(
      <AppointmentContextMenu
        appointment={{ ...baseAppointment, status: 'REQUESTED' }}
        canEditAppointments
        menuRef={{ current: null }}
        menuStyle={{ top: 20, left: 20, width: 280 }}
        handleViewAppointment={jest.fn()}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByRole('menuitem', { name: /Change status/i })).not.toBeInTheDocument();
  });

  it('shows a room submenu and updates the room inline', async () => {
    mockRoomState = {
      roomUnitsById: {
        'unit-2a': {
          id: 'unit-2a',
          roomId: 'room-2',
          displayName: 'Ward 2A',
          code: '2A',
          isActive: true,
          isOccupied: true,
        },
        'unit-2b': {
          id: 'unit-2b',
          roomId: 'room-2',
          displayName: 'Ward 2B',
          code: '2B',
          isActive: true,
          isOccupied: false,
        },
      },
      roomUnitIdsByRoomId: { 'room-2': ['unit-2a', 'unit-2b'] },
      setRoomUnitOccupied: jest.fn(),
    };
    render(
      <AppointmentContextMenu
        appointment={{
          ...baseAppointment,
          status: 'UPCOMING',
          appointmentKind: 'INPATIENT',
          encounterId: 'enc-1',
          room: { id: 'room-1', name: 'Room 1' },
        }}
        canEditAppointments
        menuRef={{ current: null }}
        menuStyle={{ top: 20, left: 20, width: 280 }}
        handleViewAppointment={jest.fn()}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /Assign room/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Room 2' }));
    });

    expect(updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'appt-1',
        room: { id: 'room-2', name: 'Room 2' },
      })
    );
    expect(mockSetRoomUnit).toHaveBeenCalledWith('appt-1', 'room-2', 'unit-2b');
    expect(assignEncounterUnit).toHaveBeenCalledWith(
      expect.objectContaining({ encounterId: 'enc-1', unitId: 'unit-2b' })
    );
  });

  it('anchors each submenu to its trigger row and flips left near the viewport edge', () => {
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 460,
    });

    render(
      <AppointmentContextMenu
        appointment={{
          ...baseAppointment,
          status: 'UPCOMING',
          room: { id: 'room-1', name: 'Room 1' },
        }}
        canEditAppointments
        menuRef={{ current: null }}
        menuStyle={{ top: 20, left: 260, width: 220 }}
        handleViewAppointment={jest.fn()}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const changeStatusTrigger = screen.getByRole('menuitem', { name: /Change status/i });
    const assignRoomTrigger = screen.getByRole('menuitem', { name: /Assign room/i });

    Object.defineProperty(changeStatusTrigger, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 180,
        left: 280,
        right: 460,
        bottom: 200,
        width: 180,
        height: 20,
        x: 280,
        y: 180,
        toJSON: () => null,
      }),
    });

    Object.defineProperty(assignRoomTrigger, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 252,
        left: 280,
        right: 460,
        bottom: 272,
        width: 180,
        height: 20,
        x: 280,
        y: 252,
        toJSON: () => null,
      }),
    });

    fireEvent.click(changeStatusTrigger);

    const statusMenu = screen.getByRole('menu', { name: 'Change appointment status' });
    expect(statusMenu).toHaveStyle({ top: '176px', left: '10px' });

    fireEvent.click(assignRoomTrigger);

    const roomMenu = screen.getByRole('menu', { name: 'Assign appointment room' });
    expect(roomMenu).toHaveStyle({ top: '248px', left: '10px' });
  });

  const renderMenu = (
    appointment: any,
    handlers: {
      handleViewAppointment?: jest.Mock;
      handleRescheduleAppointment?: jest.Mock;
      onClose?: jest.Mock;
      canEditAppointments?: boolean;
    } = {}
  ) => {
    const handleViewAppointment = handlers.handleViewAppointment ?? jest.fn();
    const handleRescheduleAppointment = handlers.handleRescheduleAppointment ?? jest.fn();
    const onClose = handlers.onClose ?? jest.fn();
    const utils = render(
      <AppointmentContextMenu
        appointment={appointment}
        canEditAppointments={handlers.canEditAppointments ?? true}
        menuRef={{ current: null }}
        menuStyle={{ top: 20, left: 20, width: 280 }}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        onClose={onClose}
      />
    );
    return { ...utils, handleViewAppointment, handleRescheduleAppointment, onClose };
  };

  it('routes each workspace quick action to the correct step and closes the menu', () => {
    const { onClose } = renderMenu(baseAppointment);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Clinical notes' }));
    expect(pushMock).toHaveBeenCalledWith('/appointments/appt-1/workspace?step=SOAP');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Finance summary' }));
    expect(pushMock).toHaveBeenCalledWith('/appointments/appt-1/workspace?step=INVOICE');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Lab tests' }));
    expect(pushMock).toHaveBeenCalledWith('/appointments/appt-1/workspace?step=DIAGNOSTICS');

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not navigate to the workspace when the appointment has no id', () => {
    const { onClose } = renderMenu({ ...baseAppointment, id: undefined });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Clinical notes' }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('invokes the view-appointment handler and closes the menu', () => {
    const { handleViewAppointment, onClose } = renderMenu(baseAppointment);

    fireEvent.click(screen.getByRole('menuitem', { name: 'View appointment' }));

    expect(handleViewAppointment).toHaveBeenCalledWith(baseAppointment);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes the reschedule handler and closes the menu', () => {
    const { handleRescheduleAppointment, onClose } = renderMenu({
      ...baseAppointment,
      status: 'UPCOMING',
    });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Reschedule' }));

    expect(handleRescheduleAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-1' })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('surfaces an inline error when a status change fails', async () => {
    (changeAppointmentStatus as jest.Mock).mockRejectedValueOnce(new Error('status boom'));

    renderMenu({ ...baseAppointment, status: 'UPCOMING' });

    fireEvent.click(screen.getByRole('menuitem', { name: /Change status/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'CHECKED_IN' }));
    });

    expect(await screen.findByText('status boom')).toBeInTheDocument();
  });

  it('surfaces an inline error when a room change fails', async () => {
    (updateAppointment as jest.Mock).mockRejectedValueOnce(new Error('room boom'));

    renderMenu({ ...baseAppointment, status: 'UPCOMING', room: { id: 'room-1', name: 'Room 1' } });

    fireEvent.click(screen.getByRole('menuitem', { name: /Assign room/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Room 2' }));
    });

    expect(await screen.findByText('room boom')).toBeInTheDocument();
  });

  it('clears the assigned room without touching inpatient encounter state', async () => {
    renderMenu({ ...baseAppointment, status: 'UPCOMING', room: { id: 'room-1', name: 'Room 1' } });

    fireEvent.click(screen.getByRole('menuitem', { name: /Assign room/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Clear room' }));
    });

    expect(updateAppointment).toHaveBeenCalledTimes(1);
    expect(mockSetRoomUnit).not.toHaveBeenCalled();
    expect(mockInitEncounter).not.toHaveBeenCalled();
  });

  it('updates a non-inpatient room without assigning a unit', async () => {
    renderMenu({ ...baseAppointment, status: 'UPCOMING', room: { id: 'room-1', name: 'Room 1' } });

    fireEvent.click(screen.getByRole('menuitem', { name: /Assign room/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Room 2' }));
    });

    expect(updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ room: { id: 'room-2', name: 'Room 2' } })
    );
    expect(mockSetRoomUnit).not.toHaveBeenCalled();
    expect(mockInitEncounter).not.toHaveBeenCalled();
  });

  it('passes the appointment lead through when seeding an inpatient encounter', async () => {
    mockRoomState = {
      roomUnitsById: {
        'unit-2b': {
          id: 'unit-2b',
          roomId: 'room-2',
          isActive: true,
          isOccupied: false,
        },
      },
      roomUnitIdsByRoomId: { 'room-2': ['unit-2b'] },
      setRoomUnitOccupied: jest.fn(),
    };

    renderMenu({
      ...baseAppointment,
      status: 'UPCOMING',
      appointmentKind: 'INPATIENT',
      encounterId: 'enc-1',
      room: { id: 'room-1', name: 'Room 1' },
      lead: { id: 'lead-1', name: 'Dr Lead' },
    });

    fireEvent.click(screen.getByRole('menuitem', { name: /Assign room/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Room 2' }));
    });

    expect(mockInitEncounter).toHaveBeenCalledWith('appt-1', 'INPATIENT', {
      leadId: 'lead-1',
      leadName: 'Dr Lead',
    });
    expect(assignEncounterUnit).toHaveBeenCalledWith(
      expect.objectContaining({ encounterId: 'enc-1', unitId: 'unit-2b' })
    );
  });

  it('reads the org type and current encounter unit from the stores', () => {
    mockOrgState = { orgsById: { 'org-9': { type: 'CLINIC' } } };
    mockWorkspaceState = {
      initEncounter: mockInitEncounter,
      setRoomUnit: mockSetRoomUnit,
      encountersById: { 'appt-1': { unitId: 'unit-5' } },
    };

    renderMenu({
      ...baseAppointment,
      status: 'UPCOMING',
      organisationId: 'org-9',
      appointmentKind: 'INPATIENT',
      room: { id: 'room-1', name: 'Room 1' },
    });

    // orgType resolves from the org store (not the HOSPITAL fallback) and the
    // encounter's unit is read for room availability without throwing.
    expect(screen.getByRole('menuitem', { name: 'Clinical notes' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Assign room/i })).toBeInTheDocument();
  });

  it('opens a submenu on hover and dismisses it when hovering a plain action', () => {
    renderMenu({ ...baseAppointment, status: 'UPCOMING', room: { id: 'room-1', name: 'Room 1' } });

    fireEvent.mouseOver(screen.getByRole('menuitem', { name: /Change status/i }));
    expect(screen.getByRole('menu', { name: 'Change appointment status' })).toBeInTheDocument();

    fireEvent.mouseOver(screen.getByRole('menuitem', { name: 'View appointment' }));
    expect(
      screen.queryByRole('menu', { name: 'Change appointment status' })
    ).not.toBeInTheDocument();
  });
});
