import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskCalendar from '@/app/features/appointments/components/Calendar/TaskCalendar';
import { getProfileForUserForPrimaryOrg } from '@/app/features/organization/services/teamService';
import { updateTask } from '@/app/features/tasks/services/taskService';
import { useNotify } from '@/app/hooks/useNotify';
import { canRescheduleTask, canShowTaskStatusChangeAction } from '@/app/lib/tasks';

jest.mock('@/app/features/appointments/components/Calendar/common/Header', () => {
  return function MockHeader() {
    return <div data-testid="task-calendar-header" />;
  };
});

jest.mock('@/app/features/appointments/components/Calendar/Task/DayCalendar', () => {
  return function MockDayCalendar(props: any) {
    const task = props.events[0];
    return (
      <div data-testid="task-day-calendar">
        <button type="button" onClick={() => props.onTaskDragStart(task)}>
          drag-start
        </button>
        <button type="button" onClick={() => props.handleViewTask(task)}>
          view-task
        </button>
        <button type="button" onClick={() => props.handleChangeStatusTask(task)}>
          change-status
        </button>
        <button type="button" onClick={() => props.handleRescheduleTask(task)}>
          reschedule-task
        </button>
        <button
          type="button"
          onClick={() => props.onTaskDropAt(new Date('2026-05-01T00:00:00Z'), 615)}
        >
          drop
        </button>
        <button
          type="button"
          onClick={() => props.onDragHoverTarget(new Date('2026-05-01T00:00:00Z'), 'team-2')}
        >
          hover
        </button>
        <button
          type="button"
          onClick={() => props.onCreateTaskAt(new Date('2026-05-01T00:00:00Z'), 630)}
        >
          create
        </button>
      </div>
    );
  };
});

jest.mock('@/app/features/appointments/components/Calendar/Task/WeekCalendar', () => () => (
  <div data-testid="task-week-calendar" />
));

jest.mock('@/app/features/appointments/components/Calendar/Task/UserCalendar', () => {
  return function MockUserCalendar(props: any) {
    return (
      <div data-testid="task-user-calendar">
        <button
          type="button"
          onClick={() => props.onCreateTaskAt(new Date('2026-05-01T00:00:00Z'), 645, 'team-2')}
        >
          team-create
        </button>
      </div>
    );
  };
});

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(() => [
    { _id: 'team-1', practionerId: 'vet-1', name: 'Dr One', userId: 'user-1' },
    { _id: 'team-2', practionerId: 'vet-2', name: 'Dr Two', userId: 'user-2' },
  ]),
}));

jest.mock('@/app/hooks/useMemberMap', () => ({
  useMemberMap: jest.fn(() => ({ resolveMemberName: () => '-' })),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  getProfileForUserForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  updateTask: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: any) => selector({ attributes: { sub: 'user-1' } })),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/lib/timezone', () => ({
  buildDateInPreferredTimeZone: jest.fn((date: Date, minute: number) => {
    const d = new Date(date);
    d.setUTCHours(0, minute, 0, 0);
    return d;
  }),
  formatDateInPreferredTimeZone: jest.fn((date: Date, options: Intl.DateTimeFormatOptions) => {
    if (options.weekday) {
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      return days[date.getUTCDay()];
    }
    return '2026-05-01';
  }),
  getPreferredTimeZone: jest.fn(() => 'UTC'),
  isOnPreferredTimeZoneCalendarDay: jest.fn(
    (a: Date, b: Date) => a.getUTCDate() === b.getUTCDate()
  ),
  utcClockTimeToPreferredTimeZoneClock: jest.fn((clock: string) => {
    const [h, m] = clock.split(':').map(Number);
    return { dayOffset: 0, minutes: h * 60 + m };
  }),
}));

jest.mock('@/app/lib/tasks', () => ({
  canRescheduleTask: jest.fn(() => true),
  canShowTaskStatusChangeAction: jest.fn(() => true),
  getPreferredNextTaskStatus: jest.fn(() => 'IN_PROGRESS'),
}));

describe('TaskCalendar drag and creation behavior', () => {
  const notifyMock = jest.fn();
  const onCreateFromCalendarSlot = jest.fn();
  const setActiveTask = jest.fn();
  const setViewPopup = jest.fn();
  const setChangeStatusPopup = jest.fn();
  const setChangeStatusPreferredStatus = jest.fn();
  const setReschedulePopup = jest.fn();

  const task: any = {
    _id: 'task-1',
    name: 'Task 1',
    title: 'Task 1',
    dueAt: new Date('2026-05-01T09:00:00Z'),
    assignedTo: 'vet-1',
    assignedBy: 'user-1',
    status: 'PENDING',
    audience: 'EMPLOYEE_TASK',
    timezone: '',
  };

  const baseProps: any = {
    filteredList: [task],
    allTasks: [task],
    activeCalendar: 'day',
    currentDate: new Date('2026-05-01T00:00:00Z'),
    setCurrentDate: jest.fn(),
    weekStart: new Date('2026-05-01T00:00:00Z'),
    setWeekStart: jest.fn(),
    canEditTasks: true,
    onCreateFromCalendarSlot,
    setActiveTask,
    setViewPopup,
    setChangeStatusPopup,
    setChangeStatusPreferredStatus,
    setReschedulePopup,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    (updateTask as jest.Mock).mockResolvedValue({});
    (getProfileForUserForPrimaryOrg as jest.Mock).mockResolvedValue({
      baseAvailability: [
        {
          dayOfWeek: 'FRIDAY',
          slots: [{ isAvailable: true, startTime: '08:00', endTime: '18:00' }],
        },
      ],
    });
    (canShowTaskStatusChangeAction as unknown as jest.Mock).mockReturnValue(true);
    (canRescheduleTask as unknown as jest.Mock).mockReturnValue(true);
  });

  it('moves task on drag-drop and keeps assignee for day calendar', async () => {
    render(<TaskCalendar {...baseProps} />);

    fireEvent.click(screen.getByText('drag-start'));
    fireEvent.click(screen.getByText('drop'));

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'task-1',
          assignedTo: 'vet-1',
          timezone: 'UTC',
          dueAt: expect.any(Date),
        })
      );
    });
    expect(getProfileForUserForPrimaryOrg).not.toHaveBeenCalled();
  });

  it('shows assignee-required error when dropping task with missing assignee', async () => {
    render(
      <TaskCalendar
        {...baseProps}
        filteredList={[{ ...task, assignedTo: '' }]}
        allTasks={[{ ...task, assignedTo: '' }]}
      />
    );

    fireEvent.click(screen.getByText('drag-start'));
    fireEvent.click(screen.getByText('drop'));

    expect(await screen.findByText('Task assignee is required.')).toBeInTheDocument();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('creates team task prefill with resolved assignee in team view', () => {
    render(<TaskCalendar {...baseProps} activeCalendar="team" />);

    fireEvent.click(screen.getByText('team-create'));

    expect(onCreateFromCalendarSlot).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: 'vet-2', dueAt: expect.any(Date) })
    );
  });

  it('does not create task prefill when edit access is disabled', () => {
    render(<TaskCalendar {...baseProps} canEditTasks={false} />);

    fireEvent.click(screen.getByText('create'));

    expect(onCreateFromCalendarSlot).not.toHaveBeenCalled();
  });

  it('shows drag error when updating task after drop fails', async () => {
    (updateTask as jest.Mock).mockRejectedValue(new Error('update failed'));
    render(<TaskCalendar {...baseProps} />);

    fireEvent.click(screen.getByText('drag-start'));
    fireEvent.click(screen.getByText('drop'));

    expect(await screen.findByText('Unable to update task. Please try again.')).toBeInTheDocument();
  });

  it('blocks drag-drop for completed tasks', async () => {
    render(
      <TaskCalendar
        {...baseProps}
        filteredList={[{ ...task, status: 'COMPLETED' }]}
        allTasks={[{ ...task, status: 'COMPLETED' }]}
      />
    );

    fireEvent.click(screen.getByText('drag-start'));
    fireEvent.click(screen.getByText('drop'));

    expect(
      screen.queryByText('Only pending or in-progress tasks can be moved.')
    ).not.toBeInTheDocument();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('opens view popup when day calendar requests task view', () => {
    render(<TaskCalendar {...baseProps} />);

    fireEvent.click(screen.getByText('view-task'));

    expect(setActiveTask).toHaveBeenCalledWith(expect.objectContaining({ _id: 'task-1' }));
    expect(setViewPopup).toHaveBeenCalledWith(true);
  });

  it('blocks status action when task status cannot be changed', () => {
    (canShowTaskStatusChangeAction as unknown as jest.Mock).mockReturnValue(false);
    render(<TaskCalendar {...baseProps} />);

    fireEvent.click(screen.getByText('change-status'));

    expect(setChangeStatusPopup).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Status change blocked' })
    );
  });

  it('blocks reschedule action when task status cannot be rescheduled', () => {
    (canRescheduleTask as unknown as jest.Mock).mockReturnValue(false);
    render(<TaskCalendar {...baseProps} />);

    fireEvent.click(screen.getByText('reschedule-task'));

    expect(setReschedulePopup).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Reschedule blocked' })
    );
  });

  it('renders no calendar body for unsupported calendar mode', () => {
    render(<TaskCalendar {...baseProps} activeCalendar="month" />);

    expect(screen.queryByTestId('task-day-calendar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-week-calendar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-user-calendar')).not.toBeInTheDocument();
  });
});
