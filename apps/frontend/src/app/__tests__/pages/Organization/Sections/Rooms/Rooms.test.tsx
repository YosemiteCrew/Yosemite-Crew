import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import Rooms from '@/app/features/organization/pages/Organization/Sections/Rooms/Rooms';

const useRoomsMock = jest.fn();
const usePermissionsMock = jest.fn();
const notifyMock = jest.fn();
const toggleRoomAvailabilityMock = jest.fn();

jest.mock('@/app/hooks/useRooms', () => ({
  useRoomsForPrimaryOrg: () => useRoomsMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/features/organization/services/roomService', () => ({
  toggleRoomAvailability: (...args: any[]) => toggleRoomAvailabilityMock(...args),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

// Rich mock: expose the table's row callbacks as buttons so the parent's
// handlers (select/open overlay, toggle availability) can be exercised via fireEvent.
jest.mock('@/app/ui/tables/RoomTable', () => ({
  __esModule: true,
  default: ({ filteredList, setActive, setView, onToggleAvailability }: any) => (
    <div data-testid="room-table">
      <span data-testid="room-rows">{filteredList.length}</span>
      <button
        type="button"
        onClick={() => {
          setActive({ id: 'room-1', name: 'Room A' });
          setView(true);
        }}
      >
        edit-room
      </button>
      <button
        type="button"
        onClick={() => onToggleAvailability({ id: 'room-1', name: 'Room A' }, true)}
      >
        toggle-on
      </button>
      <button
        type="button"
        onClick={() => onToggleAvailability({ id: 'room-1', name: 'Room A' }, false)}
      >
        toggle-off
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/Rooms/AddRoom', () => ({
  __esModule: true,
  default: () => <div data-testid="add-room" />,
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfo', () => ({
  __esModule: true,
  default: ({ activeRoom }: any) => <div data-testid="room-info">{activeRoom?.name}</div>,
}));

describe('Rooms section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRoomsMock.mockReturnValue([{ id: 'room-1', name: 'Room A' }]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
    toggleRoomAvailabilityMock.mockResolvedValue(undefined);
  });

  it('renders the rooms table, count and add trigger when permitted', () => {
    render(<Rooms />);

    expect(screen.getByTestId('room-table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Rooms/ })).toHaveTextContent('(1)');
    const add = screen.getByRole('button', { name: /Add room/ });
    fireEvent.click(add);
    expect(screen.getByTestId('add-room')).toBeInTheDocument();
  });

  it('hides the add trigger when the user cannot edit rooms', () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });
    render(<Rooms />);

    expect(screen.getByTestId('room-table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add room/ })).not.toBeInTheDocument();
  });

  it('renders the RoomInfo overlay for the active room and keeps it after edit', () => {
    render(<Rooms />);

    expect(screen.getByTestId('room-info')).toHaveTextContent('Room A');
    fireEvent.click(screen.getByRole('button', { name: 'edit-room' }));
    expect(screen.getByTestId('room-info')).toBeInTheDocument();
  });

  it('shows an empty state with a zero count and no active room overlay', () => {
    useRoomsMock.mockReturnValue([]);
    render(<Rooms />);

    expect(screen.getByRole('heading', { name: /Rooms/ })).toHaveTextContent('(0)');
    expect(screen.queryByTestId('room-info')).not.toBeInTheDocument();
  });

  it('re-selects the first room when the active room no longer exists after an update', () => {
    const { rerender } = render(<Rooms />);
    expect(screen.getByTestId('room-info')).toHaveTextContent('Room A');

    useRoomsMock.mockReturnValue([{ id: 'room-2', name: 'Room B' }]);
    rerender(<Rooms />);

    expect(screen.getByTestId('room-info')).toHaveTextContent('Room B');
  });

  it('selects the first room when transitioning from an empty to a populated list', () => {
    useRoomsMock.mockReturnValue([]);
    const { rerender } = render(<Rooms />);
    expect(screen.queryByTestId('room-info')).not.toBeInTheDocument();

    useRoomsMock.mockReturnValue([{ id: 'room-3', name: 'Room C' }]);
    rerender(<Rooms />);

    expect(screen.getByTestId('room-info')).toHaveTextContent('Room C');
  });

  it('marks a room available and notifies success', async () => {
    render(<Rooms />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle-on' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith('success', {
        title: 'Room available',
        text: 'Room A availability has been updated.',
      })
    );
    expect(toggleRoomAvailabilityMock).toHaveBeenCalledWith({ id: 'room-1', name: 'Room A' }, true);
  });

  it('marks a room unavailable and notifies success', async () => {
    render(<Rooms />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle-off' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith('success', {
        title: 'Room unavailable',
        text: 'Room A availability has been updated.',
      })
    );
  });

  it('notifies an error when the availability update fails', async () => {
    toggleRoomAvailabilityMock.mockRejectedValueOnce(new Error('nope'));
    render(<Rooms />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle-on' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith('error', {
        title: 'Unable to update room',
        text: 'Failed to update room availability. Please try again.',
      })
    );
  });

  it('ignores availability toggles when the user cannot edit rooms', () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });
    render(<Rooms />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle-on' }));

    expect(toggleRoomAvailabilityMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
