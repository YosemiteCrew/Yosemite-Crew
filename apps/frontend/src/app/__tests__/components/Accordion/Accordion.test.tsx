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
});
