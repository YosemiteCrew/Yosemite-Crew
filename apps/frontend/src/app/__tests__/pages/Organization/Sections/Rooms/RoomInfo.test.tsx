import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import RoomInfo from '@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfo';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';

const updateRoomMock = jest.fn();
const deleteRoomMock = jest.fn();
const toggleRoomAvailabilityMock = jest.fn();

jest.mock('@/app/features/organization/services/roomService', () => ({
  updateRoom: (...args: any[]) => updateRoomMock(...args),
  deleteRoom: (...args: any[]) => deleteRoomMock(...args),
  toggleRoomAvailability: (...args: any[]) => toggleRoomAvailabilityMock(...args),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: jest.fn() }),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [{ practionerId: 'team-1', _id: 'team-1', name: 'Alex' }],
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: () => [{ _id: 'spec-1', name: 'Surgery' }],
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, setShowModal, canClose, children }: any) =>
    showModal ? (
      <div>
        <button
          type="button"
          onClick={() => {
            if (!canClose || canClose()) setShowModal(false);
          }}
        >
          backdrop-close
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
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, defaultOption, options = [] }: any) => (
    <div>
      <button type="button" onClick={() => onSelect({ value: defaultOption || 'SURGERY' })}>
        {placeholder}
      </button>
      {options.map((option: any) => (
        <button
          key={option.value}
          type="button"
          aria-label={`${placeholder} option ${option.value}`}
          onClick={() => onSelect(option)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value = [], onChange }: any) => (
    <button
      type="button"
      aria-label={placeholder}
      onClick={() => onChange?.(placeholder === 'Species' ? ['CANINE', 'FELINE'] : value)}
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

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
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

describe('RoomInfo modal', () => {
  const activeRoom: any = {
    id: 'room-1',
    organisationId: 'org-1',
    name: 'Room A',
    type: 'INPATIENT',
    assignedSpecialiteis: ['spec-1'],
    assignedStaffs: ['team-1'],
    unitCount: 1,
    units: [{ id: 'unit-a', name: 'A', occupied: true }],
    availability: {
      isAvailable: true,
      days: 'MON_SAT',
      startTime: '10:00',
      endTime: '20:00',
      species: ['CANINE', 'FELINE'],
      totalUnits: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useOrganisationRoomStore.setState({
      roomUnitGroupsById: {},
      roomUnitGroupIdsByRoomId: {},
      roomUnitsById: {},
      roomUnitIdsByRoomId: {},
      roomUnitIdsByGroupId: {},
    });
  });

  it('renders room details with normalized legacy unit data', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    expect(screen.getAllByText('Room A').length).toBeGreaterThan(0);
    expect(screen.getByText('Room Code')).toBeInTheDocument();
    expect(screen.getByText('Canine, Feline')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('updates room on save from edit mode', async () => {
    updateRoomMock.mockResolvedValue({});
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Edit room'));
    fireEvent.change(screen.getAllByLabelText('Name')[0], {
      target: { value: 'Updated Room' },
    });
    fireEvent.change(screen.getByLabelText('Units'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByLabelText('Species'));
    fireEvent.change(screen.getByLabelText('Add equipment name'), {
      target: { value: 'MRI Scanner' },
    });
    fireEvent.click(screen.getByLabelText('Add custom equipment'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateRoomMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'room-1',
          organisationId: 'org-1',
          name: 'Updated Room',
          unitCount: 2,
          availability: expect.objectContaining({
            species: ['CANINE', 'FELINE'],
          }),
          units: [
            expect.objectContaining({
              id: 'unit-a',
              name: 'A',
              size: 'Medium',
              count: 2,
              occupied: true,
            }),
          ],
          equipment: expect.arrayContaining(['MRI Scanner']),
        })
      );
    });
  });

  it('confirms and deletes a room', async () => {
    deleteRoomMock.mockResolvedValue({});
    const setShowModal = jest.fn();
    render(<RoomInfo showModal setShowModal={setShowModal} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Delete room'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(deleteRoomMock).toHaveBeenCalledWith(activeRoom);
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('cancels the delete confirmation without deleting', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Delete room'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(deleteRoomMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Delete room'));
    fireEvent.click(screen.getByText('close-Delete room?'));
    expect(deleteRoomMock).not.toHaveBeenCalled();
  });

  it('surfaces backend error messages when delete and update fail', async () => {
    deleteRoomMock.mockRejectedValue({ response: { data: { message: 'Room occupied' } } });
    updateRoomMock.mockRejectedValue({ message: 'update failed' });
    const setShowModal = jest.fn();
    render(<RoomInfo showModal setShowModal={setShowModal} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Delete room'));
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(deleteRoomMock).toHaveBeenCalled());
    expect(setShowModal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Edit room'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(updateRoomMock).toHaveBeenCalled());
    // Save failed, so the drawer stays in edit mode.
    expect(screen.getByText('close-Edit room')).toBeInTheDocument();
  });

  it('collapses and re-expands every section', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.queryByText('Room Code')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('Room Code')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Availability' }));
    expect(screen.queryByText('Total units')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Unit type/ }));
    expect(screen.queryByText('Size')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Equipments / Capabilities' }));
  });

  it('toggles live room availability in view mode and reports failures', async () => {
    toggleRoomAvailabilityMock.mockResolvedValueOnce({});
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    const toggle = screen.getByRole('switch', { name: 'Toggle room availability' });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggleRoomAvailabilityMock).toHaveBeenCalledWith(activeRoom, false);
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    toggleRoomAvailabilityMock.mockRejectedValueOnce('nope');
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggleRoomAvailabilityMock).toHaveBeenCalledTimes(2);
    });
    // Failure leaves the local state unchanged.
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('only updates local availability state when toggled in edit mode', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Edit room'));
    fireEvent.click(screen.getByRole('switch', { name: 'Toggle room availability' }));

    expect(toggleRoomAvailabilityMock).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Toggle room availability' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('closes cleanly from view mode but asks to confirm discarding edits', () => {
    const setShowModal = jest.fn();
    render(<RoomInfo showModal setShowModal={setShowModal} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByText('close-Room A'));
    expect(setShowModal).toHaveBeenCalledWith(false);
    setShowModal.mockClear();

    fireEvent.click(screen.getByLabelText('Edit room'));
    fireEvent.change(screen.getAllByLabelText('Name')[0], { target: { value: 'Dirty name' } });
    fireEvent.click(screen.getByText('close-Edit room'));
    expect(setShowModal).not.toHaveBeenCalled();
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();

    // Keep editing keeps the dirty value.
    fireEvent.click(screen.getByText('Keep editing'));
    expect((screen.getAllByLabelText('Name')[0] as HTMLInputElement).value).toBe('Dirty name');

    // The backdrop canClose guard also opens the confirmation while dirty.
    fireEvent.click(screen.getByText('backdrop-close'));
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();

    // Discard resets to the stored room and returns to view mode.
    fireEvent.click(screen.getAllByText('Discard').at(-1) as HTMLElement);
    expect(screen.getAllByText('Room A').length).toBeGreaterThan(0);
  });

  it('closes via the backdrop when the form is clean', () => {
    const setShowModal = jest.fn();
    render(<RoomInfo showModal setShowModal={setShowModal} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByText('backdrop-close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('adds unit drafts and redistributes counts across units', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Edit room'));
    fireEvent.click(screen.getByLabelText('Add unit type'));
    expect(screen.getAllByLabelText('Units')).toHaveLength(2);

    // Distributing 3 across two unit rows gives 2 + 1.
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: '3' } });
    const counts = screen
      .getAllByLabelText('Units')
      .map((input) => (input as HTMLInputElement).value);
    expect(counts).toEqual(['2', '1']);

    // NaN input clamps the total to 0.
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: 'abc' } });
    expect(
      screen.getAllByLabelText('Units').map((input) => (input as HTMLInputElement).value)
    ).toEqual(['0', '0']);

    // Per-unit count edits (including NaN) feed back into the total.
    fireEvent.change(screen.getAllByLabelText('Units')[0], { target: { value: '4' } });
    expect((screen.getByLabelText('Total units') as HTMLInputElement).value).toBe('4');
    fireEvent.change(screen.getAllByLabelText('Units')[0], { target: { value: 'x' } });
    expect((screen.getByLabelText('Total units') as HTMLInputElement).value).toBe('0');
  });

  it('clears units when switching to a room type that cannot hold them', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Edit room'));
    fireEvent.click(screen.getByLabelText('Room type option CONSULTATION'));

    expect(screen.queryByLabelText('Total units')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add unit type')).not.toBeInTheDocument();
    expect(
      screen.getByText('Select ICU, Inpatient, Isolation, or Boarding to configure unit types.')
    ).toBeInTheDocument();

    // Switching back restores unit support with an empty unit list.
    fireEvent.click(screen.getByLabelText('Room type option ICU'));
    expect(screen.getByText('No unit types configured.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Add unit type'));
    expect(screen.getAllByLabelText('Units')).toHaveLength(1);
  });

  it('edits availability days, times, and unit size', () => {
    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom />);

    fireEvent.click(screen.getByLabelText('Edit room'));
    fireEvent.click(screen.getByLabelText('Days option MON_FRI'));
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '18:00' } });
    fireEvent.click(screen.getByLabelText('Size option Large'));

    fireEvent.click(screen.getByText('Discard'));
    expect(screen.getByText('10:00 - 20:00')).toBeInTheDocument();
  });

  it('derives units, species, and equipment from store unit groups when the room has none', () => {
    useOrganisationRoomStore.setState({
      roomUnitGroupsById: {
        'group-1': {
          id: 'group-1',
          roomId: 'room-2',
          name: 'Kennel',
          size: 'LARGE',
          unitCount: 4,
          speciesConstraints: ['FELINE'],
          capabilities: ['Oxygen Tank'],
        } as never,
      },
      roomUnitGroupIdsByRoomId: { 'room-2': ['group-1'] },
    });

    const bareRoom: any = {
      id: 'room-2',
      organisationId: 'org-1',
      name: 'Boarding B',
      type: 'BOARDING',
    };

    render(<RoomInfo showModal setShowModal={jest.fn()} activeRoom={bareRoom} canEditRoom />);

    expect(screen.getAllByText('Kennel').length).toBeGreaterThan(0);
    expect(screen.getByText('Feline')).toBeInTheDocument();
    expect(screen.getByText('Oxygen Tank')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });

  it('hides edit and delete controls without room edit permission', () => {
    render(
      <RoomInfo showModal setShowModal={jest.fn()} activeRoom={activeRoom} canEditRoom={false} />
    );

    expect(screen.queryByLabelText('Edit room')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete room')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle room availability' })).toBeDisabled();
  });
});
