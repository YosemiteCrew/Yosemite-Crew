// Tests for the play-function run guard. What matters is the split: a run that
// did not happen fails, a run that happened with failing stories does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFailures, main, problemsWith } from './check-play-results.mjs';

const dir = mkdtempSync(join(tmpdir(), 'play-results-'));
const write = (name, value) => {
  const file = join(dir, name);
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
};
// Runs the CLI entry with console captured, so a test can pin what it said.
let stderr = '';
const run = (argv, env = {}) => {
  const { log, error } = console;
  stderr = '';
  console.log = () => {};
  console.error = (line) => (stderr += `${line}\n`);
  try {
    return main(argv, env);
  } finally {
    Object.assign(console, { log, error });
  }
};

// The exact failure text the runner produced for a real story in this repo.
const failureMessage =
  'page.evaluate: StorybookTestRunnerError: \x1b[34m\nClick to debug the error directly in Storybook:\n' +
  'http://127.0.0.1:6006/?path=/story/auth-githubsigninbutton--default&addonPanel=storybook/interactions/panel\n\n' +
  '\x1b[39mMessage:\n Unable to find an accessible element with the role "button" and name "Continue with GitHub"\n\nmore';

const results = (overrides = {}) => ({
  numTotalTests: 3,
  numPassedTests: 2,
  numFailedTests: 1,
  numRuntimeErrorTestSuites: 0,
  wasInterrupted: false,
  testResults: [
    {
      name: '/repo/GithubSignInButton.stories.tsx',
      status: 'failed',
      message: failureMessage,
      assertionResults: [
        {
          status: 'passed',
          title: 'smoke-test',
          ancestorTitles: ['Auth/GithubSignInButton', 'Other'],
        },
        {
          status: 'failed',
          title: 'play-test',
          ancestorTitles: ['Auth/GithubSignInButton', 'Default'],
          failureMessages: [failureMessage],
        },
      ],
    },
    { name: '/repo/Ok.stories.tsx', status: 'passed', assertionResults: [{ status: 'passed' }] },
  ],
  ...overrides,
});

test('a failing play function is reported by story id with the real message', () => {
  assert.deepEqual(collectFailures(results()), [
    {
      story: 'auth-githubsigninbutton--default',
      test: 'play-test',
      message:
        'Unable to find an accessible element with the role "button" and name "Continue with GitHub"',
    },
  ]);
});

test('a suite that errored before any test ran is still reported', () => {
  const failures = collectFailures({
    testResults: [
      {
        name: '/repo/Broken.stories.tsx',
        status: 'failed',
        message: 'SyntaxError: nope',
        assertionResults: [],
      },
    ],
  });
  assert.deepEqual(failures, [
    { story: '/repo/Broken.stories.tsx', test: '(suite)', message: 'SyntaxError: nope' },
  ]);
});

test('without a story link the failure falls back to the story titles', () => {
  const [failure] = collectFailures({
    testResults: [
      {
        status: 'failed',
        assertionResults: [
          {
            status: 'failed',
            title: 'play-test',
            ancestorTitles: ['A/B', 'C'],
            failureMessages: ['boom'],
          },
        ],
      },
    ],
  });
  assert.equal(failure.story, 'A/B > C');
});

test('a real run with failing stories is not a problem', () => {
  assert.deepEqual(problemsWith(results()), []);
});

test('zero tests is a problem', () => {
  assert.deepEqual(problemsWith(results({ numTotalTests: 0, numPassedTests: 0 })), [
    'no story was tested, so this shard checked nothing',
  ]);
});

test('tests that all failed is a problem', () => {
  const [problem] = problemsWith(results({ numPassedTests: 0, numFailedTests: 3 }));
  assert.match(problem, /none of 3 stories passed/);
});

test('an interrupted run is a problem', () => {
  assert.equal(problemsWith(results({ wasInterrupted: true })).length, 1);
});

test('a missing results file fails: that is what a browser that cannot launch leaves', () => {
  assert.equal(run([join(dir, 'never-written.json')]), 1);
  assert.match(stderr, /was not written/);
});

test('an unreadable results file fails', () => {
  assert.equal(run([write('bad.json', '{"numTotalTests":')]), 1);
  assert.match(stderr, /is not valid JSON/);
});

test('an empty run fails', () => {
  assert.equal(
    run([write('empty.json', results({ numTotalTests: 0, numPassedTests: 0, testResults: [] }))]),
    1
  );
});

test('a run where nothing passed fails', () => {
  assert.equal(run([write('none.json', results({ numPassedTests: 0 }))]), 1);
});

test('a real run with failing stories passes and lists them in the step summary', () => {
  const summary = write('summary.md', '');
  assert.equal(run([write('ok.json', results())], { GITHUB_STEP_SUMMARY: summary }), 0);
  const text = readFileSync(summary, 'utf8');
  assert.match(text, /3 tests, 2 passed, 1 failed/);
  assert.match(text, /`auth-githubsigninbutton--default` \| play-test \| Unable to find/);
  assert.doesNotMatch(text, /Not a real run/);
});

test('the step summary says when a run was not real', () => {
  const summary = write('summary-bad.md', '');
  run([write('none2.json', results({ numPassedTests: 0 }))], { GITHUB_STEP_SUMMARY: summary });
  assert.match(readFileSync(summary, 'utf8'), /\*\*Not a real run:\*\* none of 3 stories passed/);
});

test('no argument is a usage error', () => {
  assert.equal(run([]), 2);
});
