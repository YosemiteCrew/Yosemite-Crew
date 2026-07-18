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
      span.className.includes('size-2.5')
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
    const addAppointmentButton = screen.getByRole('button', { name: 'New appointment' });
    const datepicker = screen.getByTestId('datepicker');
    const viewSelector = screen.getByRole('button', { name: /week/i });
    const zoomInButton = screen.getByTitle('Zoom in timeline');

    // Design order: date -> view segmented pill -> status -> emergencies -> new appointment -> zoom.
    expect(datepicker.compareDocumentPosition(monthLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(monthLabel.compareDocumentPosition(viewSelector)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(viewSelector.compareDocumentPosition(statusButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(statusButton.compareDocumentPosition(emergenciesPill)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(emergenciesPill.compareDocumentPosition(addAppointmentButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(addAppointmentButton.compareDocumentPosition(zoomInButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('renders the emergency pill as a slim danger-outlined pill with a leading dot', () => {
    const { rerender } = render(
      <Header
        {...defaultProps}
        activeFilter="all"
        setActiveFilter={jest.fn()}
        hasEmergency
        filterOptions={[{ key: 'emergencies', name: 'Emergencies' }]}
      />
    );

    // Design recipe: rounded-full pill, no icon glyph, danger tokens, transparent when inactive.
    const inactivePill = screen.getByRole('button', { name: 'Emergencies' });
    expect(inactivePill).toHaveClass('rounded-full!');
    expect(inactivePill).not.toHaveClass('h-12');
    expect(inactivePill.querySelector('svg')).toBeNull();
    expect(inactivePill.getAttribute('style')).toContain('background-color: transparent');
    expect(inactivePill.getAttribute('style')).toContain('border-color: var(--danger-border)');
    expect(inactivePill.getAttribute('style')).toContain('color: var(--danger-text)');
    // Top-right presence dot uses --danger with a --screen outline.
    const inactiveDot = getEmergencyDot(inactivePill);
    expect(inactiveDot.getAttribute('style')).toContain('background-color: var(--danger)');
    expect(inactiveDot.getAttribute('style')).toContain('outline: 2px solid var(--screen)');

    rerender(
      <Header
        {...defaultProps}
        activeFilter="emergencies"
        setActiveFilter={jest.fn()}
        hasEmergency
        filterOptions={[{ key: 'emergencies', name: 'Emergencies' }]}
      />
    );

    // Active emergency filter is a solid danger-800 fill with a white label (AA-safe
    // in both themes) so selected/unselected are unmistakable. The old translucent
    // danger-bg tint + `text-danger-500!` label failed WCAG AA in dark mode (#1885).
    const activePill = screen.getByRole('button', { name: 'Emergencies' });
    expect(activePill.getAttribute('style')).toContain('background-color: var(--color-danger-800)');
    expect(activePill.getAttribute('style')).toContain('border-color: var(--color-danger-800)');
    expect(activePill.getAttribute('style')).toContain('color: var(--color-white)');
    // The `!important` danger-500 label class must be gone so the inline white wins.
    expect(activePill).not.toHaveClass('text-danger-500!');
  });

  it('keeps the calendar header sticky at the top of the planner', () => {
    const { container } = render(<Header {...defaultProps} />);

    expect(container.firstChild).toHaveClass('sticky', 'top-0', 'bg-neutral-0');
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

  // --- 2. Filter pills ---

  it('styles active/inactive filter pills and toggles the active filter', () => {
    const setActiveFilter = jest.fn();
    const filterOptions = [
      { key: 'all', name: 'All' },
      { key: 'emergencies', name: 'Emergencies' },
    ];

    const { rerender } = render(
      <Header
        {...defaultProps}
        activeFilter="all"
        setActiveFilter={setActiveFilter}
        hasEmergency
        filterOptions={filterOptions}
      />
    );

    // Active non-emergency pill uses the brand/blue treatment and the brand border.
    const allPillActive = screen.getByRole('button', { name: 'All' });
    expect(allPillActive).toHaveClass('bg-blue-light');
    expect(allPillActive).toHaveStyle({ borderColor: 'var(--color-text-brand)' });

    // Clicking an inactive pill selects it; clicking the active pill resets to 'all'.
    fireEvent.click(screen.getByRole('button', { name: 'Emergencies' }));
    expect(setActiveFilter).toHaveBeenCalledWith('emergencies');
    fireEvent.click(allPillActive);
    expect(setActiveFilter).toHaveBeenCalledWith('all');

    rerender(
      <Header
        {...defaultProps}
        activeFilter="emergencies"
        setActiveFilter={setActiveFilter}
        hasEmergency
        filterOptions={filterOptions}
      />
    );

    // Inactive non-emergency pill falls back to the muted tertiary treatment and card border.
    const allPillInactive = screen.getByRole('button', { name: 'All' });
    expect(allPillInactive).toHaveClass('text-text-tertiary');
    expect(allPillInactive).toHaveStyle({ borderColor: 'var(--color-card-border)' });

    // Active emergency pill draws its label colour from the inline style (white on
    // danger-800), so it no longer carries the AA-failing `text-danger-500!` class.
    const activeEmergencyPill = screen.getByRole('button', { name: 'Emergencies' });
    expect(activeEmergencyPill).not.toHaveClass('text-danger-500!');
    expect(activeEmergencyPill.getAttribute('style')).toContain('color: var(--color-white)');
  });

  it('ignores filter toggles when no setter is provided', () => {
    render(<Header {...defaultProps} filterOptions={[{ key: 'all', name: 'All' }]} />);

    // No setActiveFilter: clicking must be a no-op rather than throwing.
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'All' }))).not.toThrow();
  });

  // --- 3. Status filter dropdown ---

  const statusOptions = [
    { key: 'all', name: 'Status' },
    { key: 'scheduled', name: 'Scheduled', bg: '#eef', text: '#123', border: '#abc' },
  ];

  it('shows the neutral status trigger style when the selected option has no background', () => {
    render(<Header {...defaultProps} activeStatus="all" statusOptions={statusOptions} />);

    const trigger = screen.getByRole('button', { name: /All statuses/i });
    expect(trigger).toHaveStyle({ borderColor: 'var(--hairline)' });
  });

  // Trigger + open panel both render the label text; when open there are two matches.
  const statusOptionButton = (label: string) =>
    screen.getAllByText(label).at(-1)!.closest('button') as HTMLElement;

  it('selects a status option and closes the dropdown', () => {
    const setActiveStatus = jest.fn();
    render(
      <Header
        {...defaultProps}
        activeStatus="scheduled"
        setActiveStatus={setActiveStatus}
        statusOptions={statusOptions}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Scheduled/i }));
    expect(screen.getAllByText('Scheduled')).toHaveLength(2); // trigger + option
    fireEvent.click(statusOptionButton('Scheduled'));

    expect(setActiveStatus).toHaveBeenCalledWith('scheduled');
    expect(screen.getAllByText('Scheduled')).toHaveLength(1); // closed → trigger only
  });

  it('does not throw when selecting a status option without a setter', () => {
    render(<Header {...defaultProps} activeStatus="all" statusOptions={statusOptions} />);

    // Selected 'all' → trigger reads 'Status'; the panel adds the 'Scheduled' option.
    fireEvent.click(screen.getByRole('button', { name: /Status/i }));
    expect(() => fireEvent.click(statusOptionButton('Scheduled'))).not.toThrow();
  });

  it('closes the status dropdown on outside click but keeps it open for inside interactions', () => {
    render(
      <Header
        {...defaultProps}
        activeStatus="scheduled"
        setActiveStatus={jest.fn()}
        statusOptions={statusOptions}
      />
    );

    const trigger = screen.getByRole('button', { name: /Scheduled/i });
    fireEvent.click(trigger);
    const isOpen = () => screen.getAllByText('Scheduled').length === 2;
    expect(isOpen()).toBe(true);

    // Mousedown on the trigger / inside the panel keeps the dropdown open.
    fireEvent.mouseDown(trigger);
    expect(isOpen()).toBe(true);
    fireEvent.mouseDown(statusOptionButton('Scheduled'));
    expect(isOpen()).toBe(true);

    // Mousedown elsewhere closes it.
    fireEvent.mouseDown(document.body);
    expect(isOpen()).toBe(false);
  });

  it('closes the status dropdown on scroll', () => {
    render(
      <Header
        {...defaultProps}
        activeStatus="scheduled"
        setActiveStatus={jest.fn()}
        statusOptions={statusOptions}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Scheduled/i }));
    expect(screen.getAllByText('Scheduled')).toHaveLength(2);

    fireEvent.scroll(window);
    expect(screen.getAllByText('Scheduled')).toHaveLength(1);
  });

  // --- 4. Calendar view dropdown ---

  it('selects a different calendar view and ignores re-selecting the active view', () => {
    const setActiveCalendar = jest.fn();
    render(
      <Header {...defaultProps} activeCalendar="week" setActiveCalendar={setActiveCalendar} />
    );

    fireEvent.click(screen.getByRole('button', { name: /week/i }));
    // Selecting a different view transitions to it.
    fireEvent.click(screen.getByText('Day').closest('button') as HTMLElement);
    expect(setActiveCalendar).toHaveBeenCalledWith('day');

    setActiveCalendar.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /week/i }));
    // Re-selecting the already active view is a no-op.
    fireEvent.click(screen.getAllByText('Week').at(-1)!.closest('button') as HTMLElement);
    expect(setActiveCalendar).not.toHaveBeenCalled();
  });

  // --- 5. Zoom toggle ---

  it('renders the zoom toggle in zoomed-out mode and switches modes', () => {
    const setZoomMode = jest.fn();
    render(<Header {...defaultProps} zoomMode="out" setZoomMode={setZoomMode} />);

    const zoomOutButton = screen.getByTitle('Zoom out timeline');
    expect(zoomOutButton).toHaveClass('bg-neutral-0');

    fireEvent.click(screen.getByTitle('Zoom in timeline'));
    expect(setZoomMode).toHaveBeenCalledWith('in');
    fireEvent.click(zoomOutButton);
    expect(setZoomMode).toHaveBeenCalledWith('out');
  });
});
