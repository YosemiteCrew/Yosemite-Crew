import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Appointment } from '@yosemite-crew/types';
import type { Task } from '@/app/features/tasks/types/task';

import PhoneCalendar, {
  type PhoneCalendarProps,
} from '@/app/features/appointments/components/Calendar/responsive/PhoneCalendar';
import { useTasksAssignedToUser } from '@/app/hooks/useTask';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('next/image', () => ({
  __esModule: true,

  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('@/app/hooks/useTask', () => ({
  useLoadTasksForPrimaryOrg: jest.fn(),
  useTasksAssignedToUser: jest.fn(),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  changeTaskStatus: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/lib/timezone', () => ({
  ...jest.requireActual('@/app/lib/timezone'),
  getPreferredTimeZone: jest.fn(() => 'Asia/Kolkata'),
}));

const localDate = (day: number, hour: number, minutes = 0): Date =>
  new Date(2026, 6, day, hour, minutes);

const NOW = localDate(7, 10, 20);
const at = (hours: number, minutes = 0) => localDate(7, hours, minutes);

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment =>
  ({
    id: 'appt-1',
    patient: {
      id: 'pet-1',
      name: 'Pretzel',
      species: 'dog',
      parent: { id: 'parent-1', name: 'Lena Fischer' },
    },
    organisationId: 'org-1',
    appointmentDate: at(9),
    startTime: at(9),
    timeSlot: '09:00',
    durationMinutes: 30,
    endTime: at(9, 30),
    status: 'UPCOMING',
    lead: { id: 'vet-1', name: 'Dr Weber' },
    appointmentType: { id: 'svc-1', name: 'ear recheck', speciality: { id: 'sp-1', name: 'Gen' } },
    ...overrides,
  }) as Appointment;

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    _id: 'task-1',
    assignedTo: 'vet-1',
    audience: 'EMPLOYEE_TASK',
    source: 'CUSTOM',
    category: 'CARE',
    name: 'Call Lena',
    companionId: 'pet-1',
    dueAt: at(13),
    status: 'PENDING',
    ...overrides,
  }) as Task;

const notifyMock = jest.fn();
const setCurrentDate = jest.fn();
const setWeekStart = jest.fn();
const setActiveCalendar = jest.fn();
const onSelectAppointment = jest.fn();
const onOpenWorkspace = jest.fn();
const onCreateFromCalendarSlot = jest.fn();

const appointments = [makeAppointment()];

const renderCalendar = (overrides: Partial<PhoneCalendarProps> = {}) =>
  render(
    <PhoneCalendar
      appointments={appointments}
      dayEvents={appointments}
      currentDate={localDate(7, 0)}
      setCurrentDate={setCurrentDate}
      weekStart={localDate(6, 12)}
      setWeekStart={setWeekStart}
      activeCalendar="day"
      setActiveCalendar={setActiveCalendar}
      onSelectAppointment={onSelectAppointment}
      onOpenWorkspace={onOpenWorkspace}
      onCreateFromCalendarSlot={onCreateFromCalendarSlot}
      canEditAppointments
      currentUserPractitionerId="vet-1"
      now={NOW}
      {...overrides}
    />
  );

describe('PhoneCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    (useTasksAssignedToUser as jest.Mock).mockReturnValue([makeTask()]);
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', practionerId: 'vet-1', name: 'Sarah Weber' },
    ]);
    (useCompanionsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'pet-1', name: 'Pretzel' }]);
    (changeTaskStatus as jest.Mock).mockResolvedValue({});
  });

  describe('day view', () => {
    it('renders the day rail with its own chrome and the booked count', () => {
      renderCalendar();

      expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
      expect(screen.getByText('Tue 7 Jul · Sarah Weber · 1 booked')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Day schedule' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pretzel/ })).toBeInTheDocument();
    });

    it('expands the day rail window to cover out-of-hours appointments', () => {
      renderCalendar({
        dayEvents: [
          makeAppointment({ id: 'early', startTime: at(7), endTime: at(8) }),
          // Invalid end (midnight <= start) falls back to a one-hour span, pushing
          // the window end to 20:00.
          makeAppointment({ id: 'late', startTime: at(19), endTime: at(0) }),
        ],
      });

      // Default window is 08:00-16:00; it should now stretch to 07:00-20:00.
      expect(screen.getByText('07:00')).toBeInTheDocument();
      expect(screen.getByText('20:00')).toBeInTheDocument();
    });

    it('stretches the day rail window to midnight for overnight appointments', () => {
      renderCalendar({
        dayEvents: [
          // 21:00 -> 01:00 the next day: the end rolls past midnight, so the window
          // must reach end-of-day (old code capped it at start + 1h = 22:00).
          makeAppointment({ id: 'overnight', startTime: at(21), endTime: localDate(8, 1) }),
        ],
      });

      // Only reachable when the overnight branch extends the window to 24:00.
      expect(screen.getByText('23:00')).toBeInTheDocument();
    });

    it('opens an appointment through the page callback', async () => {
      renderCalendar();

      await userEvent.click(screen.getByRole('button', { name: /Pretzel/ }));

      expect(onSelectAppointment).toHaveBeenCalledWith(appointments[0]);
    });

    it('starts a visit through the workspace callback for checked-in appointments', async () => {
      const checkedIn = makeAppointment({ id: 'appt-2', status: 'CHECKED_IN' });
      renderCalendar({ appointments: [checkedIn], dayEvents: [checkedIn] });

      await userEvent.click(screen.getByRole('button', { name: 'Start visit' }));

      expect(onOpenWorkspace).toHaveBeenCalledWith(checkedIn);
    });

    it('books into a folded band at the fold start minute', async () => {
      renderCalendar();

      await userEvent.click(screen.getAllByRole('button', { name: 'Book' })[0]);

      expect(onCreateFromCalendarSlot).toHaveBeenCalledWith({
        date: new Date(2026, 6, 7),
        minuteOfDay: expect.any(Number),
      });
    });

    it('hides booking when the user cannot edit appointments', () => {
      renderCalendar({ canEditAppointments: false });

      expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument();
    });

    it('falls back to a bare date label when the user is not on the team', () => {
      (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
      renderCalendar();

      expect(screen.getByText('Tue 7 Jul · 1 booked')).toBeInTheDocument();
    });
  });

  describe('view switching', () => {
    it('switches to the week overview and pushes week up to the shared calendar', async () => {
      renderCalendar();

      await userEvent.click(screen.getByRole('button', { name: 'Week' }));

      expect(setActiveCalendar).toHaveBeenCalledWith('week');
      expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
    });

    it('switches to the month overview without pushing month up to the shared calendar', async () => {
      renderCalendar();

      await userEvent.click(screen.getByRole('button', { name: 'Month' }));

      expect(setActiveCalendar).not.toHaveBeenCalled();
      expect(screen.getByRole('region', { name: 'Month overview' })).toBeInTheDocument();
    });

    it('seeds the week overview from an active week calendar', () => {
      renderCalendar({ activeCalendar: 'week' });

      expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    });

    it('seeds My day from the shared team calendar', () => {
      renderCalendar({ activeCalendar: 'team' });

      expect(screen.getByRole('region', { name: 'My day' })).toBeInTheDocument();
    });

    // The desktop Header is not rendered on phone, so the clinic views must
    // carry their own way back into My day or it becomes unreachable.
    it('enters My day from the day rail', async () => {
      renderCalendar();

      await userEvent.click(screen.getByRole('button', { name: 'My day' }));

      expect(setActiveCalendar).toHaveBeenCalledWith('team');
      expect(screen.getByRole('region', { name: 'My day' })).toBeInTheDocument();
    });

    it('enters My day from the week overview', async () => {
      renderCalendar({ activeCalendar: 'week' });

      await userEvent.click(screen.getByRole('button', { name: 'My day' }));

      expect(screen.getByRole('region', { name: 'My day' })).toBeInTheDocument();
    });

    it('enters My day from the month overview', async () => {
      renderCalendar();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));

      await userEvent.click(screen.getByRole('button', { name: 'My day' }));

      expect(screen.getByRole('region', { name: 'My day' })).toBeInTheDocument();
    });
  });

  describe('week overview', () => {
    it('steps the week backwards and forwards', async () => {
      renderCalendar({ activeCalendar: 'week' });

      await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
      expect(setWeekStart).toHaveBeenCalledWith(new Date(2026, 5, 29, 12));

      await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
      expect(setWeekStart).toHaveBeenCalledWith(localDate(13, 12));
    });

    it('selecting a day opens the day rail on that date', async () => {
      renderCalendar({ activeCalendar: 'week' });

      await userEvent.click(screen.getAllByRole('button', { name: /TUE/ })[0]);

      expect(setCurrentDate).toHaveBeenCalledWith(new Date(2026, 6, 7));
      expect(setActiveCalendar).toHaveBeenCalledWith('day');
    });
  });

  describe('month overview', () => {
    const showMonth = async () => {
      renderCalendar();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    };

    it('selects a day without leaving the month view', async () => {
      await showMonth();

      await userEvent.click(screen.getByRole('button', { name: /^2026-07-07/ }));

      // Cells anchor to noon UTC so the date key round-trips across timezones.
      expect(setCurrentDate).toHaveBeenCalledWith(new Date(Date.UTC(2026, 6, 7, 12, 0, 0)));
      expect(screen.getByRole('region', { name: 'Month overview' })).toBeInTheDocument();
    });

    it('navigates months locally', async () => {
      await showMonth();

      await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));

      expect(screen.getByRole('heading', { name: 'June' })).toBeInTheDocument();
      expect(setCurrentDate).not.toHaveBeenCalled();
    });

    it('opens the selected day from the peek', async () => {
      await showMonth();

      await userEvent.click(screen.getByRole('button', { name: /Open day/ }));

      const openedDate = (setCurrentDate as jest.Mock).mock.calls.at(-1)?.[0] as Date;
      expect(openedDate).toBeInstanceOf(Date);
      // parseDateKey anchors the opened day to noon UTC (timezone-stable).
      expect(openedDate.getUTCHours()).toBe(12);
      expect(setActiveCalendar).toHaveBeenCalledWith('day');
    });
  });

  describe('my day', () => {
    const showMyDay = (overrides: Partial<PhoneCalendarProps> = {}) =>
      renderCalendar({ activeCalendar: 'team', ...overrides });

    it('renders the signed-in user context and their own appointments only', () => {
      const other = makeAppointment({ id: 'appt-9', lead: { id: 'vet-2', name: 'Dr Two' } });
      showMyDay({ dayEvents: [appointments[0], other] });

      expect(screen.getByText('Tue 7 Jul · Sarah Weber')).toBeInTheDocument();
      expect(screen.getByText('SW')).toBeInTheDocument();
      expect(screen.getAllByText(/Pretzel/)[0]).toBeInTheDocument();
      expect(screen.getByText('Appointments')).toBeInTheDocument();
    });

    it('shows every appointment when the user has no practitioner id', () => {
      const other = makeAppointment({ id: 'appt-9', lead: { id: 'vet-2', name: 'Dr Two' } });
      showMyDay({ currentUserPractitionerId: '', dayEvents: [appointments[0], other] });

      // Both leads' appointments land on the rail rather than none.
      expect(screen.getByText('2 · all done')).toBeInTheDocument();
    });

    // Rounds have no model, type or endpoint in this codebase, so nothing is
    // passed and nothing must be advertised.
    it('renders no rounds chip and no round rows', () => {
      showMyDay();

      expect(screen.queryByText('Rounds')).not.toBeInTheDocument();
      expect(screen.queryByText('None due')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open ward' })).not.toBeInTheDocument();
    });

    it('completes a task and resolves its companion name', async () => {
      showMyDay();

      expect(screen.getByText('Task · due 13:00 · linked to Pretzel')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Complete Call Lena' }));

      expect(changeTaskStatus).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'task-1', status: 'COMPLETED' })
      );
    });

    it('reopens a completed task', async () => {
      (useTasksAssignedToUser as jest.Mock).mockReturnValue([makeTask({ status: 'COMPLETED' })]);
      showMyDay();

      await userEvent.click(screen.getByRole('button', { name: 'Complete Call Lena' }));

      expect(changeTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
    });

    it('notifies when the task update fails', async () => {
      (changeTaskStatus as jest.Mock).mockRejectedValue(new Error('boom'));
      showMyDay();

      await userEvent.click(screen.getByRole('button', { name: 'Complete Call Lena' }));

      expect(notifyMock).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Task not updated' })
      );
    });

    it('opens the workspace from the next appointment card', async () => {
      showMyDay({ dayEvents: [makeAppointment({ startTime: at(11), endTime: at(11, 30) })] });

      await userEvent.click(screen.getByRole('button', { name: 'Open workspace' }));

      expect(onOpenWorkspace).toHaveBeenCalled();
    });

    it('returns to the clinic day rail via the Clinic toggle', async () => {
      showMyDay();

      await userEvent.click(screen.getByRole('button', { name: 'Clinic' }));

      expect(setActiveCalendar).toHaveBeenCalledWith('day');
      expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    });

    it('keeps month phone-local when returning to the clinic from My day', async () => {
      renderCalendar();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await userEvent.click(screen.getByRole('button', { name: 'Day' }));
      setActiveCalendar.mockClear();

      // Switching into My day and back out with month selected must not push
      // 'month' onto the shared union.
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      expect(setActiveCalendar).not.toHaveBeenCalled();
    });

    it('works without an optional setActiveCalendar', async () => {
      renderCalendar({ setActiveCalendar: undefined });

      await userEvent.click(screen.getByRole('button', { name: 'Week' }));

      expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
    });
  });
});
