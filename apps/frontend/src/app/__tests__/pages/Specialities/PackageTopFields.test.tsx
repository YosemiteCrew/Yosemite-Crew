import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PackageTopFields from '@/app/features/organization/pages/Specialities/PackageTopFields';

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({
    placeholder,
    onSelect,
  }: {
    placeholder: string;
    onSelect: (o: { value: string }) => void;
  }) => (
    <button type="button" onClick={() => onSelect({ value: `picked-${placeholder}` })}>
      {`dropdown-${placeholder}`}
    </button>
  ),
}));

describe('PackageTopFields', () => {
  const defaultProps = {
    name: 'Package A',
    onNameChange: jest.fn(),
    nameError: undefined,
    description: 'Package description',
    onDescriptionChange: jest.fn(),
    descId: 'pkg-desc',
    durationText: '60 mins',
    onDurationTextChange: jest.fn(),
    durationTextError: undefined,
    leadCount: '1',
    onLeadCountSelect: jest.fn(),
    supportCount: '2',
    onSupportCountSelect: jest.fn(),
    effectiveBookable: true,
    requiredBookable: false,
    onIsBookableChange: jest.fn(),
    effectiveInpatientPreferred: false,
    requiredInpatient: false,
    onIsInpatientPreferredChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders name, description, and duration values', () => {
    render(<PackageTopFields {...defaultProps} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Package A');
    expect(screen.getByLabelText('Description')).toHaveValue('Package description');
    expect(screen.getByLabelText('Approx. duration')).toHaveValue('60 mins');
  });

  it('propagates name and description changes', () => {
    render(<PackageTopFields {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Package B' } });
    expect(defaultProps.onNameChange).toHaveBeenCalledWith('Package B');
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New desc' } });
    expect(defaultProps.onDescriptionChange).toHaveBeenCalledWith('New desc');
  });

  it('propagates duration text changes', () => {
    render(<PackageTopFields {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Approx. duration'), { target: { value: '90 mins' } });
    expect(defaultProps.onDurationTextChange).toHaveBeenCalledWith('90 mins');
  });

  it('selects lead and support counts', () => {
    render(<PackageTopFields {...defaultProps} />);
    fireEvent.click(screen.getByText('dropdown-Lead'));
    expect(defaultProps.onLeadCountSelect).toHaveBeenCalledWith('picked-Lead');
    fireEvent.click(screen.getByText('dropdown-Support'));
    expect(defaultProps.onSupportCountSelect).toHaveBeenCalledWith('picked-Support');
  });

  it('toggles the bookable checkbox', () => {
    render(<PackageTopFields {...defaultProps} />);
    const checkbox = screen.getByLabelText('Package bookable');
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(defaultProps.onIsBookableChange).toHaveBeenCalledWith(false);
  });

  it('toggles the in-patient checkbox', () => {
    render(<PackageTopFields {...defaultProps} />);
    const checkbox = screen.getByLabelText('Package in-patient');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(defaultProps.onIsInpatientPreferredChange).toHaveBeenCalledWith(true);
  });

  it('disables the checkboxes when they are required by the breakdown', () => {
    render(<PackageTopFields {...defaultProps} requiredBookable requiredInpatient />);
    expect(screen.getByLabelText('Package bookable')).toBeDisabled();
    expect(screen.getByLabelText('Package in-patient')).toBeDisabled();
  });

  it('shows name and duration errors', () => {
    render(
      <PackageTopFields
        {...defaultProps}
        nameError="Name is required."
        durationTextError="Enter a duration."
      />
    );
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a duration.')).toBeInTheDocument();
  });
});
