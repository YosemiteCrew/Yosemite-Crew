import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const WORKFLOW = '.github/workflows/_core.yaml';

const withoutComments = (text) =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

// Each `uses: actions/checkout@...` step, paired with the lines that follow it
// at the same or deeper indentation - which is the step's `with:` block.
function checkoutSteps(source) {
  const lines = source.split('\n');
  const steps = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(\s*)uses: actions\/checkout@/.exec(lines[i]);
    if (!match) continue;

    const indent = match[1].length;
    const body = [lines[i]];

    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() !== '' && line.length - line.trimStart().length < indent) break;
      body.push(line);
    }

    steps.push(body.join('\n'));
  }

  return steps;
}

test('the core pipeline checks out the merged tree, not the pull request head', () => {
  const source = readFileSync(WORKFLOW, 'utf8');
  const steps = checkoutSteps(source);

  // Liveness. The loop below passes vacuously over an empty list, and over any
  // step the segmenter dropped, so a parser that stopped following the file
  // would report this gate as held. The control counts the action a second way,
  // with a needle that shares nothing with the segmenter's anchor beyond the
  // action name - a control built from the same expression goes blind on
  // exactly the reformatting that blinds the thing it is checking.
  const occurrences = withoutComments(source).match(/actions\/checkout@/g) ?? [];
  assert.ok(occurrences.length > 0, `no checkout steps in ${WORKFLOW}`);
  assert.equal(
    steps.length,
    occurrences.length,
    `segmented ${steps.length} checkout steps but ${WORKFLOW} uses the action ${occurrences.length} times`
  );

  // Pinning the checkout to `github.event.pull_request.head.sha` makes lint,
  // type-check and build judge the branch tip. A pull request that predates a
  // change to what a gate reads is then green against a tree that is not the
  // tree being merged, and dev finds out afterwards. Issue #3316.
  //
  // Comment lines come out first: the detect step's comment names the
  // expression it exists to explain, and a needle that matches the prose
  // announcing the fix fails on the fix as readily as on the regression.
  for (const step of steps) {
    const directives = withoutComments(step);

    assert.match(directives, /uses: actions\/checkout@/, `stripped every line of:\n${step}`);
    assert.doesNotMatch(
      directives,
      /pull_request\.head\.sha/,
      `a checkout step in ${WORKFLOW} pins the pull request head, so its gate cannot judge the merged tree:\n${step}`
    );
  }
});
