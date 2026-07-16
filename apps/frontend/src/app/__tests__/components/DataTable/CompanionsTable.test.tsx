import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionsTable from '@/app/ui/tables/CompanionsTable';

const useAppointmentsForPrimaryOrgMock = jest.fn();
const useIsPhoneMock = jest.fn();
const pushMock = jest.fn();
// Driven per-test so the species line can exercise its singular / plural /
// missing-age branches instead of always returning the same constant.
const formatCompanionAgeMock = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="mock-next-image">{alt || ''}</span>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsForPrimaryOrgMock(),
}));

jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  useIsPhone: () => useIsPhoneMock(),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

jest.mock('@/app/lib/date', () => ({
  formatCompanionAge: (dateOfBirth?: string) => formatCompanionAgeMock(dateOfBirth),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: jest.fn(() => 'Jan 6, 2025'),
  formatTimeLabel: jest.fn(() => '10:00 AM'),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => 'image'),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitleCase: (value: string) => value,
}));

jest.mock('react-icons/io5', () => ({
  IoCalendarOutline: () => <span>calendar-icon</span>,
  IoCheckmarkDoneOutline: () => <span>task-icon</span>,
  IoChevronForwardOutline: () => <span>chevron-icon</span>,
  IoEllipsisHorizontal: () => <span>kebab-icon</span>,
  IoPersonOutline: () => <span>person-icon</span>,
  IoReaderOutline: () => <span>reader-icon</span>,
  IoSwapHorizontalOutline: () => <span>swap-icon</span>,
}));

const baseProps = {
  setActiveCompanion: jest.fn(),
  setViewCompanion: jest.fn(),
  setBookAppointment: jest.fn(),
  setAddTask: jest.fn(),
  setChangeStatusPopup: jest.fn(),
  canEditAppointments: false,
  canEditTasks: false,
  canEditCompanions: false,
};

const companion: any = {
  companion: {
    id: 'c1',
    name: 'Buddy',
    breed: 'Labrador',
    type: 'dog',
    gender: 'Male',
    dateOfBirth: '2023-01-01',
    allergy: 'None',
    status: 'active',
    photoUrl: 'photo',
  },
  parent: { firstName: 'Sam', lastName: 'Owner' },
};

const openRowMenu = () =>
  fireEvent.click(screen.getAllByRole('button', { name: 'Companion row actions' })[0]);

describe('CompanionsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    formatCompanionAgeMock.mockReturnValue('2 Yrs');
    useIsPhoneMock.mockReturnValue(false);
    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);
  });

  it('opens overview, profile, appointment, task, and status actions from the row menu', () => {
    const setActiveCompanion = jest.fn();
    const setViewCompanion = jest.fn();
    const setCompanionInfoInitialLabel = jest.fn();
    const setBookAppointment = jest.fn();
    const setAddTask = jest.fn();
    const setChangeStatusPopup = jest.fn();

    render(
      <CompanionsTable
        {...baseProps}
        filteredList={[companion]}
        setActiveCompanion={setActiveCompanion}
        setViewCompanion={setViewCompanion}
        setCompanionInfoInitialLabel={setCompanionInfoInitialLabel}
        setBookAppointment={setBookAppointment}
        setAddTask={setAddTask}
        setChangeStatusPopup={setChangeStatusPopup}
        canEditAppointments
        canEditTasks
        canEditCompanions
      />
    );

    // Patient name link opens the companion overview/history page.
    fireEvent.click(screen.getByTitle('Open companion history'));

    openRowMenu();
    fireEvent.click(screen.getByText('Open overview'));

    openRowMenu();
    fireEvent.click(screen.getByText('View profile'));

    openRowMenu();
    fireEvent.click(screen.getByText('Book appointment'));

    openRowMenu();
    fireEvent.click(screen.getByText('Add task'));

    openRowMenu();
    fireEvent.click(screen.getByText('Change status'));

    expect(setActiveCompanion).toHaveBeenCalledWith(companion);
    expect(setViewCompanion).toHaveBeenCalledWith(true);
    expect(setCompanionInfoInitialLabel).toHaveBeenCalledWith('info');
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);
    expect(setBookAppointment).toHaveBeenCalledWith(true);
    expect(setAddTask).toHaveBeenCalledWith(true);
    expect(pushMock).toHaveBeenCalledWith(
      '/companions/history?companionId=c1&source=companions&backTo=%2Fcompanions'
    );
  });

  it('hides edit-gated actions when the user lacks permissions', () => {
    render(<CompanionsTable {...baseProps} filteredList={[companion]} />);

    openRowMenu();
    expect(screen.getByText('Open overview')).toBeInTheDocument();
    expect(screen.getByText('View profile')).toBeInTheDocument();
    expect(screen.queryByText('Book appointment')).not.toBeInTheDocument();
    expect(screen.queryByText('Add task')).not.toBeInTheDocument();
    expect(screen.queryByText('Change status')).not.toBeInTheDocument();
  });

  it('renders the species sub-line, patient id, breed and last visit', () => {
    // startTime is "now" so the last visit renders as Today · <time>.
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'appt-1',
        status: 'COMPLETED',
        startTime: new Date(),
        appointmentDate: new Date(),
        companion: { id: 'c1' },
      },
    ]);

    render(<CompanionsTable {...baseProps} filteredList={[companion]} />);

    expect(screen.getByText(/Dog/)).toBeInTheDocument();
    expect(screen.getByText('Labrador')).toBeInTheDocument();
    // Patient ID cell echoes the companion id.
    expect(screen.getByText('c1')).toBeInTheDocument();
    // Today's completed appointment surfaces as the last visit.
    expect(screen.getByText(/Today · 10:00 AM/)).toBeInTheDocument();
  });

  it('renders a formatted date for an older last visit and a dash when none', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'old',
        status: 'COMPLETED',
        startTime: new Date('2025-01-06T10:00:00.000Z'),
        appointmentDate: new Date('2025-01-06T10:00:00.000Z'),
        companion: { id: 'c1' },
      },
    ]);

    const { rerender } = render(<CompanionsTable {...baseProps} filteredList={[companion]} />);
    expect(screen.getByText('Jan 6, 2025')).toBeInTheDocument();

    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);
    rerender(<CompanionsTable {...baseProps} filteredList={[companion]} />);
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('shows the co-parent pill and the active status dot', () => {
    const coParented = {
      ...companion,
      companion: {
        ...companion.companion,
        parentLinks: [{ role: 'CO_PARENT', status: 'ACTIVE' }],
      },
    };
    render(<CompanionsTable {...baseProps} filteredList={[coParented]} />);

    expect(screen.getByText('+ CO-PARENT')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('fades inactive rows and defaults a missing status to inactive', () => {
    const inactive = {
      ...companion,
      companion: { ...companion.companion, status: undefined },
    };
    const { container } = render(<CompanionsTable {...baseProps} filteredList={[inactive]} />);

    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(container.innerHTML).toContain('opacity-[0.62]');
  });

  it('renders the grid view when viewMode is grid and its empty state', () => {
    const { rerender } = render(
      <CompanionsTable {...baseProps} filteredList={[companion]} viewMode="grid" />
    );
    // Grid card carries the name and the row menu.
    expect(screen.getByText(/Buddy/)).toBeInTheDocument();
    // The grid card name opens the companion overview.
    fireEvent.click(screen.getByTitle('Open companion history'));
    expect(pushMock).toHaveBeenCalled();
    openRowMenu();
    expect(screen.getByText('Open overview')).toBeInTheDocument();

    rerender(<CompanionsTable {...baseProps} filteredList={[]} viewMode="grid" />);
    expect(screen.getAllByText('No data available').length).toBeGreaterThan(0);
  });

  // Regression: the non-phone table used to carry the shared `.table-list`
  // class, which DataTable.css hides at max-width:1280 so that Appointments and
  // Tasks can swap to their `xl:hidden` card lists. CompanionsTable has no card
  // list and only swaps to cards below 768, so 768-1279 rendered a hidden table
  // and nothing else — a completely empty list body. It must own a class that no
  // 1280 rule hides.
  it('renders the tablet/desktop table under its own class, not the shared table-list', () => {
    const { container } = render(<CompanionsTable {...baseProps} filteredList={[companion]} />);

    expect(container.querySelector('.companions-table-list')).toBeInTheDocument();
    expect(container.querySelector('.table-list')).not.toBeInTheDocument();
  });

  it('renders the phone card variant and opens overview on tap', () => {
    useIsPhoneMock.mockReturnValue(true);
    render(<CompanionsTable {...baseProps} filteredList={[companion]} />);

    // No desktop table header on phone.
    expect(screen.queryByText('Patient ID')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Open companion history'));
    expect(pushMock).toHaveBeenCalledWith(
      '/companions/history?companionId=c1&source=companions&backTo=%2Fcompanions'
    );
  });

  it('shows the phone empty state', () => {
    useIsPhoneMock.mockReturnValue(true);
    render(<CompanionsTable {...baseProps} filteredList={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows the desktop empty state', () => {
    render(<CompanionsTable {...baseProps} filteredList={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('highlights the row while its menu is open and closes on outside click / scroll / resize', () => {
    render(<CompanionsTable {...baseProps} filteredList={[companion]} canEditCompanions />);

    openRowMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // A pointer-down on the trigger button itself is ignored (contains → return).
    fireEvent.mouseDown(screen.getAllByRole('button', { name: 'Companion row actions' })[0]);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // A pointer-down inside the panel is ignored too.
    fireEvent.mouseDown(screen.getByText('Open overview'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // A pointer-down outside closes the menu.
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Scrolling closes it.
    openRowMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Resizing closes it.
    openRowMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders a fallback species, no gender, and a singular year in the sub-line', () => {
    formatCompanionAgeMock.mockReturnValue('1 Yr');

    const oddCompanion: any = {
      companion: {
        id: 'rx',
        name: 'Thumper',
        breed: 'Lop',
        type: 'rabbit',
        dateOfBirth: '2024-01-01',
        status: 'active',
        photoUrl: 'photo',
      },
      parent: { firstName: 'A', lastName: 'B' },
    };

    render(<CompanionsTable {...baseProps} filteredList={[oddCompanion]} />);

    // Unknown species falls through to toTitleCase; no gender segment; singular "Yr".
    expect(screen.getByText('rabbit · 1 Yr')).toBeInTheDocument();
  });

  it('handles missing age, breed, parent name, and companion id', () => {
    formatCompanionAgeMock.mockReturnValue('');

    const sparse: any = {
      companion: {
        name: 'Ghost',
        breed: '',
        type: 'dog',
        gender: 'Male',
        dateOfBirth: 'not-a-date',
      },
      parent: {},
    };

    render(<CompanionsTable {...baseProps} filteredList={[sparse]} />);

    // Empty breed and parent both render the "-" placeholder.
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    // Missing status falls back to "inactive".
    expect(screen.getByText('inactive')).toBeInTheDocument();
    // Monogram fallback appears when there is no photoUrl.
    expect(screen.getByText('G')).toBeInTheDocument();

    // Clicking the name link with a blank id is a no-op (guard returns early).
    fireEvent.click(screen.getByTitle('Open companion history'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('renders pagination controls and navigates between pages', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      companion: {
        id: `id-${i}`,
        name: `Pet ${i}`,
        breed: 'Mix',
        type: 'dog',
        gender: 'Male',
        dateOfBirth: '2023-01-01',
        status: 'active',
        photoUrl: 'photo',
      },
      parent: { firstName: 'Sam', lastName: 'Owner' },
    }));

    render(<CompanionsTable {...baseProps} filteredList={many as any} />);

    // Page 1: previous disabled, page 1 marked current.
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');

    // Jump to page 2 via the numbered button.
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

    // Back to page 1 via the previous arrow.
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    // Forward again via the next arrow.
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('truncates a long patient id, blanks a missing breed, and reads a visit without a start time', () => {
    const longId = 'abcdefghij1234';
    // Appointment carries only appointmentDate (no startTime) so the last-visit
    // label exercises the `startTime ?? appointmentDate` fallback.
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'no-start',
        status: 'COMPLETED',
        appointmentDate: new Date('2025-01-06T10:00:00.000Z'),
        companion: { id: longId },
      },
    ]);

    const longIdCompanion: any = {
      companion: {
        id: longId,
        name: 'Rex',
        breed: undefined,
        type: 'dog',
        gender: 'Male',
        dateOfBirth: '2023-01-01',
        status: 'active',
        photoUrl: 'photo',
      },
      parent: { firstName: 'Sam', lastName: 'Owner' },
    };

    render(<CompanionsTable {...baseProps} filteredList={[longIdCompanion]} />);

    // Ids longer than 10 chars are truncated with an ellipsis.
    expect(screen.getByText('abcdefghij…')).toBeInTheDocument();
    // Missing breed (undefined) falls back to the "-" placeholder.
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    // The startTime-less appointment still resolves to a formatted date.
    expect(screen.getByText('Jan 6, 2025')).toBeInTheDocument();
  });

  it('fades an inactive grid card and keys it by name when the id is missing', () => {
    const inactiveNoId: any = {
      companion: {
        name: 'Nimbus',
        breed: 'Ragdoll',
        type: 'cat',
        gender: 'Female',
        dateOfBirth: '2022-01-01',
        status: undefined,
      },
      parent: { firstName: 'Ivy', lastName: 'Stone' },
    };

    const { container } = render(
      <CompanionsTable {...baseProps} filteredList={[inactiveNoId]} viewMode="grid" />
    );

    // Missing status defaults to inactive and fades the card.
    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(container.innerHTML).toContain('opacity-[0.62]');
    expect(screen.getByText(/Nimbus/)).toBeInTheDocument();
  });

  it('renders an inactive, co-parented phone card with a missing id and blank breed', () => {
    useIsPhoneMock.mockReturnValue(true);

    const phoneEdgeCase: any = {
      companion: {
        name: 'Willow',
        breed: undefined,
        type: 'dog',
        gender: 'Female',
        dateOfBirth: '2021-01-01',
        status: undefined,
        parentLinks: [{ role: 'CO_PARENT', status: 'ACTIVE' }],
      },
      parent: { firstName: 'Rob', lastName: 'Fields' },
    };

    const { container } = render(<CompanionsTable {...baseProps} filteredList={[phoneEdgeCase]} />);

    // Co-parent pill shows in the phone card, status falls back to inactive,
    // the card fades, and the subline still renders (blank breed dropped).
    expect(screen.getByText('+ CO-PARENT')).toBeInTheDocument();
    expect(screen.getByText(/inactive/)).toBeInTheDocument();
    expect(container.innerHTML).toContain('opacity-[0.62]');
    expect(screen.getByText(/Willow/)).toBeInTheDocument();
  });

  it('leaves the row menu closed when the trigger has no measurable rect', () => {
    const rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(undefined as unknown as DOMRect);

    render(<CompanionsTable {...baseProps} filteredList={[companion]} canEditCompanions />);

    openRowMenu();
    // position() bails on the missing rect, so no portal panel is positioned.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    rectSpy.mockRestore();
  });
});
