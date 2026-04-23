import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TextRenderer from '@/app/features/forms/pages/Forms/Sections/AddForm/components/Text/TextRenderer';
import { FormField } from '@/app/features/forms/types/forms';

// --- Mock UI Components ---
// Mock FormDesc to capture props and allow interaction
jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <textarea data-testid="mock-textarea" value={value} onChange={onChange} aria-label={inlabel} />
  ),
}));

describe('TextRenderer Component', () => {
  const mockOnChange = jest.fn();

  const baseField = {
    id: 'text-1',
    type: 'textarea',
    label: 'Description',
    placeholder: 'Enter details',
  } as FormField & { type: 'textarea' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---

  it('renders correctly with provided value', () => {
    render(<TextRenderer field={baseField} value="User Input" onChange={mockOnChange} />);

    const textarea = screen.getByTestId('mock-textarea');
    expect(textarea).toBeInTheDocument();
    // When value is present, it should be used
    expect(textarea).toHaveValue('User Input');
    // Verify label passing
    expect(textarea).toHaveAttribute('aria-label', 'Description');
  });

  // --- Section 2: Value Fallback Logic ---

  it('renders empty string when value prop is empty — does not fall back to placeholder', () => {
    render(<TextRenderer field={baseField} value="" onChange={mockOnChange} />);

    const textarea = screen.getByTestId('mock-textarea');
    // Placeholder is hint text only — the field value must stay empty so users can clear it
    expect(textarea).toHaveValue('');
  });

  it('defaults to empty string if both value and placeholder are missing', () => {
    const emptyField = { ...baseField, placeholder: undefined } as any;

    render(<TextRenderer field={emptyField} value="" onChange={mockOnChange} />);

    const textarea = screen.getByTestId('mock-textarea');
    expect(textarea).toHaveValue('');
  });

  // --- Section 3: Interactions ---

  it('calls onChange when typing', () => {
    render(<TextRenderer field={baseField} value="" onChange={mockOnChange} />);

    const textarea = screen.getByTestId('mock-textarea');
    fireEvent.change(textarea, { target: { value: 'New Text' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('New Text');
  });

  // --- Section 4: Edge Cases ---

  it('handles missing label gracefully', () => {
    const fieldNoLabel = { ...baseField, label: undefined } as any;

    render(<TextRenderer field={fieldNoLabel} value="Content" onChange={mockOnChange} />);

    const textarea = screen.getByTestId('mock-textarea');
    // Should receive empty string for label
    expect(textarea).toHaveAttribute('aria-label', '');
  });
});
