// Unit tests for check-override-advisories.mjs.
//
// Run with: pnpm run test:scripts   (node --test, no test dependency needed)
//
// Every case is hermetic: advisory payloads are inline fixtures and the audit
// reader is injected, so nothing here touches the network or shells out to pnpm.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import {
  applyBaseline,
  CheckError,
  compareVersions,
  findVulnerablePins,
  fixedVersionFrom,
  formatFinding,
  indexOverrides,
  isExactVersion,
  main,
  overrideKeyCovers,
  parseOverrideKey,
  selectorCovers,
  splitOverrideKey,
  suggestRangeKey,
} from './check-override-advisories.mjs';

const workdir = mkdtempSync(path.join(tmpdir(), 'override-advisories-'));
after(() => rmSync(workdir, { recursive: true, force: true }));

function writeJson(name, value) {
  const file = path.join(workdir, name);
  writeFileSync(file, JSON.stringify(value));
  return file;
}

function advisory(overrides) {
  return {
    id: 1000,
    github_advisory_id: 'GHSA-test-0000-0000',
    module_name: 'axios',
    severity: 'high',
    title: 'test advisory',
    vulnerable_versions: '<1.18.0',
    patched_versions: '>=1.18.0',
    url: 'https://github.com/advisories/GHSA-test-0000-0000',
    findings: [{ version: '1.16.0', paths: ['apps/backend > axios@1.16.0'] }],
    ...overrides,
  };
}

// Captures console output so main() can be asserted on without noise in the
// test report.
function runMain(argv, options) {
  const log = [];
  const { log: realLog, error: realError } = console;
  console.log = (...args) => log.push(args.join(' '));
  console.error = (...args) => log.push(args.join(' '));
  try {
    return { code: main(argv, options), output: log.join('\n') };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

describe('parseOverrideKey', () => {
  it('returns a bare package name unchanged', () => {
    assert.equal(parseOverrideKey('axios'), 'axios');
  });

  it('keeps the scope of a scoped package', () => {
    assert.equal(parseOverrideKey('@protobufjs/utf8'), '@protobufjs/utf8');
  });

  it('strips an exact-version selector', () => {
    assert.equal(parseOverrideKey('axios@1.15.2'), 'axios');
  });

  it('strips a bare major selector', () => {
    assert.equal(parseOverrideKey('ajv@6'), 'ajv');
  });

  it('strips a range selector from a scoped package', () => {
    assert.equal(parseOverrideKey('@tiptap/core@<=3.27.0'), '@tiptap/core');
  });

  it('takes the child of a parent>child key', () => {
    assert.equal(parseOverrideKey('@aws-cdk/toolkit-lib>yaml'), 'yaml');
  });

  // Regression: '>' is both pnpm's parent>child separator and a semver
  // operator. Treating the range '>' as a separator silently reduced this key
  // to '=5.0.0', so the pin was never checked against any advisory.
  it('does not mistake a >= range operator for a parent separator', () => {
    assert.equal(parseOverrideKey('brace-expansion@>=5.0.0'), 'brace-expansion');
  });

  it('does not mistake a bare > range operator for a parent separator', () => {
    assert.equal(parseOverrideKey('brace-expansion@>5.0.0'), 'brace-expansion');
  });

  it('handles a parent>child key whose child carries a range selector', () => {
    assert.equal(parseOverrideKey('parent>child@>=1.0.0'), 'child');
  });
});

describe('isExactVersion', () => {
  it('accepts a plain semver version', () => {
    assert.equal(isExactVersion('1.18.0'), true);
  });

  it('accepts a prerelease version', () => {
    assert.equal(isExactVersion('1.18.0-rc.1'), true);
  });

  it('rejects a range', () => {
    assert.equal(isExactVersion('^1.18.0'), false);
    assert.equal(isExactVersion('>=1.18.0'), false);
  });
});

describe('splitOverrideKey', () => {
  it('separates the name from an exact-version selector', () => {
    assert.deepEqual(splitOverrideKey('axios@1.15.2'), {
      name: 'axios',
      selector: '1.15.2',
      parent: null,
    });
  });

  it('separates the name from a range selector on a scoped package', () => {
    assert.deepEqual(splitOverrideKey('@tiptap/core@<=3.27.0'), {
      name: '@tiptap/core',
      selector: '<=3.27.0',
      parent: null,
    });
  });

  it('reports no selector for a blanket override', () => {
    assert.deepEqual(splitOverrideKey('protobufjs'), {
      name: 'protobufjs',
      selector: null,
      parent: null,
    });
  });

  it('takes the child of a parent>child key and keeps its selector and parent', () => {
    assert.deepEqual(splitOverrideKey('parent>child@>=1.0.0'), {
      name: 'child',
      selector: '>=1.0.0',
      parent: 'parent',
    });
  });
});

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
    assert.equal(compareVersions('1.2.0', '1.10.0'), -1); // numeric, not lexical
    assert.equal(compareVersions('3.3.18', '3.3.9'), 1);
    assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  });

  it('sorts a prerelease below the release it precedes', () => {
    assert.equal(compareVersions('3.3.18-rc.1', '3.3.18'), -1);
    assert.equal(compareVersions('3.3.18', '3.3.18-rc.1'), 1);
  });

  it('ignores build metadata', () => {
    assert.equal(compareVersions('1.2.3+build.5', '1.2.3'), 0);
  });
});

describe('selectorCovers', () => {
  // A blanket override applies to whatever resolves, so it can never leave a
  // copy uncovered.
  it('treats a missing selector as covering everything', () => {
    assert.equal(selectorCovers(null, '7.0.3'), true);
    assert.equal(selectorCovers('', '7.0.3'), true);
  });

  // The uuid failure in one line: an exact selector reaches exactly one version.
  it('matches an exact selector only against that version', () => {
    assert.equal(selectorCovers('9.0.1', '9.0.1'), true);
    assert.equal(selectorCovers('9.0.1', '8.3.2'), false);
    assert.equal(selectorCovers('11.1.0', '7.0.3'), false);
  });

  it('treats a bare major as covering its whole line', () => {
    assert.equal(selectorCovers('3', '3.3.17'), true);
    assert.equal(selectorCovers('3', '4.0.0'), false);
    assert.equal(selectorCovers('6', '6.12.6'), true);
  });

  it('treats a major.minor as covering that line', () => {
    assert.equal(selectorCovers('3.3', '3.3.17'), true);
    assert.equal(selectorCovers('3.3', '3.4.0'), false);
  });

  it('applies the < and <= comparators', () => {
    assert.equal(selectorCovers('<11.1.1', '8.3.2'), true);
    assert.equal(selectorCovers('<11.1.1', '11.1.1'), false);
    assert.equal(selectorCovers('<=3.27.0', '3.27.0'), true);
    assert.equal(selectorCovers('<=3.27.0', '3.27.1'), false);
  });

  it('applies the > and >= comparators', () => {
    assert.equal(selectorCovers('>=5.0.0', '5.0.9'), true);
    assert.equal(selectorCovers('>=5.0.0', '4.9.9'), false);
    assert.equal(selectorCovers('>2.0.0', '2.0.0'), false);
  });

  // An explicit '=' takes the comparator path, unlike a bare '1.2.3' which is
  // read as a prefix. Both have to end up meaning the same thing.
  it('applies an explicit = comparator', () => {
    assert.equal(selectorCovers('=1.2.3', '1.2.3'), true);
    assert.equal(selectorCovers('=1.2.3', '1.2.4'), false);
    assert.equal(selectorCovers('= 1.2.3', '1.2.3'), true);
  });

  it('tolerates a v prefix on the bound', () => {
    assert.equal(selectorCovers('<v11.1.1', '8.3.2'), true);
    assert.equal(selectorCovers('>=v5.0.0', '4.9.9'), false);
  });

  // A partial bound names a whole line, not a zero-padded point. semver reads
  // '>1' as "from 2.0.0" and '<=1.2' as "all of 1.2.x"; zero-padding gets both
  // backwards, calling 1.5.0 covered by '>1' and 1.2.5 uncovered by '<=1.2'.
  it('expands a partial comparator bound the way semver does', () => {
    assert.equal(selectorCovers('>1', '1.5.0'), false);
    assert.equal(selectorCovers('>1', '2.0.0'), true);
    assert.equal(selectorCovers('<=1.2', '1.2.5'), true);
    assert.equal(selectorCovers('<=1.2', '1.3.0'), false);
    assert.equal(selectorCovers('<1.2', '1.1.9'), true);
    assert.equal(selectorCovers('<1.2', '1.2.0'), false);
    assert.equal(selectorCovers('>=1.2', '1.2.0'), true);
    assert.equal(selectorCovers('>=1.2', '1.1.9'), false);
    assert.equal(selectorCovers('=1.2', '1.2.9'), true);
    assert.equal(selectorCovers('=1.2', '1.3.0'), false);
  });

  // semver keeps a prerelease out of an ordinary range, and so does pnpm, so an
  // exact 'pkg@1.2.3' key genuinely would not be applied to 1.2.3-alpha.1.
  // Claiming coverage there would let a vulnerable prerelease pass unreported.
  it('does not let a plain selector cover a prerelease', () => {
    assert.equal(selectorCovers('1.2.3', '1.2.3-alpha.1'), false);
    assert.equal(selectorCovers('1.2.3', '1.2.3'), true);
    assert.equal(selectorCovers('3', '3.3.18-rc.1'), false);
    assert.equal(selectorCovers('3', '3.3.18'), true);
  });

  // A selector that IS a prerelease is a point and has to be compared as one.
  // Its tag is not a numeric part, so without an explicit branch it reaches the
  // permissive fallback and reads as covering the entire tree.
  it('matches an exact prerelease selector as a point', () => {
    assert.equal(selectorCovers('1.2.3-alpha.1', '1.2.3-alpha.1'), true);
    assert.equal(selectorCovers('1.2.3-alpha.1', '1.2.3-alpha.2'), false);
    assert.equal(selectorCovers('1.2.3-alpha.1', '9.9.9'), false);
    assert.equal(selectorCovers('1.2.3-alpha.1', '1.2.3'), false);
  });

  // ^ and ~ are handled rather than left to the catch-all, because the catch-all
  // direction is a false negative: a '^8.0.0' key silently treated as covering a
  // 7.0.3 copy is exactly the uuid failure again, one operator along.
  it('applies caret ranges, including the 0.x special cases', () => {
    assert.equal(selectorCovers('^8.0.0', '7.0.3'), false);
    assert.equal(selectorCovers('^8.0.0', '8.5.0'), true);
    assert.equal(selectorCovers('^8.0.0', '9.0.0'), false);
    // ^ pins the left-most non-zero element, so 0.x behaves differently.
    assert.equal(selectorCovers('^0.2.3', '0.2.9'), true);
    assert.equal(selectorCovers('^0.2.3', '0.3.0'), false);
    assert.equal(selectorCovers('^0.0.3', '0.0.4'), false);
    assert.equal(selectorCovers('^0', '0.9.9'), true);
    assert.equal(selectorCovers('^0', '1.0.0'), false);
  });

  it('applies tilde ranges at each level of precision', () => {
    assert.equal(selectorCovers('~8.3.0', '8.3.9'), true);
    assert.equal(selectorCovers('~8.3.0', '8.4.0'), false);
    assert.equal(selectorCovers('~1.2', '1.2.9'), true);
    assert.equal(selectorCovers('~1.2', '1.3.0'), false);
    assert.equal(selectorCovers('~1', '1.9.9'), true);
    assert.equal(selectorCovers('~1', '2.0.0'), false);
  });

  // Erring towards silence: an unfamiliar selector must not manufacture a
  // finding, because the stale-pin check still covers that key on its own.
  it('treats an unrecognised selector as covering the version', () => {
    assert.equal(selectorCovers('workspace:*', '1.0.0'), true);
    assert.equal(selectorCovers('npm:other@1.0.0', '1.0.0'), true);
    assert.equal(selectorCovers('*', '1.0.0'), true);
    assert.equal(selectorCovers('>=1 <2', '9.9.9'), true);
  });

  // Regression guard on the prefix branch: a bare '1' selects the 1.x line and
  // must not be read as a string prefix of '10.0.0'.
  it('does not let a bare major prefix-match a longer major', () => {
    assert.equal(selectorCovers('1', '10.0.0'), false);
    assert.equal(selectorCovers('3', '30.0.0'), false);
  });

  // `uuid@8` and `uuid@8.x` mean the same thing. Letting only the first through
  // would leave the second in the catch-all, silently reinstating the blind spot
  // this whole check exists to close.
  it('reads an x-range as the prefix it stands for', () => {
    assert.equal(selectorCovers('8.x', '7.0.3'), false);
    assert.equal(selectorCovers('8.x', '8.3.2'), true);
    assert.equal(selectorCovers('8.x', '9.0.0'), false);
    assert.equal(selectorCovers('8.*', '7.0.3'), false);
    assert.equal(selectorCovers('8.X', '8.1.0'), true);
    assert.equal(selectorCovers('8.x.x', '7.0.3'), false);
    assert.equal(selectorCovers('1.2.x', '1.2.7'), true);
    assert.equal(selectorCovers('1.2.x', '1.3.0'), false);
  });

  it('treats a lone wildcard as covering everything', () => {
    assert.equal(selectorCovers('x', '9.9.9'), true);
    assert.equal(selectorCovers('*', '9.9.9'), true);
  });
});

describe('overrideKeyCovers', () => {
  it('reads the selector straight off the key', () => {
    assert.equal(overrideKeyCovers('uuid@9.0.1', '8.3.2'), false);
    assert.equal(overrideKeyCovers('uuid@<11.1.1', '8.3.2'), true);
    assert.equal(overrideKeyCovers('uuid', '8.3.2'), true);
    assert.equal(overrideKeyCovers('nanoid@3', '3.3.17'), true);
  });
});

describe('overrideKeyCovers with a parent-scoped key', () => {
  const key = 'react-native>jest-environment-node';

  it('covers a copy reached through that parent', () => {
    assert.equal(
      overrideKeyCovers(key, '1.2.3', ['apps/m > react-native > jest-environment-node@1.2.3']),
      true
    );
  });

  // A parent-scoped override only rewrites the copy under that parent, so it
  // must not be credited with covering one that arrives another way. This key
  // has no blanket sibling in the repo, so without the check every
  // jest-environment-node in the tree would look covered.
  it('does not cover a copy reached through a different parent', () => {
    assert.equal(
      overrideKeyCovers(key, '1.2.3', ['apps/m > jest > jest-environment-node@1.2.3']),
      false
    );
  });

  it('credits the key when no path information is available', () => {
    assert.equal(overrideKeyCovers(key, '1.2.3', null), true);
    assert.equal(overrideKeyCovers(key, '1.2.3', []), true);
  });

  // The same version can arrive both under the scoped parent and elsewhere.
  // Crediting the key because one path matched would suppress the finding for
  // the occurrence the override cannot rewrite.
  it('requires every path to go through the parent, not just one', () => {
    assert.equal(
      overrideKeyCovers(key, '1.2.3', [
        'apps/m > react-native > jest-environment-node@1.2.3',
        'apps/m > jest > jest-environment-node@1.2.3',
      ]),
      false
    );
  });
});

describe('suggestRangeKey', () => {
  it('suggests a range key bounded by the first patched release', () => {
    assert.equal(suggestRangeKey('uuid', '11.1.1', '>=11.1.1'), '"uuid@<11.1.1": "11.1.1"');
  });

  it('suggests nothing when no fix has been published', () => {
    assert.equal(suggestRangeKey('uuid', null), null);
  });

  // '<2.0.0 || >=2.0.5' has no single lower bound. Suggesting "<2.0.0": "2.0.0"
  // would miss a vulnerable 2.0.3 and pin copies to a version outside the
  // patched set, so no suggestion is better than a wrong one.
  it('suggests nothing for a disjoint patched range', () => {
    assert.equal(suggestRangeKey('pkg', '2.0.0', '<2.0.0 || >=2.0.5'), null);
  });
});

describe('indexOverrides', () => {
  it('groups every entry that targets the same package', () => {
    const index = indexOverrides({
      axios: '1.18.0',
      'axios@1.15.2': '1.18.0',
      'fast-uri': '3.1.4',
    });
    assert.deepEqual(index.get('axios'), [
      { key: 'axios', pinned: '1.18.0' },
      { key: 'axios@1.15.2', pinned: '1.18.0' },
    ]);
    assert.equal(index.get('fast-uri').length, 1);
  });

  it('tolerates a missing overrides block', () => {
    assert.equal(indexOverrides(undefined).size, 0);
  });
});

describe('fixedVersionFrom', () => {
  it('takes the lower bound of a patched range', () => {
    assert.equal(fixedVersionFrom('>=1.18.0'), '1.18.0');
  });

  it("reports no fix for npm's <0.0.0 encoding", () => {
    assert.equal(fixedVersionFrom('<0.0.0'), null);
  });

  it('reports no fix when the field is absent', () => {
    assert.equal(fixedVersionFrom(''), null);
    assert.equal(fixedVersionFrom(undefined), null);
  });
});

describe('findVulnerablePins', () => {
  it('flags an override whose pinned version is the vulnerable installed one', () => {
    const findings = findVulnerablePins({ axios: '1.16.0' }, { advisories: { 1000: advisory() } });
    assert.equal(findings.length, 1);
    assert.deepEqual(
      {
        package: findings[0].package,
        overrideKey: findings[0].overrideKey,
        pinned: findings[0].pinned,
        advisory: findings[0].advisory,
        fixedIn: findings[0].fixedIn,
      },
      {
        package: 'axios',
        overrideKey: 'axios',
        pinned: '1.16.0',
        advisory: 'GHSA-test-0000-0000',
        fixedIn: '1.18.0',
      }
    );
  });

  it('clears an override once its pin is raised past the advisory', () => {
    const findings = findVulnerablePins({ axios: '1.18.0' }, { advisories: { 1000: advisory() } });
    assert.deepEqual(findings, []);
  });

  // The real uuid incident. Both override keys selected an exact version and
  // pinned a patched 11.1.1, so the stale-pin check was satisfied, while the
  // copies that were actually vulnerable resolved at 7.0.3 and 8.3.2 and matched
  // neither key. Six high alerts stayed open behind a check that said OK.
  it('reports a vulnerable copy that no override key covers', () => {
    const findings = findVulnerablePins(
      { 'uuid@9.0.1': '11.1.1', 'uuid@11.1.0': '11.1.1' },
      {
        advisories: {
          1000: advisory({
            module_name: 'uuid',
            vulnerable_versions: '<11.1.1',
            patched_versions: '>=11.1.1',
            findings: [{ version: '8.3.2' }, { version: '7.0.3' }],
          }),
        },
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'uncovered-copy');
    assert.equal(findings[0].package, 'uuid');
    assert.deepEqual(findings[0].uncovered, ['8.3.2', '7.0.3']);
    assert.equal(findings[0].suggestedKey, '"uuid@<11.1.1": "11.1.1"');
  });

  // The other half of the same rule: a key that genuinely selects the vulnerable
  // copy is doing its job, and the pin it points at is patched, so there is
  // nothing to report. This is what stops the new check crying wolf on the
  // range keys the repo already uses.
  it('stays quiet when a range key does cover the vulnerable copy', () => {
    const findings = findVulnerablePins(
      { 'uuid@<11.1.1': '11.1.1' },
      {
        advisories: {
          1000: advisory({
            module_name: 'uuid',
            vulnerable_versions: '<11.1.1',
            patched_versions: '>=11.1.1',
            findings: [{ version: '8.3.2' }, { version: '7.0.3' }],
          }),
        },
      }
    );
    assert.deepEqual(findings, []);
  });

  // A blanket override with no selector at all covers every version by
  // definition, so it can never leave a copy uncovered.
  it('treats a selector-less override as covering every copy', () => {
    const findings = findVulnerablePins(
      { uuid: '11.1.1' },
      {
        advisories: {
          1000: advisory({
            module_name: 'uuid',
            vulnerable_versions: '<11.1.1',
            patched_versions: '>=11.1.1',
            findings: [{ version: '8.3.2' }],
          }),
        },
      }
    );
    assert.deepEqual(findings, []);
  });

  // A bare-major key covers its whole line, so `nanoid@3` covers 3.3.17 and the
  // only thing wrong there is the pin. Reporting it twice would be noise.
  it('reports only a stale pin, not an uncovered copy, for a covering major key', () => {
    const findings = findVulnerablePins(
      { 'nanoid@3': '3.3.17' },
      {
        advisories: {
          1000: advisory({
            module_name: 'nanoid',
            vulnerable_versions: '<3.3.18',
            patched_versions: '>=3.3.18',
            findings: [{ version: '3.3.17' }],
          }),
        },
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'stale-pin');
  });

  // Both problems can be true at once: one key pins a vulnerable version while
  // the key set as a whole still fails to reach another vulnerable copy.
  it('reports a stale pin and an uncovered copy independently', () => {
    const findings = findVulnerablePins(
      { 'uuid@8.0.0': '8.0.0' },
      {
        advisories: {
          1000: advisory({
            module_name: 'uuid',
            vulnerable_versions: '<11.1.1',
            patched_versions: '>=11.1.1',
            findings: [{ version: '8.0.0' }, { version: '7.0.3' }],
          }),
        },
      }
    );
    assert.equal(findings.length, 2);
    assert.deepEqual(
      findings.map((finding) => finding.kind).sort(),
      ['stale-pin', 'uncovered-copy']
    );
    assert.deepEqual(
      findings.find((finding) => finding.kind === 'uncovered-copy').uncovered,
      ['7.0.3']
    );
  });

  // The commonest override shape in this repo: an exact-version key pinned to a
  // HIGHER version, e.g. "vite@7.3.3": "7.3.5". The installed 7.3.5 is by
  // construction not selected by the key `vite@7.3.3`, so a naive coverage test
  // calls it uncovered and prints "no override key covers 7.3.5" right next to a
  // stale-pin finding for the same version. The override plainly did apply: 7.3.5
  // is installed BECAUSE of it. Only the stale pin should be reported.
  it('does not double-report a stale pin as an uncovered copy', () => {
    const findings = findVulnerablePins(
      { 'vite@7.3.3': '7.3.5' },
      {
        advisories: {
          1000: advisory({
            module_name: 'vite',
            vulnerable_versions: '<7.3.6',
            patched_versions: '>=7.3.6',
            findings: [{ version: '7.3.5' }],
          }),
        },
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'stale-pin');
  });

  // The two exclusions are independent: a pinned value is forgiven, but a copy
  // that is neither the pin nor covered by a key is still reported.
  it('still reports a genuinely uncovered copy alongside a stale pin', () => {
    const findings = findVulnerablePins(
      { 'vite@7.3.3': '7.3.5' },
      {
        advisories: {
          1000: advisory({
            module_name: 'vite',
            vulnerable_versions: '<7.3.6',
            patched_versions: '>=7.3.6',
            findings: [{ version: '7.3.5' }, { version: '6.0.0' }],
          }),
        },
      }
    );
    assert.equal(findings.length, 2);
    const uncoveredFinding = findings.find((finding) => finding.kind === 'uncovered-copy');
    assert.deepEqual(uncoveredFinding.uncovered, ['6.0.0']);
  });

  // No patched release means no range key can be suggested; the finding still
  // has to surface rather than being dropped for lack of a suggestion.
  it('reports an uncovered copy even when no fix has been published', () => {
    const findings = findVulnerablePins(
      { 'uuid@9.0.1': '11.1.1' },
      {
        advisories: {
          1000: advisory({
            module_name: 'uuid',
            vulnerable_versions: '<11.1.1',
            patched_versions: '<0.0.0',
            findings: [{ version: '7.0.3' }],
          }),
        },
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'uncovered-copy');
    assert.equal(findings[0].suggestedKey, null);
  });

  it('ignores a vulnerable package that is not overridden at all', () => {
    const findings = findVulnerablePins(
      { axios: '1.18.0' },
      { advisories: { 1000: advisory({ module_name: 'dompurify' }) } }
    );
    assert.deepEqual(findings, []);
  });

  it('flags a parent>child override by its child package', () => {
    const findings = findVulnerablePins(
      { '@aws-cdk/toolkit-lib>yaml': '1.10.2' },
      {
        advisories: {
          1000: advisory({ module_name: 'yaml', findings: [{ version: '1.10.2' }] }),
        },
      }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].overrideKey, '@aws-cdk/toolkit-lib>yaml');
  });

  it('flags a range pin whenever a vulnerable copy is present, and says so', () => {
    const findings = findVulnerablePins({ axios: '^1.16.0' }, { advisories: { 1000: advisory() } });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].pinIsRange, true);
  });

  it('orders findings by severity, worst first', () => {
    const findings = findVulnerablePins(
      { axios: '1.16.0', 'fast-uri': '3.1.3' },
      {
        advisories: {
          1000: advisory({ severity: 'moderate' }),
          1001: advisory({
            module_name: 'fast-uri',
            severity: 'critical',
            github_advisory_id: 'GHSA-test-1111-1111',
            findings: [{ version: '3.1.3' }],
          }),
        },
      }
    );
    assert.deepEqual(
      findings.map((f) => f.severity),
      ['critical', 'moderate']
    );
  });

  it('falls back to the numeric advisory id when there is no GHSA id', () => {
    const findings = findVulnerablePins(
      { axios: '1.16.0' },
      { advisories: { 1000: advisory({ github_advisory_id: undefined, id: 1234 }) } }
    );
    assert.equal(findings[0].advisory, '1234');
  });

  it('tolerates an audit report with no advisories', () => {
    assert.deepEqual(findVulnerablePins({ axios: '1.16.0' }, {}), []);
  });
});

describe('applyBaseline', () => {
  const finding = {
    package: 'tar',
    pinned: '7.5.17',
    advisory: 'GHSA-23hp-3jrh-7fpw',
    severity: 'critical',
  };

  it('accepts a finding that the baseline records exactly', () => {
    const result = applyBaseline([finding], { accepted: [finding] });
    assert.deepEqual(result.unaccepted, []);
    assert.equal(result.known.length, 1);
    assert.deepEqual(result.stale, []);
  });

  // The property that makes the baseline safe: it is keyed on the pinned
  // version, so raising the pin cannot carry the acceptance forward.
  it('stops accepting once the pinned version changes', () => {
    const result = applyBaseline([{ ...finding, pinned: '7.5.21' }], { accepted: [finding] });
    assert.equal(result.unaccepted.length, 1);
    assert.equal(result.stale.length, 1);
  });

  it('does not accept a different advisory against the same pin', () => {
    const result = applyBaseline([{ ...finding, advisory: 'GHSA-new-0000-0000' }], {
      accepted: [finding],
    });
    assert.equal(result.unaccepted.length, 1);
  });

  // pnpm audit lists findings in whatever order it likes. An order-sensitive key
  // would make an accepted entry go stale the day that order changes, failing CI
  // on an advisory nobody touched.
  it('accepts an uncovered-copy entry regardless of version order', () => {
    const finding = {
      kind: 'uncovered-copy',
      package: 'uuid',
      pinned: '11.1.1',
      uncovered: ['8.3.2', '7.0.3'],
      advisory: 'GHSA-uuid',
    };
    const baseline = {
      accepted: [
        {
          kind: 'uncovered-copy',
          package: 'uuid',
          uncovered: ['7.0.3', '8.3.2'],
          advisory: 'GHSA-uuid',
          reason: 'blocked upstream',
        },
      ],
    };
    const { unaccepted, known } = applyBaseline([finding], baseline);
    assert.deepEqual(unaccepted, []);
    assert.equal(known.length, 1);
  });

  it('reports every finding when there is no baseline', () => {
    const result = applyBaseline([finding], null);
    assert.equal(result.unaccepted.length, 1);
    assert.deepEqual(result.stale, []);
  });

  it('reports a baseline entry that no longer matches anything', () => {
    const result = applyBaseline([], { accepted: [finding] });
    assert.deepEqual(result.stale, [finding]);
  });
});

describe('formatFinding', () => {
  it('prints the override key, the pin, the advisory and the fixing version', () => {
    const [finding] = findVulnerablePins({ axios: '1.16.0' }, { advisories: { 1000: advisory() } });
    const text = formatFinding(finding);
    assert.match(text, /override key: {2}"axios"/);
    assert.match(text, /pinned at: {5}1\.16\.0/);
    assert.match(text, /advisory: {6}GHSA-test-0000-0000/);
    assert.match(text, /fixed in: {6}1\.18\.0/);
  });

  it('says so plainly when no patched version exists', () => {
    const [finding] = findVulnerablePins(
      { axios: '1.16.0' },
      { advisories: { 1000: advisory({ patched_versions: '<0.0.0' }) } }
    );
    assert.match(formatFinding(finding), /no patched version published/);
  });
});

describe('main', () => {
  const manifest = writeJson('package.json', { pnpm: { overrides: { axios: '1.16.0' } } });
  const vulnerableAudit = writeJson('audit-vulnerable.json', {
    advisories: { 1000: advisory() },
  });
  const cleanAudit = writeJson('audit-clean.json', { advisories: {} });

  it('fails with an actionable report when an override pins a vulnerable version', () => {
    const { code, output } = runMain([
      '--manifest',
      manifest,
      '--audit-json',
      vulnerableAudit,
      '--no-baseline',
    ]);
    assert.equal(code, 1);
    assert.match(output, /1 override entry pins a version with a known advisory/);
    assert.match(output, /GHSA-test-0000-0000/);
    assert.match(output, /fixed in: {6}1\.18\.0/);
  });

  it('passes when no override pins a vulnerable version', () => {
    const { code, output } = runMain([
      '--manifest',
      manifest,
      '--audit-json',
      cleanAudit,
      '--no-baseline',
    ]);
    assert.equal(code, 0);
    assert.match(output, /OK - every override pins a patched version and covers every vulnerable copy/);
  });

  it('passes when the only finding is recorded in the baseline', () => {
    const baseline = writeJson('baseline.json', {
      accepted: [{ package: 'axios', pinned: '1.16.0', advisory: 'GHSA-test-0000-0000' }],
    });
    const { code, output } = runMain([
      '--manifest',
      manifest,
      '--audit-json',
      vulnerableAudit,
      '--baseline',
      baseline,
    ]);
    assert.equal(code, 0);
    assert.match(output, /Accepted drift/);
  });

  it('warns and passes when advisory data cannot be fetched', () => {
    const { code, output } = runMain(['--manifest', manifest], {
      readAudit: () => ({ ok: false, reason: 'registry unreachable' }),
    });
    assert.equal(code, 0);
    assert.match(output, /advisory data unavailable - registry unreachable/);
    assert.match(output, /SKIPPED/);
    assert.match(output, /Overrides were NOT verified/);
  });

  it('fails with exit 2 when advisory data cannot be fetched under --strict', () => {
    const { code, output } = runMain(['--manifest', manifest, '--strict'], {
      readAudit: () => ({ ok: false, reason: 'registry unreachable' }),
    });
    assert.equal(code, 2);
    assert.match(output, /--strict was passed/);
  });

  it('rejects an unknown argument instead of silently ignoring it', () => {
    assert.throws(() => runMain(['--nope']), CheckError);
  });

  it('rejects a manifest with no overrides block', () => {
    const empty = writeJson('empty-package.json', { name: 'nothing' });
    assert.throws(
      () => runMain(['--manifest', empty, '--audit-json', cleanAudit]),
      /no pnpm.overrides block/
    );
  });

  it('rejects an unreadable audit report with a message, not a stack trace', () => {
    assert.throws(
      () => runMain(['--manifest', manifest, '--audit-json', path.join(workdir, 'missing.json')]),
      /cannot read audit report/
    );
  });
});
