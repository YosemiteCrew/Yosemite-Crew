import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskBoard from '@/app/features/tasks/components/TaskBoard';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="next-image">{alt}</span>,
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
  getStatusStyle: () => ({ backgroundColor: '#eee', color: '#111', borderColor: '#222' }),
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

// Real, computed helpers — NOT constant mocks — so per-status conditional
// rendering (draggable, status-change action, reschedule, quick details)
// actually varies with the task fed in.
jest.mock('@/app/lib/tasks', () => jest.requireActual('@/app/lib/tasks'));

const teamMock = jest.fn();
jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => teamMock(),
}));

let mockAuthAttributes: Record<string, string> = { sub: 'user-1' };
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: mockAuthAttributes }),
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
  useMemberMap: () => ({
    resolveMemberName: (id: string) => (id === 'unnamed' || id === 'lost' ? '-' : id),
  }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
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

const makeDataTransfer = () => ({
  effectAllowed: '',
  setData: jest.fn(),
  getData: jest.fn(),
  setDragImage: jest.fn(),
});

describe('TaskBoard', () => {
  const setCurrentDate = jest.fn();
  const setActiveTask = jest.fn();
  const setViewPopup = jest.fn();
  const setChangeStatusPopup = jest.fn();
  const setChangeStatusPreferredStatus = jest.fn();
  const setReschedulePopup = jest.fn();
  const onAddTask = jest.fn();
  const notifyMock = jest.fn();

  const defaultTeam = [
    { _id: 'team-1', practionerId: 'user-1', name: 'Dr One', image: 'http://img/u1.png' },
    { _id: 'team-2', practionerId: 'user-2', name: 'Dr Two' },
  ];

  const tasks = [
    {
      _id: 'task-1',
      name: 'Task One',
      status: 'PENDING',
      category: 'Grooming',
      description: 'Trim nails',
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
    mockAuthAttributes = { sub: 'user-1' };
    teamMock.mockReturnValue(defaultTeam);
    (changeTaskStatus as jest.Mock).mockResolvedValue(undefined);
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
    // getPreferredNextTaskStatus('PENDING') → 'IN_PROGRESS'
    expect(setChangeStatusPreferredStatus).toHaveBeenCalledWith('IN_PROGRESS');

    const rescheduleAction = within(screen.getAllByTestId('tooltip-Reschedule')[0]).getByRole(
      'button'
    );
    fireEvent.click(rescheduleAction);
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it('opens the task from the dedicated view (eye) action button', () => {
    renderBoard();

    // The eye button lives in its own "View task" tooltip; its onClick calls
    // preventDefault/stopPropagation before opening the task (Build.tsx L236-240).
    const viewAction = within(screen.getAllByTestId('tooltip-View task')[0]).getByRole('button');
    fireEvent.click(viewAction);

    expect(setActiveTask).toHaveBeenCalledWith(expect.objectContaining({ _id: 'task-1' }));
    expect(setViewPopup).toHaveBeenCalledWith(true);
  });

  it('renders computed quick-details and the category value', () => {
    renderBoard();
    // getTaskQuickDetails(task).slice(0,2) → Category + Description
    expect(screen.getAllByText('Category:').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Grooming')).toBeInTheDocument();
    expect(screen.getByText('Trim nails')).toBeInTheDocument();
  });

  it('moves task to another status on drop', async () => {
    renderBoard();

    const dataTransfer = makeDataTransfer();

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

  it('shows the transient updating indicator while a status change is in flight', async () => {
    let resolveChange: () => void = () => {};
    (changeTaskStatus as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        })
    );
    renderBoard();

    const dataTransfer = makeDataTransfer();
    const card = screen.getByRole('button', { name: 'Open task Task One' }).closest('article');
    fireEvent.dragStart(card!, { dataTransfer });
    const column = screen.getAllByText('In progress')[0].closest('div')
      ?.parentElement?.parentElement;
    fireEvent.drop(column!, { dataTransfer });

    expect(await screen.findByText('Updating...')).toBeInTheDocument();
    await act(async () => {
      resolveChange();
    });
    await waitFor(() => expect(screen.queryByText('Updating...')).not.toBeInTheDocument());
  });

  it('is a no-op when dropping onto the same status column', async () => {
    renderBoard();
    const dataTransfer = makeDataTransfer();
    const card = screen.getByRole('button', { name: 'Open task Task One' }).closest('article');
    fireEvent.dragStart(card!, { dataTransfer });
    // Drop the PENDING task back onto the Pending column.
    const pendingColumn = screen.getAllByText('Pending')[0].closest('div')
      ?.parentElement?.parentElement;
    fireEvent.drop(pendingColumn!, { dataTransfer });
    await Promise.resolve();
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('paints task card status badges with theme-aware status tokens', () => {
    renderBoard();

    const pendingCard = screen
      .getByRole('button', { name: 'Open task Task One' })
      .closest('article');
    const pendingBadge = pendingCard!.querySelector('[style*="--status-requested-bg"]');
    expect(pendingBadge).not.toBeNull();
    expect(pendingBadge!.getAttribute('style')).toContain('color: var(--status-requested-text)');

    const inProgressCard = screen
      .getByRole('button', { name: 'Open task Task Two' })
      .closest('article');
    const inProgressBadge = inProgressCard!.querySelector('[style*="--status-in-progress-bg"]');
    expect(inProgressBadge).not.toBeNull();
    expect(inProgressBadge!.getAttribute('style')).toContain(
      'color: var(--status-in-progress-text)'
    );
  });

  it('shows warning and blocks drop for invalid status transition', async () => {
    renderBoard();

    const dataTransfer = makeDataTransfer();

    // Drag the IN_PROGRESS task onto the Pending column — IN_PROGRESS → PENDING is not allowed.
    const card = screen.getByRole('button', { name: 'Open task Task Two' }).closest('article');
    fireEvent.dragStart(card!, { dataTransfer });

    const pendingColumn = screen.getAllByText('Pending')[0].closest('div')
      ?.parentElement?.parentElement;
    fireEvent.drop(pendingColumn!, { dataTransfer });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Status change blocked' })
      );
    });
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('renders the pink pet-parent accent only for parent tasks', () => {
    renderBoard({
      tasks: [
        {
          _id: 'p1',
          name: 'Parent Care',
          status: 'PENDING',
          audience: 'PARENT_TASK',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-1',
        },
        {
          _id: 'e1',
          name: 'Team Care',
          status: 'PENDING',
          audience: 'EMPLOYEE_TASK',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-2',
        },
      ] as any,
    });

    expect(screen.getByText('Parent task')).toBeInTheDocument();

    const parentCard = screen
      .getByRole('button', { name: 'Open task Parent Care' })
      .closest('article');
    expect(parentCard).toHaveClass('border-[var(--pink)]');

    const teamCard = screen.getByRole('button', { name: 'Open task Team Care' }).closest('article');
    expect(teamCard).not.toHaveClass('border-[var(--pink)]');
    expect(teamCard).toHaveClass('border-card-border');
  });

  it('mutes completed and cancelled task titles and hides their status/reschedule actions', () => {
    renderBoard({
      tasks: [
        {
          _id: 'c1',
          name: 'Done Task',
          status: 'COMPLETED',
          audience: 'EMPLOYEE_TASK',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-1',
        },
        {
          _id: 'x1',
          name: 'Void Task',
          status: 'CANCELLED',
          audience: 'EMPLOYEE_TASK',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-1',
        },
      ] as any,
    });

    expect(screen.getByText('Done Task')).toHaveClass('line-through');
    expect(screen.getByText('Void Task')).toHaveClass('line-through');

    const doneCard = screen.getByRole('button', { name: 'Open task Done Task' }).closest('article');
    expect(doneCard).toHaveClass('opacity-70');
    // Completed / cancelled → canShowTaskStatusChangeAction + canRescheduleTask are false.
    expect(doneCard).toHaveAttribute('draggable', 'false');
    expect(screen.queryByTestId('tooltip-Change status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tooltip-Reschedule')).not.toBeInTheDocument();
  });

  it('applies and clears dragging styles on drag start and end', () => {
    renderBoard();
    const card = screen.getByRole('button', { name: 'Open task Task One' }).closest('article')!;
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    expect(card).toHaveClass('opacity-60');
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'task-1');

    fireEvent.dragEnd(card);
    expect(card).not.toHaveClass('opacity-60');
  });

  it('falls back to a dash for tasks without a name', () => {
    renderBoard({
      tasks: [
        {
          _id: 'nn',
          name: '',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-2',
        },
      ] as any,
    });
    expect(screen.getByRole('button', { name: 'Open task -' })).toBeInTheDocument();
  });

  it('renders a dash identity when a task has no assignee ids at all', () => {
    renderBoard({
      tasks: [
        {
          _id: 'na',
          name: 'Unassigned',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
        },
      ] as any,
    });

    // assignedBy / assignedTo are undefined → resolveMemberIdentity hits `memberId ?? ''`.
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('renders member avatars for members with images and initials otherwise', () => {
    teamMock.mockReturnValue([
      { _id: 'team-1', practionerId: 'user-1', name: 'Dr One', image: 'http://img/u1.png' },
      { _id: 'team-2', practionerId: 'user-2', name: 'Dr Two', profileUrl: 'http://img/u2.png' },
      { _id: 'unnamed', practionerId: 'unnamed', displayName: 'Display Only' },
      { _id: '', practionerId: '', name: 'No Ids' },
      { _id: 'team-5', userId: 'user-5' },
    ]);
    renderBoard({
      tasks: [
        {
          _id: 'a',
          name: 'A',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-5',
        },
        {
          _id: 'b',
          name: 'B',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-2',
          assignedTo: 'unnamed',
        },
        {
          _id: 'c',
          name: 'C',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'ghost',
          assignedTo: '',
        },
        {
          _id: 'd',
          name: 'D',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'lost',
          assignedTo: 'user-2',
        },
      ] as any,
    });

    // Image branch (member.image / member.profileUrl present).
    expect(screen.getAllByTestId('next-image').length).toBeGreaterThan(0);
    // identity.name branch: resolveMemberName('unnamed') === '-' → identity.name 'Display Only'.
    expect(screen.getByText('Display Only')).toBeInTheDocument();
    // else branch, resolved truthy: unknown id 'ghost' shows raw id.
    expect(screen.getByText('ghost')).toBeInTheDocument();
    // else branch, resolved '-' → teamNameById fallback → raw id 'lost'.
    expect(screen.getByText('lost')).toBeInTheDocument();
  });

  it('adds a task from the Pending column quick-add affordance', () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Add task to Pending' }));
    expect(onAddTask).toHaveBeenCalled();
  });

  it('hides both add affordances when the user cannot edit tasks', () => {
    renderBoard({ canEditTasks: false });
    expect(screen.queryByRole('button', { name: 'Add task to Pending' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument();
  });

  it('shows an empty-state placeholder for columns without tasks', () => {
    renderBoard({ tasks: [] as any });
    expect(screen.getAllByText('No tasks').length).toBe(4);
  });

  it('ignores tasks whose status is not a board column', () => {
    renderBoard({
      tasks: [
        {
          _id: 'z',
          name: 'Ghost Status',
          status: 'ARCHIVED',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-1',
        },
      ] as any,
    });
    expect(screen.queryByText('Ghost Status')).not.toBeInTheDocument();
    expect(screen.getAllByText('No tasks').length).toBe(4);
  });

  it('filters to the current user tasks when the my-tasks scope is toggled', () => {
    renderBoard();
    // Both visible initially.
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByText('Task Two')).toBeInTheDocument();

    fireEvent.click(screen.getByText('my-tasks'));
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.queryByText('Task Two')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('all-tasks'));
    expect(screen.getByText('Task Two')).toBeInTheDocument();
  });

  it('advances and rewinds the board date and accepts a picked date', () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: 'back' }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    fireEvent.click(screen.getByRole('button', { name: 'select-date' }));

    expect(setCurrentDate).toHaveBeenCalledTimes(3);
    const backUpdater = setCurrentDate.mock.calls[0][0] as (d: Date) => Date;
    const nextUpdater = setCurrentDate.mock.calls[1][0] as (d: Date) => Date;
    expect(backUpdater(new Date(2026, 2, 15)).getDate()).toBe(14);
    expect(nextUpdater(new Date(2026, 2, 15)).getDate()).toBe(16);
    // Datepicker passes a concrete date, not an updater.
    expect(setCurrentDate.mock.calls[2][0]).toBeInstanceOf(Date);
  });

  it('no-ops popup callbacks when optional handlers are not provided', () => {
    render(
      <TaskBoard
        tasks={tasks}
        currentDate={new Date('2026-03-31T00:00:00Z')}
        setCurrentDate={setCurrentDate}
        canEditTasks
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open task Task One' }));
    fireEvent.click(within(screen.getAllByTestId('tooltip-Change status')[0]).getByRole('button'));
    fireEvent.click(within(screen.getAllByTestId('tooltip-Reschedule')[0]).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Add task to Pending' }));
    // Handlers were omitted, so the module-level spies are untouched.
    expect(setViewPopup).not.toHaveBeenCalled();
  });

  it('runs the board and column drag listeners with and without an active drag', () => {
    const { container } = renderBoard();
    const boardRoot = container.querySelector('[data-board-scroll-root="true"]') as HTMLElement;
    const flex = boardRoot.firstElementChild as HTMLElement;
    const firstColumn = flex.children[0] as HTMLElement;
    const columnScroll = firstColumn.querySelector('[data-calendar-scroll="true"]') as HTMLElement;
    const dataTransfer = makeDataTransfer();

    // Before any drag starts, listeners early-return (draggedTaskId is null) — including the
    // per-column scroll-area drag-over handler.
    fireEvent.dragOver(boardRoot, { dataTransfer });
    fireEvent.dragOver(firstColumn, { dataTransfer });
    fireEvent.dragOver(columnScroll, { dataTransfer });
    fireEvent.drop(firstColumn, { dataTransfer });
    expect(changeTaskStatus).not.toHaveBeenCalled();

    // Start a drag and re-fire — now the listeners run their bodies.
    const card = screen.getByRole('button', { name: 'Open task Task One' }).closest('article')!;
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(boardRoot, { dataTransfer });
    fireEvent.dragOver(firstColumn, { dataTransfer });
    fireEvent.dragOver(columnScroll, { dataTransfer });
    expect(columnScroll).toBeInTheDocument();
  });

  it('ignores drag listeners entirely when editing is disabled', () => {
    const { container } = renderBoard({ canEditTasks: false });
    const boardRoot = container.querySelector('[data-board-scroll-root="true"]') as HTMLElement;
    const firstColumn = boardRoot.firstElementChild!.children[0] as HTMLElement;
    const dataTransfer = makeDataTransfer();

    const card = screen.getByRole('button', { name: 'Open task Task One' }).closest('article')!;
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(boardRoot, { dataTransfer });
    fireEvent.drop(firstColumn, { dataTransfer });
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('resolves the auth user id via email/cognito/empty fallbacks', () => {
    mockAuthAttributes = { email: 'e@x.com' };
    renderBoard({ tasks: [] as any }).unmount();
    mockAuthAttributes = { 'cognito:username': 'cog' };
    renderBoard({ tasks: [] as any }).unmount();
    mockAuthAttributes = {};
    renderBoard({ tasks: [] as any });
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  it('matches the current user by alternate identity fields', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ _id: 'm', practionerId: 'p9', name: 'P' }, 'p9'],
      [{ _id: 'id9', name: 'I' }, 'id9'],
      [{ userId: 'uid9', name: 'U' }, 'uid9'],
      [{ id: 'x9', name: 'X' }, 'x9'],
      [{ userOrganisation: { userId: 'o9' }, name: 'O' }, 'o9'],
    ];
    cases.forEach(([member, sub]) => {
      teamMock.mockReturnValue([member]);
      mockAuthAttributes = { sub };
      renderBoard({ tasks: [] as any }).unmount();
    });
    expect(teamMock).toHaveBeenCalled();
  });

  it('scopes my-tasks using a member matched by a non-primary id field', () => {
    teamMock.mockReturnValue([{ _id: 'team-2', practionerId: 'user-2', name: 'Dr Two' }]);
    mockAuthAttributes = { sub: 'team-2' };
    renderBoard({
      tasks: [
        {
          _id: 't',
          name: 'Mine',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-2',
          assignedTo: 'user-2',
        },
        {
          _id: 'u',
          name: 'Theirs',
          status: 'PENDING',
          dueAt: new Date('2026-03-31T10:00:00Z'),
          assignedBy: 'user-1',
          assignedTo: 'user-1',
        },
      ] as any,
    });
    fireEvent.click(screen.getByText('my-tasks'));
    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.queryByText('Theirs')).not.toBeInTheDocument();
  });
});
