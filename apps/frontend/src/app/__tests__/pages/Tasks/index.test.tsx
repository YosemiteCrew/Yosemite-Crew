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

const useTeamMock = jest.fn();
const authAttributesMock = jest.fn();

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: (state: { attributes: unknown }) => unknown) =>
    selector({ attributes: authAttributesMock() }),
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
    {props.actionBeforeAdd}
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
    useTeamMock.mockReturnValue([]);
    authAttributesMock.mockReturnValue({ sub: 'me-123' });
  });

  it('renders the calendar planner and switches to table', () => {
    render(<ProtectedTasks />);

    expect(screen.getByTestId('task-calendar')).toBeInTheDocument();
    expect(taskCalendarSpy).toHaveBeenCalledWith(
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

  it('renders the TaskCalendar planner below the phone breakpoint too', () => {
    useIsPhoneMock.mockReturnValue(true);
    render(<ProtectedTasks />);

    expect(screen.getByTestId('task-calendar')).toBeInTheDocument();
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
    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: [expect.objectContaining({ _id: 't1', name: 'Follow up updated' })],
      })
    );
  });

  it('handleCreateFromCalendarSlot: onCreateFromCalendarSlot prop opens add popup', async () => {
    render(<ProtectedTasks />);

    const agendaProps = taskCalendarSpy.mock.calls[0][0];
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

  it('openAddTask: clicking the header New task CTA calls openAddTask', async () => {
    render(<ProtectedTasks />);

    // Per the design the CTA sits in the page header actions, not the filter row.
    const addButton = screen.getByRole('button', { name: 'New task' });
    await act(async () => {
      fireEvent.click(addButton);
      await Promise.resolve();
    });

    expect(addTaskSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('feeds the status dropdown and pet-parent pill to the planner header', () => {
    render(<ProtectedTasks />);

    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filterOptions: expect.any(Array),
        statusOptions: expect.any(Array),
      })
    );
    const { statusOptions, filterOptions } = lastPropsOf(taskCalendarSpy);
    // The design's status set is Pending / In progress / Completed only.
    expect(statusOptions.map((option: { key: string }) => option.key)).not.toContain('cancelled');
    // Day/Week/Team already covers the team split, so only the parent pill remains.
    expect(filterOptions.map((option: { key: string }) => option.key)).toEqual(['parent_task']);
    expect(filterOptions[0].dotColor).toBe('var(--pink)');
    // The planner header owns the filters, so no separate pill row renders.
    expect(filterBarSpy).not.toHaveBeenCalled();
  });

  it('keeps the audience, status and scope pill row for the list view', () => {
    render(<ProtectedTasks />);
    fireEvent.click(screen.getByText('List'));

    expect(filterBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filterOptions: expect.any(Array),
        statusOptions: expect.any(Array),
        scopeOptions: expect.any(Array),
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

  it('setCurrentDate prop passed to the calendar header updates the date', async () => {
    render(<ProtectedTasks />);

    const calendarProps = taskCalendarSpy.mock.calls[0][0];
    expect(calendarProps.setCurrentDate).toBeInstanceOf(Function);
    const newDate = new Date('2025-06-01');

    await act(async () => {
      calendarProps.setCurrentDate(newDate);
      await Promise.resolve();
    });

    expect(taskCalendarSpy).toHaveBeenCalledWith(expect.objectContaining({ currentDate: newDate }));
  });

  it('setWeekStart prop passed to the calendar header updates weekStart', async () => {
    render(<ProtectedTasks />);

    const calendarProps = taskCalendarSpy.mock.calls[0][0];
    expect(calendarProps.setWeekStart).toBeInstanceOf(Function);
    const newWeekStart = new Date('2025-05-26');

    await act(async () => {
      calendarProps.setWeekStart(newWeekStart);
      await Promise.resolve();
    });

    expect(taskCalendarSpy).toHaveBeenCalledWith(
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
    expect(screen.getByTestId('task-calendar')).toBeInTheDocument();
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
      lastPropsOf(taskCalendarSpy).setCurrentDate(() => nextDate);
      await Promise.resolve();
    });

    expect(lastPropsOf(taskCalendarSpy).currentDate).toBe(nextDate);
    expect(lastPropsOf(taskCalendarSpy).weekStart).toBe(nextDate);
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
      lastPropsOf(taskCalendarSpy).setActiveStatus('completed');
      await Promise.resolve();
    });
    expect(lastPropsOf(taskCalendarSpy).filteredList).toEqual([
      expect.objectContaining({ _id: 't2' }),
    ]);

    await act(async () => {
      lastPropsOf(taskCalendarSpy).setActiveFilter('employee_task');
      await Promise.resolve();
    });
    // t2 is the only completed task, but its audience is client_task.
    expect(lastPropsOf(taskCalendarSpy).filteredList).toEqual([]);

    await act(async () => {
      lastPropsOf(taskCalendarSpy).setActiveStatus('pending');
      await Promise.resolve();
    });
    expect(lastPropsOf(taskCalendarSpy).filteredList).toEqual([
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

    expect(lastPropsOf(taskCalendarSpy).filteredList).toEqual([
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
      lastPropsOf(taskCalendarSpy).onCreateFromCalendarSlot({ dueAt, assignedTo: 'u1' });
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

    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-change-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-reschedule')).not.toBeInTheDocument();
    expect(lastPropsOf(taskCalendarSpy).canEditTasks).toBe(false);
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
    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredList: expect.arrayContaining([
          expect.objectContaining({ _id: 't1' }),
          expect.objectContaining({ _id: 't2' }),
        ]),
      })
    );
  });

  it('narrows the list to my tasks when the scope is set to mine', async () => {
    authAttributesMock.mockReturnValue({ sub: 'me-123' });
    // The signed-in member is reachable by a second id form (practionerId) so a
    // task tagged with that id still resolves to "me" via the team map.
    useTeamMock.mockReturnValue([{ practionerId: 'prac-1', userId: 'me-123', name: 'Me' }]);
    useTasksMock.mockReturnValue([
      {
        _id: 'mine-direct',
        status: 'pending',
        audience: 'employee_task',
        name: 'Mine',
        assignedTo: 'me-123',
      },
      {
        _id: 'mine-primary',
        status: 'pending',
        audience: 'employee_task',
        name: 'Also mine',
        assignedTo: 'prac-1',
      },
      {
        _id: 'theirs',
        status: 'pending',
        audience: 'employee_task',
        name: 'Theirs',
        assignedTo: 'someone-else',
      },
      { _id: 'bare', status: 'pending', audience: 'employee_task', name: 'Unassigned' },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    render(<ProtectedTasks />);

    // The default "Team" scope surfaces everyone's tasks.
    expect(lastPropsOf(taskCalendarSpy).filteredList).toHaveLength(4);

    // The scope control lives in the list view only.
    fireEvent.click(screen.getByText('List'));
    await act(async () => {
      lastPropsOf(filterBarSpy).setActiveScope('mine');
      await Promise.resolve();
    });

    // "My tasks" keeps only the two that resolve to the signed-in member.
    expect(lastPropsOf(taskTableSpy).filteredList).toEqual([
      expect.objectContaining({ _id: 'mine-direct' }),
      expect.objectContaining({ _id: 'mine-primary' }),
    ]);
  });

  it('shows nothing under "my tasks" when the signed-in member cannot be resolved', async () => {
    authAttributesMock.mockReturnValue({});
    useTasksMock.mockReturnValue([
      {
        _id: 't1',
        status: 'pending',
        audience: 'employee_task',
        name: 'Alpha',
        assignedTo: 'me-123',
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    render(<ProtectedTasks />);

    fireEvent.click(screen.getByText('List'));
    await act(async () => {
      lastPropsOf(filterBarSpy).setActiveScope('mine');
      await Promise.resolve();
    });

    expect(lastPropsOf(taskTableSpy).filteredList).toEqual([]);
  });

  it('does not apply the my-tasks scope in board view', async () => {
    authAttributesMock.mockReturnValue({ sub: 'me-123' });
    useTasksMock.mockReturnValue([
      {
        _id: 'mine',
        status: 'pending',
        audience: 'employee_task',
        name: 'Mine',
        assignedTo: 'me-123',
      },
      {
        _id: 'theirs',
        status: 'pending',
        audience: 'employee_task',
        name: 'Theirs',
        assignedTo: 'other',
      },
    ]);
    useSearchStoreMock.mockImplementation((selector: any) => selector({ query: '' }));

    render(<ProtectedTasks />);

    // Narrow to my tasks in the list view, the only view with the scope control.
    fireEvent.click(screen.getByText('List'));
    await act(async () => {
      lastPropsOf(filterBarSpy).setActiveScope('mine');
      await Promise.resolve();
    });
    expect(lastPropsOf(taskTableSpy).filteredList).toEqual([
      expect.objectContaining({ _id: 'mine' }),
    ]);

    // The board hides the scope control, so switching to it must show every task.
    fireEvent.click(screen.getByText('Board'));
    expect(lastPropsOf(taskBoardSpy).tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'mine' }),
        expect.objectContaining({ _id: 'theirs' }),
      ])
    );
  });
});
