// The page helper is a plain browser script: Preferences loads it over file://
// under a strict CSP, and the sandboxed preload cannot share a compiled module
// with it either. It also assigns `module.exports`, so it imports here -
// untyped, hence the surface restated below for the type checker.
import untypedView from '../src/pages/settings-view.js';

interface SyncStatus {
  state?: string;
  pendingMutations?: number;
  dirtyRows?: number;
}

const view: {
  syncStatusLabel: (status: SyncStatus | null | undefined) => string;
  saveFeedback: (rejected: unknown) => { message: string; tone: string };
  FIELD_LABELS: Record<string, string>;
  TIME_HINT: string;
  SEP: string;
} = untypedView;

describe('syncStatusLabel', () => {
  describe('plain language for a quiet queue', () => {
    test.each([
      ['idle', 'Up to date'],
      ['pending', 'Pending local changes'],
      ['offline', 'Offline'],
      ['error', 'Last sync failed'],
      ['blocked', 'Waiting for sync endpoint'],
      ['not-ready', 'Starting up'],
    ])('%s reads as %s', (state, expected) => {
      expect(view.syncStatusLabel({ state, pendingMutations: 0, dirtyRows: 0 })).toBe(expected);
    });
  });

  /*
   * The row read "Up to date - pending 0 - dirty rows 0": two internal counters
   * shown at zero, with a separator used nowhere else on the page (issue
   * #3298).
   */
  test('says nothing about counters when nothing is queued', () => {
    const label = view.syncStatusLabel({ state: 'idle', pendingMutations: 0, dirtyRows: 0 });
    expect(label).toBe('Up to date');
    expect(label).not.toMatch(/0/);
    expect(label.toLowerCase()).not.toContain('pending');
    expect(label.toLowerCase()).not.toContain('dirty');
  });

  test('never names dirty rows, whatever the count', () => {
    // dirtyRows is a property of the local store that no user can act on, so it
    // has no wording at all rather than a friendlier one.
    const label = view.syncStatusLabel({ state: 'pending', pendingMutations: 3, dirtyRows: 12 });
    expect(label.toLowerCase()).not.toContain('dirty');
    expect(label).not.toContain('12');
  });

  test.each([
    [1, '1 change waiting to sync'],
    [2, '2 changes waiting to sync'],
    [31, '31 changes waiting to sync'],
  ])('%i queued reads as %s', (pendingMutations, expected) => {
    expect(view.syncStatusLabel({ state: 'pending', pendingMutations })).toBe(expected);
  });

  test('a state that still adds information keeps it, joined by the page separator', () => {
    expect(view.syncStatusLabel({ state: 'offline', pendingMutations: 3 })).toBe(
      'Offline' + view.SEP + '3 changes waiting to sync'
    );
    expect(view.syncStatusLabel({ state: 'error', pendingMutations: 1 })).toBe(
      'Last sync failed' + view.SEP + '1 change waiting to sync'
    );
  });

  test('a state that would contradict or repeat the count is dropped', () => {
    // "Up to date · 3 changes waiting to sync" contradicts itself, and
    // "Pending local changes · 3 changes waiting to sync" repeats itself.
    expect(view.syncStatusLabel({ state: 'idle', pendingMutations: 3 })).toBe(
      '3 changes waiting to sync'
    );
    expect(view.syncStatusLabel({ state: 'pending', pendingMutations: 3 })).toBe(
      '3 changes waiting to sync'
    );
  });

  test('the separator is the one the Update channel hint already uses', () => {
    expect(view.SEP).toBe(' · ');
  });

  test.each([
    [undefined, 'Unknown'],
    [null, 'Unknown'],
    [{}, 'Unknown'],
    [{ state: 'reticulating' }, 'Unknown'],
  ])('%p has no state to report', (status, expected) => {
    expect(view.syncStatusLabel(status as SyncStatus)).toBe(expected);
  });

  test('a count that is not a number is treated as no count', () => {
    expect(view.syncStatusLabel({ state: 'idle', pendingMutations: Number.NaN as number })).toBe(
      'Up to date'
    );
    expect(
      view.syncStatusLabel({ state: 'idle', pendingMutations: 'lots' as unknown as number })
    ).toBe('Up to date');
  });
});

describe('saveFeedback', () => {
  /*
   * The page said "Saved" whenever the IPC call resolved, which was true of the
   * call and not of the field the user had just typed into (issue #3298).
   */
  test('an accepted submission confirms the save', () => {
    expect(view.saveFeedback([])).toEqual({ message: 'Saved', tone: 'ok' });
  });

  test('a refused field is named, and the message is not a confirmation', () => {
    const feedback = view.saveFeedback(['dndStart']);
    expect(feedback.tone).toBe('error');
    expect(feedback.message).toBe('Do not disturb start time not saved');
    expect(feedback.message).not.toContain('Saved');
  });

  test('two refused fields are joined into one sentence', () => {
    expect(view.saveFeedback(['dndStart', 'dndEnd']).message).toBe(
      'Do not disturb start time and Do not disturb end time not saved'
    );
  });

  test('three refused fields keep the list readable', () => {
    expect(view.saveFeedback(['dndStart', 'dndEnd', 'theme']).message).toBe(
      'Do not disturb start time, Do not disturb end time and theme not saved'
    );
  });

  test('a field with no label is named by its key rather than dropped', () => {
    // A new free-text setting is then visibly unlabelled instead of invisibly
    // unreported.
    expect(view.saveFeedback(['brandNewSetting']).message).toBe('brandNewSetting not saved');
  });

  test.each([[undefined], [null], ['dndStart'], [{ dndStart: true }]])(
    'a non-array %p is read as nothing refused',
    (rejected) => {
      expect(view.saveFeedback(rejected)).toEqual({ message: 'Saved', tone: 'ok' });
    }
  );

  test('every labelled field is one the user can type a bad value into', () => {
    // The labels exist to name a refusal in the page's own words; a key here
    // that Preferences renders as a select or a checkbox cannot be refused, and
    // would be a label that never appears.
    expect(Object.keys(view.FIELD_LABELS).sort()).toEqual(['dndEnd', 'dndStart']);
  });

  test('the inline hint states the accepted range', () => {
    expect(view.TIME_HINT).toBe('Enter a time between 00:00 and 23:59.');
  });
});
