import {
  resolvePreventionCover,
  shouldWarnAboutCover,
} from '@/features/parasiteRisk/utils/preventionCover';
import apiClient from '@/shared/services/apiClient';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
import {taskApi} from '@/features/tasks/services/taskService';
import tasksReducer from '@/features/tasks/taskSlice';
import {fetchTasksForCompanion} from '@/features/tasks/thunks';
import {selectTasksByCompanion} from '@/features/tasks/selectors';
import type {RootState} from '@/app/store';
import type {Task} from '@/features/tasks/types';

jest.mock('@/shared/services/apiClient');
jest.mock('@/features/auth/sessionManager');
jest.mock('@/features/observationalTools/services/observationToolService');
jest.mock('@/shared/utils/cdnHelpers');

const NOW = Date.parse('2026-07-29T12:00:00.000Z');
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
const daysAhead = (n: number) =>
  new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    companionId: 'companion-1',
    category: 'health',
    subcategory: 'parasite-prevention',
    title: 'Flea and tick prevention',
    date: daysAgo(1),
    frequency: 'monthly',
    reminderEnabled: false,
    reminderOptions: null,
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    status: 'pending',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
    details: {description: ''},
    ...overrides,
  }) as Task;

describe('resolvePreventionCover', () => {
  it('reports no cover when the pet has no prevention tasks at all', () => {
    expect(resolvePreventionCover([], NOW)).toEqual({status: 'none'});
  });

  it('ignores tasks from other categories', () => {
    const vaccination = task({subcategory: 'vaccination'});
    expect(resolvePreventionCover([vaccination], NOW)).toEqual({
      status: 'none',
    });
  });

  it('reports lapsed cover with the number of days overdue', () => {
    const overdue = task({dueAt: daysAgo(9), status: 'pending'});

    expect(resolvePreventionCover([overdue], NOW)).toEqual({
      status: 'lapsed',
      daysOverdue: 9,
    });
  });

  it('measures the gap from the oldest outstanding task', () => {
    const cover = resolvePreventionCover(
      [
        task({id: 'a', dueAt: daysAgo(3), status: 'pending'}),
        task({id: 'b', dueAt: daysAgo(21), status: 'pending'}),
      ],
      NOW,
    );

    // How long there has actually been a gap, not how recent the last miss was.
    expect(cover).toEqual({status: 'lapsed', daysOverdue: 21});
  });

  it('treats a scheduled future task as covered', () => {
    const upcoming = task({dueAt: daysAhead(5), status: 'pending'});

    expect(resolvePreventionCover([upcoming], NOW)).toMatchObject({
      status: 'covered',
    });
  });

  it('treats a completed task as covered even though it is in the past', () => {
    const done = task({
      dueAt: daysAgo(10),
      status: 'completed',
      completedAt: daysAgo(10),
    });

    expect(resolvePreventionCover([done], NOW)).toMatchObject({
      status: 'covered',
      lastCompletedAt: daysAgo(10),
    });
  });

  it('expires completed cover after its recurrence interval', () => {
    const done = task({
      dueAt: daysAgo(45),
      status: 'completed',
      completedAt: daysAgo(45),
      frequency: 'monthly',
    });

    expect(resolvePreventionCover([done], NOW)).toEqual({
      status: 'lapsed',
      daysOverdue: 14,
    });
  });

  it('does not infer ongoing cover from a completed one-off task', () => {
    const done = task({
      status: 'completed',
      completedAt: daysAgo(1),
      frequency: 'once',
    });

    expect(resolvePreventionCover([done], NOW)).toEqual({status: 'none'});
  });

  it('accepts the uppercase API status as completed', () => {
    const done = task({dueAt: daysAgo(4), status: 'COMPLETED'});
    expect(resolvePreventionCover([done], NOW)).toMatchObject({
      status: 'covered',
    });
  });

  it('does not count a cancelled task as a gap in cover', () => {
    const cancelled = task({dueAt: daysAgo(30), status: 'cancelled'});
    expect(resolvePreventionCover([cancelled], NOW)).toEqual({status: 'none'});
  });

  it('accepts the uppercase API status as cancelled', () => {
    const cancelled = task({dueAt: daysAgo(30), status: 'CANCELLED'});
    expect(resolvePreventionCover([cancelled], NOW)).toEqual({status: 'none'});
  });

  it('reports the newest completion when several tasks are done', () => {
    const cover = resolvePreventionCover(
      [
        task({id: 'a', status: 'completed', completedAt: daysAgo(40)}),
        task({id: 'b', status: 'COMPLETED', completedAt: daysAgo(6)}),
      ],
      NOW,
    );

    expect(cover).toEqual({status: 'covered', lastCompletedAt: daysAgo(6)});
  });

  it('still reports lapsed when an older task was completed but a newer one is overdue', () => {
    const cover = resolvePreventionCover(
      [
        task({id: 'a', dueAt: daysAgo(40), status: 'completed'}),
        task({id: 'b', dueAt: daysAgo(6), status: 'pending'}),
      ],
      NOW,
    );

    expect(cover).toEqual({status: 'lapsed', daysOverdue: 6});
  });

  it('falls back to the start date when there is no due timestamp', () => {
    const overdue = task({dueAt: undefined, date: daysAgo(2)});
    expect(resolvePreventionCover([overdue], NOW)).toEqual({
      status: 'lapsed',
      daysOverdue: 2,
    });
  });
});

// The cover check is only as good as what survives hydration, so this walks a
// server task all the way through the mapper, the reducer and the selector.
describe('prevention cover after hydration from the API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'access-token',
      userId: 'user-1',
      expiresAt: Date.now() + 60_000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  it('keeps parasite-prevention from the API response through to covered', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: [
        {
          _id: 'api-task-1',
          patientId: 'companion-1',
          category: 'CUSTOM',
          subcategory: 'parasite-prevention',
          name: 'Flea and tick prevention',
          status: 'COMPLETED',
          dueAt: daysAgo(4),
          completedAt: daysAgo(4),
          recurrence: {type: 'WEEKLY'},
        },
      ],
    });

    const fetched = await taskApi.list({companionId: 'companion-1'});
    expect(fetched[0].subcategory).toBe('parasite-prevention');

    const state = tasksReducer(
      undefined,
      fetchTasksForCompanion.fulfilled(
        {companionId: 'companion-1', tasks: fetched},
        'request-1',
        {companionId: 'companion-1'},
      ),
    );
    const stored = selectTasksByCompanion('companion-1')({
      tasks: state,
    } as unknown as RootState);

    expect(stored).toHaveLength(1);
    expect(stored[0].subcategory).toBe('parasite-prevention');

    const cover = resolvePreventionCover(stored, NOW);
    expect(cover).toMatchObject({status: 'covered'});
    expect(shouldWarnAboutCover(cover)).toBe(false);
  });
});

describe('shouldWarnAboutCover', () => {
  it('warns only when cover is missing or lapsed', () => {
    expect(shouldWarnAboutCover({status: 'none'})).toBe(true);
    expect(shouldWarnAboutCover({status: 'lapsed', daysOverdue: 1})).toBe(true);
    expect(
      shouldWarnAboutCover({status: 'covered', lastCompletedAt: null}),
    ).toBe(false);
  });
});
