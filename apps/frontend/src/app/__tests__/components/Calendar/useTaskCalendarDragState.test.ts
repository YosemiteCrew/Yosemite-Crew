import { createTaskDropHandler } from '@/app/features/appointments/components/Calendar/useTaskCalendarDragState';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/lib/logger', () => ({ logger: { warn: jest.fn() } }));

describe('createTaskDropHandler', () => {
  const date = new Date('2026-07-12T00:00:00Z');

  afterEach(() => jest.clearAllMocks());

  it('moves the task, then ends the drag', async () => {
    const moveTask = jest.fn().mockResolvedValue(undefined);
    const onDragEnd = jest.fn();
    const handle = createTaskDropHandler(moveTask, onDragEnd);

    handle(date, 540, 'assignee-1');
    await Promise.resolve();

    expect(moveTask).toHaveBeenCalledWith(date, 540, 'assignee-1');
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('logs a warning when the move fails but still ends the drag', async () => {
    const moveTask = jest.fn().mockRejectedValue(new Error('boom'));
    const onDragEnd = jest.fn();
    const handle = createTaskDropHandler(moveTask, onDragEnd);

    handle(date, 600);
    await Promise.resolve();
    await Promise.resolve();

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to move task from calendar drop.',
      expect.any(Error)
    );
  });
});
