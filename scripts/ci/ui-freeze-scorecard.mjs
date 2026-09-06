#!/usr/bin/env node
/* Versioned UI freeze measurements. All counts use one ref and one frontend
 * source corpus so adoption figures remain comparable in CI. */
import { execFileSync } from 'node:child_process';

const ref = process.argv[2] ?? 'origin/dev';
const root = new URL('../..', import.meta.url).pathname;
const run = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const assertThrows = (fn, expected, label) => {
  try {
    fn();
  } catch (error) {
    assert(String(error.message).includes(expected), `${label}: wrong failure`);
    return;
  }
  throw new Error(`${label}: expected failure`);
};
const matchingFiles = (pattern, path = 'apps/frontend/src/app/', exclude = true) => {
  try {
    return run('grep', '-lE', pattern, ref, '--', path)
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter(
        (file) =>
          (!exclude || !file.includes('/ui/primitives/')) &&
          !file.includes('.stories.') &&
          !file.includes('__tests__')
      );
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
};
const adoption = [
  ['Buttons', 'ui/primitives/Buttons', '<button', '<button type="button">'],
  [
    'SegmentedPill',
    'ui/primitives/SegmentedPill',
    'role=[\\x27"]group[\\x27"]',
    '<div role="group">',
  ],
  [
    'PanelStates',
    'ui/primitives/PanelStates',
    'EmptyState|ErrorState|LoadingState',
    '<EmptyState title="No results" />',
  ],
  ['Overlays', 'ui/overlays', 'Modal|Dialog|Sheet|Popover', '<Modal open />'],
  ['StatusPill', 'ui/primitives/StatusPill', 'Badge|StatusBadge', '<Badge>Ready</Badge>'],
];
const measure = (name, raw, fixture, usingFiles, rawFiles) => {
  assert(fixture && new RegExp(raw).test(fixture), `${name}: bypass pattern is stale`);
  const using = new Set(usingFiles);
  const bypassing = rawFiles.filter((file) => !using.has(file)).length;
  if (rawFiles.length > 0 && bypassing === 0)
    throw new Error(`${name}: bypass pattern only matches primitive consumers`);
  const total = using.size + bypassing;
  if (total === 0) throw new Error(`${name}: adoption is unmeasured`);
  return { using: using.size, bypassing, total, adoption: Math.round((using.size / total) * 100) };
};
if (process.argv.includes('--selftest')) {
  for (const [name, , raw, fixture] of adoption)
    assert(fixture && new RegExp(raw).test(fixture), `${name}: stale fixture`);
  assertThrows(
    () => {
      throw new Error('PanelStates: adoption oracle is unmeasured');
    },
    'adoption oracle is unmeasured',
    'empty oracle'
  );
  assertThrows(
    () =>
      measure(
        'stale fixture',
        'role=[\\x27"]group[\\x27"]',
        '<div role="tab">',
        [],
        ['legacy.tsx']
      ),
    'bypass pattern is stale',
    'stale fixture'
  );
  assertThrows(
    () => measure('tautology', 'role=', '<div role="group">', ['consumer.tsx'], ['consumer.tsx']),
    'only matches primitive consumers',
    'tautological raw set'
  );
  assertThrows(
    () => measure('zero total', 'EmptyState', '<EmptyState />', [], []),
    'adoption is unmeasured',
    'zero total'
  );
  console.log(
    `UI freeze scorecard selftest: ${adoption.length} fixtures + 4 negative controls passed`
  );
  process.exit(0);
}
const counts = Object.fromEntries(
  adoption.map(([name, marker, raw, fixture]) => {
    const oracleFiles = run(
      'ls-tree',
      '-r',
      '--name-only',
      ref,
      '--',
      `apps/frontend/src/app/${marker}/`
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    if (oracleFiles.length === 0) throw new Error(`${name}: adoption oracle is unmeasured`);
    const usingFiles = new Set(matchingFiles(`(from|import)[[:space:]][^[:space:]]*${marker}`));
    const rawFiles = matchingFiles(raw);
    return [name, measure(name, raw, fixture, usingFiles, rawFiles)];
  })
);
console.log(`UI freeze adoption @ ${run('rev-parse', '--short', ref).trim()}`);
for (const [name, result] of Object.entries(counts)) {
  console.log(
    `  ${name}: ${result.using}/${result.total} migrated (${result.adoption}%), ${result.bypassing} remaining`
  );
}
