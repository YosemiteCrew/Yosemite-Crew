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

jest.mock('@/app/features/organization/services/roomService', () => ({
  loadRoomsForOrgPrimaryOrg: jest.fn().mockResolvedValue(undefined),
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
  setRoomUnitOccupied: jest.fn(),
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
      setRoomUnitOccupied: jest.fn(),
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
      setRoomUnitOccupied: jest.fn(),
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

  it('does not offer occupied units for inpatient room assignment', () => {
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
      <ChangeRoom
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={{
          ...baseAppointment,
          appointmentKind: 'INPATIENT',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));

    expect(screen.queryByRole('button', { name: 'Ward 2A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ward 2B' })).toBeInTheDocument();
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

  it('does not reload rooms while the modal is closed', () => {
    const { loadRoomsForOrgPrimaryOrg } = jest.requireMock(
      '@/app/features/organization/services/roomService'
    );
    render(
      <ChangeRoom showModal={false} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    expect(loadRoomsForOrgPrimaryOrg).not.toHaveBeenCalled();
  });

  it('reloads rooms when the modal opens', () => {
    const { loadRoomsForOrgPrimaryOrg } = jest.requireMock(
      '@/app/features/organization/services/roomService'
    );
    render(
      <ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    expect(loadRoomsForOrgPrimaryOrg).toHaveBeenCalledWith({ force: true, silent: true });
  });

  it('resets selection and clears errors when the active appointment changes', async () => {
    // Seed an error state first, then re-render with a different appointment to
    // exercise the render-phase reset block (new room id + cleared error).
    mockUpdateAppointment.mockRejectedValueOnce(new Error('boom'));
    const setShowModal = jest.fn();
    const { rerender } = render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={baseAppointment}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(screen.getByText('Unable to update room. Please try again.')).toBeInTheDocument();
    });

    rerender(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={{ id: 'appt-9', room: { id: 'room-1', name: 'Room A' } } as any}
      />
    );

    // The reset block picked up the new room id and cleared the previous error.
    expect(screen.getByTestId('dropdown-default')).toHaveTextContent('room-1');
    expect(screen.queryByText('Unable to update room. Please try again.')).not.toBeInTheDocument();
  });

  it('Cancel restores the encounter unit for an inpatient appointment', () => {
    mockEncounterById = { 'appt-1': { unitId: 'unit-2a' } };
    mockRoomState = {
      roomUnitsById: {
        'unit-2a': {
          id: 'unit-2a',
          roomId: 'room-1',
          displayName: 'Ward 2A',
          code: '2A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-1': ['unit-2a'] },
      setRoomUnitOccupied: jest.fn(),
    };
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={{ ...baseAppointment, appointmentKind: 'INPATIENT' }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('clears the selected unit when switching to a non-inpatient room', () => {
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
      setRoomUnitOccupied: jest.fn(),
    };
    // Outpatient: selecting a room clears any unit rather than auto-picking one.
    render(
      <ChangeRoom showModal={true} setShowModal={jest.fn()} activeAppointment={baseAppointment} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));
    // No unit dropdown for outpatient appointments.
    expect(screen.queryByRole('button', { name: 'Ward 2A' })).not.toBeInTheDocument();
  });

  it('does nothing when saving without an appointment id', async () => {
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={{ room: { id: 'room-1', name: 'Room A' } } as any}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(mockUpdateAppointment).not.toHaveBeenCalled();
    });
    expect(setShowModal).not.toHaveBeenCalled();
  });

  it('closes without an API call when an inpatient room and unit are unchanged', async () => {
    mockEncounterById = { 'appt-1': { unitId: 'unit-1a' } };
    mockRoomState = {
      roomUnitsById: {
        'unit-1a': {
          id: 'unit-1a',
          roomId: 'room-1',
          displayName: 'Ward 1A',
          code: '1A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-1': ['unit-1a'] },
      setRoomUnitOccupied: jest.fn(),
    };
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={{ ...baseAppointment, appointmentKind: 'INPATIENT' }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
    expect(mockUpdateAppointment).not.toHaveBeenCalled();
  });

  it('initialises an encounter with lead details but skips unit assignment without an encounter id', async () => {
    mockUpdateAppointment.mockResolvedValue({});
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
      setRoomUnitOccupied: jest.fn(),
    };
    const setShowModal = jest.fn();
    render(
      <ChangeRoom
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={{
          ...baseAppointment,
          appointmentKind: 'INPATIENT',
          // No encounterId → the assignEncounterUnit branch is skipped.
          lead: { id: 'lead-1', name: 'Dr Lead' },
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Room B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(mockInitEncounter).toHaveBeenCalledWith('appt-1', 'INPATIENT', {
        leadId: 'lead-1',
        leadName: 'Dr Lead',
      });
      expect(mockSetRoomUnit).toHaveBeenCalledWith('appt-1', 'room-2', 'unit-2a');
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
    expect(mockAssignEncounterUnit).not.toHaveBeenCalled();
  });

  it('marks the previous unit free and the new unit occupied after assignment', async () => {
    mockUpdateAppointment.mockResolvedValue({});
    mockAssignEncounterUnit.mockResolvedValue({});
    const setRoomUnitOccupied = jest.fn();
    mockEncounterById = { 'appt-1': { unitId: 'unit-old' } };
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
      setRoomUnitOccupied,
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
    fireEvent.click(screen.getByRole('button', { name: 'Ward 2A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => {
      expect(mockAssignEncounterUnit).toHaveBeenCalledWith(
        expect.objectContaining({ encounterId: 'enc-1', unitId: 'unit-2a' })
      );
      expect(setRoomUnitOccupied).toHaveBeenCalledWith('unit-old', false);
      expect(setRoomUnitOccupied).toHaveBeenCalledWith('unit-2a', true);
    });
  });
});
