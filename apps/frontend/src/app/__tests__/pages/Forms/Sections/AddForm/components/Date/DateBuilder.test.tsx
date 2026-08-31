import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DateBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Date/DateBuilder';
import { FormField } from '@/app/features/forms/types/forms';

// --- Mock UI Components ---
// Mock FormInput to test logic without relying on implementation details
jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <input
      data-testid={`input-${inlabel}`}
      value={value}
      onChange={onChange}
      placeholder={inlabel}
    />
  ),
}));

describe('DateBuilder Component', () => {
  const mockOnChange = jest.fn();

  // Test data strictly typed to match the component's expected prop
  const mockField = {
    id: 'date-123',
    type: 'date',
    label: 'Date of Birth',
    placeholder: 'Select a date',
  } as FormField & { type: 'date' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it('renders correctly with initial values', () => {
    render(<DateBuilder field={mockField} onChange={mockOnChange} />);

    // Verify Label Input
    const labelInput = screen.getByTestId('input-Label');
    expect(labelInput).toBeInTheDocument();
    expect(labelInput).toHaveValue('Date of Birth');
  });

  it('offers no Placeholder box, even for a field that stores one', () => {
    // The box used to sit under the Label and was dead copy: DateRenderer never
    // forwards field.placeholder, FormInput has no placeholder prop, and a native
    // date input ignores the attribute. Authors filled it in for nothing.
    render(<DateBuilder field={mockField} onChange={mockOnChange} />);

    expect(screen.queryByTestId('input-Placeholder')).toBeNull();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  // --- Section 2: Props Handling (Edge Cases) ---

  it('handles an undefined label gracefully', () => {
    const emptyField = {
      id: 'date-empty',
      type: 'date',
    } as FormField & { type: 'date' }; // Missing label

    render(<DateBuilder field={emptyField} onChange={mockOnChange} />);

    expect(screen.getByTestId('input-Label')).toHaveValue('');
  });

  // --- Section 3: Interactions ---

  it('calls onChange when label input is updated', () => {
    render(<DateBuilder field={mockField} onChange={mockOnChange} />);

    const labelInput = screen.getByTestId('input-Label');
    fireEvent.change(labelInput, { target: { value: 'Updated Label' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    // The whole field goes back, so a placeholder stored before the box was
    // removed is preserved rather than dropped by an unrelated label edit.
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockField,
      label: 'Updated Label',
    });
  });
});
