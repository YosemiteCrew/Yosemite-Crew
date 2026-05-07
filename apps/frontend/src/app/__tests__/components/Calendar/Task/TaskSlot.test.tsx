import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import TaskSlot from '@/app/features/appointments/components/Calendar/Task/TaskSlot';
import { Task } from '@/app/features/tasks/types/task';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/ui/tables/Tasks', () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: 'pink', color: 'white' })),
}));

jest.mock('@/app/features/appointments/components/Calendar/calendarDrop', () => ({
  calcNearestAvailableMinute: jest.fn((minute: number) => minute),
}));

import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

expect.extend(toHaveNoViolations);

describe('TaskSlot', () => {
  const handleViewTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ _id: 'user-1', name: 'Alex' }]);
    (calcNearestAvailableMinute as jest.Mock).mockImplementation((minute: number) => minute);
  });

  it('renders tasks with member names and triggers view handler', () => {
    const slotEvents: Task[] = [
      {
        name: 'Task A',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'PENDING',
        assignedTo: 'user-1',
        _id: '',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: '',
      } as Task,
      {
        name: 'Task B',
        dueAt: new Date('2025-01-06T11:00:00Z'),
        status: 'COMPLETED',
        _id: '',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: '',
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        index={0}
        length={1}
        height={200}
      />
    );

    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
    expect(screen.getByText(/Due:\s*11:00 AM/)).toBeInTheDocument();
    expect(screen.getByText(/Due:\s*12:00 PM/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle('View task')[0]);
    expect(handleViewTask).toHaveBeenCalledWith(slotEvents[0]);

    const container = screen.getByText('Task A').closest('button')!.parentElement;
    expect(container).toHaveStyle('height: 98px');
  });

  it('renders empty slot area when no tasks exist', () => {
    render(
      <TaskSlot slotEvents={[]} handleViewTask={handleViewTask} index={1} length={1} height={180} />
    );

    const slotContainer = screen.getByRole('region', { name: /Tasks slot for/i });
    expect(slotContainer).toBeInTheDocument();
    expect(slotContainer).toHaveStyle('height: 180px');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('creates task from slot click and double click', () => {
    const onCreateTaskAt = jest.fn();

    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={180}
        hour={10}
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        onCreateTaskAt={onCreateTaskAt}
      />
    );

    const createButton = screen.getByRole('button', { name: /Create task on/i });
    fireEvent.click(createButton, { clientY: 40 });
    fireEvent.doubleClick(createButton, { clientY: 60 });

    expect(onCreateTaskAt).toHaveBeenCalledTimes(2);
  });

  it('handles drop for dragged task with nearest available minute', () => {
    const onTaskDropAt = jest.fn();
    (calcNearestAvailableMinute as jest.Mock).mockReturnValue(625);

    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={180}
        hour={10}
        draggedTaskId="task-1"
        draggedTaskLabel="Dragged Task"
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        onTaskDropAt={onTaskDropAt}
        dropAvailabilityIntervals={[{ startMinute: 600, endMinute: 659 }]}
      />
    );

    const slot = screen.getByRole('region', { name: /Tasks slot for/i });
    fireEvent.dragOver(slot, { clientX: 12, clientY: 55 });
    fireEvent.drop(slot, { clientX: 12, clientY: 55 });

    expect(onTaskDropAt).toHaveBeenCalledWith(expect.any(Date), 625, undefined);
  });

  it('has no axe accessibility violations when the task popover is open', async () => {
    const slotEvents: Task[] = [
      {
        name: 'Task A',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'PENDING',
        assignedBy: 'user-1',
        assignedTo: 'user-1',
        _id: 'task-a',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: 'General',
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        index={0}
        length={1}
        height={200}
      />
    );

    fireEvent.focus(screen.getByRole('button', { name: /Task A/i }));

    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('wires task markers to a non-modal dialog popover and closes on Escape', () => {
    const slotEvents: Task[] = [
      {
        name: 'Task A',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'PENDING',
        assignedBy: 'user-1',
        assignedTo: 'user-1',
        _id: 'task-a',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: 'General',
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        index={0}
        length={1}
        height={200}
      />
    );

    const trigger = screen.getByRole('button', { name: /Task A/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.focus(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Task A' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.getAttribute('id'));
    expect(dialog).toHaveAttribute('aria-modal', 'false');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    return waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Task A' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
