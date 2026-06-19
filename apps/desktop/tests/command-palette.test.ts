import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  scoreFuzzyMatch,
  searchPalette,
  createRecentsStore,
  type PaletteItem,
  type RecentEntry,
} from '../src/ui/command-palette';

const TEST_ACTIONS: PaletteItem[] = [
  {
    id: 'go-dashboard',
    label: 'Dashboard',
    keywords: ['home', 'overview'],
    url: 'yosemitecrew://',
    type: 'navigate',
  },
  {
    id: 'go-appointments',
    label: 'Appointments',
    keywords: ['schedule', 'calendar'],
    url: 'yosemitecrew://appointments',
    type: 'navigate',
  },
  {
    id: 'go-patients',
    label: 'Patients',
    keywords: ['records', 'clients'],
    url: 'yosemitecrew://patients',
    type: 'navigate',
  },
  {
    id: 'action-new-appointment',
    label: 'New appointment',
    keywords: ['create', 'schedule', 'book'],
    url: 'yosemitecrew://appointments/new',
    type: 'action',
  },
  {
    id: 'action-find-patient',
    label: 'Find patient',
    keywords: ['search', 'lookup'],
    url: 'yosemitecrew://patients/find',
    type: 'action',
  },
];

describe('scoreFuzzyMatch', () => {
  test('exact match scores 100', () => {
    expect(scoreFuzzyMatch('dashboard', 'dashboard')).toBe(100);
  });

  test('prefix match scores 90', () => {
    expect(scoreFuzzyMatch('dash', 'dashboard')).toBe(90);
  });

  test('substring match scores 70', () => {
    expect(scoreFuzzyMatch('board', 'dashboard')).toBe(70);
  });

  test('fuzzy match scores between 50-69', () => {
    const score = scoreFuzzyMatch('ds', 'dashboard');
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(70);
  });

  test('higher consecutive chars in fuzzy match boost score', () => {
    const low = scoreFuzzyMatch('ab', 'apple banana');
    const high = scoreFuzzyMatch('app', 'apple banana');
    expect(high).toBeGreaterThan(low);
  });

  test('returns 0 when query chars not all present in order', () => {
    expect(scoreFuzzyMatch('xyz', 'dashboard')).toBe(0);
  });

  test('returns 0 for empty query', () => {
    expect(scoreFuzzyMatch('', 'dashboard')).toBe(0);
  });

  test('is case insensitive', () => {
    expect(scoreFuzzyMatch('DASHBOARD', 'dashboard')).toBe(100);
    expect(scoreFuzzyMatch('dashboard', 'DASHBOARD')).toBe(100);
  });

  test('trims whitespace from query', () => {
    expect(scoreFuzzyMatch('  dash  ', 'dashboard')).toBe(90);
  });
});

describe('searchPalette', () => {
  test('returns empty for empty query', () => {
    expect(searchPalette('', TEST_ACTIONS, [])).toEqual([]);
  });

  test('finds exact match by label', () => {
    const results = searchPalette('Dashboard', TEST_ACTIONS, []);
    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe('go-dashboard');
    expect(results[0].score).toBe(100);
  });

  test('finds match by keyword', () => {
    const results = searchPalette('schedule', TEST_ACTIONS, []);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((r) => r.item.id === 'go-appointments')).toBe(true);
    expect(results.some((r) => r.item.id === 'action-new-appointment')).toBe(true);
  });

  test('returns multiple results sorted by score descending', () => {
    const results = searchPalette('appointment', TEST_ACTIONS, []);
    expect(results.length).toBeGreaterThan(1);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  test('applies recency boost to recently visited items', () => {
    const recents: RecentEntry[] = [
      {
        id: 'go-appointments',
        label: 'Appointments',
        url: 'yosemitecrew://appointments',
        visitedAt: Date.now() - 1000,
      },
    ];
    const results = searchPalette('appointment', TEST_ACTIONS, recents);
    const aptResult = results.find((r) => r.item.id === 'go-appointments');
    expect(aptResult).toBeDefined();
    expect(aptResult!.score).toBeGreaterThan(70);
  });

  test('fuzzy search matches across keywords and label', () => {
    const results = searchPalette('pt', TEST_ACTIONS, []);
    expect(results.some((r) => r.item.id === 'go-patients')).toBe(true);
  });
});

describe('createRecentsStore', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recents-test-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('load returns empty array when file does not exist', () => {
    const store = createRecentsStore(tmpDir);
    expect(store.load()).toEqual([]);
  });

  test('recordVisit adds entry and persists', () => {
    const store = createRecentsStore(tmpDir);
    const entries = store.recordVisit(
      'yosemitecrew://appointments',
      'Appointments',
      'go-appointments'
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('go-appointments');
    expect(entries[0].label).toBe('Appointments');

    const loaded = store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('go-appointments');
  });

  test('recordVisit deduplicates by id and moves to front', () => {
    const store = createRecentsStore(tmpDir);
    store.recordVisit('yosemitecrew://appointments', 'Appointments', 'go-appointments');
    store.recordVisit('yosemitecrew://patients', 'Patients', 'go-patients');
    store.recordVisit('yosemitecrew://appointments', 'Appointments', 'go-appointments');

    const loaded = store.load();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('go-appointments');
    expect(loaded[1].id).toBe('go-patients');
  });

  test('trims to MAX_RECENTS', () => {
    const store = createRecentsStore(tmpDir);
    for (let i = 0; i < 25; i++) {
      store.recordVisit(`url-${i}`, `Item ${i}`, `id-${i}`);
    }
    expect(store.load()).toHaveLength(20);
  });

  test('clear removes all entries', () => {
    const store = createRecentsStore(tmpDir);
    store.recordVisit('yosemitecrew://test', 'Test', 'test');
    store.clear();
    expect(store.load()).toEqual([]);
  });

  test('handles corrupt file gracefully', () => {
    const badDir = path.join(tmpDir, 'bad');
    fs.mkdirSync(badDir, { recursive: true });
    fs.writeFileSync(path.join(badDir, 'command-palette-recents.json'), '{invalid}', 'utf8');
    const store = createRecentsStore(badDir);
    expect(store.load()).toEqual([]);
  });
});
