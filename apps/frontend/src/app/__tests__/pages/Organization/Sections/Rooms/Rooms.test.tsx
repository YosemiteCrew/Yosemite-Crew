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

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
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
    useRoomsMock.mockReturnValue([{ id: 'room-1', name: 'Room A', type: 'EXAM_ROOM' }]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  /**
   * Pins the shared SectionCard primitive rather than the old hand-rolled
   * `.yc-card-surface` section with its own `text-[15.5px]` title - that
   * hand-rolled size was one type ramp below the `text-heading-3` (20px/500)
   * SectionCard already gives Specialities, Documents and Online booking on
   * the same page, which is what made Rooms' title visibly smaller/bolder
   * than its siblings when scrolling the Organization page.
   */
  it('renders the "Rooms" title through the shared SectionCard primitive', () => {
    render(<Rooms />);

    const heading = screen.getByRole('heading', { name: /Rooms/ });
    expect(heading.className).toContain('text-heading-3');
    expect(heading.className).not.toContain('text-[15.5px]');
  });

  it('renders the rooms list, count, type suffix and add trigger when permitted', () => {
    render(<Rooms />);

    expect(screen.getByRole('heading', { name: /Rooms/ })).toHaveTextContent('(1)');
    expect(screen.getByRole('button', { name: 'View Room A details' })).toBeInTheDocument();
    expect(screen.getByText(/exam room/)).toBeInTheDocument();
    const add = screen.getByRole('button', { name: '+ Add room' });
    fireEvent.click(add);
    expect(screen.getByTestId('add-room')).toBeInTheDocument();
  });

  it('hides the add trigger when the user cannot edit rooms', () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });
    render(<Rooms />);

    expect(screen.getByRole('button', { name: 'View Room A details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add room/ })).not.toBeInTheDocument();
  });

  it('leaves availability toggling to the room detail view', () => {
    render(<Rooms />);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('summarizes room schedules, capabilities and specialities across icon types', () => {
    useRoomsMock.mockReturnValue([
      {
        id: 'r1',
        name: 'Room 1',
        type: 'SURGERY',
        availabilityMode: 'ALL_DAY',
        capabilities: ['X-ray'],
      },
      {
        id: 'r2',
        name: 'Room 2',
        type: 'ICU',
        availabilityDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      },
      { id: 'r3', name: 'Room 3', type: 'IMAGING', availabilityDays: ['MONDAY', 'TUESDAY'] },
      {
        id: 'r4',
        name: 'Room 4',
        type: 'RECEPTION',
        assignedSpecialiteis: [{ id: 's', name: 'Cardio' }],
      },
      { id: 'r5', name: 'Room 5', type: 'BOARDING' },
      {
        id: 'r6',
        name: 'Room 6',
        type: 'GROOMING',
        availabilityDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      },
    ]);
    render(<Rooms />);

    expect(screen.getByText('Every day · X-ray')).toBeInTheDocument();
    expect(screen.getByText('Mon–Fri')).toBeInTheDocument();
    expect(screen.getByText('Mon, Tue')).toBeInTheDocument();
    expect(screen.getByText('Cardio')).toBeInTheDocument();
    expect(screen.getByText('No schedule set')).toBeInTheDocument();
    expect(screen.getByText('Every day')).toBeInTheDocument();
  });

  it('opens the RoomInfo overlay for the active room from a row', () => {
    render(<Rooms />);

    expect(screen.getByTestId('room-info')).toHaveTextContent('Room A');
    fireEvent.click(screen.getByRole('button', { name: 'View Room A details' }));
    expect(screen.getByTestId('room-info')).toBeInTheDocument();
  });

  it('shows an empty state with a zero count and no active room overlay', () => {
    useRoomsMock.mockReturnValue([]);
    render(<Rooms />);

    expect(screen.getByRole('heading', { name: /Rooms/ })).toHaveTextContent('(0)');
    expect(screen.getByText('No rooms added yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('room-info')).not.toBeInTheDocument();
  });

  it('re-selects the first room when the active room no longer exists after an update', () => {
    const { rerender } = render(<Rooms />);
    expect(screen.getByTestId('room-info')).toHaveTextContent('Room A');

    useRoomsMock.mockReturnValue([{ id: 'room-2', name: 'Room B', type: 'EXAM_ROOM' }]);
    rerender(<Rooms />);

    expect(screen.getByTestId('room-info')).toHaveTextContent('Room B');
  });

  it('selects the first room when transitioning from an empty to a populated list', () => {
    useRoomsMock.mockReturnValue([]);
    const { rerender } = render(<Rooms />);
    expect(screen.queryByTestId('room-info')).not.toBeInTheDocument();

    useRoomsMock.mockReturnValue([{ id: 'room-3', name: 'Room C', type: 'EXAM_ROOM' }]);
    rerender(<Rooms />);

    expect(screen.getByTestId('room-info')).toHaveTextContent('Room C');
  });
});
