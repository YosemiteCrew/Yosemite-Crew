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

  const getEmergencyDot = (button: HTMLElement) =>
    Array.from(button.querySelectorAll('span')).find((span) =>
      span.className.includes('h-2.5')
    ) as HTMLElement;

  // --- 1. Rendering ---

  it('renders the month/year label correctly', () => {
    render(<Header {...defaultProps} />);

    // Expect mocked output
    expect(screen.getByText('January 2023')).toBeInTheDocument();

    // Verify helper was called with correct date
    expect(getMonthYear).toHaveBeenCalledWith(mockDate);
  });

  it('orders calendar controls from date through zoom actions', () => {
    render(
      <Header
        {...defaultProps}
        showAddButton
        onAddButtonClick={jest.fn()}
        activeCalendar="week"
        setActiveCalendar={jest.fn()}
        zoomMode="in"
        setZoomMode={jest.fn()}
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
    const viewSelector = screen.getByRole('button', { name: /week/i });
    const zoomInButton = screen.getByTitle('Zoom in timeline');

    expect(datepicker.compareDocumentPosition(monthLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(monthLabel.compareDocumentPosition(statusButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(statusButton.compareDocumentPosition(emergenciesPill)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(emergenciesPill.compareDocumentPosition(addAppointmentButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(addAppointmentButton.compareDocumentPosition(viewSelector)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(viewSelector.compareDocumentPosition(zoomInButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('renders the emergency pill with semantic styles and a stateful filled warning icon', () => {
    const { rerender } = render(
      <Header
        {...defaultProps}
        activeFilter="all"
        setActiveFilter={jest.fn()}
        hasEmergency
        filterOptions={[{ key: 'emergencies', name: 'Emergencies' }]}
      />
    );

    const inactiveIcon = screen.getByRole('button', { name: 'Emergencies' }).querySelector('svg');
    const inactivePill = screen.getByRole('button', { name: 'Emergencies' });
    const inactiveDot = getEmergencyDot(inactivePill);
    expect(inactivePill).toHaveClass('h-12');
    expect(inactivePill).toHaveStyle({
      backgroundColor: 'var(--color-neutral-0)',
      borderColor: 'var(--color-neutral-500)',
      color: 'var(--color-neutral-700)',
    });
    expect(inactivePill).toHaveClass('text-body-4');
    expect(inactiveIcon).toHaveAttribute('color', 'var(--color-neutral-700)');
    expect(inactiveDot.getAttribute('style')).toContain(
      'background-color: var(--color-semantic-error-700)'
    );
    expect(inactiveDot.getAttribute('style')).toContain('outline: 2px solid white');

    rerender(
      <Header
        {...defaultProps}
        activeFilter="emergencies"
        setActiveFilter={jest.fn()}
        hasEmergency
        filterOptions={[{ key: 'emergencies', name: 'Emergencies' }]}
      />
    );

    const activePill = screen.getByRole('button', { name: 'Emergencies' });
    const activeIcon = activePill.querySelector('svg');
    const activeDot = getEmergencyDot(activePill);
    expect(activePill).toHaveStyle({
      backgroundColor: 'var(--color-semantic-error-100)',
      borderColor: 'var(--color-semantic-error-500)',
      color: 'var(--color-semantic-error-700)',
    });
    expect(activeIcon).toHaveAttribute('color', 'var(--color-semantic-error-700)');
    expect(activeDot.getAttribute('style')).toContain(
      'background-color: var(--color-semantic-error-700)'
    );
    expect(activeDot.getAttribute('style')).toContain('outline: 2px solid white');
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
