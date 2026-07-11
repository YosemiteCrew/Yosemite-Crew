import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskBoard from '@/app/features/tasks/components/TaskBoard';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { useNotify } from '@/app/hooks/useNotify';
import { canTransitionTaskStatus } from '@/app/lib/tasks';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt}</span>,
}));

jest.mock('@/app/hooks/useBoardDragScroll', () => ({
  useBoardDragScroll: () => ({ autoScrollBoardOnDrag: jest.fn() }),
}));

jest.mock('@/app/lib/buildDragPreview', () => ({
  buildDragPreview: () => {
    const el = document.createElement('div');
    return Object.assign(el, { remove: jest.fn() });
  },
}));

jest.mock('@/app/config/statusConfig', () => ({
  getStatusStyle: () => ({ backgroundColor: '#eee', color: '#111' }),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  changeTaskStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/lib/timezone', () => ({
  isOnPreferredTimeZoneCalendarDay: jest.fn(() => true),
  formatDateInPreferredTimeZone: jest.fn((_date: Date, opts: any) =>
    opts?.weekday ? 'Monday, Mar 31, 2026' : 'Mar 31, 2026'
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      back
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Next', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      next
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date('2026-04-01T00:00:00Z'))}>
      select-date
    </button>
  ),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [
    { _id: 'team-1', practionerId: 'user-1', name: 'Dr One' },
    { _id: 'team-2', practionerId: 'user-2', name: 'Dr Two' },
  ],
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: { sub: 'user-1' } }),
}));

jest.mock('@/app/ui/primitives/BoardScopeToggle/BoardScopeToggle', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <div>
      <button type="button" onClick={() => onChange(false)}>
        all-tasks
      </button>
      <button type="button" onClick={() => onChange(true)}>
        my-tasks
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ content, children }: any) => <div data-testid={`tooltip-${content}`}>{children}</div>,
}));

jest.mock('@/app/hooks/useMemberMap', () => ({
  useMemberMap: () => ({ resolveMemberName: (id: string) => id }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/lib/tasks', () => ({
  canRescheduleTask: jest.fn(() => true),
  canTransitionTaskStatus: jest.fn(() => true),
  canShowTaskStatusChangeAction: jest.fn(() => true),
  getInvalidTaskStatusTransitionMessage: jest.fn(() => 'invalid transition'),
  getPreferredNextTaskStatus: jest.fn(() => 'IN_PROGRESS'),
  getTaskQuickDetails: jest.fn(() => [{ label: 'Priority', value: 'High' }]),
}));

jest.mock('react-icons/io5', () => ({
  IoAdd: () => <span>add</span>,
  IoEyeOutline: () => <span>view</span>,
}));

jest.mock('react-icons/md', () => ({
  MdOutlineAutorenew: () => <span>renew</span>,
}));

jest.mock('react-icons/io', () => ({
  IoIosCalendar: () => <span>calendar</span>,
}));

describe('TaskBoard', () => {
  const setCurrentDate = jest.fn();
  const setActiveTask = jest.fn();
  const setViewPopup = jest.fn();
  const setChangeStatusPopup = jest.fn();
  const setChangeStatusPreferredStatus = jest.fn();
  const setReschedulePopup = jest.fn();
  const onAddTask = jest.fn();
  const notifyMock = jest.fn();

  const tasks = [
    {
      _id: 'task-1',
      name: 'Task One',
      status: 'PENDING',
      dueAt: new Date('2026-03-31T10:00:00Z'),
      assignedBy: 'user-1',
      assignedTo: 'user-1',
    },
    {
      _id: 'task-2',
      name: 'Task Two',
      status: 'IN_PROGRESS',
      dueAt: new Date('2026-03-31T11:00:00Z'),
      assignedBy: 'user-1',
      assignedTo: 'user-2',
    },
  ] as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
  });

  const renderBoard = (overrides: Partial<React.ComponentProps<typeof TaskBoard>> = {}) =>
    render(
      <TaskBoard
        tasks={tasks}
        currentDate={new Date('2026-03-31T00:00:00Z')}
        setCurrentDate={setCurrentDate}
        canEditTasks
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setReschedulePopup={setReschedulePopup}
        onAddTask={onAddTask}
        {...overrides}
      />
    );

  it('renders board columns and toolbar actions', () => {
    renderBoard();

    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'next' })).toBeInTheDocument();
  });

  it('opens task, status-change and reschedule flows from task card actions', () => {
    renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Open task Task One' }));
    expect(setActiveTask).toHaveBeenCalledWith(expect.objectContaining({ _id: 'task-1' }));
    expect(setViewPopup).toHaveBeenCalledWith(true);

    const statusAction = within(screen.getAllByTestId('tooltip-Change status')[0]).getByRole(
      'button'
    );
    fireEvent.click(statusAction);
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);
    expect(setChangeStatusPreferredStatus).toHaveBeenCalled();

    const rescheduleAction = within(screen.getAllByTestId('tooltip-Reschedule')[0]).getByRole(
      'button'
    );
    fireEvent.click(rescheduleAction);
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it('moves task to another status on drop', async () => {
    renderBoard();

    const dataTransfer = {
      effectAllowed: '',
      setData: jest.fn(),
      getData: jest.fn(),
      setDragImage: jest.fn(),
    };

    const card = screen.getByRole('button', { name: 'Open task Task One' }).closest('article');
    expect(card).not.toBeNull();
    fireEvent.dragStart(card!, { dataTransfer });

    const inProgressHeader = screen.getAllByText('In progress')[0];
    const column = inProgressHeader.closest('div')?.parentElement?.parentElement;
    expect(column).not.toBeNull();
    fireEvent.drop(column!, { dataTransfer });

    await waitFor(() => {
      expect(changeTaskStatus).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'task-1', status: 'IN_PROGRESS' })
      );
    });
  });

  it('shows warning and blocks drop for invalid status transition', async () => {
    (canTransitionTaskStatus as jest.Mock).mockReturnValue(false);
    renderBoard();

    const dataTransfer = {
      effectAllowed: '',
      setData: jest.fn(),
      getData: jest.fn(),
      setDragImage: jest.fn(),
    };

    const card = screen.getByRole('button', { name: 'Open task Task One' }).closest('article');
    fireEvent.dragStart(card!, { dataTransfer });

    const completedHeader = screen.getByText('Completed');
    const column = completedHeader.closest('div')?.parentElement?.parentElement;
    fireEvent.drop(column!, { dataTransfer });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Status change blocked' })
      );
    });
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });
});
