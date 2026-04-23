import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Header from '@/app/features/appointments/components/Calendar/common/Header';

// --- Mocks ---

// Mock Helper
jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  getMonthYear: jest.fn(() => 'January 2023'),
}));
import { getMonthYear } from '@/app/features/appointments/components/Calendar/helpers';

jest.mock('@/app/ui/inputs/Datepicker', () => () => <div data-testid="datepicker" />);
jest.mock('@/app/ui/inputs/Dropdown', () => () => <div data-testid="dropdown" />);
jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Header Component', () => {
  const mockSetCurrentDate = jest.fn();
  const mockDate = new Date('2023-01-15T00:00:00.000Z');

  const defaultProps = {
    currentDate: mockDate,
    setCurrentDate: mockSetCurrentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it('renders the month/year label correctly', () => {
    render(<Header {...defaultProps} />);

    // Expect mocked output
    expect(screen.getByText('January 2023')).toBeInTheDocument();

    // Verify helper was called with correct date
    expect(getMonthYear).toHaveBeenCalledWith(mockDate);
  });

  it('renders the month label before the emergencies toggle and places status before add appointment', () => {
    render(
      <Header
        {...defaultProps}
        showAddButton
        onAddButtonClick={jest.fn()}
        activeFilter="all"
        setActiveFilter={jest.fn()}
        activeStatus="scheduled"
        setActiveStatus={jest.fn()}
        filterOptions={[{ key: 'emergencies', name: 'Emergencies' }]}
        statusOptions={[{ key: 'scheduled', name: 'Scheduled' }]}
      />
    );

    const emergenciesPill = screen.getByRole('button', { name: 'Emergencies' });
    const monthLabel = screen.getByText('January 2023');
    const statusButton = screen.getByRole('button', { name: /Scheduled/i });
    const addAppointmentButton = screen.getByRole('button', { name: 'Add Appointment' });
    const datepicker = screen.getByTestId('datepicker');

    expect(monthLabel.compareDocumentPosition(emergenciesPill)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(statusButton.compareDocumentPosition(addAppointmentButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(addAppointmentButton.compareDocumentPosition(datepicker)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('keeps the calendar header sticky at the top of the planner', () => {
    const { container } = render(<Header {...defaultProps} />);

    expect(container.firstChild).toHaveClass('sticky', 'top-0', 'bg-white');
  });

  it('uses readable dropdown text when a status pill uses light text tokens', () => {
    render(
      <Header
        {...defaultProps}
        activeStatus="pending"
        setActiveStatus={jest.fn()}
        statusOptions={[
          {
            key: 'pending',
            name: 'Pending',
            bg: 'var(--color-badge-slate-bg)',
            text: 'var(--color-badge-light-text)',
            dropdownText: 'var(--color-badge-slate-bg)',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Pending/i }));

    expect(screen.getAllByText('Pending')[1]).toHaveStyle({
      color: 'var(--color-badge-slate-bg)',
    });
  });
});
