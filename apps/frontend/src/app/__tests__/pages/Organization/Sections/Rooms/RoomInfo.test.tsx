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
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
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
  default: ({ placeholder, onSelect, defaultOption }: any) => (
    <button type="button" onClick={() => onSelect({ value: defaultOption || 'SURGERY' })}>
      {placeholder}
    </button>
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
});
