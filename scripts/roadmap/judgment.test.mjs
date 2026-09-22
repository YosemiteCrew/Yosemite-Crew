// What is pinned here is the BOUNDARY between the deterministic ladder and the
// typed judgment: which rows a judgment may touch, what leaves this machine when
// it does, and that every way of failing leaves the board exactly as dev leaves
// it today. The judgment's own accuracy is not a unit-test property - that is the
// measurement in issue #3376 - so nothing below asserts that an answer is right,
// only that a wrong or slow or absent answer cannot reach a public board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env } from 'node:process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES, PRIORITIES, classifyCategory, classifyPriority } from './classify.mjs';
import { reconcileIssue } from './sync.mjs';
import {
  BODY_LIMIT,
  QUESTION_CATEGORY,
  QUESTION_URGENCY,
  URGENCY_LEVELS,
  URGENCY_PRIORITY_BY_LEVEL,
  classifyWithJudgment,
  createJudgmentCacheStore,
  createJudgmentClient,
  judgmentCacheKey,
  judgmentPayload,
  percentile,
  skipUrgencyJudgment,
} from './judgment.mjs';

// A transport that answers from a script and records what it was handed, so a
// test can assert on the REQUEST as well as the outcome. No network, no key.
function fakeTransport(reply, { delayMs = 0, fail = null } = {}) {
  const calls = [];
  const fn = async (req) => {
    calls.push(req);
    if (fail) throw fail;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return typeof reply === 'function' ? reply(req) : reply;
  };
  fn.calls = calls;
  return fn;
}

const answer = ({ category, categoryConfidence = 0.9, score, urgencyConfidence = 0.9 } = {}) => {
  const answers = {};
  if (category !== undefined) {
    answers[QUESTION_CATEGORY] = {
      type: 'choice',
      choice: category,
      confidence: categoryConfidence,
    };
  }
  if (score !== undefined) {
    answers[QUESTION_URGENCY] = { type: 'score', score, confidence: urgencyConfidence };
  }
  return { model: 'jev-1.13.0', answers, usage: { input_tokens: 296, output_tokens: 20 } };
};

// The cache store reads its path from the environment rather than from an
// argument, so a test that wants one sets the variable around the call and puts
// it back afterwards.
function withCachePath(path, run) {
  const previous = env.ROADMAP_JUDGMENT_CACHE;
  env.ROADMAP_JUDGMENT_CACHE = path;
  const restore = () => {
    if (previous === undefined) delete env.ROADMAP_JUDGMENT_CACHE;
    else env.ROADMAP_JUDGMENT_CACHE = previous;
  };
  let out;
  try {
    out = run();
  } catch (err) {
    restore();
    throw err;
  }
  return out instanceof Promise ? out.finally(restore) : (restore(), out);
}

// An issue the ladder cannot judge: no surface label, no conventional-commit
// scope, no workspace path in the body. This is the whole population the
// judgment is allowed to see.
const abandoned = {
  number: 4001,
  updatedAt: '2026-09-22T10:00:00Z',
  title: 'Prescription refill reminders never reach the owner',
  body: 'Owners say they do not get the reminder.',
  labels: [],
};

test('the ladder really does abandon the fixture this suite is built on', () => {
  // Without this the rest of the file could pass against a fixture the ladder
  // already answers, and every "the judgment filled it" assertion would be
  // measuring nothing.
  assert.equal(classifyCategory(abandoned).category, null);
  assert.equal(classifyPriority(abandoned), null);
});

// ---------------------------------------------------------------- payload

test('only the title, the labels and a truncated body ever leave this machine', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS, score: 3 }));
  const judge = createJudgmentClient({ transport });
  await judge(
    { ...abandoned, body: 'x'.repeat(BODY_LIMIT + 250) },
    {
      askCategory: true,
      askUrgency: true,
    }
  );

  const sent = transport.calls[0].body.state;
  assert.deepEqual(Object.keys(sent).sort(), ['body', 'labels', 'title']);
  assert.equal(sent.body.length, BODY_LIMIT);
  assert.equal(sent.title, abandoned.title);
});

test('the payload is an allowlist, so a field added to the GitHub query cannot leak', () => {
  const sent = judgmentPayload({
    title: 'A title',
    body: 'A body',
    labels: ['bug'],
    // Everything below exists on the GraphQL node and must not appear.
    author: { login: 'someone' },
    assignees: { nodes: [{ login: 'someone-else' }] },
    comments: { nodes: [{ body: 'a comment' }] },
    id: 'I_kwDO',
    number: 4001,
  });
  assert.deepEqual(sent, { title: 'A title', labels: ['bug'], body: 'A body' });
});

test('a body shorter than the limit is not padded and a missing body is empty', () => {
  assert.equal(judgmentPayload({ body: 'short' }).body, 'short');
  assert.equal(judgmentPayload({}).body, '');
  assert.deepEqual(judgmentPayload({}).labels, []);
});

// ------------------------------------------------------------ reachability

test('a labelled issue never reaches the judgment at all', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.MOBILE, score: 4 }));
  const judge = createJudgmentClient({ transport });

  const out = await classifyWithJudgment(
    {
      number: 1,
      updatedAt: 'u',
      title: 'Something vague',
      body: '',
      labels: ['App', 'bug'],
    },
    judge
  );

  assert.equal(transport.calls.length, 0);
  assert.equal(out.category, CATEGORIES.MOBILE); // from the `App` label, not the judgment
  assert.equal(out.priority, PRIORITIES.HIGH); // from the `bug` label
  assert.equal(out.judgment, null);
});

test('a judgment cannot outrank a ladder answer on the cell the ladder answered', async () => {
  // The ladder has a category but no priority. Exactly one question is asked,
  // and the category the judgment would have given is never requested.
  const transport = fakeTransport(answer({ score: 4 }));
  const judge = createJudgmentClient({ transport });

  const out = await classifyWithJudgment(
    {
      number: 2,
      updatedAt: 'u',
      title: 'fix(mobile): breed picker is empty',
      body: '',
      labels: [],
    },
    judge
  );

  assert.deepEqual(Object.keys(transport.calls[0].body.questions), [QUESTION_URGENCY]);
  assert.equal(out.category, CATEGORIES.MOBILE);
  assert.equal(out.priority, PRIORITIES.URGENT);
});

test('a null from the ladder is the only thing a judgment can fill', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }));
  const judge = createJudgmentClient({ transport });
  const out = await classifyWithJudgment(abandoned, judge);

  assert.deepEqual(Object.keys(transport.calls[0].body.questions).sort(), [
    QUESTION_CATEGORY,
    QUESTION_URGENCY,
  ]);
  assert.equal(out.category, CATEGORIES.PMS);
  assert.equal(out.priority, PRIORITIES.URGENT);
  assert.match(out.categoryReason, /judgment/);
});

test('a judge that answers a question it was not asked cannot overwrite the ladder', async () => {
  // createJudgmentClient never returns an unasked answer, which makes this
  // guard unreachable through it. `judge` is an injected collaborator though,
  // so drive it directly: a future client, a replayed fixture or a cache from
  // an older shape could all hand back more than was requested.
  const overreaching = async () => ({
    category: CATEGORIES.GROWTH,
    priority: PRIORITIES.LOW,
    confidence: { category: 1, urgency: 1 },
    score: 0,
    error: null,
  });

  // The ladder answers Category and not Priority, so the judge IS called - for
  // urgency only - and hands back a category nobody asked for.
  const issue = {
    number: 9,
    updatedAt: 'u',
    title: 'fix(mobile): breed picker',
    body: '',
    labels: [],
  };
  assert.equal(classifyCategory(issue).category, CATEGORIES.MOBILE);
  assert.equal(classifyPriority(issue), null);

  const out = await classifyWithJudgment(issue, overreaching);
  assert.equal(out.category, CATEGORIES.MOBILE, 'the ladder keeps the cell it answered');
  assert.equal(out.priority, PRIORITIES.LOW, 'and the cell it did not is filled');
});

test('a board cell a human already filled is never asked about', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }));
  const judge = createJudgmentClient({ transport });

  // The ladder abandons both cells, but the board only wants a priority.
  const out = await classifyWithJudgment(abandoned, judge, { wantCategory: false });
  assert.deepEqual(Object.keys(transport.calls[0].body.questions), [QUESTION_URGENCY]);
  assert.equal(out.category, null);
  assert.equal(out.priority, PRIORITIES.URGENT);

  // And with neither cell wanted, nothing is asked at all.
  const quiet = fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }));
  await classifyWithJudgment(abandoned, createJudgmentClient({ transport: quiet }), {
    wantCategory: false,
    wantPriority: false,
  });
  assert.equal(quiet.calls.length, 0);
});

// ------------------------------------------------------------- skip rules

test('a repo-wide toolchain title skips the urgency judgment', () => {
  assert.equal(
    skipUrgencyJudgment({ title: 'chore(deps): bump react to 19.3' }),
    'repo-wide toolchain title'
  );
  assert.equal(
    skipUrgencyJudgment({ title: 'ci(repo): fail on unmet peers' }),
    'repo-wide toolchain title'
  );
  // A product-scoped chore is NOT repo-wide and is not skipped by this rule.
  assert.equal(skipUrgencyJudgment({ title: 'chore(frontend): tidy an unused route' }), null);
});

test('a Dependabot label skips the urgency judgment, ecosystem labels included', () => {
  assert.match(skipUrgencyJudgment({ title: 'x', labels: ['dependencies'] }), /dependencies/);
  // Security updates arrive with the ecosystem label, not `dependencies` -
  // see the note at the top of .github/dependabot.yml.
  assert.match(skipUrgencyJudgment({ title: 'x', labels: ['javascript'] }), /javascript/);
  assert.match(skipUrgencyJudgment({ title: 'x', labels: ['github_actions'] }), /github_actions/);
  assert.match(skipUrgencyJudgment({ title: 'x', labels: ['Ruby'] }), /ruby/);
  assert.equal(skipUrgencyJudgment({ title: 'x', labels: ['bug', 'PMS'] }), null);
});

test('a skipped urgency judgment asks no urgency question and leaves the cell empty', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PLATFORM, score: 4 }));
  const judge = createJudgmentClient({ transport });

  const out = await classifyWithJudgment(
    {
      number: 3,
      updatedAt: 'u',
      title: 'Update a pinned tool',
      body: '',
      labels: ['dependencies'],
    },
    judge
  );

  assert.deepEqual(Object.keys(transport.calls[0].body.questions), [QUESTION_CATEGORY]);
  assert.equal(out.priority, null);
  assert.match(out.priorityReason, /skipped/);
});

// --------------------------------------------------------- reading answers

test('each urgency level maps to the published priority the issue specifies', () => {
  const t = (score) => {
    const client = createJudgmentClient({ transport: fakeTransport(answer({ score })) });
    return client(abandoned, { askUrgency: true });
  };
  return Promise.all([0, 1, 2, 3, 4].map(t)).then((rs) => {
    assert.deepEqual(
      rs.map((r) => r.priority),
      URGENCY_PRIORITY_BY_LEVEL
    );
  });
});

test('a score landing between two levels rounds to the nearer level', async () => {
  const at = async (score) => {
    const client = createJudgmentClient({ transport: fakeTransport(answer({ score })) });
    return (await client(abandoned, { askUrgency: true })).priority;
  };
  // 2.6 is closer to "degrades a core flow" (3) than to "has a workaround" (2).
  assert.equal(await at(2.6), PRIORITIES.URGENT);
  assert.equal(await at(2.4), PRIORITIES.HIGH);
  // Flooring instead of rounding would send this one to Normal.
  assert.equal(await at(1.7), PRIORITIES.HIGH);
});

test('the urgency ladder is ordered weakest first, as the score primitive reads it', () => {
  assert.equal(URGENCY_LEVELS.length, URGENCY_PRIORITY_BY_LEVEL.length);
  assert.match(URGENCY_LEVELS[0], /No user impact/);
  assert.match(URGENCY_LEVELS[URGENCY_LEVELS.length - 1], /Blocks a practice/);
  // Nothing here may publish Low: that is a deferral decision, not a harm judgment.
  assert.ok(!URGENCY_PRIORITY_BY_LEVEL.includes(PRIORITIES.LOW));
});

test('a category outside the eight board options is refused rather than written', async () => {
  const judge = createJudgmentClient({
    transport: fakeTransport(answer({ category: 'Frontend', score: 4 })),
  });
  const out = await judge(abandoned, { askCategory: true });
  assert.equal(out.category, null);
});

test('an answer below the confidence threshold is not published', async () => {
  const judge = createJudgmentClient({
    minConfidence: 0.6,
    transport: fakeTransport(
      answer({
        category: CATEGORIES.PMS,
        categoryConfidence: 0.59,
        score: 4,
        urgencyConfidence: 0.59,
      })
    ),
  });
  const out = await judge(abandoned, { askCategory: true, askUrgency: true });
  assert.equal(out.category, null);
  assert.equal(out.priority, null);
  // The confidence itself is still reported, so a dry run can show how close it was.
  assert.equal(out.confidence.category, 0.59);
});

test('an answer at exactly the threshold is published', async () => {
  const judge = createJudgmentClient({
    minConfidence: 0.6,
    transport: fakeTransport(
      answer({
        category: CATEGORIES.PMS,
        categoryConfidence: 0.6,
        score: 4,
        urgencyConfidence: 0.6,
      })
    ),
  });
  const out = await judge(abandoned, { askCategory: true, askUrgency: true });
  assert.equal(out.category, CATEGORIES.PMS);
  assert.equal(out.priority, PRIORITIES.URGENT);
});

test('a missing confidence is treated as below any threshold, never as certainty', async () => {
  const judge = createJudgmentClient({
    transport: fakeTransport({ answers: { [QUESTION_CATEGORY]: { choice: CATEGORIES.PMS } } }),
  });
  assert.equal((await judge(abandoned, { askCategory: true })).category, null);
});

// ------------------------------------------------------------- failing open

test('a transport error leaves the ladder null in place', async () => {
  const judge = createJudgmentClient({
    transport: fakeTransport(null, { fail: new Error('HTTP 503') }),
  });
  const out = await classifyWithJudgment(abandoned, judge);
  assert.equal(out.category, null);
  assert.equal(out.priority, null);
  assert.match(out.categoryReason, /503/);
  assert.equal(judge.stats().errors, 1);
});

test('a slow judgment times out and leaves the ladder null in place', async () => {
  const judge = createJudgmentClient({
    timeoutMs: 5,
    transport: fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }), { delayMs: 200 }),
  });
  const out = await classifyWithJudgment(abandoned, judge);
  assert.equal(out.category, null);
  assert.equal(out.priority, null);
  assert.match(out.judgment.error, /timed out/);
});

test('a timed-out request has its socket aborted, not just its answer discarded', async () => {
  let seen;
  const judge = createJudgmentClient({
    timeoutMs: 5,
    transport: async ({ signal }) => {
      seen = signal;
      return new Promise(() => {}); // never settles
    },
  });
  await judge(abandoned, { askCategory: true });
  assert.ok(seen, 'the transport was handed an abort signal');
  assert.equal(seen.aborted, true);
});

test('a credential resolver that throws fails open like any other failure', async () => {
  const judge = createJudgmentClient({
    credential: () => {
      throw new Error('keychain locked');
    },
    transport: fakeTransport(answer({ category: CATEGORIES.PMS })),
  });
  const out = await judge(abandoned, { askCategory: true });
  assert.equal(out.category, null);
  assert.match(out.error, /keychain locked/);
});

test('with nothing configured there is no client at all', () => {
  assert.equal(createJudgmentClient(), null);
  assert.equal(createJudgmentClient({}), null);
});

test('an unconfigured run produces exactly the ladder answers, on every shape of issue', async () => {
  const sample = [
    abandoned,
    { number: 5, updatedAt: 'u', title: 'fix(mobile): thing', body: '', labels: [] },
    { number: 6, updatedAt: 'u', title: 'x', body: '', labels: ['security'] },
    { number: 7, updatedAt: 'u', title: 'chore(deps): bump', body: '', labels: ['dependencies'] },
    { number: 8, updatedAt: 'u', title: 'Launch campaign', body: '', labels: ['Marketing'] },
    {
      number: 9,
      updatedAt: 'u',
      title: 'Something vague',
      body: 'apps/frontend apps/frontend',
      labels: [],
    },
  ];
  for (const issue of sample) {
    const out = await classifyWithJudgment(issue, null);
    assert.equal(out.category, classifyCategory(issue).category, `category for #${issue.number}`);
    assert.equal(out.priority, classifyPriority(issue), `priority for #${issue.number}`);
    assert.equal(out.judgment, null);
  }
});

// ------------------------------------------------------------------- cache

test('the cache key changes with updated_at and not otherwise', () => {
  const a = judgmentCacheKey({ number: 1, updatedAt: '2026-09-22T10:00:00Z' });
  assert.equal(a, judgmentCacheKey({ number: 1, updatedAt: '2026-09-22T10:00:00Z' }));
  assert.notEqual(a, judgmentCacheKey({ number: 1, updatedAt: '2026-09-22T10:00:01Z' }));
  assert.notEqual(a, judgmentCacheKey({ number: 2, updatedAt: '2026-09-22T10:00:00Z' }));
});

test('an unchanged issue is judged once, however many times the sync runs', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }));
  const judge = createJudgmentClient({ transport });
  const ask = { askCategory: true, askUrgency: true };

  const first = await judge(abandoned, ask);
  const second = await judge(abandoned, ask);
  assert.equal(transport.calls.length, 1);
  assert.deepEqual(second, first);
  assert.equal(judge.stats().cacheHits, 1);

  // An edit moves updated_at, so the next run asks again.
  await judge({ ...abandoned, updatedAt: '2026-09-22T11:00:00Z' }, ask);
  assert.equal(transport.calls.length, 2);
});

test('a cached answer to a narrower question does not satisfy a wider one', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }));
  const judge = createJudgmentClient({ transport });

  await judge(abandoned, { askCategory: true });
  const wider = await judge(abandoned, { askCategory: true, askUrgency: true });
  assert.equal(transport.calls.length, 2);
  assert.equal(wider.priority, PRIORITIES.URGENT);
});

test('a failure is cached for the run, so one outage is not one request per issue', async () => {
  const transport = fakeTransport(null, { fail: new Error('HTTP 503') });
  const judge = createJudgmentClient({ transport });
  await judge(abandoned, { askCategory: true });
  await judge(abandoned, { askCategory: true });
  assert.equal(transport.calls.length, 1);
});

test('the file cache survives the process and a missing file is simply empty', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'l3yc-roadmap-')), 'cache.json');
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS }));

  await withCachePath(path, async () => {
    const saving = createJudgmentCacheStore();
    assert.equal(saving.size, 0, 'a cache file that does not exist yet is simply empty');
    const first = createJudgmentClient({ transport, store: saving });
    await first(abandoned, { askCategory: true });
    assert.equal(saving.save(), true);

    const third = createJudgmentClient({ transport, store: createJudgmentCacheStore() });
    const before = transport.calls.length;
    const out = await third(abandoned, { askCategory: true });
    assert.equal(transport.calls.length, before, 'answered from the file, not the network');
    assert.equal(out.category, CATEGORIES.PMS);
  });
});

test('with no cache path configured the store is an ordinary in-memory Map', () => {
  const previous = env.ROADMAP_JUDGMENT_CACHE;
  delete env.ROADMAP_JUDGMENT_CACHE;
  try {
    const store = createJudgmentCacheStore();
    assert.ok(store instanceof Map);
    assert.equal(typeof store.save, 'undefined', 'nothing is ever written to disk');
  } finally {
    if (previous !== undefined) env.ROADMAP_JUDGMENT_CACHE = previous;
  }
});

test('a corrupt cache file is an empty cache, never a failed sync', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'l3yc-roadmap-')), 'cache.json');
  writeFileSync(path, 'not json at all');
  const lines = [];
  withCachePath(path, () => {
    const store = createJudgmentCacheStore({ log: (m) => lines.push(m) });
    assert.equal(store.size, 0);
  });
  assert.equal(lines.length, 1);
});

test('an unwritable cache path is reported but does not throw', () => {
  withCachePath('/definitely/not/a/directory/cache.json', () => {
    const store = createJudgmentCacheStore();
    store.set('k', { asked: {}, result: {} });
    assert.equal(store.save(), false);
  });
});

// ------------------------------------------------------------------ stats

test('latency percentiles are reported, and are null rather than NaN when nothing ran', () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([5], 95), 5);
  assert.equal(percentile([10, 20, 30, 40], 50), 20);
  assert.equal(percentile([10, 20, 30, 40], 95), 40);
  // Unsorted input must not change the answer.
  assert.equal(percentile([40, 10, 30, 20], 50), 20);
});

test('token usage is accumulated across calls for the measurement', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS }));
  const judge = createJudgmentClient({ transport });
  await judge(abandoned, { askCategory: true });
  await judge({ ...abandoned, number: 4002 }, { askCategory: true });
  const s = judge.stats();
  assert.equal(s.calls, 2);
  assert.equal(s.inputTokens, 592);
  assert.equal(s.outputTokens, 40);
});

// ------------------------------------------------------- the write path

const cell = (name, value) => ({ name: value, field: { name } });

const boardWrites = async (issue, judge, { dryRun = false, filled = [] } = {}) => {
  const writes = [];
  const actions = { uncategorised: [], untriaged: [], updated: [], judgments: [] };
  await reconcileIssue({
    issue: {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: 'OPEN',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: issue.updatedAt,
      labels: { nodes: (issue.labels || []).map((name) => ({ name })) },
    },
    item: { id: 'i', fieldValues: { nodes: filled } },
    setSelect: async (_item, field, value) => writes.push([field, value]),
    setDate: async (_item, field, value) => writes.push([field, value.slice(0, 10)]),
    actions,
    today: '2026-09-22',
    linkedPrs: [],
    judge,
    dryRun,
  });
  return { writes, actions };
};

test('an unconfigured run writes exactly what dev writes, on the sample', async () => {
  const cases = [
    abandoned,
    {
      number: 5,
      updatedAt: 'u',
      title: 'fix(mobile): breed picker is empty',
      body: '',
      labels: ['bug'],
    },
    { number: 6, updatedAt: 'u', title: 'Anything', body: '', labels: ['security'] },
    {
      number: 7,
      updatedAt: 'u',
      title: 'chore(deps): bump react',
      body: '',
      labels: ['dependencies'],
    },
  ];
  for (const issue of cases) {
    const { writes } = await boardWrites(issue, null);
    // The dates are derived from the priority and are already pinned by
    // classify.test.mjs, so what is compared here is the two decisions the
    // judgment could have changed and did not.
    const expected = [];
    const category = classifyCategory(issue).category;
    const priority = classifyPriority(issue);
    if (category) expected.push(['Category', category]);
    if (priority) expected.push(['Priority', priority]);
    assert.deepEqual(
      writes.filter(([f]) => f === 'Category' || f === 'Priority'),
      expected,
      `#${issue.number}`
    );
  }
});

test('a judged category and priority are actually written to the board', async () => {
  const judge = createJudgmentClient({
    transport: fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 })),
  });
  const { writes, actions } = await boardWrites(abandoned, judge);
  assert.deepEqual(writes, [
    ['Category', CATEGORIES.PMS],
    ['Priority', PRIORITIES.URGENT],
    ['Start date', '2026-09-01'],
    // 14 days from the run date: the Urgent window, reached only because the
    // judgment produced Urgent. With no judgment there is no priority and so no
    // End date at all.
    ['End date', '2026-10-06'],
    ['Status', 'Not Started'],
  ]);
  assert.equal(actions.uncategorised.length, 0);
});

test('a declined judgment still lands the row in the uncategorised report', async () => {
  const judge = createJudgmentClient({
    transport: fakeTransport(null, { fail: new Error('HTTP 503') }),
  });
  const { writes, actions } = await boardWrites(abandoned, judge);
  assert.deepEqual(
    writes.filter(([f]) => f === 'Category' || f === 'Priority'),
    []
  );
  assert.equal(actions.uncategorised.length, 1);
  assert.match(actions.uncategorised[0], /503/);
  assert.equal(actions.untriaged.length, 1);
});

test('a dry run reports the ladder and the judgment side by side and writes neither', async () => {
  const judge = createJudgmentClient({
    transport: fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 })),
  });
  const { actions } = await boardWrites(abandoned, judge, { dryRun: true });
  assert.equal(actions.judgments.length, 1);
  assert.match(actions.judgments[0], /ladder -\/-/);
  assert.match(actions.judgments[0], new RegExp(`judgment ${CATEGORIES.PMS}/${PRIORITIES.URGENT}`));
});

test('a row whose cells a human already filled is not classified at all', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }));
  const inner = createJudgmentClient({ transport });
  // Count invocations of the judge itself, not just requests. The want flags
  // already stop the request; this is the separate claim that sync.mjs reads
  // the board BEFORE it classifies, and it has to be able to fail on its own.
  let judgeCalls = 0;
  const judge = (...args) => {
    judgeCalls += 1;
    return inner(...args);
  };

  const { writes } = await boardWrites(abandoned, judge, {
    filled: [cell('Category', CATEGORIES.GROWTH), cell('Priority', PRIORITIES.LOW)],
  });

  assert.equal(judgeCalls, 0, 'the board is read before anything is classified');
  assert.equal(transport.calls.length, 0, 'nothing is sent for a row nothing can be written to');
  assert.deepEqual(
    writes.filter(([f]) => f === 'Category' || f === 'Priority'),
    [],
    'and the human values are left exactly as they were'
  );
});

test('only the empty cell is asked about when the other is already filled', async () => {
  const transport = fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 }));
  const judge = createJudgmentClient({ transport });

  await boardWrites(abandoned, judge, { filled: [cell('Category', CATEGORIES.GROWTH)] });
  assert.deepEqual(Object.keys(transport.calls[0].body.questions), [QUESTION_URGENCY]);
});

test('the side-by-side report carries the issue number and not its title', async () => {
  const judge = createJudgmentClient({
    transport: fakeTransport(answer({ category: CATEGORIES.PMS, score: 4 })),
  });
  const { actions } = await boardWrites(abandoned, judge, { dryRun: true });
  assert.equal(actions.judgments.length, 1);
  assert.ok(
    !actions.judgments[0].includes(abandoned.title),
    'an author-controlled title does not belong in a log line'
  );
  assert.match(actions.judgments[0], /^#4001 \|/);
});

test('nothing is reported side by side for a row the judgment never saw', async () => {
  const judge = createJudgmentClient({ transport: fakeTransport(answer({})) });
  const { actions } = await boardWrites(
    { number: 8, updatedAt: 'u', title: 'x', body: '', labels: ['App', 'bug'] },
    judge,
    { dryRun: true }
  );
  assert.equal(actions.judgments.length, 0);
});
