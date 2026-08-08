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
  findVulnerablePins,
  fixedVersionFrom,
  formatFinding,
  indexOverrides,
  isExactVersion,
  main,
  parseOverrideKey,
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

  // The uuid case in this repo: old copies of an overridden package are
  // vulnerable, but the override itself pins a patched version, so the override
  // is not the thing at fault and must not be reported.
  it('ignores a vulnerable installed copy that the override does not pin', () => {
    const findings = findVulnerablePins(
      { 'uuid@9.0.1': '11.1.1' },
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
    assert.match(output, /OK - no unreviewed override pins a vulnerable version/);
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
