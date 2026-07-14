import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('paints the pink pet-parent accent and strikes completed markers', () => {
    const slotEvents: Task[] = [
      {
        name: 'Parent Visit',
        dueAt: new Date('2025-01-06T10:05:00Z'),
        status: 'PENDING',
        assignedTo: 'user-1',
        _id: 'parent-1',
        audience: 'PARENT_TASK',
        source: 'CUSTOM',
        category: '',
      } as Task,
      {
        name: 'Wrap Up',
        dueAt: new Date('2025-01-06T10:35:00Z'),
        status: 'COMPLETED',
        assignedTo: 'user-1',
        _id: 'done-1',
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

    const parentMarker = screen.getByRole('button', { name: /Parent Visit/i });
    const parentStyle = parentMarker.getAttribute('style') ?? '';
    expect(parentStyle).toContain('var(--pink)');
    expect(parentStyle).toContain('var(--screen)');

    // Employee tasks keep the warm-bone status tokens (no pink).
    const employeeMarker = screen.getByRole('button', { name: /Wrap Up/i });
    expect(employeeMarker.getAttribute('style') ?? '').not.toContain('var(--pink)');
    expect(screen.getByText('Wrap Up')).toHaveClass('line-through');
    expect(screen.getByText('Parent Visit')).not.toHaveClass('line-through');
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

  it('renders the trailing border and compact markers in zoom-out mode', () => {
    const slotEvents: Task[] = [
      {
        name: 'Zoomed',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'PENDING',
        assignedTo: 'user-1',
        _id: 'z-1',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: '',
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        dayIndex={1}
        length={1}
        height={200}
        zoomMode="out"
      />
    );

    const section = screen.getByRole('region', { name: /Tasks slot for/i });
    expect(section.className).toContain('border-r');

    const marker = screen.getByTitle(/Zoomed/);
    expect(marker.getAttribute('style')).toContain('border-radius: 9999px');
    expect(marker.className).toContain('rounded-full');
    // Zoom-out markers hide the inner name/time text.
    expect(screen.queryByText('Zoomed')).not.toBeInTheDocument();
  });

  it('paints grid lines, slot offsets and the last-hour rule', () => {
    const { container } = render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={200}
        hour={9}
        layout={{ showGridLines: true, slotOffsetMinutes: [15, 30, 45], isLastVisibleHour: true }}
      />
    );

    expect(container.querySelector('[style*="top: 25%"]')).toBeInTheDocument();
    expect(container.querySelector('.top-full')).toBeInTheDocument();
  });

  it('omits the last-hour rule when the slot is not the last visible hour', () => {
    const { container } = render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={200}
        hour={9}
        layout={{ showGridLines: true, slotOffsetMinutes: [] }}
      />
    );

    expect(container.querySelector('.top-full')).not.toBeInTheDocument();
  });

  it('ignores drag events when nothing is being dragged', () => {
    const onTaskDropAt = jest.fn();

    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={180}
        hour={10}
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        onTaskDropAt={onTaskDropAt}
      />
    );

    const slot = screen.getByRole('region', { name: /Tasks slot/i });
    fireEvent.dragOver(slot, { clientX: 5, clientY: 30 });
    fireEvent.dragLeave(slot, { relatedTarget: null });
    fireEvent.drop(slot, { clientX: 5, clientY: 30 });

    expect(onTaskDropAt).not.toHaveBeenCalled();
  });

  it('ignores a drop when no drop handler is provided', () => {
    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={180}
        hour={10}
        draggedTaskId="d-1"
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
      />
    );

    const slot = screen.getByRole('region', { name: /Tasks slot/i });
    expect(() => fireEvent.drop(slot, { clientX: 5, clientY: 30 })).not.toThrow();
  });

  it('reports the hover target, shows the fallback preview label and skips out-of-hour availability', () => {
    const onDragHoverTarget = jest.fn();

    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={180}
        hour={10}
        draggedTaskId="d-1"
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        onDragHoverTarget={onDragHoverTarget}
        onTaskDropAt={jest.fn()}
        dropAvailabilityIntervals={[
          { startMinute: 600, endMinute: 659 },
          { startMinute: 700, endMinute: 720 },
        ]}
      />
    );

    const slot = screen.getByRole('region', { name: /Tasks slot/i });
    fireEvent.dragOver(slot, { clientX: 5, clientY: 30 });
    expect(onDragHoverTarget).toHaveBeenCalledWith(expect.any(Date), undefined);
    // No draggedTaskLabel provided -> the preview falls back to the "Task" label.
    expect(screen.getByText('Task')).toBeInTheDocument();

    fireEvent.dragLeave(slot, { relatedTarget: null });
    expect(screen.queryByText('Task')).not.toBeInTheDocument();
  });

  it('clears the drop preview when the drag leaves the slot', () => {
    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={180}
        hour={10}
        draggedTaskId="d-1"
        draggedTaskLabel="Moving"
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        onTaskDropAt={jest.fn()}
        dropAvailabilityIntervals={[{ startMinute: 600, endMinute: 659 }]}
      />
    );

    const slot = screen.getByRole('region', { name: /Tasks slot/i });
    fireEvent.dragOver(slot, { clientX: 5, clientY: 30 });
    expect(screen.getByText('Moving')).toBeInTheDocument();

    // Leaving the slot (no related target inside it) clears the drop preview.
    fireEvent.dragLeave(slot, { relatedTarget: null });
    expect(screen.queryByText('Moving')).not.toBeInTheDocument();
  });

  it('does not drop when there is no available minute', () => {
    (calcNearestAvailableMinute as jest.Mock).mockReturnValue(null);
    const onTaskDropAt = jest.fn();

    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={180}
        hour={10}
        draggedTaskId="d-1"
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        onTaskDropAt={onTaskDropAt}
        dropAvailabilityIntervals={[{ startMinute: 600, endMinute: 659 }]}
      />
    );

    const slot = screen.getByRole('region', { name: /Tasks slot/i });
    fireEvent.drop(slot, { clientX: 5, clientY: 30 });

    expect(onTaskDropAt).not.toHaveBeenCalled();
  });

  it('creates a task at the pointer minute using the measured slot height', () => {
    const onCreateTaskAt = jest.fn();

    render(
      <TaskSlot
        slotEvents={[]}
        handleViewTask={handleViewTask}
        height={240}
        hour={9}
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        onCreateTaskAt={onCreateTaskAt}
      />
    );

    const createButton = screen.getByRole('button', { name: /Create task on/i });
    const section = createButton.parentElement as HTMLElement;
    section.getBoundingClientRect = jest.fn(() => ({
      top: 0,
      left: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as HTMLElement['getBoundingClientRect'];

    fireEvent.click(createButton, { clientY: 60 });
    // ratio 0.5 of the hour (540 base) rounded to the nearest 5 minutes -> 570.
    expect(onCreateTaskAt).toHaveBeenCalledWith(expect.any(Date), 570, undefined);
  });

  it('supports dragging markers and pointer popover interactions', () => {
    const canDragTask = jest.fn((task: Task) => task.status === 'PENDING');
    const onTaskDragStart = jest.fn();
    const onTaskDragEnd = jest.fn();
    const slotEvents: Task[] = [
      {
        name: 'Draggable',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'PENDING',
        assignedTo: 'user-1',
        assignedBy: 'user-1',
        _id: 'd-1',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: 'General',
      } as Task,
      {
        name: 'Locked',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'COMPLETED',
        assignedTo: 'user-1',
        _id: 'l-1',
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
        canDragTask={canDragTask}
        onTaskDragStart={onTaskDragStart}
        onTaskDragEnd={onTaskDragEnd}
      />
    );

    const marker = screen.getByTitle(/Draggable/);
    expect(marker).toHaveAttribute('draggable', 'true');
    expect(screen.getByTitle(/Locked/)).toHaveAttribute('draggable', 'false');

    fireEvent.mouseEnter(marker, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(marker, { clientX: 12, clientY: 12 });
    expect(screen.getByRole('dialog', { name: 'Draggable' })).toBeInTheDocument();

    fireEvent.dragStart(marker);
    expect(onTaskDragStart).toHaveBeenCalledWith(slotEvents[0]);
    fireEvent.dragEnd(marker);
    expect(onTaskDragEnd).toHaveBeenCalled();

    fireEvent.mouseLeave(marker);
    fireEvent.blur(marker);
    fireEvent.mouseEnter(marker);
  });

  it('handles unknown status markers and empty task names', () => {
    const slotEvents: Task[] = [
      {
        name: '',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'ARCHIVED',
        assignedTo: '',
        _id: 'u-1',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: '',
      } as unknown as Task,
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

    const marker = screen.getByTitle(/Due/);
    // Unknown status falls back to the PENDING marker tokens.
    expect(marker.getAttribute('style')).toContain('var(--status-requested-bg)');
    // Empty name renders the placeholder in the marker body.
    expect(screen.getByText('-')).toBeInTheDocument();

    fireEvent.focus(marker);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('-').length).toBeGreaterThan(0);
  });

  it('shows editable popover actions and resolves assignee names', () => {
    const handleRescheduleTask = jest.fn();
    const resolveDisplayName = jest.fn((id?: string) => (id === 'mgr' ? 'Manager Sam' : '-'));
    const slotEvents: Task[] = [
      {
        name: 'Editable',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'PENDING',
        assignedBy: 'mgr',
        assignedTo: 'ghost',
        _id: 'e-1',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: 'General',
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        handleRescheduleTask={handleRescheduleTask}
        permissions={{ canEditTasks: true }}
        index={0}
        length={1}
        height={200}
        resolveDisplayName={resolveDisplayName}
      />
    );

    fireEvent.focus(screen.getByTitle(/Editable/));
    const dialog = screen.getByRole('dialog', { name: 'Editable' });
    // A resolved name is used directly.
    expect(within(dialog).getByText('Manager Sam')).toBeInTheDocument();
    // A "-" resolution falls back to the raw id.
    expect(within(dialog).getByText('ghost')).toBeInTheDocument();
    expect(within(dialog).getAllByText('General').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reschedule task' }));
    expect(handleRescheduleTask).toHaveBeenCalledWith(slotEvents[0]);
  });

  it('changes task status from the popover', () => {
    const handleChangeStatusTask = jest.fn();
    const slotEvents: Task[] = [
      {
        name: 'Progressing',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'IN_PROGRESS',
        assignedBy: 'u',
        assignedTo: 'u',
        _id: 'p-1',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: 'C',
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        handleChangeStatusTask={handleChangeStatusTask}
        permissions={{ canEditTasks: true }}
        index={0}
        length={1}
        height={200}
      />
    );

    fireEvent.focus(screen.getByTitle(/Progressing/));
    const dialog = screen.getByRole('dialog', { name: 'Progressing' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change task status' }));
    expect(handleChangeStatusTask).toHaveBeenCalledWith(slotEvents[0]);
  });

  it('hides editable actions for completed tasks and closes on view', () => {
    const slotEvents: Task[] = [
      {
        name: 'Done',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'COMPLETED',
        assignedTo: '',
        _id: 'c-1',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: '',
      } as Task,
    ];

    render(
      <TaskSlot
        slotEvents={slotEvents}
        handleViewTask={handleViewTask}
        permissions={{ canEditTasks: true }}
        index={0}
        length={1}
        height={200}
      />
    );

    fireEvent.focus(screen.getByTitle(/Done/));
    const dialog = screen.getByRole('dialog', { name: 'Done' });
    expect(
      within(dialog).queryByRole('button', { name: 'Change task status' })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Reschedule task' })
    ).not.toBeInTheDocument();
    // From/To/Category all render the "-" placeholder for a completed task with no assignees.
    expect(within(dialog).getAllByText('-').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'View task' }));
    expect(handleViewTask).toHaveBeenCalledWith(slotEvents[0]);

    return waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Done' })).not.toBeInTheDocument()
    );
  });

  it('exercises the popover dialog hover, focus and cancel handlers', () => {
    const slotEvents: Task[] = [
      {
        name: 'Hovered',
        dueAt: new Date('2025-01-06T10:00:00Z'),
        status: 'PENDING',
        assignedBy: 'u',
        assignedTo: 'u',
        _id: 'h-1',
        audience: 'EMPLOYEE_TASK',
        source: 'CUSTOM',
        category: 'C',
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

    fireEvent.focus(screen.getByTitle(/Hovered/));
    const dialog = screen.getByRole('dialog', { name: 'Hovered' });

    fireEvent.mouseEnter(dialog);
    fireEvent.mouseLeave(dialog);
    fireEvent.mouseEnter(dialog);
    fireEvent.focus(dialog);
    fireEvent.blur(dialog);
    fireEvent.focus(dialog);
    expect(dialog).toBeInTheDocument();

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Hovered' })).not.toBeInTheDocument();
  });
});
