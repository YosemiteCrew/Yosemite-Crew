import {
  resolvePreventionCover,
  shouldWarnAboutCover,
} from '@/features/parasiteRisk/utils/preventionCover';
import type {Task} from '@/features/tasks/types';

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

describe('shouldWarnAboutCover', () => {
  it('warns only when cover is missing or lapsed', () => {
    expect(shouldWarnAboutCover({status: 'none'})).toBe(true);
    expect(shouldWarnAboutCover({status: 'lapsed', daysOverdue: 1})).toBe(true);
    expect(
      shouldWarnAboutCover({status: 'covered', lastCompletedAt: null}),
    ).toBe(false);
  });
});
