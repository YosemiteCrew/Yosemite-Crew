import * as taskCalendarInteractionPropsModule from '@/app/features/appointments/components/Calendar/Task/taskCalendarInteractionProps';
import type { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import type { Task } from '@/app/features/tasks/types/task';

type TaskCalendarInteractionProps = taskCalendarInteractionPropsModule.TaskCalendarInteractionProps;

describe('TaskCalendarInteractionProps contract', () => {
  it('is a type-only module with zero runtime exports', () => {
    expect(Object.keys(taskCalendarInteractionPropsModule)).toEqual([]);
  });

  const task = { id: 'task-1', title: 'Recheck bandage' } as unknown as Task;
  const date = new Date('2026-08-15T09:00:00Z');
  const intervals: DropAvailabilityInterval[] = [{ startMinute: 480, endMinute: 720 }];

  it('accepts an empty object because every field is optional', () => {
    const minimal: TaskCalendarInteractionProps = {};
    expect(minimal.canEditTasks).toBeUndefined();
    expect(minimal.resolveDisplayName).toBeUndefined();
  });

  it('accepts a fully populated object and wires every handler', () => {
    const canDragTask = jest.fn((candidate: Task) => candidate === task);
    const onTaskDragStart = jest.fn();
    const onTaskDragEnd = jest.fn();
    const onTaskDropAt = jest.fn();
    const onCreateTaskAt = jest.fn();
    const onDragHoverTarget = jest.fn();
    const getDropAvailabilityIntervals = jest.fn(() => intervals);
    const resolveDisplayName = jest.fn((memberId?: string) => memberId ?? 'Unassigned');

    const props: TaskCalendarInteractionProps = {
      canEditTasks: true,
      draggedTaskId: 'task-1',
      draggedTaskLabel: 'Recheck bandage',
      canDragTask,
      onTaskDragStart,
      onTaskDragEnd,
      onTaskDropAt,
      onCreateTaskAt,
      onDragHoverTarget,
      getDropAvailabilityIntervals,
      draggedTaskDurationMinutes: 45,
      slotStepMinutes: 15,
      resolveDisplayName,
    };

    expect(props.canDragTask?.(task)).toBe(true);
    props.onTaskDragStart?.(task);
    props.onTaskDragEnd?.();
    props.onTaskDropAt?.(date, 510, 'member-1');
    props.onCreateTaskAt?.(date, 540);
    props.onDragHoverTarget?.(date, 'member-1');

    expect(onTaskDragStart).toHaveBeenCalledWith(task);
    expect(onTaskDragEnd).toHaveBeenCalledTimes(1);
    expect(onTaskDropAt).toHaveBeenCalledWith(date, 510, 'member-1');
    expect(onCreateTaskAt).toHaveBeenCalledWith(date, 540);
    expect(onDragHoverTarget).toHaveBeenCalledWith(date, 'member-1');

    expect(props.getDropAvailabilityIntervals?.(date, 'member-1')).toEqual(intervals);
    expect(props.resolveDisplayName?.('member-1')).toBe('member-1');
    expect(props.resolveDisplayName?.(undefined)).toBe('Unassigned');
  });

  it('allows null for the dragged-task id and label', () => {
    const props: TaskCalendarInteractionProps = {
      draggedTaskId: null,
      draggedTaskLabel: null,
    };
    expect(props.draggedTaskId).toBeNull();
    expect(props.draggedTaskLabel).toBeNull();
  });
});
