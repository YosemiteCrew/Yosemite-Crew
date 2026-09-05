import { EMPTY_COMPANION_TASK, EMPTY_TASK } from '@/app/features/tasks/types/task';

// `dueAt` is an accessor so that importing this module under SSR does not bake
// the server's start-up instant into every blank task for the life of the
// process. These tests are what stops it going back to a `new Date()` literal.
describe.each([
  ['EMPTY_TASK', EMPTY_TASK, 'EMPLOYEE_TASK'],
  ['EMPTY_COMPANION_TASK', EMPTY_COMPANION_TASK, 'PARENT_TASK'],
])('%s', (_name, emptyTask, audience) => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the current time on every access rather than one frozen at import', () => {
    jest.setSystemTime(new Date('2026-03-01T09:00:00.000Z'));
    const first = emptyTask.dueAt!.getTime();

    jest.setSystemTime(new Date('2026-03-02T09:00:00.000Z'));

    expect(emptyTask.dueAt!.getTime()).toBe(first + 86_400_000);
  });

  it('snapshots a plain date when spread, so a copy does not keep moving', () => {
    jest.setSystemTime(new Date('2026-03-01T09:00:00.000Z'));
    const draft = { ...emptyTask };

    jest.setSystemTime(new Date('2026-03-02T09:00:00.000Z'));

    expect(draft.dueAt).toEqual(new Date('2026-03-01T09:00:00.000Z'));
  });

  it('still ships the blank-form defaults the callers rely on', () => {
    expect(emptyTask.audience).toBe(audience);
    expect(emptyTask.status).toBe('PENDING');
    expect(emptyTask.recurrence).toEqual({ type: 'ONCE', isMaster: false });
  });
});
