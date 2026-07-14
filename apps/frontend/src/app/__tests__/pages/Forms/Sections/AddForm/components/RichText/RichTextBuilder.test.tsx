import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RichTextBuilder from '@/app/features/forms/pages/Forms/Sections/AddForm/components/RichText/RichTextBuilder';
import { StructureLockContext } from '@/app/features/forms/pages/Forms/Sections/AddForm/components/structureLockContext';
import { FormField } from '@/app/features/forms/types/forms';

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, inlabel }: any) => (
    <input data-testid="mock-label-input" value={value} onChange={onChange} aria-label={inlabel} />
  ),
}));

jest.mock('@/app/ui/primitives/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: ({ value, onChange, ariaLabel, placeholder }: any) => (
    <textarea
      data-testid="mock-rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      placeholder={placeholder}
    />
  ),
}));

describe('RichTextBuilder', () => {
  const mockOnChange = jest.fn();
  const mockField = {
    id: 'rt-1',
    type: 'richtext',
    label: 'Notes',
    defaultValue: '<p>hello</p>',
  } as FormField & { type: 'richtext' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders an editable label input and the rich text editor when structure is not locked', () => {
    render(<RichTextBuilder field={mockField} onChange={mockOnChange} />);
    expect(screen.getByTestId('mock-label-input')).toHaveValue('Notes');
    expect(screen.getByTestId('mock-rich-text-editor')).toHaveValue('<p>hello</p>');
  });

  it('falls back to "Rich text" default label when field.label is empty', () => {
    const emptyLabelField = { ...mockField, label: '' };
    render(<RichTextBuilder field={emptyLabelField} onChange={mockOnChange} />);
    expect(screen.getByTestId('mock-rich-text-editor')).toHaveAttribute(
      'aria-label',
      'Rich text default content'
    );
  });

  it('renders a read-only heading label instead of the input when structure is locked', () => {
    render(
      <StructureLockContext.Provider value={true}>
        <RichTextBuilder field={mockField} onChange={mockOnChange} />
      </StructureLockContext.Provider>
    );
    expect(screen.queryByTestId('mock-label-input')).not.toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('calls onChange with updated label when the label input changes', () => {
    render(<RichTextBuilder field={mockField} onChange={mockOnChange} />);
    fireEvent.change(screen.getByTestId('mock-label-input'), {
      target: { value: 'Updated label' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({ ...mockField, label: 'Updated label' });
  });

  it('calls onChange with updated defaultValue when the editor content changes', () => {
    render(<RichTextBuilder field={mockField} onChange={mockOnChange} />);
    fireEvent.change(screen.getByTestId('mock-rich-text-editor'), {
      target: { value: '<p>updated</p>' },
    });
    expect(mockOnChange).toHaveBeenCalledWith({ ...mockField, defaultValue: '<p>updated</p>' });
  });

  it('renders an empty editor value when defaultValue is not a string', () => {
    const numericDefault = { ...mockField, defaultValue: 42 as unknown as string };
    render(<RichTextBuilder field={numericDefault} onChange={mockOnChange} />);
    expect(screen.getByTestId('mock-rich-text-editor')).toHaveValue('');
  });
});
