import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import GenericTablePagination from '@/app/components/GenericTable/GenericTablePagination';

jest.mock('react-bootstrap', () => ({
  Button: jest.fn(({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )),
}));

jest.mock('react-icons/fi', () => ({
  FiArrowLeft: () => <svg>Prev</svg>,
  FiArrowRight: () => <svg>Next</svg>,
}));

describe('GenericTablePagination Component', () => {
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    mockOnPageChange.mockClear();
  });

  it('should not render if there is only one page', () => {
    const { container } = render(
      <GenericTablePagination
        currentPage={1}
        totalPages={1}
        totalItems={10}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should not render if there are no items', () => {
    const { container } = render(
      <GenericTablePagination
        currentPage={1}
        totalPages={5}
        totalItems={0}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render correctly on the first page', () => {
    render(
      <GenericTablePagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByText((content, element) => element?.textContent === "Showing 1 of 50")).toBeInTheDocument();
    expect(screen.getByText('Prev').closest('button')).toBeDisabled();
    expect(screen.getByText('Next').closest('button')).not.toBeDisabled();
  });

  it('should render correctly on a middle page', () => {
    render(
      <GenericTablePagination
        currentPage={3}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByText((content, element) => element?.textContent === "Showing 21 of 50")).toBeInTheDocument();
    expect(screen.getByText('Prev').closest('button')).not.toBeDisabled();
    expect(screen.getByText('Next').closest('button')).not.toBeDisabled();
  });

  it('should render correctly on the last page', () => {
    render(
      <GenericTablePagination
        currentPage={5}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByText((content, element) => element?.textContent === "Showing 41 of 50")).toBeInTheDocument();
    expect(screen.getByText('Prev').closest('button')).not.toBeDisabled();
    expect(screen.getByText('Next').closest('button')).toBeDisabled();
  });

  it('should call onPageChange with the correct page number when "Next" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GenericTablePagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );

    const nextButton = screen.getByText('Next').closest('button')!;
    await user.click(nextButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('should call onPageChange with the correct page number when "Prev" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GenericTablePagination
        currentPage={4}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );

    const prevButton = screen.getByText('Prev').closest('button')!;
    await user.click(prevButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('should not call onPageChange if "Prev" is clicked on the first page', async () => {
    const user = userEvent.setup();
    render(
      <GenericTablePagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );

    const prevButton = screen.getByText('Prev').closest('button')!;
    if (!prevButton.hasAttribute('disabled')) {
        await user.click(prevButton);
    }

    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it('should not call onPageChange if "Next" is clicked on the last page', async () => {
    const user = userEvent.setup();
    render(
      <GenericTablePagination
        currentPage={5}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    );

    const nextButton = screen.getByText('Next').closest('button')!;
    if (!nextButton.hasAttribute('disabled')) {
        await user.click(nextButton);
    }

    expect(mockOnPageChange).not.toHaveBeenCalled();
  });

  it('should apply a custom className', () => {
    const { container } = render(
      <GenericTablePagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        className="my-custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});

