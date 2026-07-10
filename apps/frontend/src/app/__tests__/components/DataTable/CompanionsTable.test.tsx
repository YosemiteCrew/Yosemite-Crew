import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionsTable from '@/app/ui/tables/CompanionsTable';

const useAppointmentsForPrimaryOrgMock = jest.fn();
const pushMock = jest.fn();
// Driven per-test so the species line can exercise its singular / plural /
// missing-age branches instead of always returning the same constant.
const getAgeInYearsMock = jest.fn();

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

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

jest.mock('@/app/lib/date', () => ({
  getAgeInYears: (dateOfBirth?: string) => getAgeInYearsMock(dateOfBirth),
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

jest.mock('@/app/ui/cards/CompanionCard/CompanionCard', () => ({
  __esModule: true,
  default: ({ companion }: any) => (
    <div data-testid="companion-card">{companion.companion.name}</div>
  ),
}));

jest.mock('react-icons/io5', () => ({
  IoCalendarOutline: () => <span>calendar-icon</span>,
  IoCheckmarkDoneOutline: () => <span>task-icon</span>,
  IoEllipsisHorizontal: () => <span>kebab-icon</span>,
  IoOpenOutline: () => <span>open-icon</span>,
  IoPersonOutline: () => <span>person-icon</span>,
  IoReaderOutline: () => <span>reader-icon</span>,
  IoSwapHorizontalOutline: () => <span>swap-icon</span>,
}));

describe('CompanionsTable', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Companion row actions' }));

  beforeEach(() => {
    jest.clearAllMocks();
    getAgeInYearsMock.mockReturnValue(2);
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'appt-1',
        status: 'UPCOMING',
        appointmentDate: new Date('2025-01-06T10:00:00.000Z'),
        startTime: new Date('2025-01-06T10:00:00.000Z'),
        companion: { id: 'c1', name: 'Buddy' },
      },
    ]);
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
    // Upcoming visit cell opens the linked appointment.
    fireEvent.click(screen.getByTitle('Open appointment'));

    // Row overflow menu carries every companion action.
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
    expect(pushMock).toHaveBeenCalledWith('/appointments?appointmentId=appt-1');
    expect(pushMock).toHaveBeenCalledWith(
      '/companions/history?companionId=c1&source=companions&backTo=%2Fcompanions'
    );
  });

  it('hides edit-gated actions when the user lacks permissions', () => {
    render(
      <CompanionsTable
        filteredList={[companion]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

    openRowMenu();
    expect(screen.getByText('Open overview')).toBeInTheDocument();
    expect(screen.getByText('View profile')).toBeInTheDocument();
    expect(screen.queryByText('Book appointment')).not.toBeInTheDocument();
    expect(screen.queryByText('Add task')).not.toBeInTheDocument();
    expect(screen.queryByText('Change status')).not.toBeInTheDocument();
  });

  it('renders the species sub-line for the patient cell', () => {
    render(
      <CompanionsTable
        filteredList={[companion]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

    expect(screen.getByText(/Canine/)).toBeInTheDocument();
  });

  it('shows empty state for mobile list', () => {
    render(
      <CompanionsTable
        filteredList={[]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

    expect(screen.getAllByText('No data available').length).toBeGreaterThan(0);
  });

  it('keeps the row menu open on inside interaction and closes it on outside click / scroll / resize', () => {
    render(
      <CompanionsTable
        filteredList={[companion]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments
        canEditTasks
        canEditCompanions
      />
    );

    openRowMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // A pointer-down on the trigger button itself is ignored (contains → return).
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Companion row actions' }));
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

  it('sorts multiple upcoming appointments and links to the earliest future one', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'a-late',
        status: 'UPCOMING',
        appointmentDate: new Date('2999-02-01T10:00:00.000Z'),
        startTime: new Date('2999-02-01T10:00:00.000Z'),
        companion: { id: 'c1' },
      },
      {
        // No startTime → the sort/find fall back to appointmentDate.
        id: 'a-early',
        status: 'REQUESTED',
        appointmentDate: new Date('2999-01-01T09:00:00.000Z'),
        companion: { id: 'c1' },
      },
    ]);

    render(
      <CompanionsTable
        filteredList={[companion]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

    fireEvent.click(screen.getByTitle('Open appointment'));
    expect(pushMock).toHaveBeenCalledWith('/appointments?appointmentId=a-early');
  });

  it('falls back to the first related appointment when none are in the future', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([
      {
        id: 'past-late',
        status: 'UPCOMING',
        appointmentDate: new Date('2000-01-02T10:00:00.000Z'),
        startTime: new Date('2000-01-02T10:00:00.000Z'),
        companion: { id: 'c1' },
      },
      {
        id: 'past-early',
        status: 'UPCOMING',
        appointmentDate: new Date('2000-01-01T10:00:00.000Z'),
        startTime: new Date('2000-01-01T10:00:00.000Z'),
        companion: { id: 'c1' },
      },
    ]);

    render(
      <CompanionsTable
        filteredList={[companion]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

    // No future match → find returns undefined → falls back to the earliest (sorted first).
    fireEvent.click(screen.getByTitle('Open appointment'));
    expect(pushMock).toHaveBeenCalledWith('/appointments?appointmentId=past-early');
  });

  it('renders a fallback species, no gender, and a singular year in the sub-line', () => {
    getAgeInYearsMock.mockReturnValue(1);
    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);

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

    render(
      <CompanionsTable
        filteredList={[oddCompanion]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

    // Unknown species falls through to toTitleCase; no gender segment; singular "Yr".
    expect(screen.getByText('rabbit · 1 Yr')).toBeInTheDocument();
  });

  it('handles missing age, breed, parent name, status, and companion id', () => {
    getAgeInYearsMock.mockReturnValue(Number.NaN);
    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);

    const sparse: any = {
      companion: {
        name: 'Ghost',
        breed: '',
        type: 'dog',
        gender: 'Male',
        dateOfBirth: 'not-a-date',
        photoUrl: 'photo',
      },
      parent: {},
    };

    render(
      <CompanionsTable
        filteredList={[sparse]}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

    // Empty breed and parent both render the "-" placeholder; missing upcoming too.
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    // Missing status falls back to "inactive".
    expect(screen.getByText('inactive')).toBeInTheDocument();

    // Clicking the name link with a blank id is a no-op (guard returns early).
    fireEvent.click(screen.getByTitle('Open companion history'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('renders pagination controls and navigates between pages', () => {
    useAppointmentsForPrimaryOrgMock.mockReturnValue([]);

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

    render(
      <CompanionsTable
        filteredList={many as any}
        setActiveCompanion={jest.fn()}
        setViewCompanion={jest.fn()}
        setBookAppointment={jest.fn()}
        setAddTask={jest.fn()}
        setChangeStatusPopup={jest.fn()}
        canEditAppointments={false}
        canEditTasks={false}
        canEditCompanions={false}
      />
    );

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
});
