import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PhoneTaskDayList from '@/app/features/appointments/components/Calendar/PhoneTaskDayList';
import type { Task, TaskStatus } from '@/app/features/tasks/types/task';

jest.mock('react-icons/io5', () => ({
  IoCheckmark: () => <span data-testid="icon-check" />,
  IoChevronBack: () => <span data-testid="icon-back" />,
  IoChevronForward: () => <span data-testid="icon-forward" />,
}));

const NOW = new Date('2026-07-16T12:00:00.000Z');

const makeTask = (overrides: Partial<Task> & { _id: string; dueAt: Date }): Task => ({
  assignedTo: 'user-1',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'GENERAL',
  name: 'Task',
  status: 'PENDING' as TaskStatus,
  ...overrides,
});

const OVERDUE = makeTask({
  _id: 'overdue-1',
  name: 'Give Poppy her meds',
  dueAt: new Date('2026-07-16T11:34:00Z'),
});
const TODAY = makeTask({
  _id: 'today-1',
  name: 'Restock kennel 3',
  dueAt: new Date('2026-07-16T15:00:00Z'),
  companionId: 'companion-1',
});
const DONE = makeTask({
  _id: 'done-1',
  name: 'Clean the OR',
  status: 'COMPLETED',
  dueAt: new Date('2026-07-16T09:00:00Z'),
});
const PARENT = makeTask({
  _id: 'parent-1',
  name: 'Upload vaccination record',
  audience: 'PARENT_TASK',
  assignedTo: 'parent-9',
  dueAt: new Date('2026-07-16T16:00:00Z'),
});
const SOMEONE_ELSE = makeTask({
  _id: 'other-1',
  name: 'Order suture kits',
  assignedTo: 'user-2',
  dueAt: new Date('2026-07-16T17:00:00Z'),
});

const renderList = (props: Partial<React.ComponentProps<typeof PhoneTaskDayList>> = {}) => {
  const setCurrentDate = jest.fn();
  const onToggleTask = jest.fn();
  const onViewTask = jest.fn();
  const utils = render(
    <PhoneTaskDayList
      tasks={[OVERDUE, TODAY, DONE, PARENT, SOMEONE_ELSE]}
      currentDate={NOW}
      setCurrentDate={setCurrentDate}
      canEditTasks
      currentUserId="user-1"
      resolveDisplayName={(id) => (id === 'user-2' ? 'Dr Weber' : '')}
      companionNameById={{ 'companion-1': 'Luna Kim' }}
      onToggleTask={onToggleTask}
      onViewTask={onViewTask}
      now={NOW}
      {...props}
    />
  );
  return { ...utils, setCurrentDate, onToggleTask, onViewTask };
};

describe('PhoneTaskDayList', () => {
  it('groups tasks under Overdue and Today with counts', () => {
    renderList();
    expect(screen.getByRole('heading', { name: 'Overdue · 1' })).toBeInTheDocument();
    // The parent task sits outside the default "Everyone" (team) scope.
    expect(screen.getByRole('heading', { name: 'Today · 3' })).toBeInTheDocument();
  });

  it('counts only the tasks the current scope actually shows', () => {
    renderList();
    expect(screen.getByRole('heading', { name: 'Tasks (4)' })).toBeInTheDocument();
  });

  it('renders the overdue subtitle with lateness and the assignee', () => {
    renderList();
    expect(screen.getByText('Due 13:34 · 26 min overdue · you')).toBeInTheDocument();
  });

  it('names another practitioner rather than saying "you"', () => {
    renderList();
    expect(screen.getByText('Due 19:00 · Dr Weber')).toBeInTheDocument();
  });

  it('marks a completed task done and strikes its title through', () => {
    renderList();
    const card = screen.getByTestId('phone-task-task:done-1');
    expect(within(card).getByText('Clean the OR')).toHaveClass('line-through');
    expect(within(card).getByRole('button', { name: 'Complete Clean the OR' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('shows a companion avatar only when the task is linked to one', () => {
    renderList();
    expect(
      within(screen.getByTestId('phone-task-task:today-1')).getByText('LK')
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('phone-task-task:overdue-1')).queryByText('LK')).toBeNull();
  });

  it('renders a status badge per task', () => {
    renderList();
    expect(
      within(screen.getByTestId('phone-task-task:done-1')).getByText('Done')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('phone-task-task:today-1')).getByText('Pending')
    ).toBeInTheDocument();
  });

  it('completes a pending task through the real status flow', async () => {
    const { onToggleTask } = renderList();
    await userEvent.click(screen.getByRole('button', { name: 'Complete Restock kennel 3' }));
    expect(onToggleTask).toHaveBeenCalledWith(TODAY);
  });

  it('reopens a completed task', async () => {
    const { onToggleTask } = renderList();
    await userEvent.click(screen.getByRole('button', { name: 'Complete Clean the OR' }));
    expect(onToggleTask).toHaveBeenCalledWith(DONE);
  });

  it('disables the checkbox without edit permission', async () => {
    const { onToggleTask } = renderList({ canEditTasks: false });
    const checkbox = screen.getByRole('button', { name: 'Complete Restock kennel 3' });
    expect(checkbox).toBeDisabled();
    await userEvent.click(checkbox);
    expect(onToggleTask).not.toHaveBeenCalled();
  });

  it('opens a task when its body is tapped', async () => {
    const { onViewTask } = renderList();
    await userEvent.click(screen.getByText('Restock kennel 3'));
    expect(onViewTask).toHaveBeenCalledWith(TODAY);
  });

  it('filters to the signed-in user on My board', async () => {
    renderList();
    await userEvent.click(screen.getByRole('button', { name: 'My board' }));
    expect(screen.getByText('Restock kennel 3')).toBeInTheDocument();
    expect(screen.queryByText('Order suture kits')).toBeNull();
    expect(screen.queryByText('Upload vaccination record')).toBeNull();
  });

  it('shows only parent tasks on Parents', async () => {
    renderList();
    await userEvent.click(screen.getByRole('button', { name: 'Parents' }));
    expect(screen.getByText('Upload vaccination record')).toBeInTheDocument();
    expect(screen.queryByText('Restock kennel 3')).toBeNull();
  });

  it('excludes parent tasks from Everyone', () => {
    renderList();
    expect(screen.queryByText('Upload vaccination record')).toBeNull();
    expect(screen.getByText('Order suture kits')).toBeInTheDocument();
  });

  it('shows no tasks on My board when the user has no id', async () => {
    renderList({ currentUserId: '' });
    await userEvent.click(screen.getByRole('button', { name: 'My board' }));
    expect(screen.getByText('No tasks due in this window.')).toBeInTheDocument();
  });

  it('renders an empty state when nothing is due', () => {
    renderList({ tasks: [] });
    expect(screen.getByText('No tasks due in this window.')).toBeInTheDocument();
  });

  it('steps the day backwards and forwards', async () => {
    const { setCurrentDate } = renderList();
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(setCurrentDate).toHaveBeenCalledTimes(1);
    const back = setCurrentDate.mock.calls[0][0] as (prev: Date) => Date;
    expect(back(new Date('2026-07-16T12:00:00Z')).getDate()).toBe(15);

    await userEvent.click(screen.getByRole('button', { name: 'Next day' }));
    const forward = setCurrentDate.mock.calls[1][0] as (prev: Date) => Date;
    expect(forward(new Date('2026-07-16T12:00:00Z')).getDate()).toBe(17);
  });

  it('jumps back to today', async () => {
    const { setCurrentDate } = renderList();
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(setCurrentDate).toHaveBeenCalledWith(NOW);
  });

  it('defaults the reference instant to now when none is injected', () => {
    renderList({ now: undefined, tasks: [TODAY] });
    expect(screen.getByRole('heading', { name: 'Tasks (1)' })).toBeInTheDocument();
  });
});
