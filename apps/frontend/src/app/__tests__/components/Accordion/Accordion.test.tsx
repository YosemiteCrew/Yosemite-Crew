import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-icons/ri', () => ({
  RiEdit2Fill: () => <span data-testid="edit-icon">edit</span>,
}));

jest.mock('react-icons/md', () => ({
  MdDeleteForever: () => <span data-testid="delete-icon">delete</span>,
}));

jest.mock('react-icons/io', () => ({
  IoIosArrowDown: ({ className }: { className?: string }) => (
    <span data-testid="arrow" className={className} />
  ),
  IoIosAdd: () => <span data-testid="add-icon">add</span>,
}));

import Accordion from '@/app/ui/primitives/Accordion/Accordion';

describe('<Accordion />', () => {
  test('renders title and children when defaultOpen is true', () => {
    render(
      <Accordion title="Details" defaultOpen>
        <div data-testid="accordion-content">Content</div>
      </Accordion>
    );

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
    expect(screen.getByTestId('arrow')).toHaveClass('rotate-0');
  });

  test('toggles visibility when header button is clicked', () => {
    render(
      <Accordion title="Toggle me">
        <div data-testid="accordion-content">Hidden content</div>
      </Accordion>
    );

    expect(screen.queryByTestId('accordion-content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle me' }));
    expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle me' }));
    expect(screen.queryByTestId('accordion-content')).not.toBeInTheDocument();
  });

  test('clicking edit button opens accordion and calls onEditClick', () => {
    const onEditClick = jest.fn();
    render(
      <Accordion title="Edit me" onEditClick={onEditClick}>
        <div data-testid="accordion-content">Editable</div>
      </Accordion>
    );

    const editButton = screen.getByRole('button', { name: 'Edit Edit me' });
    fireEvent.click(editButton);
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
  });

  test.each([['Enter'], [' ']])(
    'pressing "%s" on the edit button opens the accordion and calls onEditClick',
    (key) => {
      const onEditClick = jest.fn();
      render(
        <Accordion title="Edit me" onEditClick={onEditClick}>
          <div data-testid="accordion-content">Editable</div>
        </Accordion>
      );

      fireEvent.keyDown(screen.getByRole('button', { name: 'Edit Edit me' }), { key });

      expect(onEditClick).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
    }
  );

  test('ignores other keys on the edit button', () => {
    const onEditClick = jest.fn();
    render(
      <Accordion title="Edit me" onEditClick={onEditClick}>
        <div data-testid="accordion-content">Editable</div>
      </Accordion>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Edit Edit me' }), { key: 'Escape' });

    expect(onEditClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId('accordion-content')).not.toBeInTheDocument();
  });

  test('keyboard edit works when no onEditClick handler is supplied', () => {
    render(
      <Accordion title="Edit me">
        <div data-testid="accordion-content">Editable</div>
      </Accordion>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Edit Edit me' }), { key: 'Enter' });

    expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
  });

  test('clicking the delete button calls onDeleteClick without toggling', () => {
    const onDeleteClick = jest.fn();
    render(
      <Accordion title="Delete me" showDeleteIcon onDeleteClick={onDeleteClick}>
        <div data-testid="accordion-content">Deletable</div>
      </Accordion>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Delete me' }));

    expect(onDeleteClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('accordion-content')).not.toBeInTheDocument();
  });

  test.each([['Enter'], [' ']])('pressing "%s" on the delete button calls onDeleteClick', (key) => {
    const onDeleteClick = jest.fn();
    render(
      <Accordion title="Delete me" showDeleteIcon onDeleteClick={onDeleteClick}>
        <div>Deletable</div>
      </Accordion>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Delete Delete me' }), { key });

    expect(onDeleteClick).toHaveBeenCalledTimes(1);
  });

  test('ignores other keys on the delete button', () => {
    const onDeleteClick = jest.fn();
    render(
      <Accordion title="Delete me" showDeleteIcon onDeleteClick={onDeleteClick}>
        <div>Deletable</div>
      </Accordion>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Delete Delete me' }), { key: 'Escape' });

    expect(onDeleteClick).not.toHaveBeenCalled();
  });

  test('delete button is safe to activate without an onDeleteClick handler', () => {
    render(
      <Accordion title="Delete me" showDeleteIcon>
        <div>Deletable</div>
      </Accordion>
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete Delete me' });
    expect(() => {
      fireEvent.click(deleteButton);
      fireEvent.keyDown(deleteButton, { key: 'Enter' });
    }).not.toThrow();
  });

  test('hides edit and delete icons while editing', () => {
    render(
      <Accordion title="Busy" showDeleteIcon isEditing>
        <div>Content</div>
      </Accordion>
    );

    expect(screen.queryByRole('button', { name: 'Edit Busy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Busy' })).not.toBeInTheDocument();
  });

  test('notifies onOpenChange in uncontrolled mode', () => {
    const onOpenChange = jest.fn();
    render(
      <Accordion title="Notify" onOpenChange={onOpenChange}>
        <div data-testid="accordion-content">Content</div>
      </Accordion>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
  });

  test('respects the controlled open prop and does not manage its own state', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <Accordion title="Controlled" open={false} onOpenChange={onOpenChange}>
        <div data-testid="accordion-content">Content</div>
      </Accordion>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Controlled' }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    // Still closed: the parent owns the state.
    expect(screen.queryByTestId('accordion-content')).not.toBeInTheDocument();

    rerender(
      <Accordion title="Controlled" open onOpenChange={onOpenChange}>
        <div data-testid="accordion-content">Content</div>
      </Accordion>
    );
    expect(screen.getByTestId('accordion-content')).toBeInTheDocument();
  });

  test('renders no content panel when children is an empty array', () => {
    const { container } = render(
      <Accordion title="Empty" defaultOpen>
        {[]}
      </Accordion>
    );

    expect(container.querySelector('.rounded-b-2xl')).not.toBeInTheDocument();
  });

  test('renders no content panel when there are no children', () => {
    const { container } = render(<Accordion title="Childless" defaultOpen />);

    expect(container.querySelector('.rounded-b-2xl')).not.toBeInTheDocument();
  });

  test('renders a content panel for a non-empty array of children', () => {
    render(
      <Accordion title="Many" defaultOpen>
        <div data-testid="first">One</div>
        <div data-testid="second">Two</div>
      </Accordion>
    );

    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.getByTestId('second')).toBeInTheDocument();
  });

  test('applies a custom title class', () => {
    render(<Accordion title="Styled" titleClassName="text-body-9" />);

    expect(screen.getByText('Styled')).toHaveClass('text-body-9');
  });

  test('renders a right element', () => {
    render(<Accordion title="With right" rightElement={<span data-testid="right">R</span>} />);

    expect(screen.getByTestId('right')).toBeInTheDocument();
  });
});
