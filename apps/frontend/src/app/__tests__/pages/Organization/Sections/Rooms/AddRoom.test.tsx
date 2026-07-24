import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddRoom from '@/app/features/organization/pages/Organization/Sections/Rooms/AddRoom';

let mockLastCanClose: boolean | undefined;

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children, canClose }: any) =>
    showModal ? (
      <div data-testid="modal">
        <button
          type="button"
          onClick={() => {
            mockLastCanClose = canClose?.();
          }}
        >
          modal-canclose
        </button>
        {children}
      </div>
    ) : null,
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, eyebrow, meta, actions, onClose }: any) => (
    <div>
      {eyebrow && <div>{eyebrow}</div>}
      <div>{title}</div>
      {meta && <div>{meta}</div>}
      {actions}
      <button type="button" aria-label="close" onClick={onClose}>
        {`close-${title}`}
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, defaultOption, error }: any) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onSelect({
            value:
              placeholder === 'Room Type'
                ? 'INPATIENT'
                : placeholder === 'Days'
                  ? 'SUN'
                  : placeholder === 'Size'
                    ? 'Large'
                    : defaultOption || 'CONSULTATION',
          })
        }
      >
        {placeholder}
      </button>
      {placeholder === 'Room Type' && (
        <button
          type="button"
          aria-label="select-consultation"
          onClick={() => onSelect({ value: 'CONSULTATION' })}
        >
          Consultation type
        </button>
      )}
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value = [], onChange }: any) => (
    <button
      type="button"
      aria-label={placeholder}
      onClick={() => {
        const nextValue =
          placeholder === 'Species'
            ? ['CANINE', 'FELINE']
            : placeholder === 'Speciality (optional)'
              ? ['spec-1']
              : placeholder === 'Assigned Staff (optional)'
                ? ['staff-1']
                : placeholder === 'Equipment'
                  ? ['Oxygen']
                  : value;
        onChange?.(nextValue);
      }}
    >
      {placeholder}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({ label, value, onChange }: any) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

let mockTeams: any = [{ name: 'Dr. Rivera', practionerId: 'staff-1' }];
let mockSpecialities: any = [{ name: 'Surgery', _id: 'spec-1' }];

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => mockTeams,
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: () => mockSpecialities,
}));

jest.mock('@/app/features/organization/services/roomService', () => ({
  createRoom: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: jest.fn() }),
}));

const roomService = jest.requireMock('@/app/features/organization/services/roomService');

describe('AddRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTeams = [{ name: 'Dr. Rivera', practionerId: 'staff-1' }];
    mockSpecialities = [{ name: 'Surgery', _id: 'spec-1' }];
    mockLastCanClose = undefined;
  });

  it('shows validation errors', () => {
    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByText('Add room'));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('creates a room', async () => {
    roomService.createRoom.mockResolvedValue({});
    const setShowModal = jest.fn();

    render(<AddRoom showModal setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Room A' },
    });
    fireEvent.change(screen.getByLabelText('Room code'), {
      target: { value: 'RA-01' },
    });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    expect(roomService.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Room A',
        code: 'RA-01',
        unitCount: 0,
        units: [],
        equipment: [],
      })
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('does not prefill room type or equipment, and blocks save until a room type is chosen', () => {
    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Room B' },
    });
    fireEvent.click(screen.getByText('Add room'));

    expect(screen.getByText('Room type is required')).toBeInTheDocument();
    expect(roomService.createRoom).not.toHaveBeenCalled();
  });

  it('creates a room without a custom code so the backend can generate one', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Consultation Room' },
    });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Consultation Room',
          code: '',
        })
      );
    });
  });

  it('adds custom equipment to the created room payload', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Imaging Room' },
    });
    fireEvent.change(screen.getByLabelText('Room code'), {
      target: { value: 'IR-01' },
    });
    fireEvent.change(screen.getByLabelText('Add equipment name'), {
      target: { value: 'MRI Scanner' },
    });
    fireEvent.click(screen.getByLabelText('Add custom equipment'));
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          equipment: expect.arrayContaining(['MRI Scanner']),
        })
      );
    });
  });

  it('creates room units from configured unit types', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Ward A' },
    });
    fireEvent.change(screen.getByLabelText('Room code'), {
      target: { value: 'WA-01' },
    });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByLabelText('Add unit type'));
    fireEvent.change(screen.getByLabelText('Units'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          unitCount: 2,
          units: [expect.objectContaining({ id: 'unit-1', count: 2, size: 'Medium' })],
        })
      );
    });
  });

  it('creates a room with multiple supported species', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Shared Ward' },
    });
    fireEvent.change(screen.getByLabelText('Room code'), {
      target: { value: 'SW-01' },
    });
    fireEvent.click(screen.getByLabelText('Species'));
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          availability: expect.objectContaining({
            species: ['CANINE', 'FELINE'],
          }),
        })
      );
    });
  });

  it('updates availability, assignments, equipment, and unit metadata in the payload', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'ICU A' },
    });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByLabelText('Toggle room availability'));
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '08:30' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '18:45' } });
    fireEvent.click(screen.getByText('Days'));
    fireEvent.click(screen.getByLabelText('Speciality (optional)'));
    fireEvent.click(screen.getByLabelText('Assigned Staff (optional)'));
    fireEvent.click(screen.getByLabelText('Equipment'));
    fireEvent.click(screen.getByLabelText('Add unit type'));
    fireEvent.change(screen.getAllByLabelText('Name')[1], { target: { value: 'Large ward' } });
    fireEvent.click(screen.getByText('Size'));
    fireEvent.change(screen.getByLabelText('Units'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedSpecialiteis: [{ id: 'spec-1', name: 'Surgery' }],
          assignedStaffs: [{ id: 'staff-1', name: 'Dr. Rivera' }],
          availableNow: false,
          availabilityDays: ['SUN'],
          availabilityStartTime: '08:30',
          availabilityEndTime: '18:45',
          capabilities: ['Oxygen'],
          unitCount: 3,
          units: [expect.objectContaining({ name: 'Large ward', size: 'Large', count: 3 })],
        })
      );
    });
  });

  it('discards dirty form data through the confirmation modal', () => {
    const setShowModal = jest.fn();
    render(<AddRoom showModal setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Dirty room' },
    });
    fireEvent.click(screen.getByText('close-Adding new room'));
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Keep editing'));
    expect(setShowModal).not.toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByText('close-Adding new room'));
    fireEvent.click(screen.getByText('Discard'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('does not add blank custom equipment and reports save failures', async () => {
    roomService.createRoom.mockRejectedValue(new Error('nope'));

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByLabelText('Add custom equipment'));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Failure room' },
    });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ equipment: [] })
      );
    });
  });

  it('closes immediately when the form is pristine', () => {
    const setShowModal = jest.fn();
    render(<AddRoom showModal setShowModal={setShowModal} />);

    fireEvent.click(screen.getByText('close-Adding new room'));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('allows the modal to close when pristine and blocks it when dirty', () => {
    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByText('modal-canclose'));
    expect(mockLastCanClose).toBe(true);
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
    fireEvent.click(screen.getByText('modal-canclose'));
    expect(mockLastCanClose).toBe(false);
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
  });

  it('toggles a collapsible section closed', () => {
    render(<AddRoom showModal setShowModal={jest.fn()} />);

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Basic details'));
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('does not duplicate custom equipment already added', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Eq room' } });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.change(screen.getByLabelText('Add equipment name'), {
      target: { value: 'Ventilator' },
    });
    fireEvent.click(screen.getByLabelText('Add custom equipment'));
    fireEvent.change(screen.getByLabelText('Add equipment name'), {
      target: { value: 'Ventilator' },
    });
    fireEvent.click(screen.getByLabelText('Add custom equipment'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    const payload = roomService.createRoom.mock.calls[0][0];
    expect(payload.equipment.filter((entry: string) => entry === 'Ventilator')).toHaveLength(1);
  });

  it('distributes total units across configured unit drafts', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ward' } });
    fireEvent.click(screen.getByText('Room Type'));
    // Changing total units with no drafts hits the early-return path.
    fireEvent.change(screen.getByLabelText('Total Units'), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText('Add unit type'));
    fireEvent.click(screen.getByLabelText('Add unit type'));
    // Distribute 3 units across 2 drafts -> [2, 1].
    fireEvent.change(screen.getByLabelText('Total Units'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    const payload = roomService.createRoom.mock.calls[0][0];
    expect(payload.unitCount).toBe(3);
    expect(payload.units.map((unit: any) => unit.count)).toEqual([2, 1]);
  });

  it('recomputes totals when updating one of several unit drafts', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kennel' } });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByLabelText('Add unit type'));
    fireEvent.click(screen.getByLabelText('Add unit type'));

    const unitCountInputs = screen.getAllByLabelText('Units');
    fireEvent.change(unitCountInputs[0], { target: { value: '5' } });
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    const payload = roomService.createRoom.mock.calls[0][0];
    expect(payload.unitCount).toBe(6);
    expect(payload.units.map((unit: any) => unit.count)).toEqual([5, 1]);
  });

  it('clears unit configuration when switching to a non-unit room type', async () => {
    roomService.createRoom.mockResolvedValue({});

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Flex room' } });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByLabelText('Add unit type'));
    fireEvent.click(screen.getByLabelText('select-consultation'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    const payload = roomService.createRoom.mock.calls[0][0];
    expect(payload.type).toBe('CONSULTATION');
    expect(payload.unitCount).toBe(0);
    expect(payload.units).toEqual([]);
  });

  it('falls back to identifiers when option labels are missing', async () => {
    roomService.createRoom.mockResolvedValue({});
    mockTeams = [{ name: '', practionerId: 'staff-1' }];
    mockSpecialities = [{ name: 'Cardiology' }];

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fallback room' } });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByLabelText('Assigned Staff (optional)'));
    fireEvent.click(screen.getByLabelText('Speciality (optional)'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    const payload = roomService.createRoom.mock.calls[0][0];
    // Empty team name falls back to the practitioner id as the label.
    expect(payload.assignedStaffs).toEqual([{ id: 'staff-1', name: 'staff-1' }]);
    // The selected speciality id has no matching name, so it is dropped.
    expect(payload.assignedSpecialiteis).toEqual([]);
  });

  it('handles missing teams and specialities gracefully', async () => {
    roomService.createRoom.mockResolvedValue({});
    mockTeams = undefined;
    mockSpecialities = undefined;

    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'No refs room' } });
    fireEvent.click(screen.getByText('Room Type'));
    fireEvent.click(screen.getByText('Add room'));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ assignedStaffs: [], assignedSpecialiteis: [] })
      );
    });
  });
});
