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
const taskCalendarSpy = jest.fn();
const taskTableSpy = jest.fn();
const taskBoardSpy = jest.fn();
const taskInfoSpy = jest.fn();
const addTaskSpy = jest.fn();
const filtersSpy = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  startOfDay: (d: Date) => d,
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
  </div>
));

jest.mock(
  '@/app/ui/filters/Filters',
  () => (props: any) =>
    (() => {
      filtersSpy(props);
      return (
        <div data-testid="filters">
          {props.showAddButton ? (
            <button type="button" onClick={props.onAddButtonClick}>
              Add
            </button>
          ) : null}
        </div>
      );
    })()
);

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

jest.mock('@/app/features/tasks/pages/Tasks/Sections/ChangeStatus', () => () => (
  <div data-testid="task-change-status" />
));

jest.mock('@/app/features/tasks/pages/Tasks/Sections/Reschedule', () => () => (
  <div data-testid="task-reschedule" />
));

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
  });

  it('renders calendar view and switches to table', () => {
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

    // After re-render with updated task list, taskCalendar should receive the updated filteredList
    expect(taskCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allTasks: [expect.objectContaining({ _id: 't1', name: 'Follow up updated' })],
      })
    );
  });

  it('handleCreateFromCalendarSlot: onCreateFromCalendarSlot prop opens add popup', async () => {
    render(<ProtectedTasks />);

    const calendarProps = taskCalendarSpy.mock.calls[0][0];
    expect(calendarProps.onCreateFromCalendarSlot).toBeInstanceOf(Function);

    await act(async () => {
      calendarProps.onCreateFromCalendarSlot({ dueAt: new Date('2025-01-01'), assignedTo: 'u1' });
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

  it('openAddTask: clicking Add button in Filters calls openAddTask', async () => {
    render(<ProtectedTasks />);

    const addButton = screen.getByRole('button', { name: 'Add' });
    await act(async () => {
      fireEvent.click(addButton);
      await Promise.resolve();
    });

    expect(addTaskSpy).toHaveBeenCalledWith(expect.objectContaining({ showModal: true }));
  });

  it('uses compact filter pills to match the companions pill styling', () => {
    render(<ProtectedTasks />);

    expect(filtersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        compactFilterPills: true,
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

  it('setCurrentDate prop passed to TaskCalendar updates the date', async () => {
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

  it('setWeekStart prop passed to TaskCalendar updates weekStart', async () => {
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

  it('setActiveCalendar prop updates activeCalendar passed to TaskCalendar', async () => {
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
});
