import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentContextMenu from '@/app/features/appointments/components/Calendar/common/AppointmentContextMenu';
import {
  changeAppointmentStatus,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ orgsById: {} }),
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
  toStatusLabel: jest.fn((status: string) => status),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: jest.fn(() => [
    { id: 'room-1', name: 'Room 1' },
    { id: 'room-2', name: 'Room 2' },
  ]),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  changeAppointmentStatus: jest.fn(),
  updateAppointment: jest.fn(),
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

  it('shows a room submenu and updates the room inline', async () => {
    render(
      <AppointmentContextMenu
        appointment={{
          ...baseAppointment,
          status: 'UPCOMING',
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
});
