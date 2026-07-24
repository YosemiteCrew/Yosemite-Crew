import {
  getAgendaCardStyle,
  getTaskCardVariant,
} from '@/app/features/tasks/components/taskCardVisuals';
import { Task } from '@/app/features/tasks/types/task';

const baseTask = (overrides: Partial<Task>): Task =>
  ({
    _id: 't',
    name: 'Task',
    audience: 'EMPLOYEE_TASK',
    status: 'PENDING',
    category: 'CARE',
    source: 'CUSTOM',
    assignedTo: 'u1',
    dueAt: new Date(),
    ...overrides,
  }) as Task;

describe('getTaskCardVariant', () => {
  it('always returns the parent variant for pet-parent tasks regardless of status', () => {
    expect(getTaskCardVariant(baseTask({ audience: 'PARENT_TASK', status: 'COMPLETED' }))).toBe(
      'parent'
    );
  });

  it('maps completed / cancelled / in-progress statuses to their variants', () => {
    expect(getTaskCardVariant(baseTask({ status: 'COMPLETED' }))).toBe('completed');
    expect(getTaskCardVariant(baseTask({ status: 'CANCELLED' }))).toBe('cancelled');
    expect(getTaskCardVariant(baseTask({ status: 'IN_PROGRESS' }))).toBe('in_progress');
  });

  it('splits pending into requested (today/past) and upcoming (future)', () => {
    expect(getTaskCardVariant(baseTask({ status: 'PENDING' }), false)).toBe('requested');
    expect(getTaskCardVariant(baseTask({ status: 'PENDING' }), true)).toBe('upcoming');
    // Defaults to non-future when the flag is omitted.
    expect(getTaskCardVariant(baseTask({ status: 'PENDING' }))).toBe('requested');
  });
});

describe('getAgendaCardStyle', () => {
  it('returns the pink glow treatment for parent tasks on the screen surface', () => {
    const style = getAgendaCardStyle('parent');
    expect(style.background).toBe('var(--screen)');
    expect(style.borderColor).toBe('var(--pink)');
    expect(style.textColor).toBe('var(--ink)');
    expect(style.metaColor).toBe('var(--ink-faint)');
    expect(style.boxShadow).toBe('0 4px 12px var(--glow-p12)');
  });

  it('maps each tinted variant to its status token family without a glow', () => {
    const cases: Array<[Parameters<typeof getAgendaCardStyle>[0], string]> = [
      ['completed', 'completed'],
      ['cancelled', 'cancelled'],
      ['in_progress', 'in-progress'],
      ['upcoming', 'upcoming'],
      ['requested', 'requested'],
    ];
    cases.forEach(([variant, token]) => {
      const style = getAgendaCardStyle(variant);
      expect(style.background).toBe(`var(--status-${token}-bg)`);
      expect(style.borderColor).toBe(`var(--status-${token}-border)`);
      expect(style.textColor).toBe(`var(--status-${token}-text)`);
      expect(style.metaColor).toBe(`var(--status-${token}-text)`);
      expect(style.boxShadow).toBeUndefined();
    });
  });
});
