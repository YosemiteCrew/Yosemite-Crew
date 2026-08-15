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
    const viewSelector = screen.getByRole('button', { name: 'Week' });
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

  // --- 1b. Date nav pill + Today (moved here from the grid headers) ---

  it('steps the current date by a day from the nav pill outside the week view', () => {
    render(<Header {...defaultProps} activeCalendar="team" setActiveCalendar={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));

    const prevFn = mockSetCurrentDate.mock.calls[0][0];
    const nextFn = mockSetCurrentDate.mock.calls[1][0];

    expect(prevFn(new Date(2025, 0, 6)).getDate()).toBe(5);
    expect(nextFn(new Date(2025, 0, 6)).getDate()).toBe(7);
  });

  it('steps whole weeks from the nav pill when the week view owns the week start', () => {
    const setWeekStart = jest.fn();
    render(
      <Header
        {...defaultProps}
        activeCalendar="week"
        setActiveCalendar={jest.fn()}
        setWeekStart={setWeekStart}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    // The week setter runs an updater that also syncs the current date.
    const prevFn = setWeekStart.mock.calls[0][0];
    const nextFn = setWeekStart.mock.calls[1][0];
    const base = new Date('2025-01-06T00:00:00.000Z');

    expect(prevFn(base).getDate()).toBe(30); // 30 Dec
    expect(nextFn(base).getDate()).toBe(13); // 13 Jan
    expect(mockSetCurrentDate).toHaveBeenCalledTimes(2);
  });

  it('falls back to day stepping in the week view when no week setter is supplied', () => {
    render(<Header {...defaultProps} activeCalendar="week" setActiveCalendar={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(mockSetCurrentDate.mock.calls[0][0](new Date(2025, 0, 6)).getDate()).toBe(7);
  });

  it('jumps to today and realigns the week start', () => {
    const setWeekStart = jest.fn();
    render(
      <Header
        {...defaultProps}
        activeCalendar="week"
        setActiveCalendar={jest.fn()}
        setWeekStart={setWeekStart}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(mockSetCurrentDate).toHaveBeenCalledWith(expect.any(Date));
    // Week views re-anchor to the Monday of the current week.
    expect(setWeekStart).toHaveBeenCalledWith(expect.any(Date));
    expect(setWeekStart.mock.calls[0][0].getDay()).toBe(1);
  });

  it('leaves the week start alone when jumping to today without a week setter', () => {
    render(<Header {...defaultProps} />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Today' }))).not.toThrow();
    expect(mockSetCurrentDate).toHaveBeenCalledTimes(1);
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

    expect(screen.getByTitle('Pending')).toHaveClass('text-[10px]', 'uppercase');
    expect(screen.getByTitle('Pending')).toHaveStyle({
      backgroundColor: 'var(--color-badge-slate-bg)',
    });

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

    // Active non-emergency pill fills with --inset behind a --divider outline and
    // steps its label to --ink 700, per the planner's filter row.
    const allPillActive = screen.getByRole('button', { name: 'All' });
    expect(allPillActive).toHaveClass('bg-[var(--inset)]', 'font-bold', 'text-[var(--ink)]');
    expect(allPillActive).toHaveStyle({ borderColor: 'var(--divider)' });

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

    // Inactive non-emergency pill falls back to a bare --hairline outline with
    // --ink-muted 600 type.
    const allPillInactive = screen.getByRole('button', { name: 'All' });
    expect(allPillInactive).toHaveClass('text-[var(--ink-muted)]', 'font-semibold');
    expect(allPillInactive).toHaveStyle({ borderColor: 'var(--hairline)' });

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

  it('falls back to the first status option when the active status matches none', () => {
    render(<Header {...defaultProps} activeStatus="missing" statusOptions={statusOptions} />);

    // selectedStatus falls back to statusOptions[0] ('all') → neutral trigger.
    expect(screen.getByRole('button', { name: /All statuses/i })).toBeInTheDocument();
  });

  it('keeps the selected status chevron inside the coloured pill', () => {
    render(
      <Header
        {...defaultProps}
        activeStatus="scheduled"
        setActiveStatus={jest.fn()}
        statusOptions={statusOptions}
      />
    );

    const trigger = screen.getByRole('button', { name: /Scheduled/i });
    const pill = screen.getByText('Scheduled').closest('span');

    expect(trigger.children).toHaveLength(1);
    expect(pill).toHaveStyle({ backgroundColor: '#eef' });
    expect(pill?.querySelector('svg')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    // Selecting a different view transitions to it.
    fireEvent.click(screen.getByText('Day').closest('button') as HTMLElement);
    expect(setActiveCalendar).toHaveBeenCalledWith('day');

    setActiveCalendar.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
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
