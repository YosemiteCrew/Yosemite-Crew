import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskWeekAgenda from '@/app/features/tasks/components/TaskWeekAgenda';

// Deterministic Monday-aligned week starting at whatever currentDate we pass.
jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getStartOfWeek: (d: Date) => d,
  getWeekDays: (start: Date) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      return day;
    }),
}));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

jest.mock('@/app/lib/timezone', () => ({
  formatDateInPreferredTimeZone: (date: Date, opts: any = {}) => {
    const d = new Date(date);
    if (opts.weekday === 'long') return `long-${d.getDate()}`;
    if (opts.weekday === 'short') return DAYS_SHORT[d.getDay()];
    if (opts.hour) return `${String(d.getHours()).padStart(2, '0')}:00`;
    if (opts.month === 'short' && opts.day == null) return MONTHS[d.getMonth()];
    return String(d.getDate());
  },
  isOnPreferredTimeZoneCalendarDay: (a: Date, b: Date) => {
    const x = new Date(a);
    const y = new Date(b);
    return (
      x.getFullYear() === y.getFullYear() &&
      x.getMonth() === y.getMonth() &&
      x.getDate() === y.getDate()
    );
  },
}));

jest.mock('@/app/hooks/useMemberMap', () => ({
  useMemberMap: () => ({
    resolveMemberName: (id: string) => {
      if (id === 'u1') return 'Dr One';
      if (id === 'unknown') return '-';
      return id;
    },
  }),
}));

let mockAuthAttributes: Record<string, string> = { sub: 'me' };
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: mockAuthAttributes }),
}));

describe('TaskWeekAgenda', () => {
  const setActiveTask = jest.fn();
  const setViewPopup = jest.fn();
  const onCreateFromCalendarSlot = jest.fn();

  // Week: Mon Jul 6 2026 .. Sun Jul 12 2026; "today" is Wed Jul 8.
  const monday = new Date(2026, 6, 6);

  const tasks = [
    {
      _id: 'mon',
      name: 'Mon Task',
      status: 'PENDING',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'u1',
      dueAt: new Date(2026, 6, 6, 10, 0),
    },
    {
      _id: 'wed',
      name: 'Wed Task',
      status: 'IN_PROGRESS',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'me',
      dueAt: new Date(2026, 6, 8, 11, 0),
    },
    {
      _id: 'fri',
      name: 'Fri Task',
      status: 'PENDING',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'u1',
      dueAt: new Date(2026, 6, 10, 14, 0),
    },
    {
      _id: 'parent',
      name: 'Parent Task',
      status: 'PENDING',
      audience: 'PARENT_TASK',
      category: 'CARE',
      assignedTo: 'u1',
      dueAt: new Date(2026, 6, 9, 9, 0),
    },
    {
      _id: 'done',
      name: 'Done Task',
      status: 'COMPLETED',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'u1',
      dueAt: new Date(2026, 6, 8, 8, 0),
    },
    {
      _id: 'unassigned',
      name: 'Unassigned Task',
      status: 'PENDING',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: '',
      dueAt: new Date(2026, 6, 7, 12, 0),
    },
    {
      _id: 'unknown',
      name: 'Unknown Assignee',
      status: 'PENDING',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'unknown',
      dueAt: new Date(2026, 6, 7, 13, 0),
    },
    {
      // Falls outside the visible week → filtered out.
      _id: 'offweek',
      name: 'Off Week',
      status: 'PENDING',
      audience: 'EMPLOYEE_TASK',
      category: 'CARE',
      assignedTo: 'u1',
      dueAt: new Date(2026, 6, 20, 9, 0),
    },
  ] as any;

  const renderAgenda = (overrides: Partial<React.ComponentProps<typeof TaskWeekAgenda>> = {}) =>
    render(
      <TaskWeekAgenda
        filteredList={tasks}
        currentDate={monday}
        weekStart={monday}
        canEditTasks
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        onCreateFromCalendarSlot={onCreateFromCalendarSlot}
        {...overrides}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthAttributes = { sub: 'me' };
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 8, 9, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lays out a 7-day agenda board and marks today', () => {
    renderAgenda();
    // One column header per day of the visible week; today (Wed 8) is marked.
    const headers = ['MON 6', 'TUE 7', 'WED 8 · today', 'THU 9', 'FRI 10', 'SAT 11', 'SUN 12'];
    headers.forEach((label) => {
      expect(
        screen.getByText(
          (_content, element) => element?.tagName === 'SPAN' && element.textContent === label
        )
      ).toBeInTheDocument();
    });
  });

  it('leaves the week-range navigator to the page title row', () => {
    renderAgenda();
    expect(screen.queryByRole('button', { name: 'Previous week' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next week' })).not.toBeInTheDocument();
    expect(screen.queryByText('6 – 12 Jul')).not.toBeInTheDocument();
  });

  it('places tasks in their due-day columns and drops off-week tasks', () => {
    renderAgenda();
    expect(screen.getByRole('button', { name: 'Open task Mon Task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open task Wed Task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open task Parent Task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open task Off Week' })).not.toBeInTheDocument();
  });

  it('opens a task when its card is clicked', () => {
    renderAgenda();
    fireEvent.click(screen.getByRole('button', { name: 'Open task Mon Task' }));
    expect(setActiveTask).toHaveBeenCalledWith(expect.objectContaining({ _id: 'mon' }));
    expect(setViewPopup).toHaveBeenCalledWith(true);
  });

  it('tints pending cards requested (today/past) and upcoming (future)', () => {
    renderAgenda();
    const monCard = screen.getByRole('button', { name: 'Open task Mon Task' });
    expect(monCard.getAttribute('style')).toContain('var(--status-requested-bg)');
    const friCard = screen.getByRole('button', { name: 'Open task Fri Task' });
    expect(friCard.getAttribute('style')).toContain('var(--status-upcoming-bg)');
  });

  it('renders parent tasks with the pink accent and completed tasks struck through', () => {
    renderAgenda();
    const parentCard = screen.getByRole('button', { name: 'Open task Parent Task' });
    expect(parentCard.getAttribute('style')).toContain('var(--pink)');
    expect(screen.getByText(/^Parent task/)).toBeInTheDocument();

    const doneCard = screen.getByRole('button', { name: 'Open task Done Task' });
    expect(doneCard).toHaveClass('opacity-75');
    expect(screen.getByText('Done Task').parentElement?.className).toContain('line-through');
  });

  it('labels the current user as "you" and resolves / omits other assignees', () => {
    renderAgenda();
    // Wed task assigned to the auth user.
    expect(screen.getByText(/· you$/)).toBeInTheDocument();
    // Known members resolved by name (Mon + Fri tasks both assigned to u1).
    expect(screen.getAllByText(/Dr One$/).length).toBeGreaterThan(0);
    // Unknown / empty assignees drop the trailing name segment.
    expect(screen.getByText('Care · 12:00')).toBeInTheDocument();
    expect(screen.getByText('Care · 13:00')).toBeInTheDocument();
  });

  it('creates a task from a day column at the default hour', () => {
    renderAgenda();
    const addButtons = screen.getAllByRole('button', { name: /^Add task on/ });
    expect(addButtons).toHaveLength(7);
    fireEvent.click(addButtons[0]);
    expect(onCreateFromCalendarSlot).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: expect.any(Date) })
    );
    const { dueAt } = onCreateFromCalendarSlot.mock.calls[0][0];
    expect(dueAt.getHours()).toBe(9);
    expect(dueAt.getDate()).toBe(6);
  });

  it('hides the per-column add affordance when editing is not allowed', () => {
    renderAgenda({ canEditTasks: false });
    expect(screen.queryByRole('button', { name: /^Add task on/ })).not.toBeInTheDocument();
    // Cards still render and remain openable.
    expect(screen.getByRole('button', { name: 'Open task Mon Task' })).toBeInTheDocument();
  });

  it('handles edge-case cards: cancelled tint, unnamed, empty category, parentless meta', () => {
    const edge = [
      {
        _id: 'cancel',
        name: 'Cancelled Task',
        status: 'CANCELLED',
        audience: 'EMPLOYEE_TASK',
        category: 'CARE',
        assignedTo: 'u1',
        dueAt: new Date(2026, 6, 6, 10, 0),
      },
      {
        _id: 'noname',
        name: '',
        status: 'PENDING',
        audience: 'EMPLOYEE_TASK',
        category: '',
        assignedTo: '',
        dueAt: new Date(2026, 6, 6, 11, 0),
      },
      {
        _id: 'bareparent',
        name: 'Bare Parent',
        status: 'PENDING',
        audience: 'PARENT_TASK',
        category: 'CARE',
        assignedTo: '',
        dueAt: new Date(2026, 6, 6, 12, 0),
      },
    ] as any;
    renderAgenda({ filteredList: edge });

    // Cancelled task → cancelled status tint.
    expect(
      screen.getByRole('button', { name: 'Open task Cancelled Task' }).getAttribute('style')
    ).toContain('var(--status-cancelled-bg)');
    // Empty name → dash placeholder in the aria label.
    expect(screen.getByRole('button', { name: 'Open task -' })).toBeInTheDocument();
    // Empty category → "Task" fallback in the meta line.
    expect(screen.getByText(/^Task ·/)).toBeInTheDocument();
    // Parent task with no assignee → meta collapses to just "Parent task".
    expect(screen.getByText('Parent task')).toBeInTheDocument();
  });
});
