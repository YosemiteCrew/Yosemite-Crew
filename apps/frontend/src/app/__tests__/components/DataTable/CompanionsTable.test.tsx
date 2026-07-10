import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionsTable from '@/app/ui/tables/CompanionsTable';

const useAppointmentsForPrimaryOrgMock = jest.fn();
const pushMock = jest.fn();

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
  getAgeInYears: jest.fn(() => 2),
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
});
