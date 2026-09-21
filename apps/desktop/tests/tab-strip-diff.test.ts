import untypedDiff from '../src/pages/tab-strip-diff.js';

// Plain browser script loaded over file:// by the tab bar under a strict CSP,
// so it is required rather than imported - untyped, surface restated here.
interface InsertStep {
  id: string;
  before: string | null;
  isNew: boolean;
}

interface Plan {
  remove: string[];
  insert: InsertStep[];
}

const diff: { plan: (currentIds: string[], nextIds: string[]) => Plan } = untypedDiff;

// Stands in for the strip's child list: the page applies the plan with
// removeChild/insertBefore, and this applies it to an array the same way, so a
// plan that leaves the array in the wrong order would leave the DOM wrong too.
const applyPlan = (currentIds: string[], nextIds: string[]): string[] => {
  const plan = diff.plan(currentIds, nextIds);
  const children = currentIds.filter((id) => !plan.remove.includes(id));
  for (const step of plan.insert) {
    const at = children.indexOf(step.id);
    if (at >= 0) children.splice(at, 1);
    if (step.before === null) {
      children.push(step.id);
    } else {
      const before = children.indexOf(step.before);
      // A `before` the strip does not contain would throw in the real DOM.
      expect(before).toBeGreaterThanOrEqual(0);
      children.splice(before, 0, step.id);
    }
  }
  return children;
};

describe('plan produces the requested order', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['no change', ['a', 'b', 'c'], ['a', 'b', 'c']],
    ['append', ['a', 'b'], ['a', 'b', 'c']],
    ['prepend', ['b', 'c'], ['a', 'b', 'c']],
    ['insert in the middle', ['a', 'c'], ['a', 'b', 'c']],
    ['close the first tab', ['a', 'b', 'c'], ['b', 'c']],
    ['close the middle tab', ['a', 'b', 'c'], ['a', 'c']],
    ['drag a tab to the front', ['a', 'b', 'c'], ['c', 'a', 'b']],
    ['drag a tab to the end', ['a', 'b', 'c'], ['b', 'c', 'a']],
    ['reverse', ['a', 'b', 'c', 'd'], ['d', 'c', 'b', 'a']],
    ['swap two neighbours', ['a', 'b', 'c'], ['a', 'c', 'b']],
    ['replace everything', ['a', 'b'], ['x', 'y']],
    ['first tabs ever', [], ['a', 'b']],
    ['last tab closed', ['a'], []],
    ['reorder and add and remove at once', ['a', 'b', 'c'], ['b', 'd', 'a']],
  ];

  test.each(cases)('%s', (_name, current, next) => {
    expect(applyPlan(current, next)).toEqual(next);
  });
});

describe('plan touches as little as possible', () => {
  test('an unchanged strip is not rebuilt, so focus inside it survives a poll', () => {
    const plan = diff.plan(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(plan.remove).toEqual([]);
    expect(plan.insert).toEqual([]);
  });

  test('a title-only change is no change to the strip’s structure', () => {
    // The page updates text in place; the plan sees only ids.
    expect(diff.plan(['a', 'b'], ['a', 'b']).insert).toHaveLength(0);
  });

  test('appending a tab leaves the existing tabs alone', () => {
    const plan = diff.plan(['a', 'b'], ['a', 'b', 'c']);
    expect(plan.remove).toEqual([]);
    expect(plan.insert).toEqual([{ id: 'c', before: null, isNew: true }]);
  });

  test('closing a tab moves none of the survivors', () => {
    const plan = diff.plan(['a', 'b', 'c'], ['a', 'c']);
    expect(plan.remove).toEqual(['b']);
    expect(plan.insert).toEqual([]);
  });

  test('a single tab dragged to the front moves only that tab', () => {
    const plan = diff.plan(['a', 'b', 'c'], ['c', 'a', 'b']);
    expect(plan.insert).toEqual([{ id: 'c', before: 'a', isNew: false }]);
  });
});

describe('plan reports which elements must be created', () => {
  test('a tab already in the strip is reused, never recreated', () => {
    const plan = diff.plan(['a', 'b', 'c'], ['c', 'b', 'a']);
    for (const step of plan.insert) {
      expect(step.isNew).toBe(false);
    }
  });

  test('a tab not in the strip is flagged as new', () => {
    const plan = diff.plan(['a'], ['a', 'b']);
    expect(plan.insert.map((s) => [s.id, s.isNew])).toEqual([['b', true]]);
  });

  test('every id in the new state ends up present exactly once', () => {
    const plan = diff.plan(['a', 'b', 'c'], ['b', 'd', 'a']);
    const created = plan.insert.filter((s) => s.isNew).map((s) => s.id);
    expect(created).toEqual(['d']);
    expect(plan.remove).toEqual(['c']);
  });
});

describe('plan is defensive about its inputs', () => {
  test('a missing or malformed state is treated as empty rather than throwing', () => {
    expect(diff.plan(undefined as unknown as string[], ['a'])).toEqual({
      remove: [],
      insert: [{ id: 'a', before: null, isNew: true }],
    });
    expect(diff.plan(['a'], undefined as unknown as string[])).toEqual({
      remove: ['a'],
      insert: [],
    });
  });
});

describe('plan against randomised strips', () => {
  // A nine-tab strip reordered wholesale. Written out because the failure it
  // pins - a moved id left in the working order, so later steps resolve their
  // `before` against a position the strip does not have - needs seven or more
  // tabs to show up at all, and a narrow fuzz misses it entirely.
  test('a nine-tab strip reshuffled end to end lands in the requested order', () => {
    const current = ['i', 'b', 'g', 'e', 'h', 'f', 'a', 'd', 'c'];
    const next = ['i', 'b', 'g', 'h', 'f', 'c', 'e', 'a', 'd'];
    expect(applyPlan(current, next)).toEqual(next);
  });

  // Deterministic PRNG: a fixed seed keeps a failure reproducible, while the
  // spread covers reorderings the hand-written cases above do not name. The
  // pool is ten wide on purpose - see the case above.
  let seed = 0x5eed;
  const rand = (n: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >>> 8) % n;
  };
  const shuffled = (n: number): string[] => {
    const pool = 'abcdefghij'.split('').slice(0, n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      const held = pool[i] ?? '';
      pool[i] = pool[j] ?? '';
      pool[j] = held;
    }
    return pool;
  };

  test('2000 random current/next pairs all reconcile exactly', () => {
    for (let i = 0; i < 2000; i++) {
      const current = shuffled(1 + rand(9));
      const next = shuffled(1 + rand(10));
      expect(applyPlan(current, next)).toEqual(next);
    }
  });
});
