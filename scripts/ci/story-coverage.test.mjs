#!/usr/bin/env node
// Unit tests for the new-component-needs-a-story gate.
//
// Run with `node --test scripts/ci/story-coverage.test.mjs`, or as part of
// `pnpm run test:scripts`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { looksLikeComponent, storyPathFor, evaluate, parseArgs } from './story-coverage.mjs';

const REAL_COMPONENT = `
import React from 'react';

export default function ServicesTab({ specialityId }: { specialityId: string }) {
  return (
    <div className="wrapper">
      <span>{specialityId}</span>
    </div>
  );
}
`;

const ARROW_COMPONENT = `
export const PackagesTab = ({ specialityId }: Props) => {
  if (loading) {
    return <YosemiteLoader />;
  }
  return (
    <div>
      <p>packages</p>
    </div>
  );
};
`;

const HOOK_FILE = `
import { useState } from 'react';

export function useConsentList(patientId: string) {
  const [items, setItems] = useState([]);
  return { items, setItems };
}
`;

const BARREL_FILE = `
export { default } from './PackagesTab';
export * from './PackagesTab';
`;

// Long enough to clear the trivial-size floor on its own, so this fixture
// exercises the // no-story marker specifically, not the size check.
const OPTED_OUT_COMPONENT = `
// no-story: pure presentational wrapper exercised only inside PackagesTab's own story
export default function PackageBadge({ label, tone }: { label: string; tone: string }) {
  const className = tone === 'warning' ? 'badge badge-warning' : 'badge';
  return (
    <span className={className}>
      {label}
    </span>
  );
}
`;

// Deliberately has a real closing tag (unlike a self-closing <div />), so this
// fixture exercises the trivial-size floor itself, not the JSX-detection check.
const TRIVIAL_COMPONENT = `
export default function Spacer() {
  return <div className="spacer"></div>;
}
`;

describe('looksLikeComponent', () => {
  it('recognises a default-exported function component', () => {
    assert.equal(looksLikeComponent(REAL_COMPONENT), true);
  });

  it('recognises a named-exported arrow-function component', () => {
    assert.equal(looksLikeComponent(ARROW_COMPONENT), true);
  });

  it('rejects a hook with no JSX', () => {
    assert.equal(looksLikeComponent(HOOK_FILE), false);
  });

  it('rejects a barrel re-export file', () => {
    assert.equal(looksLikeComponent(BARREL_FILE), false);
  });

  it('THE CASE THIS GATE EXISTS FOR: a real component with no export is not flagged as needing a story it cannot receive under its own name', () => {
    // A component that isn't exported can't be imported by a story either -
    // this is a different problem than "forgot the story".
    assert.equal(looksLikeComponent('function Inner() { return <div />; }'), false);
  });

  it('respects the // no-story escape hatch even on an otherwise-real component', () => {
    assert.equal(looksLikeComponent(OPTED_OUT_COMPONENT), false);
  });

  it('rejects a file below the trivial-size floor', () => {
    assert.equal(looksLikeComponent(TRIVIAL_COMPONENT), false);
  });
});

describe('storyPathFor', () => {
  it('swaps the .tsx extension for .stories.tsx', () => {
    assert.equal(
      storyPathFor('apps/frontend/src/app/features/x/Foo.tsx'),
      'apps/frontend/src/app/features/x/Foo.stories.tsx'
    );
  });
});

describe('parseArgs', () => {
  it('THE CASE THIS GATE EXISTS FOR: --files consumes every remaining argument, not just the first', () => {
    // Found via a real run against a historical commit: with a loop that
    // didn't stop after --files, the second file path was re-read as an
    // "unknown argument" and the whole command failed.
    const args = parseArgs(['--files', 'a.tsx', 'b.tsx', 'c.tsx']);
    assert.deepEqual(args.files, ['a.tsx', 'b.tsx', 'c.tsx']);
  });

  it('parses --base and --head', () => {
    const args = parseArgs(['--base', 'sha1', '--head', 'sha2']);
    assert.equal(args.base, 'sha1');
    assert.equal(args.head, 'sha2');
  });
});

describe('evaluate', () => {
  // Real temp files rather than a mocked fs: the function under test reads
  // the filesystem directly, and faking that out would test the mock, not
  // the gate.
  const withFixture = (fn) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'story-coverage-'));
    try {
      return fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('flags a new component with no sibling story', () => {
    withFixture((dir) => {
      writeFileSync(path.join(dir, 'Foo.tsx'), REAL_COMPONENT);
      const { missing, checked } = evaluate({ files: ['Foo.tsx'], cwd: dir });
      assert.deepEqual(checked, ['Foo.tsx']);
      assert.deepEqual(missing, [{ file: 'Foo.tsx', expected: 'Foo.stories.tsx' }]);
    });
  });

  it('THE CASE THIS GATE EXISTS FOR: passes when the sibling story exists', () => {
    withFixture((dir) => {
      writeFileSync(path.join(dir, 'Foo.tsx'), REAL_COMPONENT);
      writeFileSync(path.join(dir, 'Foo.stories.tsx'), 'export default {};');
      const { missing } = evaluate({ files: ['Foo.tsx'], cwd: dir });
      assert.deepEqual(missing, []);
    });
  });

  it('excludes story files, test files and files under __tests__ from the check itself', () => {
    withFixture((dir) => {
      mkdirSync(path.join(dir, '__tests__'), { recursive: true });
      writeFileSync(path.join(dir, 'Foo.stories.tsx'), REAL_COMPONENT);
      writeFileSync(path.join(dir, 'Foo.test.tsx'), REAL_COMPONENT);
      writeFileSync(path.join(dir, '__tests__', 'Foo.tsx'), REAL_COMPONENT);
      const { missing, checked, skipped } = evaluate({
        files: ['Foo.stories.tsx', 'Foo.test.tsx', '__tests__/Foo.tsx'],
        cwd: dir,
      });
      assert.deepEqual(missing, []);
      assert.deepEqual(checked, []);
      assert.equal(skipped.length, 3);
    });
  });

  it('skips a hook file (no JSX) without demanding a story', () => {
    withFixture((dir) => {
      writeFileSync(path.join(dir, 'useThing.tsx'), HOOK_FILE);
      const { missing, checked } = evaluate({ files: ['useThing.tsx'], cwd: dir });
      assert.deepEqual(missing, []);
      assert.deepEqual(checked, []);
    });
  });

  it('treats a file added then deleted in the same range as nothing to check', () => {
    withFixture((dir) => {
      const { missing, skipped } = evaluate({ files: ['Gone.tsx'], cwd: dir });
      assert.deepEqual(missing, []);
      assert.deepEqual(skipped, ['Gone.tsx']);
    });
  });

  it('THE CASE THIS GATE EXISTS FOR: a path escaping cwd via ../ is skipped, not read', () => {
    // `files` comes from git diff output or a --files argument; the fixture
    // here plants a real file just outside `dir` and proves it is never
    // opened by asserting it does not surface as `checked` or `missing`.
    withFixture((dir) => {
      const parent = path.dirname(dir);
      const outside = path.join(parent, `story-coverage-escape-${path.basename(dir)}.tsx`);
      writeFileSync(outside, REAL_COMPONENT);
      try {
        const { missing, checked, skipped } = evaluate({
          files: [`../${path.basename(outside)}`],
          cwd: dir,
        });
        assert.deepEqual(checked, []);
        assert.deepEqual(missing, []);
        assert.deepEqual(skipped, [`../${path.basename(outside)}`]);
      } finally {
        rmSync(outside, { force: true });
      }
    });
  });

  it('an absolute path is skipped, not read', () => {
    withFixture((dir) => {
      const outside = path.join(tmpdir(), `story-coverage-abs-${Date.now()}.tsx`);
      writeFileSync(outside, REAL_COMPONENT);
      try {
        const { missing, checked, skipped } = evaluate({ files: [outside], cwd: dir });
        assert.deepEqual(checked, []);
        assert.deepEqual(missing, []);
        assert.deepEqual(skipped, [outside]);
      } finally {
        rmSync(outside, { force: true });
      }
    });
  });
});
