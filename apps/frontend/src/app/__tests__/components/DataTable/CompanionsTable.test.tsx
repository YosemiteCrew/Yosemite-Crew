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

jest.mock('@/app/lib/date', () => ({
  getAgeInYears: jest.fn(() => '2y'),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: jest.fn(() => 'Jan 6, 2025'),
  formatTimeLabel: jest.fn(() => '10:00 AM'),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => 'image'),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitleCase: (value: string) => value.toUpperCase(),
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="table">
      {data.map((item: any) => (
        <div key={item.companion.name}>
          {columns.map((col: any) => (
            <div key={col.key || col.label}>{col.render ? col.render(item) : item[col.key]}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/cards/CompanionCard/CompanionCard', () => ({
  __esModule: true,
  default: ({ companion }: any) => (
    <div data-testid="companion-card">{companion.companion.name}</div>
  ),
}));

jest.mock('react-icons/fa', () => ({
  FaCalendar: () => <span>calendar-icon</span>,
  FaTasks: () => <span>task-icon</span>,
}));

jest.mock('react-icons/io5', () => ({
  IoEye: () => <span>view-icon</span>,
  IoOpenOutline: () => <span>open-icon</span>,
}));

jest.mock('react-icons/md', () => ({
  MdOutlineAutorenew: () => <span>status-icon</span>,
}));

describe('CompanionsTable', () => {
  const companion: any = {
    companion: {
      id: 'c1',
      name: 'Buddy',
      breed: 'Labrador',
      type: 'Dog',
      gender: 'Male',
      dateOfBirth: '2023-01-01',
      allergy: 'None',
      status: 'active',
      photoUrl: 'photo',
    },
    parent: { firstName: 'Sam' },
  };

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

  it('handles view, history, schedule, and task actions', () => {
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

    fireEvent.click(screen.getByText('view-icon').closest('button')!);
    fireEvent.click(screen.getByTitle('Open companion history'));
    fireEvent.click(screen.getByTitle('View history'));
    fireEvent.click(screen.getByTitle('Open appointment'));
    fireEvent.click(screen.getByText('status-icon').closest('button')!);
    fireEvent.click(screen.getByText('calendar-icon').closest('button')!);
    fireEvent.click(screen.getByText('task-icon').closest('button')!);

    expect(setActiveCompanion).toHaveBeenCalledWith(companion);
    expect(setViewCompanion).toHaveBeenCalledWith(true);
    expect(setCompanionInfoInitialLabel).toHaveBeenCalledWith('info');
    expect(setCompanionInfoInitialLabel).toHaveBeenCalledWith('history');
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);
    expect(setBookAppointment).toHaveBeenCalledWith(true);
    expect(setAddTask).toHaveBeenCalledWith(true);
    expect(pushMock).toHaveBeenCalledWith('/appointments?appointmentId=appt-1');
    expect(pushMock).toHaveBeenCalledWith(
      '/companions/history?companionId=c1&source=companions&backTo=%2Fcompanions%3FcompanionId%3Dc1'
    );
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

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});
