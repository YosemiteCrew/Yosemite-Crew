import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
const taskCalendarSpy = jest.fn();
const taskTableSpy = jest.fn();
const taskBoardSpy = jest.fn();

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

jest.mock('@/app/ui/filters/Filters', () => () => <div data-testid="filters" />);

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

jest.mock('@/app/features/tasks/pages/Tasks/Sections/AddTask', () => () => (
  <div data-testid="add-task" />
));

jest.mock('@/app/features/tasks/pages/Tasks/Sections/TaskInfo', () => () => (
  <div data-testid="task-info" />
));

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
});
