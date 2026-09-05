import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoomInfoSections from '@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfoSections';
import type { ManagedRoom } from '@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfo.types';

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
  }: {
    inlabel: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange ?? (() => {})} />
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({
    placeholder,
    options = [],
    onSelect,
  }: {
    placeholder: string;
    options?: { label: string; value: string }[];
    onSelect: (o: { label: string; value: string }) => void;
  }) => (
    <div>
      {options.map((option) => (
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
  default: ({
    placeholder,
    onChange,
  }: {
    placeholder: string;
    onChange?: (value: string[]) => void;
  }) => (
    <button type="button" aria-label={placeholder} onClick={() => onChange?.(['PICKED'])}>
      {placeholder}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

const makeRoom = (overrides: Partial<ManagedRoom> = {}): ManagedRoom => ({
  id: 'room-1',
  name: 'ICU Room',
  organisationId: 'org-1',
  type: 'ICU',
  code: 'R-001',
  ...overrides,
});

describe('RoomInfoSections', () => {
  const makeProps = (mode: 'view' | 'edit' = 'view') => ({
    canEditRoom: true,
    customEquipmentName: '',
    equipmentLabel: 'Oxygen Tank',
    formData: makeRoom(),
    mode,
    openSections: { details: true, availability: true, units: true, equipment: true },
    roomTypeLabel: 'ICU',
    specialityLabel: 'Surgery',
    staffLabel: 'Dr. A',
    supportsUnits: true,
    totalUnits: 2,
    availabilityLabels: { days: 'Mon - Fri', species: 'Dogs', time: '09:00 - 17:00' },
    options: {
      equipment: ['Custom Pump'],
      specialities: [{ label: 'Surgery', value: 'spec-1' }],
      team: [{ label: 'Dr. A', value: 'staff-1' }],
    },
    onAddCustomEquipment: jest.fn(),
    onAddUnit: jest.fn(),
    onAvailabilityToggle: jest.fn(),
    onCustomEquipmentNameChange: jest.fn(),
    onFormChange: jest.fn(),
    onRoomTypeChange: jest.fn(),
    onToggleSection: jest.fn(),
    onUpdateAvailability: jest.fn(),
    onUpdateUnit: jest.fn(),
  });

  it('renders view-mode details, availability, units, and equipment', () => {
    const props = makeProps();
    props.formData = makeRoom({
      units: [{ id: 'u1', name: 'Kennel', size: 'Small', count: 2 }],
    });
    render(<RoomInfoSections {...props} />);

    expect(screen.getByText('ICU Room')).toBeInTheDocument();
    expect(screen.getByText('R-001')).toBeInTheDocument();
    expect(screen.getByText('ICU')).toBeInTheDocument();
    expect(screen.getAllByText('Surgery').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Mon - Fri')).toBeInTheDocument();
    expect(screen.getByText('Dr. A')).toBeInTheDocument();
    expect(screen.getAllByText('Kennel').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Oxygen Tank')).toBeInTheDocument();
    expect(screen.queryByText('No unit types configured.')).not.toBeInTheDocument();
  });

  it('falls back to dashes, the room id, and the empty-units message in view mode', () => {
    const props = makeProps();
    props.formData = makeRoom({ name: '', code: undefined, units: [] });
    render(<RoomInfoSections {...props} />);

    expect(screen.getByText('room-1')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('No unit types configured.')).toBeInTheDocument();
  });

  it('shows unit fallbacks and the unsupported-units message', () => {
    const props = makeProps();
    props.supportsUnits = false;
    props.formData = makeRoom({ units: [{ id: 'u1', name: '', size: '', count: 0 }] });
    render(<RoomInfoSections {...props} />);

    expect(screen.getByText('Unit type')).toBeInTheDocument();
    expect(
      screen.getByText('Select ICU, Inpatient, Isolation, or Boarding to configure unit types.')
    ).toBeInTheDocument();
  });

  it('toggles sections and availability from the headers', () => {
    const props = makeProps();
    render(<RoomInfoSections {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(props.onToggleSection).toHaveBeenCalledWith('details');
    fireEvent.click(screen.getByRole('button', { name: 'Availability' }));
    expect(props.onToggleSection).toHaveBeenCalledWith('availability');
    fireEvent.click(screen.getByRole('button', { name: 'Unit type (0)' }));
    expect(props.onToggleSection).toHaveBeenCalledWith('units');
    fireEvent.click(screen.getByRole('button', { name: 'Equipments / Capabilities' }));
    expect(props.onToggleSection).toHaveBeenCalledWith('equipment');

    fireEvent.click(screen.getByRole('switch', { name: 'Toggle room availability' }));
    expect(props.onAvailabilityToggle).toHaveBeenCalledWith(false);
  });

  it('edits detail, availability, unit, and equipment fields in edit mode', () => {
    const props = makeProps('edit');
    props.formData = makeRoom({
      availability: {
        isAvailable: false,
        days: 'MON_FRI',
        startTime: '09:00',
        endTime: '17:00',
        species: 'DOG',
        totalUnits: 3,
      },
      units: [{ id: 'u1', name: 'Kennel', size: 'Small', count: 2 }],
      equipment: ['Oxygen Tank'],
    });
    render(<RoomInfoSections {...props} />);

    // The Details section and the unit editor both render a "Name" input.
    const nameInputs = screen.getAllByLabelText('Name');
    fireEvent.change(nameInputs[0], { target: { value: 'New Room' } });
    expect(props.onFormChange).toHaveBeenCalledWith({ name: 'New Room' });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'R-002' } });
    expect(props.onFormChange).toHaveBeenCalledWith({ code: 'R-002' });
    fireEvent.click(screen.getByRole('button', { name: 'Room type option SURGERY' }));
    expect(props.onRoomTypeChange).toHaveBeenCalledWith('SURGERY');
    fireEvent.click(screen.getByRole('button', { name: 'Speciality (optional)' }));
    expect(props.onFormChange).toHaveBeenCalledWith({ assignedSpecialiteis: ['PICKED'] });

    fireEvent.click(screen.getByRole('button', { name: 'Days option MON_FRI' }));
    expect(props.onUpdateAvailability).toHaveBeenCalledWith({ days: 'MON_FRI' });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:00' } });
    expect(props.onUpdateAvailability).toHaveBeenCalledWith({ startTime: '10:00' });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '18:00' } });
    expect(props.onUpdateAvailability).toHaveBeenCalledWith({ endTime: '18:00' });
    fireEvent.click(screen.getByRole('button', { name: 'Species' }));
    expect(props.onUpdateAvailability).toHaveBeenCalledWith({ species: ['PICKED'] });
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: '4' } });
    expect(props.onUpdateAvailability).toHaveBeenCalledWith({ totalUnits: 4 });
    fireEvent.change(screen.getByLabelText('Total units'), { target: { value: 'abc' } });
    expect(props.onUpdateAvailability).toHaveBeenCalledWith({ totalUnits: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Assigned staff (optional)' }));
    expect(props.onFormChange).toHaveBeenCalledWith({ assignedStaffs: ['PICKED'] });

    fireEvent.click(screen.getByRole('button', { name: 'Add unit type' }));
    expect(props.onAddUnit).toHaveBeenCalledTimes(1);
    fireEvent.change(nameInputs[1], { target: { value: 'Ward' } });
    expect(props.onUpdateUnit).toHaveBeenCalledWith('u1', { name: 'Ward' });
    fireEvent.click(screen.getByRole('button', { name: 'Size option Large' }));
    expect(props.onUpdateUnit).toHaveBeenCalledWith('u1', { size: 'Large' });
    fireEvent.change(screen.getByLabelText('Units'), { target: { value: '6' } });
    expect(props.onUpdateUnit).toHaveBeenCalledWith('u1', { count: 6 });

    fireEvent.click(screen.getByRole('button', { name: 'Equipment' }));
    expect(props.onFormChange).toHaveBeenCalledWith({ equipment: ['PICKED'] });
    fireEvent.change(screen.getByLabelText('Add equipment name'), {
      target: { value: 'Ventilator' },
    });
    expect(props.onCustomEquipmentNameChange).toHaveBeenCalledWith('Ventilator');
    fireEvent.click(screen.getByRole('button', { name: 'Add custom equipment' }));
    expect(props.onAddCustomEquipment).toHaveBeenCalledTimes(1);
  });

  it('falls back to empty availability values in edit mode', () => {
    const props = makeProps('edit');
    props.formData = makeRoom({ code: undefined, availability: undefined, units: undefined });
    render(<RoomInfoSections {...props} />);

    expect(screen.getByLabelText('Room code')).toHaveValue('');
    expect(screen.getByLabelText('Start time')).toHaveValue('');
    expect(screen.getByLabelText('End time')).toHaveValue('');
    expect(screen.getByLabelText('Total units')).toHaveValue('0');
    expect(screen.getByRole('switch', { name: 'Toggle room availability' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText('No unit types configured.')).toBeInTheDocument();
  });

  it('handles array species and hides the units input when units are unsupported', () => {
    const props = makeProps('edit');
    props.supportsUnits = false;
    props.formData = makeRoom({
      availability: { species: ['DOG', 'CAT'] },
    });
    render(<RoomInfoSections {...props} />);

    expect(screen.queryByLabelText('Total units')).not.toBeInTheDocument();
    expect(
      screen.getByText('Units are available for ICU, Inpatient, Isolation, and Boarding rooms.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add unit type' })).not.toBeInTheDocument();
  });
});
