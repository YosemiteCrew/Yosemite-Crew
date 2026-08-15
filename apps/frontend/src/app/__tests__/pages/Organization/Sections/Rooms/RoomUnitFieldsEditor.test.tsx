import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoomUnitFieldsEditor from '@/app/features/organization/pages/Organization/Sections/Rooms/RoomUnitFieldsEditor';
import { RoomUnitSizeOptions } from '@/app/features/organization/pages/Organization/types';

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
    <div>
      <label htmlFor={`fi-${inlabel}`}>{inlabel}</label>
      <input
        id={`fi-${inlabel}`}
        aria-label={inlabel}
        type="text"
        value={value}
        onChange={onChange ?? (() => {})}
      />
    </div>
  ),
}));

// LabelDropdown renders its option panel through a portal that never mounts in
// jsdom, so it is mocked as a native select (frontend-testing skill gotcha).
jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({
    placeholder,
    options,
    onSelect,
  }: {
    placeholder: string;
    options: { value: string; label: string }[];
    onSelect: (o: { value: string; label: string }) => void;
  }) => (
    <div>
      <label htmlFor={`dd-${placeholder}`}>{placeholder}</label>
      <select
        id={`dd-${placeholder}`}
        aria-label={placeholder}
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value);
          if (opt) onSelect(opt);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

describe('RoomUnitFieldsEditor', () => {
  const unit = { id: 'unit-1', name: 'Kennel A', size: 'Small', count: 2 };
  const onUpdateUnit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the unit name, size options, and count', () => {
    render(<RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Kennel A');
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(screen.getByLabelText('Units')).toHaveValue('2');
  });

  it('patches the unit name on change', () => {
    render(<RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ward B' } });
    expect(onUpdateUnit).toHaveBeenCalledWith('unit-1', { name: 'Ward B' });
  });

  it('patches the unit size on select', () => {
    render(<RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />);
    fireEvent.change(screen.getByLabelText('Size'), {
      target: { value: RoomUnitSizeOptions[2].value },
    });
    expect(onUpdateUnit).toHaveBeenCalledWith('unit-1', { size: 'Large' });
  });

  it('patches the unit count with a valid number', () => {
    render(<RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />);
    fireEvent.change(screen.getByLabelText('Units'), { target: { value: '5' } });
    expect(onUpdateUnit).toHaveBeenCalledWith('unit-1', { count: 5 });
  });

  it('clamps a non-numeric count to 0', () => {
    render(<RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />);
    fireEvent.change(screen.getByLabelText('Units'), { target: { value: 'abc' } });
    expect(onUpdateUnit).toHaveBeenCalledWith('unit-1', { count: 0 });
  });

  it('clamps a negative count to 0', () => {
    render(<RoomUnitFieldsEditor unit={unit} onUpdateUnit={onUpdateUnit} />);
    fireEvent.change(screen.getByLabelText('Units'), { target: { value: '-3' } });
    expect(onUpdateUnit).toHaveBeenCalledWith('unit-1', { count: 0 });
  });
});
