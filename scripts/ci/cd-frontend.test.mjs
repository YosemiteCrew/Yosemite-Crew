import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('frontend deploy runs serialize without cancelling earlier push ranges', () => {
  const source = readFileSync('.github/workflows/cd-frontend.yaml', 'utf8');
  const concurrency = /^concurrency:\n(?: {2}.*\n)+/m.exec(source)?.[0];

  assert.ok(concurrency, 'top-level concurrency block is missing');
  assert.match(concurrency, /^ {2}cancel-in-progress: false$/m);
});
