// Tests for the override drift gate. Reading the real repo is what the workflow step
// does; what is pinned here is the CLASSIFICATION and the lockfile parsing, since
// those are what decide whether a stale pin reds the build.
//
// Every "should not fire" case below is a real shape from the repo's own overrides
// block. A gate that reds the build on a legitimate CVE floor gets disabled within a
// week, so the negative cases matter as much as the positive ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classify,
  isBareName,
  parseLockfileVersions,
  collectDeclarations,
  findDrift,
  readRepo,
} from './check-override-drift.mjs';

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
  // forced zod across a major for the same reason. Flagging these makes the gate
  // useless and it gets switched off.
  assert.equal(classify('zod', '4.5.4', '^3.24.1', 'x/package.json'), null);
  assert.equal(classify('tiptap', '3.30.6', '^3.27.0', 'x/package.json'), null);
});

test('a pin that satisfies the declared range does not fire', () => {
  assert.equal(classify('multer', '2.3.0', '^2.3.0', 'x/package.json'), null);
  assert.equal(classify('qs', '6.16.0', '^6.15.0', 'x/package.json'), null);
});

test('an exact declaration matching the pin does not fire', () => {
  assert.equal(classify('body-parser', '1.20.6', '1.20.6', 'x/package.json'), null);
});

test('the workspace protocol is skipped rather than reported', () => {
  assert.equal(classify('@yosemite-crew/lib', '1.0.0', 'workspace:*', 'x/package.json'), null);
});

test('an unparseable range is skipped rather than reported', () => {
  // Publishers ship these. semver.satisfies returns false for every version, which
  // would otherwise manufacture a mismatch that does not exist.
  assert.equal(classify('x', '1.0.0', '>=3.16.0 || >=4.0.0-', 'x/package.json'), null);
  assert.equal(classify('x', '1.0.0', 'github:owner/repo', 'x/package.json'), null);
  assert.equal(classify('x', '1.0.0', 'npm:other@^1.0.0', 'x/package.json'), null);
});

test('an override whose value is a range, not a version, is skipped', () => {
  assert.equal(classify('x', '^1.2.0', '^1.3.0', 'x/package.json'), null);
  assert.equal(classify('x', '~1.2.0', '^1.3.0', 'x/package.json'), null);
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

test('a scoped package name is parsed as one name, not split at the slash', () => {
  const idx = parseLockfileVersions(
    [
      'packages:',
      '  /@xmldom/xmldom@0.8.15:',
      '  /@xmldom/xmldom@0.9.12:',
      '  /xmldom@0.6.0:',
      '',
    ].join('\n')
  );
  assert.deepEqual([...idx.get('@xmldom/xmldom')].sort(), ['0.8.15', '0.9.12']);
  // The unscoped package must not be folded into the scoped one, or vice versa.
  assert.deepEqual([...idx.get('xmldom')], ['0.6.0']);
});

test('a dot in a package name is not treated as a wildcard', () => {
  // The repo overrides @jsonjoy.com/fs-snapshot. Without a dotted name in the
  // fixtures, a regex that stopped escaping or loosened the name class would be
  // invisible: @xmldom/xmldom contains no metacharacters at all.
  const idx = parseLockfileVersions(
    [
      'packages:',
      '  /@jsonjoy.com/fs-snapshot@4.57.7:',
      '  /@jsonjoyXcom/fs-snapshot@9.9.9:',
      '',
    ].join('\n')
  );
  assert.deepEqual([...idx.get('@jsonjoy.com/fs-snapshot')], ['4.57.7']);
  assert.equal(idx.has('@jsonjoyXcom/fs-snapshot'), true);
  assert.notDeepEqual(idx.get('@jsonjoy.com/fs-snapshot'), idx.get('@jsonjoyXcom/fs-snapshot'));
});

test('a peer-suffixed entry yields the base version only', () => {
  // Entries carry peer context: /pkg@1.2.3(react@19.0.0). Capturing that suffix
  // would make every version invalid and silently disable split detection.
  const idx = parseLockfileVersions(
    ['packages:', '  /stream-chat@9.52.0(debug@4.4.3):', ''].join('\n')
  );
  assert.deepEqual([...idx.get('stream-chat')], ['9.52.0']);
});

test('an importer block is not mistaken for a resolved package', () => {
  // Importer entries sit at four-space indent under `importers:` and carry
  // `specifier:` / `version:` rather than a leading slash. Matching them would
  // invent versions that are not resolutions.
  const idx = parseLockfileVersions(
    [
      'importers:',
      '  apps/backend:',
      '    dependencies:',
      '      axios:',
      '        specifier: ^1.20.0',
      '        version: 1.20.0',
      '',
    ].join('\n')
  );
  assert.equal(idx.size, 0);
});

test("the lockfile's own overrides block is not parsed as resolutions", () => {
  // pnpm mirrors the overrides map at the top of the lockfile, at the same two-space
  // indent as package entries but WITHOUT the leading slash, and quotes any selector
  // containing special characters. Dropping the `/` from the pattern matches inside
  // those keys: measured against the real lockfile it produced 54 spurious versions,
  // including "grpc-js@1.9.15'" from `  '@grpc/grpc-js@1.9.15': 1.9.16`.
  const idx = parseLockfileVersions(
    [
      'overrides:',
      '  uuid@<11.1.1: 11.1.1',
      '  ip-address: 10.3.1',
      // The line with teeth: bare name, bare selector version, no quotes and no
      // metacharacters, so `  qs@6.14.2` matches the pattern in every respect
      // except the leading slash. Drop the slash and this registers qs at 6.14.2,
      // which is the override's OLD version and exactly the false split the anchor
      // prevents. The three lines around it each fail to match for their own
      // unrelated reason and so cannot guard it.
      '  qs@6.14.2: 6.15.2',
      "  '@grpc/grpc-js@1.9.15': 1.9.16",
      'packages:',
      '  /@grpc/grpc-js@1.9.16:',
      '  /@types/node@26.4.0:',
      '  /@commitlint/cli@21.2.1(@types/node@26.4.0)(typescript@5.9.3):',
      '',
    ].join('\n')
  );
  // Only the real package entries, under their full scoped names.
  assert.deepEqual([...idx.keys()].sort(), ['@commitlint/cli', '@grpc/grpc-js', '@types/node']);
  assert.deepEqual([...idx.get('@grpc/grpc-js')], ['1.9.16']);
  assert.deepEqual([...idx.get('@types/node')], ['26.4.0']);
  // A scoped entry must not also register under its bare tail. Without the
  // two-space-then-slash anchor the pattern matches mid-line from `/node@26.4.0`,
  // inventing a `node` package. Measured against the real lockfile that produced 46
  // phantom entries that pass semver.valid, including node, express and react from
  // @types/*, and an override on any of those names would then fire a false split.
  // The peer suffix is where this bites: `(@types/node@26.4.0)` sits mid-line, so
  // without the anchor the pattern matches a SECOND time from `/node@26.4.0`.
  assert.equal(idx.has('node'), false);
  assert.equal(idx.has('cli'), false);
  assert.equal(idx.has('grpc-js'), false);
  assert.equal(idx.has('qs'), false);
});

test('an empty lockfile yields no resolutions rather than throwing', () => {
  assert.equal(parseLockfileVersions('').size, 0);
});

test('declarations are collected across all three dependency fields', () => {
  const decls = collectDeclarations([
    { file: 'apps/a/package.json', json: { dependencies: { x: '^1.0.0' } } },
    { file: 'apps/b/package.json', json: { devDependencies: { x: '^2.0.0' } } },
    { file: 'packages/c/package.json', json: { optionalDependencies: { x: '^3.0.0' } } },
  ]);
  assert.deepEqual(
    decls.get('x').map((d) => d.range),
    ['^1.0.0', '^2.0.0', '^3.0.0']
  );
});

test('end to end: the axios shape reds, and the tiptap floor does not', () => {
  const findings = findDrift({
    overrides: { axios: '1.19.0', '@tiptap/core': '3.30.6' },
    manifests: [
      { file: 'apps/backend/package.json', json: { dependencies: { axios: '^1.20.0' } } },
      { file: 'apps/frontend/package.json', json: { dependencies: { '@tiptap/core': '^3.27.0' } } },
    ],
    lockText: ['packages:', '  /axios@1.19.0:', '  /@tiptap/core@3.30.6:', ''].join('\n'),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'pins-below-declared');
  assert.equal(findings[0].name, 'axios');
});

test('end to end: a split tree is reported', () => {
  // The i18next shape: the declaration and the pin are both satisfiable, so nothing
  // is inert, but two copies are resolved and that is the override's fault.
  const findings = findDrift({
    overrides: { i18next: '26.3.6' },
    manifests: [
      { file: 'apps/mobileAppYC/package.json', json: { dependencies: { i18next: '^26.3.0' } } },
    ],
    lockText: ['packages:', '  /i18next@26.3.6:', '  /i18next@26.4.1:', ''].join('\n'),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'splits-tree');
  assert.deepEqual(findings[0].others, ['26.4.1']);
});

test('a single resolved copy is not reported as a split', () => {
  const findings = findDrift({
    overrides: { i18next: '26.4.1' },
    manifests: [
      { file: 'apps/mobileAppYC/package.json', json: { dependencies: { i18next: '^26.3.0' } } },
    ],
    lockText: ['packages:', '  /i18next@26.4.1:', ''].join('\n'),
  });
  assert.deepEqual(findings, []);
});

test('a package nobody declares is not reported, split or otherwise', () => {
  // Most overrides exist purely to patch a transitive nothing first-party declares.
  // Those are the majority of the block and must stay silent.
  const findings = findDrift({
    overrides: { 'some-transitive': '1.0.0' },
    manifests: [{ file: 'apps/a/package.json', json: { dependencies: { other: '^1.0.0' } } }],
    lockText: ['packages:', '  /some-transitive@1.0.0:', '  /some-transitive@2.0.0:', ''].join(
      '\n'
    ),
  });
  assert.deepEqual(findings, []);
});

test('the walk includes the root manifest', () => {
  // The overrides live in the root package.json, and so do 20-odd devDependencies
  // that the same overrides can pin below. Walking only apps/ and packages/ made
  // that one file the single blind spot in the gate.
  const { manifests } = readRepo();
  const root = manifests.find((m) => m.file === 'package.json');
  assert.ok(root, 'root package.json must be walked like any other manifest');
  assert.ok(Object.keys(root.json.devDependencies ?? {}).length > 0);
});
