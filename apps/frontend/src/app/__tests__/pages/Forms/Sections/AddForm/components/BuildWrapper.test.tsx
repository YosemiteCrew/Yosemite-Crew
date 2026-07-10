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

  it('runs the full drag lifecycle and builds a drag preview when draggable and unlocked', () => {
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;
    const onDragStart = jest.fn();
    const onDragOver = jest.fn();
    const onDrop = jest.fn();
    const onDragEnd = jest.fn();

    render(
      <BuilderWrapper
        field={field}
        onDelete={mockOnDelete}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <div>Child Content</div>
      </BuilderWrapper>
    );

    const section = screen.getByLabelText('Input field');
    const dataTransfer = { setData: jest.fn(), setDragImage: jest.fn() };

    // canDrag is true (draggable && unlocked) so the wrapper wires its own handlers:
    // dragStart clones the row into an off-screen preview + forwards onDragStart.
    fireEvent.dragStart(section, { dataTransfer, clientX: 10, clientY: 12 });
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(dataTransfer.setDragImage).toHaveBeenCalled();

    fireEvent.dragOver(section, { dataTransfer });
    expect(onDragOver).toHaveBeenCalledTimes(1);

    fireEvent.drop(section, { dataTransfer });
    expect(onDrop).toHaveBeenCalledTimes(1);

    // dragEnd cleans up the live preview node and forwards onDragEnd.
    fireEvent.dragEnd(section, { dataTransfer });
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('early-returns from drag start with no handler and cleans up when no preview exists', () => {
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    // draggable + unlocked wires the handlers, but no onDragStart/onDragEnd are supplied.
    render(
      <BuilderWrapper field={field} onDelete={mockOnDelete} draggable>
        <div>Child Content</div>
      </BuilderWrapper>
    );

    const section = screen.getByLabelText('Input field');
    const dataTransfer = { setData: jest.fn(), setDragImage: jest.fn() };

    // handleDragStart bails at `if (!onDragStart) return` before building a preview.
    fireEvent.dragStart(section, { dataTransfer });
    expect(dataTransfer.setDragImage).not.toHaveBeenCalled();

    // handleDragEndInternal cleans up with a null preview ref and skips the optional onDragEnd.
    fireEvent.dragEnd(section, { dataTransfer });
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('keeps the delete control for content items even when the structure is locked', () => {
    const field: FormField = { ...mockFieldBase, type: 'group' } as FormField;

    render(
      <StructureLockContext.Provider value={true}>
        <BuilderWrapper
          field={field}
          onDelete={mockOnDelete}
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          canMoveUp
          canMoveDown
          contentDeletable
        >
          <div>Child Content</div>
        </BuilderWrapper>
      </StructureLockContext.Provider>
    );

    // (!structureLocked || contentDeletable) is true → delete stays; move stays hidden (locked).
    const deleteButton = screen.getByRole('button');
    fireEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle('Move up')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Move down')).not.toBeInTheDocument();
  });

  it('disables move controls at the list boundaries', () => {
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <StructureLockContext.Provider value={false}>
        <BuilderWrapper
          field={field}
          onDelete={mockOnDelete}
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          canMoveUp={false}
          canMoveDown={false}
        >
          <div />
        </BuilderWrapper>
      </StructureLockContext.Provider>
    );

    expect(screen.getByTitle('Move up')).toBeDisabled();
    expect(screen.getByTitle('Move down')).toBeDisabled();
  });

  it('renders the compact, dragging variant', () => {
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <BuilderWrapper field={field} onDelete={mockOnDelete} draggable compact isDragging>
        <div>Child Content</div>
      </BuilderWrapper>
    );

    const section = screen.getByLabelText('Input field');
    // compact base radius + the isDragging override are both applied.
    expect(section.className).toContain('rounded-[14px]');
    expect(section.className).toContain('rounded-[18px]');
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });
});
