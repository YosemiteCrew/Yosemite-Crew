import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BuilderWrapper from '@/app/features/forms/pages/Forms/Sections/AddForm/components/BuildWrapper';
import { StructureLockContext } from '@/app/features/forms/pages/Forms/Sections/AddForm/components/structureLockContext';
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

  it('calls onMoveUp/onMoveDown when their buttons are clicked and disables them when not allowed', () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <BuilderWrapper
        field={field}
        onDelete={mockOnDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={false}
        canMoveDown={false}
      >
        <div />
      </BuilderWrapper>
    );

    const upButton = screen.getByTitle('Move up');
    const downButton = screen.getByTitle('Move down');
    expect(upButton).toBeDisabled();
    expect(downButton).toBeDisabled();

    fireEvent.click(upButton);
    fireEvent.click(downButton);
    // disabled buttons don't fire onClick in jsdom
    expect(onMoveUp).not.toHaveBeenCalled();
    expect(onMoveDown).not.toHaveBeenCalled();
  });

  it('invokes onMoveUp/onMoveDown when enabled', () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <BuilderWrapper
        field={field}
        onDelete={mockOnDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp
        canMoveDown
      >
        <div />
      </BuilderWrapper>
    );

    fireEvent.click(screen.getByTitle('Move up'));
    fireEvent.click(screen.getByTitle('Move down'));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('shows delete-only controls for content items while structure is locked (contentDeletable)', () => {
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
          contentDeletable
        >
          <div>Child Content</div>
        </BuilderWrapper>
      </StructureLockContext.Provider>
    );

    // Move controls stay hidden even when contentDeletable, but delete is shown.
    expect(screen.queryByTitle('Move up')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Move down')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button'));
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('applies compact styling and drag-related props when draggable and unlocked', () => {
    const onDragOver = jest.fn();
    const onDrop = jest.fn();
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <StructureLockContext.Provider value={false}>
        <BuilderWrapper
          field={field}
          onDelete={mockOnDelete}
          draggable
          onDragStart={jest.fn()}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={jest.fn()}
          isDragging
          compact
        >
          <div>Child Content</div>
        </BuilderWrapper>
      </StructureLockContext.Provider>
    );

    const section = screen.getByLabelText('Input field');
    expect(section).toHaveAttribute('draggable', 'true');
    expect(section.className).toContain('rounded-xl');
  });

  it('does not set draggable when structure is locked, even if draggable prop is true', () => {
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <StructureLockContext.Provider value={true}>
        <BuilderWrapper field={field} onDelete={mockOnDelete} draggable contentDeletable>
          <div>Child Content</div>
        </BuilderWrapper>
      </StructureLockContext.Provider>
    );

    const section = screen.getByLabelText('Input field');
    expect(section).not.toHaveAttribute('draggable');
  });

  it('creates and cleans up a drag preview clone on dragStart/dragEnd', () => {
    const onDragStart = jest.fn();
    const onDragEnd = jest.fn();
    const field: FormField = { ...mockFieldBase, type: 'input' } as FormField;

    render(
      <BuilderWrapper
        field={field}
        onDelete={mockOnDelete}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div>Child Content</div>
      </BuilderWrapper>
    );

    const section = screen.getByLabelText('Input field');
    const dataTransfer = { setDragImage: jest.fn() };

    fireEvent.dragStart(section, { dataTransfer, clientX: 10, clientY: 10 });
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(dataTransfer.setDragImage).toHaveBeenCalled();
    expect(document.body.querySelectorAll('[style*="-9999px"]').length).toBeGreaterThan(0);

    fireEvent.dragEnd(section);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(document.body.querySelectorAll('[style*="-9999px"]').length).toBe(0);
  });
});
