import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BuilderWrapper, {
  StructureLockContext,
} from '@/app/features/forms/pages/Forms/Sections/AddForm/components/BuildWrapper';
import { FormField } from '@/app/features/forms/types/forms';

// --- Mocks ---

// Partial mock of FormField to satisfy the component's requirements
const mockFieldBase: Partial<FormField> = {
  id: 'field-123',
  label: 'Test Label',
};

describe('BuilderWrapper Component', () => {
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title correctly (capitalizes field type)', () => {
    // Test with "input" -> Expect "Input"
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <BuilderWrapper field={field} onDelete={mockOnDelete}>
        <div>Child Content</div>
      </BuilderWrapper>
    );

    // Check for title capitalization
    expect(screen.getByText('Input')).toBeInTheDocument();

    // Check if children are rendered
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('renders a different title for a different field type', () => {
    // Test with "textarea" -> Expect "Textarea"
    const field: FormField = {
      ...mockFieldBase,
      type: 'textarea',
    } as FormField;

    render(
      <BuilderWrapper field={field} onDelete={mockOnDelete}>
        <div />
      </BuilderWrapper>
    );

    expect(screen.getByText('Textarea')).toBeInTheDocument();
  });

  it('calls onDelete when the delete button is clicked', () => {
    const field: FormField = {
      ...mockFieldBase,
      type: 'checkbox',
    } as FormField;

    render(
      <BuilderWrapper field={field} onDelete={mockOnDelete}>
        <div />
      </BuilderWrapper>
    );

    // Find the button. Since it wraps an icon, we can find it by the button role.
    const deleteButton = screen.getByRole('button');

    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('hides delete and move controls when the structure is locked (YC-default)', () => {
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <StructureLockContext.Provider value={true}>
        <BuilderWrapper
          field={field}
          onDelete={mockOnDelete}
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          canMoveUp
          canMoveDown
        >
          <div>Child Content</div>
        </BuilderWrapper>
      </StructureLockContext.Provider>
    );

    // Content stays editable, but no structural controls are exposed.
    expect(screen.getByText('Child Content')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Move up')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Move down')).not.toBeInTheDocument();
  });

  it('shows delete and move controls when the structure is unlocked', () => {
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <StructureLockContext.Provider value={false}>
        <BuilderWrapper
          field={field}
          onDelete={mockOnDelete}
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          canMoveUp
          canMoveDown
        >
          <div>Child Content</div>
        </BuilderWrapper>
      </StructureLockContext.Provider>
    );

    expect(screen.getByTitle('Move up')).toBeInTheDocument();
    expect(screen.getByTitle('Move down')).toBeInTheDocument();
    // up + down + delete
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
