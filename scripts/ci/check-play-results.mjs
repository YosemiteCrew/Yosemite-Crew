#!/usr/bin/env node
// Decide whether a Storybook play-function run actually ran.
//
// Usage:
//   node scripts/ci/check-play-results.mjs <jest-json-results>
//
// The interactions job runs `test-storybook --json -- --outputFile=<file>` and
// hands the file here. Two different things can be wrong with a run, and they
// are treated differently on purpose:
//
//   - The run did not happen. The browser did not launch, nothing matched the
//     shard, or so many stories fell over that the harness, not the stories,
//     is what broke (see MIN_PASS_SHARE). The
//     runner exits 1 for this exactly as it does for a failing assertion, so
//     its exit code cannot tell the two apart. This script can, and exits 1.
//   - The run happened and some play functions failed. Those are listed, but
//     the job stays advisory until the backlog is cleared, so this exits 0.
//
// A missing results file counts as "did not happen": when the browser cannot
// launch, jest aborts before it writes anything.

import { appendFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const STORY_LINK = /[?&]path=\/story\/([\w-]+)/;

// Below this share of passing tests the shard is treated as a broken harness (a
// browser that died partway, every page crashing) rather than a story backlog.
// The backlog runs at roughly one failing test in ten per shard, so half is far
// from it while still catching a run that mostly did not happen.
export const MIN_PASS_SHARE = 0.5;

// The runner wraps every failure in the same preamble (error class, a "Click to
// debug" link, "Message:"); the first line after it is the one that says what
// went wrong.
const PREAMBLE =
  /^((page\.evaluate: )?StorybookTestRunnerError:?|Click to debug.*|https?:\/\/\S+|Message:)$/;
const firstLine = (text) =>
  stripVTControlCharacters(text)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !PREAMBLE.test(line)) ?? '';

// One row per failing test, keyed by the story id the runner links to, so a
// reader can open the story straight from the list.
export const collectFailures = (results) => {
  const failures = [];
  for (const suite of results.testResults ?? []) {
    const failing = (suite.assertionResults ?? []).filter((t) => t.status === 'failed');
    if (failing.length === 0 && suite.status === 'failed') {
      // A suite that errored before any test ran (a syntax error, a crashed
      // page) has no assertion results; its message is the only record.
      failures.push({
        story: suite.name,
        test: '(suite)',
        message: firstLine(suite.message ?? ''),
      });
    }
    for (const t of failing) {
      const text = (t.failureMessages ?? []).join('\n');
      const id = STORY_LINK.exec(text)?.[1] ?? (t.ancestorTitles ?? []).join(' > ');
      failures.push({ story: id, test: t.title, message: firstLine(text) });
    }
  }
  return failures;
};

// Reasons the run cannot be trusted. Empty means the stories were exercised.
export const problemsWith = (results) => {
  const problems = [];
  if (results.wasInterrupted) problems.push('the run was interrupted before it finished');
  if (!(results.numTotalTests > 0)) {
    problems.push('no story was tested, so this shard checked nothing');
  } else if (results.numPendingTests === results.numTotalTests) {
    problems.push(`all ${results.numTotalTests} tests were skipped, so this shard checked nothing`);
  } else if (!(results.numPassedTests >= results.numTotalTests * MIN_PASS_SHARE)) {
    problems.push(
      `only ${results.numPassedTests ?? 0} of ${results.numTotalTests} tests passed, which is the ` +
        'browser or the harness failing, not the stories'
    );
  }
  return problems;
};

const escapeCell = (text) =>
  String(text ?? '')
    .replaceAll('|', '\\|')
    .slice(0, 300);

export const main = (argv, env = process.env) => {
  const [arg] = argv;
  if (!arg) {
    console.error('usage: check-play-results.mjs <jest-json-results>');
    return 2;
  }
  const root = env.RUNNER_TEMP || process.cwd();
  const file = resolve(root, arg);
  if (!existsSync(file)) {
    console.error(
      `check-play-results: ${file} was not written, so the runner stopped before testing a single ` +
        'story. The usual causes are a browser that failed to launch or a shard that matched no ' +
        'stories. See the step above.'
    );
    return 1;
  }

  // The results file is only ever the runner's own output in the job's temp
  // directory. Compared after resolving symlinks, so a link inside the directory
  // cannot point the read somewhere else.
  const real = realpathSync(file);
  if (!real.endsWith('.json') || !real.startsWith(realpathSync(root) + sep)) {
    console.error(`check-play-results: ${arg} is not a .json file inside ${root}`);
    return 2;
  }

  let results;
  try {
    results = JSON.parse(readFileSync(real, 'utf8'));
  } catch (error) {
    console.error(`check-play-results: ${file} is not valid JSON (${error.message})`);
    return 1;
  }

  const failures = collectFailures(results);
  const problems = problemsWith(results);
  const counts =
    `${results.numTotalTests ?? 0} tests, ${results.numPassedTests ?? 0} passed, ` +
    `${results.numFailedTests ?? 0} failed, ${results.numRuntimeErrorTestSuites ?? 0} suites errored`;

  console.log(`check-play-results: ${counts}`);
  for (const f of failures) console.log(`  FAIL ${f.story} [${f.test}] ${f.message}`);

  if (env.GITHUB_STEP_SUMMARY) {
    const rows = failures.map(
      (f) => `| \`${escapeCell(f.story)}\` | ${escapeCell(f.test)} | ${escapeCell(f.message)} |`
    );
    const body = [
      `### Storybook play functions`,
      '',
      counts,
      '',
      ...problems.map((p) => `**Not a real run:** ${p}.`),
      ...(rows.length
        ? ['| Story | Test | First line of the failure |', '| --- | --- | --- |', ...rows]
        : []),
      '',
    ];
    appendFileSync(env.GITHUB_STEP_SUMMARY, body.join('\n'));
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`check-play-results: ${p}.`);
    return 1;
  }
  if (failures.length > 0) {
    console.log(
      `\n${failures.length} play test(s) failed. Advisory: listed above, not failing the job.`
    );
  }
  return 0;
};

// Compared as real paths: `import.meta.url` is percent-encoded and resolves
// symlinks, argv[1] does neither, and a mismatch would skip main() and exit 0.
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
