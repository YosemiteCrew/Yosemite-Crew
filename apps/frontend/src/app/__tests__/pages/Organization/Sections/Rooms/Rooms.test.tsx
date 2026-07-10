import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import Rooms from '@/app/features/organization/pages/Organization/Sections/Rooms/Rooms';

const useRoomsMock = jest.fn();
const usePermissionsMock = jest.fn();

jest.mock('@/app/hooks/useRooms', () => ({
  useRoomsForPrimaryOrg: () => useRoomsMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: jest.fn() }),
}));

jest.mock('@/app/features/organization/services/roomService', () => ({
  toggleRoomAvailability: jest.fn(),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/tables/RoomTable', () => () => <div data-testid="room-table" />);

jest.mock('@/app/features/organization/pages/Organization/Sections/Rooms/AddRoom', () => () => (
  <div data-testid="add-room" />
));

jest.mock('@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfo', () => () => (
  <div data-testid="room-info" />
));

describe('Rooms section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRoomsMock.mockReturnValue([{ id: 'room-1', name: 'Room A' }]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
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
});
