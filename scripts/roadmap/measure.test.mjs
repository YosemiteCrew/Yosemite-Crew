// The measurement decides whether #3376 ships, so the thing most worth pinning
// here is that the reviewer's sheet cannot leak a machine answer into the
// reviewer's column. An agreement rate computed against a reviewer who saw the
// output is not a weaker measurement, it is not a measurement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, PRIORITIES } from './classify.mjs';
import { QUOTED_CASES, blindSheet, score, selectSample } from './measure.mjs';

const issue = (number, over = {}) => ({
  number,
  title: 'Something vague',
  body: '',
  labels: [],
  updatedAt: 'u',
  ...over,
});

test('the sample is every abandoned open issue, 40 recent closed ones, and the quoted pair', () => {
  const open = [
    issue(1), // no category, no priority -> abandoned
    issue(2, { title: 'fix(mobile): thing', labels: ['bug'] }), // ladder answers both
    issue(3, { title: 'fix(mobile): thing' }), // category yes, priority no -> abandoned
  ];
  const closed = Array.from({ length: 50 }, (_, i) => issue(100 + i));

  const sample = selectSample({ open, closed });
  const numbers = sample.map((s) => s.number);

  assert.ok(numbers.includes(1) && numbers.includes(3));
  assert.ok(!numbers.includes(2), 'an issue the ladder fully answers is not in the abandoned half');
  assert.equal(sample.length, 2 + 40 + QUOTED_CASES.length);
  for (const q of QUOTED_CASES) assert.ok(numbers.includes(q.number));
});

test('an issue that is both abandoned and recently closed is counted once', () => {
  const both = issue(7);
  const sample = selectSample({ open: [both], closed: [both, issue(8)] });
  assert.equal(sample.filter((s) => s.number === 7).length, 1);
});

test('the reviewer sheet carries the issue and nothing a machine decided', () => {
  // A title and labels the ladder answers confidently: if any verdict were
  // printed, `Mobile App` and `High` would appear in this row.
  const sample = [
    issue(42, { title: 'fix(mobile): breed picker', labels: ['bug'], body: 'A body.' }),
  ];
  const sheet = blindSheet(sample);
  const row = sheet.slice(sheet.indexOf('## 42'));

  assert.equal(
    row.trim(),
    [
      '## 42',
      '',
      '**fix(mobile): breed picker**',
      '',
      'Labels: bug',
      '',
      '```',
      'A body.',
      '```',
    ].join('\n')
  );
  // The option lists in the preamble are the only place a category or priority
  // name may appear, and they are the same list for every sample.
  assert.equal(row.includes(CATEGORIES.MOBILE), false);
  assert.equal(row.includes(PRIORITIES.HIGH), false);
});

test('the sheet truncates a body to the same 500 characters the judgment sees', () => {
  const sheet = blindSheet([issue(1, { body: 'y'.repeat(900) })]);
  // Read it out of the issue's own fenced block: the preamble prose contains
  // stray `y` characters and a whole-sheet match finds one of those first.
  const fenced = sheet.slice(sheet.indexOf('## 1')).match(/```\n(y+)\n```/);
  assert.equal(fenced[1].length, 500);
});

test('every sampled issue reaches the sheet', () => {
  const sample = [issue(1), issue(2), issue(3)];
  const sheet = blindSheet(sample);
  for (const s of sample) assert.ok(sheet.includes(`## ${s.number}`));
});

// ------------------------------------------------------------------- score

const row = (number, ladder, judgment, published) => ({
  number,
  title: `issue ${number}`,
  labels: [],
  ladder,
  judgment: { asked: {}, skipped: null, confidence: null, error: null, ...judgment },
  published,
});

const stats = {
  calls: 3,
  errors: 0,
  cacheHits: 1,
  inputTokens: 900,
  outputTokens: 60,
  latencyMs: { p50: 310, p95: 480 },
};

test('agreement is reported for both columns, with the denominator beside it', () => {
  const rows = [
    // Ladder empty, judgment right.
    row(
      1,
      { category: null, priority: null },
      { category: CATEGORIES.PMS, priority: PRIORITIES.HIGH },
      { category: CATEGORIES.PMS, priority: PRIORITIES.HIGH }
    ),
    // Ladder empty, judgment wrong.
    row(
      2,
      { category: null, priority: null },
      { category: CATEGORIES.GROWTH, priority: PRIORITIES.NORMAL },
      { category: CATEGORIES.GROWTH, priority: PRIORITIES.NORMAL }
    ),
    // Ladder already right, judgment never asked.
    row(
      3,
      { category: CATEGORIES.MOBILE, priority: PRIORITIES.HIGH },
      { category: null, priority: null },
      { category: CATEGORIES.MOBILE, priority: PRIORITIES.HIGH }
    ),
    // Not adjudicated: must not count in either numerator or denominator.
    row(
      4,
      { category: null, priority: null },
      { category: CATEGORIES.SPIKE, priority: PRIORITIES.LOW },
      { category: CATEGORIES.SPIKE, priority: PRIORITIES.LOW }
    ),
  ];
  const reviewer = {
    1: { category: CATEGORIES.PMS, priority: PRIORITIES.HIGH },
    2: { category: CATEGORIES.PMS, priority: PRIORITIES.HIGH },
    3: { category: CATEGORIES.MOBILE, priority: PRIORITIES.HIGH },
  };

  const out = score({ rows, stats }, reviewer);
  assert.match(out, /3 of them adjudicated/);
  // Ladder agrees on 1 of the 3 adjudicated rows; ladder+judgment on 2 of 3.
  assert.match(out, /Agrees with reviewer on Category \| 33\.3% \(1\/3\) \| 66\.7% \(2\/3\)/);
  assert.match(out, /Agrees with reviewer on Priority \| 33\.3% \(1\/3\) \| 66\.7% \(2\/3\)/);
  assert.match(out, /Category cell left empty \| 3\/4 \| 0\/4/);
});

test('a reviewer who adjudicated nothing yields no rate at all, not a zero', () => {
  const rows = [row(1, { category: null, priority: null }, {}, { category: null, priority: null })];
  const out = score({ rows, stats }, {});
  assert.match(out, /n\/a \(0\/0\)/);
  assert.ok(!/0\.0%/.test(out), 'an empty sample must not read as 0% agreement');
});

test('every disagreement between the ladder and the judgment is listed', () => {
  const rows = [
    row(
      1,
      { category: null, priority: null },
      { category: CATEGORIES.PMS, priority: null },
      { category: CATEGORIES.PMS, priority: null }
    ),
    row(
      2,
      { category: CATEGORIES.MOBILE, priority: PRIORITIES.HIGH },
      { category: null, priority: null },
      { category: CATEGORIES.MOBILE, priority: PRIORITIES.HIGH }
    ),
  ];
  const out = score({ rows, stats }, { 1: { category: CATEGORIES.PMS, priority: null } });
  assert.match(out, /disagree on 1 of 2 rows/);
  assert.match(out, /\| 1 \| issue 1 \|/);
  assert.ok(!/\| 2 \| issue 2 \|/.test(out));
  // A row nobody adjudicated is still listed, and says so rather than looking agreed.
  const both = score({ rows, stats }, {});
  assert.match(both, /not adjudicated/);
});

test('over-escalation counts rows pushed above the reviewer, not rows merely disagreed with', () => {
  const rows = [
    // Escalated: published Urgent where the reviewer said Normal.
    row(
      1,
      { category: null, priority: null },
      { priority: PRIORITIES.URGENT },
      { category: null, priority: PRIORITIES.URGENT }
    ),
    // Not escalation: published lower than the reviewer.
    row(
      2,
      { category: null, priority: null },
      { priority: PRIORITIES.NORMAL },
      { category: null, priority: PRIORITIES.NORMAL }
    ),
    // Not escalation: the reviewer also considered it serious.
    row(
      3,
      { category: null, priority: null },
      { priority: PRIORITIES.URGENT },
      { category: null, priority: PRIORITIES.URGENT }
    ),
    // Not escalation: published Normal and the reviewer agreed. Nothing was
    // raised above Normal at all, which is what the count is of.
    row(
      4,
      { category: null, priority: null },
      { priority: PRIORITIES.NORMAL },
      { category: null, priority: PRIORITIES.NORMAL }
    ),
  ];
  const reviewer = {
    1: { priority: PRIORITIES.NORMAL },
    2: { priority: PRIORITIES.URGENT },
    3: { priority: PRIORITIES.HIGH },
    4: { priority: PRIORITIES.NORMAL },
  };
  assert.match(score({ rows, stats }, reviewer), /after the code-side skip rules: 1\./);
});

test('the cost and latency the acceptance criteria ask for are reported', () => {
  const out = score({ rows: [], stats }, {});
  assert.match(out, /Tokens: 900 in \/ 60 out over 3 calls/);
  assert.match(out, /0 failed, 1 served from cache/);
  assert.match(out, /Latency p50 310ms, p95 480ms/);
});

test('an unmeasured latency prints as a dash rather than as null', () => {
  const out = score({ rows: [], stats: { ...stats, latencyMs: { p50: null, p95: null } } }, {});
  assert.match(out, /Latency p50 -ms, p95 -ms/);
});
