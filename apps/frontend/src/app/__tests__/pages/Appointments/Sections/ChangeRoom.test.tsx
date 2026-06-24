import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, defaultOption }: any) => (
    <div>
      <span data-testid="dropdown-default">{defaultOption}</span>
      {options?.map((opt: any) => (
        <button key={opt.value} type="button" onClick={() => onSelect(opt)}>
          {opt.label}
        </button>
      ))}
      {!options?.length && <span>{placeholder}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
}));

const mockRooms = [
  { id: 'room-1', name: 'Room A' },
  { id: 'room-2', name: 'Room B' },
];
jest.mock('@/app/hooks/useRooms', () => ({
  useRoomsForPrimaryOrg: () => mockRooms,
}));

const mockUpdateAppointment = jest.fn();
const mockAssignEncounterUnit = jest.fn();
jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  updateAppointment: (...args: any[]) => mockUpdateAppointment(...args),
  assignEncounterUnit: (...args: any[]) => mockAssignEncounterUnit(...args),
}));

const mockInitEncounter = jest.fn();
const mockSetRoomUnit = jest.fn();
let mockEncounterById: Record<string, any> = {};
jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: (selector: any) =>
    selector({
      encountersById: mockEncounterById,
      initEncounter: mockInitEncounter,
      setRoomUnit: mockSetRoomUnit,
    }),
}));

let mockRoomState = {
  roomUnitsById: {} as Record<string, any>,
  roomUnitIdsByRoomId: {} as Record<string, string[]>,
};
jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: Object.assign((selector: any) => selector(mockRoomState), {
    getState: () => mockRoomState,
  }),
}));

import ChangeRoom from '@/app/features/appointments/pages/Appointments/Sections/ChangeRoom';

const baseAppointment: any = {
  id: 'appt-1',
  room: { id: 'room-1', name: 'Room A' },
};

describe('ChangeRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEncounterById = {};
    mockRoomState = {
      roomUnitsById: {},
      roomUnitIdsByRoomId: {},
    };
  });

  it('renders when showModal is true', () => {
    render(
      <ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    expect(screen.getByText('Assign room')).toBeInTheDocument();
  });

  it('does not render when showModal is false', () => {
    render(
      <ChangeRoom showModal={false} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
  });

  it('renders room options from hook', () => {
    render(
      <ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    expect(screen.getByRole('button', { name: 'Room A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Room B' })).toBeInTheDocument();
  });

  it('Cancel button closes modal', () => {
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={baseAppointment}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('Save closes modal without API call when room unchanged', async () => {
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={baseAppointment}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
    expect(mockUpdateAppointment).not.toHaveBeenCalled();
  });

  it('Save calls updateAppointment when room changed', async () => {
    mockUpdateAppointment.mockResolvedValue({});
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={baseAppointment}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(mockUpdateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ room: { id: 'room-2', name: 'Room B' } })
      );
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
  });

  it('renders and persists a unit when an inpatient room is assigned', async () => {
    mockUpdateAppointment.mockResolvedValue({});
    mockAssignEncounterUnit.mockResolvedValue({});
    mockRoomState = {
      roomUnitsById: {
        'unit-2a': {
          id: 'unit-2a',
          roomId: 'room-2',
          displayName: 'Ward 2A',
          code: '2A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-2': ['unit-2a'] },
    };
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={{
          ...baseAppointment,
          appointmentKind: 'INPATIENT',
          encounterId: 'enc-1',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));
    expect(screen.getByRole('button', { name: 'Ward 2A' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(mockUpdateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ room: { id: 'room-2', name: 'Room B' } })
      );
      expect(mockSetRoomUnit).toHaveBeenCalledWith('appt-1', 'room-2', 'unit-2a');
      expect(mockAssignEncounterUnit).toHaveBeenCalledWith(
        expect.objectContaining({ encounterId: 'enc-1', unitId: 'unit-2a' })
      );
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
  });

  it('shows error message on failed save', async () => {
    mockUpdateAppointment.mockRejectedValue({
      response: { data: { message: 'Room unavailable' } },
    });
    render(
      <ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(screen.getByText('Room unavailable')).toBeInTheDocument();
    });
  });

  it('shows fallback error message when no server message', async () => {
    mockUpdateAppointment.mockRejectedValue(new Error('network error'));
    render(
      <ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(screen.getByText('Unable to update room. Please try again.')).toBeInTheDocument();
    });
  });

  it('initializes with current room id as default', () => {
    render(
      <ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    expect(screen.getByTestId('dropdown-default')).toHaveTextContent('room-1');
  });

  it('handles appointment with no room', () => {
    const noRoomAppt = { id: 'appt-2' } as any;
    render(<ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={noRoomAppt} />);
    expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-default')).toHaveTextContent('');
  });
});
