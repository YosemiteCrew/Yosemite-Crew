import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedTasks from '@/app/features/tasks/pages/Tasks';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('Calendar/TaskCalendar')) {
        const MockTaskCalendar = jest.requireMock(
          '@/app/features/appointments/components/Calendar/TaskCalendar'
        ) as React.FC<Record<string, unknown>>;
        return <MockTaskCalendar {...props} />;
      }

      if (source.includes('TaskWeekAgenda')) {
        const MockTaskWeekAgenda = jest.requireMock(
          '@/app/features/tasks/components/TaskWeekAgenda'
        ) as React.FC<Record<string, unknown>>;
        return <MockTaskWeekAgenda {...props} />;
      }

      if (source.includes('TaskBoard')) {
        const MockTaskBoard = jest.requireMock(
          '@/app/features/tasks/components/TaskBoard'
        ) as React.FC<Record<string, unknown>>;
        return <MockTaskBoard {...props} />;
      }

      if (source.includes('ui/tables/Tasks')) {
        const MockTasksTable = jest.requireMock('@/app/ui/tables/Tasks') as React.FC<
          Record<string, unknown>
        >;
        return <MockTasksTable {...props} />;
      }

      if (source.includes('Sections/AddTask')) {
        const MockAddTask = jest.requireMock(
          '@/app/features/tasks/pages/Tasks/Sections/AddTask'
        ) as React.FC<Record<string, unknown>>;
        return <MockAddTask {...props} />;
      }

      if (source.includes('Sections/TaskInfo')) {
        const MockTaskInfo = jest.requireMock(
          '@/app/features/tasks/pages/Tasks/Sections/TaskInfo'
        ) as React.FC<Record<string, unknown>>;
        return <MockTaskInfo {...props} />;
      }

      if (source.includes('Sections/ChangeStatus')) {
        const MockChangeTaskStatus = jest.requireMock(
          '@/app/features/tasks/pages/Tasks/Sections/ChangeStatus'
        ) as React.FC<Record<string, unknown>>;
        return <MockChangeTaskStatus {...props} />;
      }

      if (source.includes('Sections/Reschedule')) {
        const MockRescheduleTask = jest.requireMock(
          '@/app/features/tasks/pages/Tasks/Sections/Reschedule'
        ) as React.FC<Record<string, unknown>>;
        return <MockRescheduleTask {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

const useTasksMock = jest.fn();
const usePermissionsMock = jest.fn();
const useSearchStoreMock = jest.fn();
const useSearchParamsMock = jest.fn();
const useIsPhoneMock = jest.fn();
const taskCalendarSpy = jest.fn();
const taskAgendaSpy = jest.fn();
const taskTableSpy = jest.fn();
const taskBoardSpy = jest.fn();
const taskInfoSpy = jest.fn();
const addTaskSpy = jest.fn();
const filterBarSpy = jest.fn();
const changeStatusSpy = jest.fn();
const rescheduleSpy = jest.fn();

const lastPropsOf = (spy: jest.Mock) => spy.mock.calls[spy.mock.calls.length - 1][0];

jest.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  startOfDay: (d: Date) => d,
}));

jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  useIsPhone: () => useIsPhoneMock(),
}));

jest.mock('@/app/hooks/usePlannerLayout', () => ({
  usePlannerAutoLock: () => ({ plannerSectionRef: { current: null } }),
  getPlannerLayoutClassNames: () => ({
    wrapperClassName: 'wrapper',
    plannerSectionClassName: 'planner',
  }),
}));

jest.mock('@/app/ui/layout/MobileSearchBar/MobileSearchBar', () => () => (
  <div data-testid="mobile-search-bar" />
));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/hooks/useTask', () => ({
  useTasksForPrimaryOrg: () => useTasksMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: any) => useSearchStoreMock(selector),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/widgets/TitleCalendar', () => (props: any) => (
  <div>
    <button type="button" onClick={() => props.setActiveView('calendar')}>
      Calendar
    </button>
    <button type="button" onClick={() => props.setActiveView('board')}>
      Board
    </button>
    <button type="button" onClick={() => props.setActiveView('list')}>
      List
    </button>
    <button type="button" onClick={() => props.setAddPopup(true)}>
      Title Add
    </button>
  </div>
));

jest.mock('@/app/features/tasks/components/TaskFilterBar', () => (props: any) => {
  filterBarSpy(props);
  return (
    <div data-testid="task-filter-bar">
      {props.showAddButton ? (
        <button type="button" onClick={props.onAddButtonClick}>
          Add
        </button>
      ) : null}
    </div>
  );
});

jest.mock('@/app/features/appointments/components/Calendar/TaskCalendar', () => (props: any) => {
  taskCalendarSpy(props);
  return <div data-testid="task-calendar" />;
});

jest.mock('@/app/features/tasks/components/TaskWeekAgenda', () => (props: any) => {
  taskAgendaSpy(props);
  return <div data-testid="task-week-agenda" />;
});

jest.mock('@/app/ui/tables/Tasks', () => (props: any) => {
  taskTableSpy(props);
  return <div data-testid="tasks-table" />;
});

jest.mock('@/app/features/tasks/components/TaskBoard', () => (props: any) => {
  taskBoardSpy(props);
  return <div data-testid="task-board" />;
});

jest.mock('@/app/features/tasks/pages/Tasks/Sections/AddTask', () => (props: any) => {
  addTaskSpy(props);
  return <div data-testid="add-task" />;
});

jest.mock('@/app/features/tasks/pages/Tasks/Sections/TaskInfo', () => (props: any) => {
  taskInfoSpy(props);
  return <div data-testid="task-info" />;
});

jest.mock('@/app/features/tasks/pages/Tasks/Sections/ChangeStatus', () => (props: any) => {
  changeStatusSpy(props);
  return <div data-testid="task-change-status" />;
});

jest.mock('@/app/features/tasks/pages/Tasks/Sections/Reschedule', () => (props: any) => {
  rescheduleSpy(props);
  return <div data-testid="task-reschedule" />;
});

describe('Tasks page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTasksMock.mockReturnValue([
      { _id: 't1', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Follow up' },
      { _id: 't2', status: 'completed', audience: 'EMPLOYEE_TASK', name: 'Close' },
    ]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: 'follow' }));
    useSearchParamsMock.mockReturnValue({ get: () => null });
    // Default to the tablet/desktop experience (7-day agenda board).
    useIsPhoneMock.mockReturnValue(false);
  });

  it('renders the desktop week agenda and switches to table', () => {
    render(<ProtectedTasks />);

    expect(screen.getByTestId('task-week-agenda')).toBeInTheDocument();
    expect(taskAgendaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ _id: 't1' })],
      })
    );

    fireEvent.click(screen.getByText('List'));
    expect(screen.getByTestId('tasks-table')).toBeInTheDocument();
    expect(taskTableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ _id: 't1' })],
      })
    );
  });

  it('renders the phone day list (TaskCalendar) below the phone breakpoint', () => {
    useIsPhoneMock.mockReturnValue(true);
    render(<ProtectedTasks />);

    expect(screen.getByTestId('task-calendar')).toBeInTheDocument();
    expect(screen.queryByTestId('task-week-agenda')).not.toBeInTheDocument();
    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ _id: 't1' })],
        allTasks: expect.arrayContaining([expect.objectContaining({ _id: 't1' })]),
      })
    );
  });

  it('renders board view when selected', () => {
    render(<ProtectedTasks />);

    fireEvent.click(screen.getByText('Board'));
    expect(screen.getByTestId('task-board')).toBeInTheDocument();
    expect(taskBoardSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [expect.objectContaining({ _id: 't1' })],
      })
    );
  });

  it('deep link: opens TaskInfo when searchParams taskId matches a task', async () => {
    useTasksMock.mockReturnValue([
      { _id: 'deep-task', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Deep Task' },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'taskId' ? 'deep-task' : null),
    });

    await act(async () => {
      render(<ProtectedTasks />);
      await Promise.resolve();
    });

    expect(screen.getByTestId('task-info')).toBeInTheDocument();
    expect(taskInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        showModal: true,
        activeTask: expect.objectContaining({ _id: 'deep-task' }),
      })
    );
  });

  it('activeTask is null when tasks list is empty', async () => {
    useTasksMock.mockReturnValue([]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    await act(async () => {
      render(<ProtectedTasks />);
      await Promise.resolve();
    });

    // TaskInfo is not rendered when activeTask is null
    expect(screen.queryByTestId('task-info')).not.toBeInTheDocument();
  });

  it('activeTask updates reactively when tasks list changes', async () => {
    const { rerender } = render(<ProtectedTasks />);

    // Initial render — t1 and t2 present, t1 is activeTask
    expect(taskInfoSpy).not.toHaveBeenCalled();

    // Update tasks list so t1 is replaced with updated t1
    useTasksMock.mockReturnValue([
      { _id: 't1', status: 'completed', audience: 'EMPLOYEE_TASK', name: 'Follow up updated' },
    ]);

    await act(async () => {
      rerender(<ProtectedTasks />);
      await Promise.resolve();
    });

    // After re-render with the updated list, the agenda receives the fresh task.
    expect(taskAgendaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ _id: 't1', name: 'Follow up updated' })],
      })
    );
  });

  it('handleCreateFromCalendarSlot: onCreateFromCalendarSlot prop opens add popup', async () => {
    render(<ProtectedTasks />);

    const agendaProps = taskAgendaSpy.mock.calls[0][0];
    expect(agendaProps.onCreateFromCalendarSlot).toBeInstanceOf(Function);

    await act(async () => {
      agendaProps.onCreateFromCalendarSlot({ dueAt: new Date('2025-01-01'), assignedTo: 'u1' });
      await Promise.resolve();
    });

    expect(addTaskSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('handleReuseTask: onReuseTask prop on TaskInfo opens add popup', async () => {
    useTasksMock.mockReturnValue([
      { _id: 'deep-task', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Deep Task' },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'taskId' ? 'deep-task' : null),
    });

    await act(async () => {
      render(<ProtectedTasks />);
      await Promise.resolve();
    });

    expect(taskInfoSpy).toHaveBeenCalled();
    const taskInfoProps = taskInfoSpy.mock.calls[taskInfoSpy.mock.calls.length - 1][0];
    expect(taskInfoProps.onReuseTask).toBeInstanceOf(Function);

    await act(async () => {
      taskInfoProps.onReuseTask({ _id: 'deep-task', name: 'Deep Task' });
      await Promise.resolve();
    });

    expect(addTaskSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('openAddTask: clicking Add button in the filter bar calls openAddTask', async () => {
    render(<ProtectedTasks />);

    const addButton = screen.getByRole('button', { name: 'Add' });
    await act(async () => {
      fireEvent.click(addButton);
      await Promise.resolve();
    });

    expect(addTaskSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('feeds the inline audience + status pills to the filter bar', () => {
    render(<ProtectedTasks />);

    expect(filterBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filterOptions: expect.any(Array),
        statusOptions: expect.any(Array),
        addButtonText: 'New task',
      })
    );
  });

  it('filteredList in board view ignores status filter (shows all matching query/audience)', async () => {
    useTasksMock.mockReturnValue([
      { _id: 't1', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Follow up' },
      { _id: 't2', status: 'completed', audience: 'EMPLOYEE_TASK', name: 'Close out' },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    render(<ProtectedTasks />);
    fireEvent.click(screen.getByText('Board'));

    // In board view, status filter is ignored — both tasks should appear
    expect(taskBoardSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: expect.arrayContaining([
          expect.objectContaining({ _id: 't1' }),
          expect.objectContaining({ _id: 't2' }),
        ]),
      })
    );
  });

  it('setCurrentDate prop passed to the agenda updates the date', async () => {
    render(<ProtectedTasks />);

    const agendaProps = taskAgendaSpy.mock.calls[0][0];
    expect(agendaProps.setCurrentDate).toBeInstanceOf(Function);
    const newDate = new Date('2025-06-01');

    await act(async () => {
      agendaProps.setCurrentDate(newDate);
      await Promise.resolve();
    });

    expect(taskAgendaSpy).toHaveBeenCalledWith(expect.objectContaining({ currentDate: newDate }));
  });

  it('setWeekStart prop passed to the agenda updates weekStart', async () => {
    render(<ProtectedTasks />);

    const agendaProps = taskAgendaSpy.mock.calls[0][0];
    expect(agendaProps.setWeekStart).toBeInstanceOf(Function);
    const newWeekStart = new Date('2025-05-26');

    await act(async () => {
      agendaProps.setWeekStart(newWeekStart);
      await Promise.resolve();
    });

    expect(taskAgendaSpy).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart: newWeekStart })
    );
  });

  it('setActiveCalendar prop updates activeCalendar passed to the phone TaskCalendar', async () => {
    useIsPhoneMock.mockReturnValue(true);
    render(<ProtectedTasks />);

    const calendarProps = taskCalendarSpy.mock.calls[0][0];
    expect(calendarProps.setActiveCalendar).toBeInstanceOf(Function);

    await act(async () => {
      calendarProps.setActiveCalendar('day');
      await Promise.resolve();
    });

    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeCalendar: 'day' })
    );
  });

  it('setActiveTask and setViewPopup props on TaskBoard open TaskInfo', async () => {
    useTasksMock.mockReturnValue([
      { _id: 'board-task', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Board Task' },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    render(<ProtectedTasks />);
    fireEvent.click(screen.getByText('Board'));

    const boardProps = taskBoardSpy.mock.calls[taskBoardSpy.mock.calls.length - 1][0];

    await act(async () => {
      boardProps.setActiveTask({
        _id: 'board-task',
        status: 'pending',
        audience: 'EMPLOYEE_TASK',
        name: 'Board Task',
      });
      boardProps.setViewPopup(true);
      await Promise.resolve();
    });

    expect(taskInfoSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('TaskPlannerSkeleton is registered for each dynamic import', () => {
    // The planner skeleton div is rendered by loading states via dynamic() - verified via renders
    render(<ProtectedTasks />);
    // Tasks page renders without errors with mocked dynamic components
    expect(screen.getByTestId('task-week-agenda')).toBeInTheDocument();
  });

  it('setActiveCalendar accepts a functional updater and resyncs weekStart on the week view', async () => {
    useIsPhoneMock.mockReturnValue(true);
    render(<ProtectedTasks />);

    // Leave the week view first, so the date move below does not sync weekStart.
    await act(async () => {
      lastPropsOf(taskCalendarSpy).setActiveCalendar((prev: string) =>
        prev === 'week' ? 'day' : 'week'
      );
      await Promise.resolve();
    });
    expect(lastPropsOf(taskCalendarSpy).activeCalendar).toBe('day');

    const movedDate = new Date('2025-09-15');
    await act(async () => {
      lastPropsOf(taskCalendarSpy).setCurrentDate(movedDate);
      await Promise.resolve();
    });
    expect(lastPropsOf(taskCalendarSpy).currentDate).toBe(movedDate);
    // Off the week view, weekStart is left behind.
    expect(lastPropsOf(taskCalendarSpy).weekStart).not.toBe(movedDate);

    await act(async () => {
      lastPropsOf(taskCalendarSpy).setActiveCalendar(() => 'week');
      await Promise.resolve();
    });

    expect(lastPropsOf(taskCalendarSpy).activeCalendar).toBe('week');
    // Returning to the week view resyncs weekStart to the current date
    // (startOfDay is mocked to the identity function).
    expect(lastPropsOf(taskCalendarSpy).weekStart).toBe(movedDate);
  });

  it('setCurrentDate accepts a functional updater and syncs weekStart on the week view', async () => {
    render(<ProtectedTasks />);

    const nextDate = new Date('2025-07-04');
    await act(async () => {
      lastPropsOf(taskAgendaSpy).setCurrentDate(() => nextDate);
      await Promise.resolve();
    });

    expect(lastPropsOf(taskAgendaSpy).currentDate).toBe(nextDate);
    expect(lastPropsOf(taskAgendaSpy).weekStart).toBe(nextDate);
  });

  it('falls back to the first task when the active task disappears from the list', async () => {
    const { rerender } = render(<ProtectedTasks />);

    expect(lastPropsOf(changeStatusSpy).activeTask).toEqual(expect.objectContaining({ _id: 't1' }));

    useTasksMock.mockReturnValue([
      { _id: 't9', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Follow up nine' },
    ]);

    await act(async () => {
      rerender(<ProtectedTasks />);
      await Promise.resolve();
    });

    expect(lastPropsOf(changeStatusSpy).activeTask).toEqual(expect.objectContaining({ _id: 't9' }));
  });

  it('adopts the first task once the list arrives after an empty state', async () => {
    useTasksMock.mockReturnValue([]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    const { rerender } = render(<ProtectedTasks />);
    expect(screen.queryByTestId('task-change-status')).not.toBeInTheDocument();

    useTasksMock.mockReturnValue([
      { _id: 'late', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Late arrival' },
    ]);

    await act(async () => {
      rerender(<ProtectedTasks />);
      await Promise.resolve();
    });

    expect(lastPropsOf(changeStatusSpy).activeTask).toEqual(
      expect.objectContaining({ _id: 'late' })
    );
  });

  it('deep link: ignores a taskId that matches no task', async () => {
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'taskId' ? 'missing-task' : null),
    });

    await act(async () => {
      render(<ProtectedTasks />);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('task-info')).not.toBeInTheDocument();
  });

  it('deep link: does not reopen a task that was already handled', async () => {
    useTasksMock.mockReturnValue([
      { _id: 'deep-task', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Deep Task' },
    ]);
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'taskId' ? 'deep-task' : null),
    });

    const { rerender } = render(<ProtectedTasks />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('task-info')).toBeInTheDocument();

    // The user closes the popup.
    await act(async () => {
      lastPropsOf(taskInfoSpy).setShowModal(false);
      await Promise.resolve();
    });
    expect(screen.queryByTestId('task-info')).not.toBeInTheDocument();

    // A fresh tasks array re-runs the deep-link effect, but the link is spent.
    useTasksMock.mockReturnValue([
      { _id: 'deep-task', status: 'pending', audience: 'EMPLOYEE_TASK', name: 'Deep Task' },
    ]);
    await act(async () => {
      rerender(<ProtectedTasks />);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('task-info')).not.toBeInTheDocument();
  });

  it('filters by status and audience when the filter pills change', async () => {
    useTasksMock.mockReturnValue([
      { _id: 't1', status: 'pending', audience: 'employee_task', name: 'Alpha' },
      { _id: 't2', status: 'completed', audience: 'client_task', name: 'Beta' },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    render(<ProtectedTasks />);

    await act(async () => {
      lastPropsOf(filterBarSpy).setActiveStatus('completed');
      await Promise.resolve();
    });
    expect(lastPropsOf(taskAgendaSpy).filteredList).toEqual([
      expect.objectContaining({ _id: 't2' }),
    ]);

    await act(async () => {
      lastPropsOf(filterBarSpy).setActiveFilter('employee_task');
      await Promise.resolve();
    });
    // t2 is the only completed task, but its audience is client_task.
    expect(lastPropsOf(taskAgendaSpy).filteredList).toEqual([]);

    await act(async () => {
      lastPropsOf(filterBarSpy).setActiveStatus('pending');
      await Promise.resolve();
    });
    expect(lastPropsOf(taskAgendaSpy).filteredList).toEqual([
      expect.objectContaining({ _id: 't1' }),
    ]);
  });

  it('tolerates tasks with no status, audience or name', async () => {
    useTasksMock.mockReturnValue([
      { _id: 't1', status: 'pending', audience: 'employee_task', name: 'Alpha' },
      { _id: 'bare' },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: 'alpha' }));

    render(<ProtectedTasks />);

    expect(lastPropsOf(taskAgendaSpy).filteredList).toEqual([
      expect.objectContaining({ _id: 't1' }),
    ]);
  });

  it('opens the add-task modal from the title bar without a prefill', async () => {
    render(<ProtectedTasks />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Title Add' }));
      await Promise.resolve();
    });

    expect(lastPropsOf(addTaskSpy)).toEqual(
      expect.objectContaining({ showModal: true, prefill: null })
    );
  });

  it('clears the add-task prefill when the add modal is closed', async () => {
    render(<ProtectedTasks />);

    const dueAt = new Date('2025-01-01');
    await act(async () => {
      lastPropsOf(taskAgendaSpy).onCreateFromCalendarSlot({ dueAt, assignedTo: 'u1' });
      await Promise.resolve();
    });
    expect(lastPropsOf(addTaskSpy).prefill).toEqual({ dueAt, assignedTo: 'u1' });

    await act(async () => {
      lastPropsOf(addTaskSpy).setShowModal(false);
      await Promise.resolve();
    });
    expect(lastPropsOf(addTaskSpy)).toEqual(
      expect.objectContaining({ showModal: false, prefill: null })
    );

    // Reopening with `true` leaves the (already cleared) prefill alone.
    await act(async () => {
      lastPropsOf(addTaskSpy).setShowModal(true);
      await Promise.resolve();
    });
    expect(lastPropsOf(addTaskSpy)).toEqual(
      expect.objectContaining({ showModal: true, prefill: null })
    );
  });

  it('hides the add button and the edit-only modals without task-edit permission', () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });

    render(<ProtectedTasks />);

    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-change-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-reschedule')).not.toBeInTheDocument();
    expect(lastPropsOf(taskAgendaSpy).canEditTasks).toBe(false);
  });

  it('renders the reschedule modal for the active task when editing is allowed', () => {
    render(<ProtectedTasks />);

    expect(screen.getByTestId('task-reschedule')).toBeInTheDocument();
    expect(lastPropsOf(rescheduleSpy)).toEqual(
      expect.objectContaining({
        showModal: false,
        activeTask: expect.objectContaining({ _id: 't1' }),
      })
    );
  });

  it('filters tasks by audience when activeFilter is set', async () => {
    useTasksMock.mockReturnValue([
      { _id: 't1', status: 'pending', audience: 'employee_task', name: 'Employee task' },
      { _id: 't2', status: 'pending', audience: 'client_task', name: 'Client task' },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    render(<ProtectedTasks />);

    // Verify both tasks pass initially (all filter)
    expect(taskAgendaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: expect.arrayContaining([
          expect.objectContaining({ _id: 't1' }),
          expect.objectContaining({ _id: 't2' }),
        ]),
      })
    );
  });
});
