// Tests for the override drift gate. Walking the real overrides block is what the
// workflow step does; what is pinned here is the CLASSIFICATION, since that is what
// decides whether a stale pin reds the build.
//
// Every "should not fire" case below is a real shape from the repo's own overrides
// block. A gate that reds the build on a legitimate CVE floor gets disabled within
// a week, so the negative cases matter as much as the positive ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, isBareName, resolvedVersions } from './check-override-drift.mjs';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the axios inert-bump defect is caught', () => {
  // #2665 raised axios ^1.19.0 -> ^1.20.0 in four manifests while the root override
  // held "1.19.0". The lockfile resolved only 1.19.0, so every workspace ran the old
  // copy while its manifest claimed the new one, and CI stayed green throughout.
  const f = classify('axios', '1.19.0', '^1.20.0', 'apps/backend/package.json');
  assert.equal(f?.kind, 'pins-below-declared');
  assert.equal(f.minimum, '1.20.0');
});

test('the validator defect that reached dev is caught', () => {
  // Three manifests declared ^13.15.35 against an override pinned at 13.15.26, so
  // nine patch releases of a validation library were installed nowhere.
  const f = classify('validator', '13.15.26', '^13.15.35', 'apps/frontend/package.json');
  assert.equal(f?.kind, 'pins-below-declared');
  assert.equal(f.minimum, '13.15.35');
});

test('a CVE floor pinning ABOVE a declared range does not fire', () => {
  // This is the whole legitimate purpose of the overrides block. #2592 pinned
  // @tiptap above what a transitive asked for to clear a HIGH advisory, and #2670
  // forced zod across a major for the same reason. Flagging these would make the
  // gate useless.
  assert.equal(classify('zod', '4.5.4', '^3.24.1', 'x/package.json'), null);
  assert.equal(classify('tiptap', '3.30.6', '^3.27.0', 'x/package.json'), null);
});

test('a pin that satisfies the declared range does not fire', () => {
  assert.equal(classify('multer', '2.3.0', '^2.3.0', 'x/package.json'), null);
  assert.equal(classify('qs', '6.16.0', '^6.15.0', 'x/package.json'), null);
});

test('an exact declaration matching the pin does not fire', () => {
  // apps/backend pins body-parser and express exactly; the override agrees.
  assert.equal(classify('body-parser', '1.20.6', '1.20.6', 'x/package.json'), null);
});

test('the workspace protocol is skipped rather than reported', () => {
  // packages/* are declared as workspace:*, which semver cannot range-check and
  // which an override never governs.
  assert.equal(classify('@yosemite-crew/lib', '1.0.0', 'workspace:*', 'x/package.json'), null);
});

test('an unparseable range is skipped rather than reported', () => {
  // Publishers ship these. semver.satisfies returns false for every version, which
  // would otherwise manufacture a mismatch that does not exist.
  assert.equal(classify('x', '1.0.0', '>=3.16.0 || >=4.0.0-', 'x/package.json'), null);
  assert.equal(classify('x', '1.0.0', 'github:owner/repo', 'x/package.json'), null);
});

test('an override whose value is a range, not a version, is skipped', () => {
  // A few entries use ^ or ~ as the override value. There is no single pinned
  // version to compare, so there is nothing to assert.
  assert.equal(classify('react-native>jest-environment-node', '^30.4.1', '^30.4.1', 'x/p.json'), null);
  assert.equal(classify('x', '^1.2.0', '^1.3.0', 'x/package.json'), null);
});

test('a prerelease declaration does not manufacture a finding', () => {
  assert.equal(classify('x', '1.0.0', '^1.0.0-beta.1', 'x/package.json'), null);
});

test('only bare-name selectors are treated as forcing every consumer', () => {
  // A selector carrying its own range only rewrites resolutions INSIDE that range,
  // so it cannot hold a newer declaration back.
  assert.equal(isBareName('axios'), true);
  assert.equal(isBareName('@xmldom/xmldom'), true);
  assert.equal(isBareName('zod@3'), false);
  assert.equal(isBareName('@xmldom/xmldom@<0.8.15'), false);
  assert.equal(isBareName('qs@6.14.2'), false);
  assert.equal(isBareName('react-native>jest-environment-node'), false);
  assert.equal(isBareName('brace-expansion@<2.0.0'), false);
});

test('resolved versions come from the lockfile, not the pnpm store', () => {
  // An early draft read node_modules/.pnpm, which retains previously-installed
  // versions until pruned, and reported validator 13.15.26 and 13.15.35 as
  // coexisting when only one was resolved. A gate that fires on a stale store is
  // worse than no gate: it trains people to ignore it.
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  writeFileSync(
    join(dir, 'pnpm-lock.yaml'),
    ['packages:', '  /validator@13.15.35:', '    resolution: {integrity: sha512-x}', ''].join('\n'),
  );
  mkdirSync(join(dir, 'node_modules/.pnpm/validator@13.15.26/node_modules/validator'), {
    recursive: true,
  });
  const got = resolvedVersions('validator', dir);
  assert.deepEqual([...got], ['13.15.35']);
});

test('a scoped package name is matched exactly in the lockfile', () => {
  // The name goes into a RegExp, so an unescaped @ or / would match the wrong rows.
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  writeFileSync(
    join(dir, 'pnpm-lock.yaml'),
    [
      'packages:',
      '  /@xmldom/xmldom@0.8.15:',
      '  /@xmldom/xmldom@0.9.12:',
      '  /xmldom@0.6.0:',
      '',
    ].join('\n'),
  );
  const got = resolvedVersions('@xmldom/xmldom', dir);
  assert.deepEqual([...got].sort(), ['0.8.15', '0.9.12']);
  // The unscoped package must not be picked up by the scoped query, or vice versa.
  assert.deepEqual([...resolvedVersions('xmldom', dir)], ['0.6.0']);
});

test('a dot in a package name is escaped, not treated as a wildcard', () => {
  // The repo overrides @jsonjoy.com/fs-snapshot. An unescaped dot matches any
  // character, so the query would also match @jsonjoyXcom/... and any sibling
  // whose name differs only there. Without a dotted name in the fixtures, dropping
  // the escaping is invisible: @xmldom/xmldom contains no metacharacters at all.
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  writeFileSync(
    join(dir, 'pnpm-lock.yaml'),
    [
      'packages:',
      '  /@jsonjoy.com/fs-snapshot@4.57.7:',
      '  /@jsonjoyXcom/fs-snapshot@9.9.9:',
      '',
    ].join('\n'),
  );
  assert.deepEqual([...resolvedVersions('@jsonjoy.com/fs-snapshot', dir)], ['4.57.7']);
});

test('a peer-suffixed lockfile entry yields the base version only', () => {
  // Entries carry peer context: /pkg@1.2.3(react@19.0.0). Capturing that suffix
  // would make every version invalid and silently disable split detection.
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  writeFileSync(
    join(dir, 'pnpm-lock.yaml'),
    ['packages:', '  /stream-chat@9.52.0(debug@4.4.3):', ''].join('\n'),
  );
  assert.deepEqual([...resolvedVersions('stream-chat', dir)], ['9.52.0']);
});

test('a missing lockfile yields nothing rather than throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  assert.deepEqual([...resolvedVersions('axios', dir)], []);
});
