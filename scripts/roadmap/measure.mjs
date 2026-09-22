#!/usr/bin/env node
// The measurement issue #3376 is accepted or rejected on.
//
//   node scripts/roadmap/measure.mjs sample  > .tmp/sample.json    # needs GITHUB_TOKEN
//   node scripts/roadmap/measure.mjs blind   < .tmp/sample.json    # the reviewer's sheet
//   node scripts/roadmap/measure.mjs run     < .tmp/sample.json    # needs ROADMAP_JUDGMENT_TOKEN
//   node scripts/roadmap/measure.mjs score .tmp/run.json .tmp/reviewer.json
//
// The four steps are separate commands on purpose. `blind` prints the issues and
// NOTHING ELSE - no ladder answer, no judgment answer, no reason string - so the
// reviewer's column is produced without seeing either output, which is what the
// acceptance criteria ask for and the only thing that makes the agreement
// numbers mean anything. Running `run` before a reviewer has answered is fine;
// showing them its output is not.
//
// Nothing here writes to the board. `sample` and `run` read; `blind` and `score`
// are pure.
import { argv, env, exit, stderr, stdin, stdout } from 'node:process';
import { readFileSync } from 'node:fs';
import { CATEGORIES, PRIORITIES, classifyCategory, classifyPriority } from './classify.mjs';
import { classifyWithJudgment, createJudgmentClient } from './judgment.mjs';
import { paginate } from './sync.mjs';

const OWNER = env.ROADMAP_OWNER || 'YosemiteCrew';
const REPO = env.ROADMAP_REPO || 'Yosemite-Crew';

// The two titles the issue quotes as the ladder's concrete failures. They are in
// the sample by name so the table has to show what happens to them, rather than
// leaving it to whichever issues the selection happened to pick up.
export const QUOTED_CASES = [
  {
    number: 'quoted-1',
    title: 'fix(frontend): appointment workspace hangs on save, losing the SOAP note',
    body: '',
    labels: ['bug'],
    updatedAt: 'quoted',
  },
  {
    number: 'quoted-2',
    title: 'chore(frontend): tidy 404s from an unused legacy route',
    body: '',
    labels: ['bug'],
    updatedAt: 'quoted',
  },
];

const SAMPLE_QUERY = `
query($owner:String!, $repo:String!, $states:[IssueState!], $cursor:String) {
  repository(owner:$owner, name:$repo) {
    issues(first:50, after:$cursor, states:$states, orderBy:{field:UPDATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title body updatedAt
        labels(first:20) { nodes { name } }
      }
    }
  }
}`;

const shape = (n) => ({
  number: n.number,
  title: n.title,
  body: n.body || '',
  labels: (n.labels?.nodes || []).map((l) => l.name),
  updatedAt: n.updatedAt,
});

/**
 * Every open issue the ladder currently abandons, plus the most recent 40 closed
 * issues, plus the two quoted titles.
 *
 * The closed issues matter more than they look: they are the only part of the
 * sample where the ladder ALREADY produces an answer, so they are what stops the
 * measurement being run entirely on the population the judgment was built for.
 */
export function selectSample({ open, closed }) {
  const abandoned = open.filter(
    (i) => classifyCategory(i).category === null || classifyPriority(i) === null
  );
  const seen = new Set(abandoned.map((i) => i.number));
  const recent = closed.filter((i) => !seen.has(i.number)).slice(0, 40);
  return [...abandoned, ...recent, ...QUOTED_CASES];
}

async function cmdSample() {
  const fetchAll = (states) =>
    paginate(SAMPLE_QUERY, { owner: OWNER, repo: REPO, states }, (d) => d.repository.issues);
  const [open, closed] = await Promise.all([fetchAll(['OPEN']), fetchAll(['CLOSED'])]);
  const sample = selectSample({ open: open.map(shape), closed: closed.map(shape) });
  stdout.write(`${JSON.stringify(sample, null, 2)}\n`);
  return sample.length;
}

/** The reviewer's sheet. Issues in, no machine answer anywhere. */
export function blindSheet(sample) {
  const lines = [
    '# Roadmap classification - reviewer sheet',
    '',
    `Sample: ${sample.length} issues. For each one, write the Category you would put on`,
    'the public roadmap board and how much it hurts a practice using the product today.',
    '',
    `Category is one of: ${Object.values(CATEGORIES).join(', ')}.`,
    `Priority is one of: ${Object.values(PRIORITIES).join(', ')}.`,
    '',
    'Answer in a JSON file shaped `{ "<number>": { "category": "...", "priority": "..." } }`.',
    '',
  ];
  for (const i of sample) {
    lines.push(`## ${i.number}`, '', `**${i.title}**`, '');
    if (i.labels.length) lines.push(`Labels: ${i.labels.join(', ')}`, '');
    const body = i.body.trim().slice(0, 500);
    if (body) lines.push('```', body, '```', '');
  }
  return lines.join('\n');
}

async function cmdRun(sample) {
  const judge = createJudgmentClient({
    credential: env.ROADMAP_JUDGMENT_TOKEN ? () => env.ROADMAP_JUDGMENT_TOKEN : null,
    ...(env.ROADMAP_JUDGMENT_MIN_CONFIDENCE
      ? { minConfidence: Number(env.ROADMAP_JUDGMENT_MIN_CONFIDENCE) }
      : {}),
  });
  if (!judge) {
    throw new Error('ROADMAP_JUDGMENT_TOKEN is not set: there is no judgment column to measure');
  }
  const rows = [];
  for (const issue of sample) {
    const d = await classifyWithJudgment(issue, judge);
    rows.push({
      number: issue.number,
      title: issue.title,
      labels: issue.labels,
      ladder: { category: d.ladder.category, priority: d.ladder.priority },
      // What the judgment PUBLISHED, which is null when it was not asked, was
      // skipped, was below threshold, or failed. The distinction is in `asked`
      // and `error`, and the report separates them.
      judgment: {
        category: d.judgment?.category ?? null,
        priority: d.judgment?.priority ?? null,
        asked: d.judgment?.asked ?? { askCategory: false, askUrgency: false },
        skipped: d.judgment?.urgencySkip ?? null,
        confidence: d.judgment?.confidence ?? null,
        error: d.judgment?.error ?? null,
      },
      published: { category: d.category, priority: d.priority },
    });
  }
  return { rows, stats: judge.stats() };
}

const RANK = {
  [PRIORITIES.LOW]: 0,
  [PRIORITIES.NORMAL]: 1,
  [PRIORITIES.HIGH]: 2,
  [PRIORITIES.URGENT]: 3,
};

// A chore, a dependency bump or internal hardening pushed above Normal. Counted
// by the reviewer's own answer rather than by a keyword, so it measures what the
// issue asked for - escalation the reviewer disagrees with - and not a second
// guess at which titles are chores.
const overEscalated = (row, reviewer) =>
  row.published.priority &&
  reviewer?.priority &&
  RANK[row.published.priority] > RANK[PRIORITIES.NORMAL] &&
  RANK[reviewer.priority] <= RANK[PRIORITIES.NORMAL];

/**
 * Score both columns against the reviewer.
 *
 * Agreement is counted over the rows the reviewer actually answered, and the
 * denominator is printed beside every rate. A rate with no denominator is the
 * number that gets quoted later, so there is nowhere here to print one without.
 */
export function score({ rows, stats }, reviewer) {
  const answered = rows.filter((r) => reviewer[String(r.number)]);
  const agree = (pick, field) =>
    answered.filter((r) => pick(r)[field] && pick(r)[field] === reviewer[String(r.number)][field])
      .length;

  const ladderOf = (r) => r.ladder;
  const publishedOf = (r) => r.published;

  const emptyBefore = rows.filter((r) => !r.ladder.category).length;
  const emptyAfter = rows.filter((r) => !r.published.category).length;
  const disagreements = rows.filter(
    (r) =>
      (r.judgment.category && r.judgment.category !== r.ladder.category) ||
      (r.judgment.priority && r.judgment.priority !== r.ladder.priority)
  );
  const escalations = answered.filter((r) => overEscalated(r, reviewer[String(r.number)]));

  const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}% (${n}/${d})` : `n/a (0/0)`);
  const d = answered.length;

  const lines = [
    '## Measurement',
    '',
    `Sample ${rows.length} issues, ${d} of them adjudicated by a reviewer who did not see either machine column.`,
    '',
    '| | Ladder | Ladder + judgment |',
    '|---|---|---|',
    `| Agrees with reviewer on Category | ${pct(agree(ladderOf, 'category'), d)} | ${pct(agree(publishedOf, 'category'), d)} |`,
    `| Agrees with reviewer on Priority | ${pct(agree(ladderOf, 'priority'), d)} | ${pct(agree(publishedOf, 'priority'), d)} |`,
    `| Category cell left empty | ${emptyBefore}/${rows.length} | ${emptyAfter}/${rows.length} |`,
    '',
    `Ladder and judgment disagree on ${disagreements.length} of ${rows.length} rows.`,
    `Raised above Normal against the reviewer's answer, after the code-side skip rules: ${escalations.length}.`,
    '',
    `Tokens: ${stats.inputTokens} in / ${stats.outputTokens} out over ${stats.calls} calls`,
    `(${stats.errors} failed, ${stats.cacheHits} served from cache).`,
    `Latency p50 ${stats.latencyMs.p50 ?? '-'}ms, p95 ${stats.latencyMs.p95 ?? '-'}ms.`,
    '',
    '### Every disagreement',
    '',
    '| Issue | Title | Ladder | Judgment | Reviewer |',
    '|---|---|---|---|---|',
  ];
  for (const r of disagreements) {
    const rev = reviewer[String(r.number)];
    lines.push(
      `| ${r.number} | ${r.title.replace(/\|/g, '\\|').slice(0, 60)} | ${r.ladder.category ?? '-'} / ${r.ladder.priority ?? '-'} | ${r.judgment.category ?? '-'} / ${r.judgment.priority ?? '-'} | ${rev ? `${rev.category ?? '-'} / ${rev.priority ?? '-'}` : 'not adjudicated'} |`
    );
  }
  return lines.join('\n');
}

const readStdin = async () => {
  const chunks = [];
  for await (const c of stdin) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

async function main() {
  const [, , cmd, a, b] = argv;
  switch (cmd) {
    case 'sample':
      return void (await cmdSample());
    case 'blind':
      return void stdout.write(`${blindSheet(await readStdin())}\n`);
    case 'run':
      return void stdout.write(`${JSON.stringify(await cmdRun(await readStdin()), null, 2)}\n`);
    case 'score': {
      const run = JSON.parse(readFileSync(a, 'utf8'));
      return void stdout.write(`${score(run, JSON.parse(readFileSync(b, 'utf8')))}\n`);
    }
    default:
      throw new Error(`usage: measure.mjs <sample|blind|run|score> - see the header of this file`);
  }
}

if (import.meta.url === `file://${argv[1]}`) {
  main().catch((err) => {
    stderr.write(`${err.message}\n`);
    exit(1);
  });
}
