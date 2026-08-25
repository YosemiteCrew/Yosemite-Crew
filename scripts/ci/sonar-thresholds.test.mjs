#!/usr/bin/env node
// Unit tests for the Sonar threshold check.
//
// The parts worth testing are the ones with a wrong answer that looks like a
// right one: a properties file read without unescaping yields a URL that does
// not resolve, an analysis scope read wrongly returns another branch's measures,
// and a missing measure read as zero turns a broken pipeline into a green check.
// Each of those gets a test, and so does the boundary of every threshold.
//
// Run with `node --test scripts/ci/sonar-thresholds.test.mjs`, or as part of
// `pnpm run test:scripts` (which is what the _core CI stage runs).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SONAR_SERVER,
  analysisScope,
  checkMeasures,
  measuresQuery,
  parseReportTask,
  pinnedServerFailure,
} from './sonar-thresholds.mjs';

/** The limits the workflow passes, spelled once. */
const LIMITS = { coverage: 95, duplication: 0, issues: 0 };

const measures = (overrides = {}) =>
  Object.entries({
    coverage: '96.0',
    duplicated_lines_density: '0.0',
    violations: '0',
    ...overrides,
  }).map(([metric, value]) => ({ metric, value }));

describe('reading report-task.txt', () => {
  it('unescapes the colons Properties.store writes into every URL', () => {
    const report = parseReportTask(
      [
        'projectKey=yosemitecrew_Yosemite-Crew_Frontend',
        'serverUrl=https\\://sonarcloud.io',
        'dashboardUrl=https\\://sonarcloud.io/dashboard?id\\=key&pullRequest\\=2186',
        'ceTaskId=AXn',
      ].join('\n')
    );
    assert.equal(report.serverUrl, 'https://sonarcloud.io');
    assert.equal(report.dashboardUrl, 'https://sonarcloud.io/dashboard?id=key&pullRequest=2186');
    assert.equal(report.projectKey, 'yosemitecrew_Yosemite-Crew_Frontend');
    assert.equal(report.ceTaskId, 'AXn');
  });

  it('ignores comments and blank lines, and keeps later = signs in the value', () => {
    const report = parseReportTask('#comment\n\n!bang\nceTaskUrl=https\\://x/y?id\\=a=b\n');
    assert.equal(report.ceTaskUrl, 'https://x/y?id=a=b');
    assert.equal(Object.keys(report).length, 1);
  });
});

describe('pinning the server', () => {
  it('accepts the one host this repository scans to', () => {
    assert.equal(pinnedServerFailure(SONAR_SERVER), null);
  });

  it('refuses any other host, naming both sides', () => {
    const failure = pinnedServerFailure('https://sonar.attacker.example');
    assert.match(failure, /https:\/\/sonar\.attacker\.example/);
    assert.match(failure, /Refusing to send SONAR_TOKEN/);
  });
});

describe('choosing which analysis to read back', () => {
  it('prefers the pull request when the scanner published one', () => {
    assert.deepEqual(analysisScope('https://sonarcloud.io/dashboard?id=k&pullRequest=2186'), {
      kind: 'pullRequest',
      value: '2186',
    });
  });

  it('reads a named branch', () => {
    assert.deepEqual(analysisScope('https://sonarcloud.io/dashboard?id=k&branch=dev'), {
      kind: 'branch',
      value: 'dev',
    });
  });

  it('treats a bare dashboard URL as the main branch', () => {
    assert.deepEqual(analysisScope('https://sonarcloud.io/dashboard?id=k'), {
      kind: 'branch',
      value: null,
    });
  });
});

describe('addressing the analysis to read back', () => {
  const query = (scope) => measuresQuery('KEY', scope, ['coverage']);

  it('names a pull request by number', () => {
    const parameters = query({ kind: 'pullRequest', value: '2186' });
    assert.equal(parameters.get('pullRequest'), '2186');
    assert.equal(parameters.get('branch'), null);
    assert.equal(parameters.get('component'), 'KEY');
  });

  it('never names a branch, because the plan refuses branch=main', () => {
    for (const value of [null, 'main']) {
      const parameters = query({ kind: 'branch', value });
      assert.equal(parameters.get('branch'), null);
      assert.equal(parameters.get('pullRequest'), null);
    }
  });

  it('refuses a branch that is not main rather than measuring main under its name', () => {
    assert.throws(() => query({ kind: 'branch', value: 'dev' }), /published to branch 'dev'/);
  });
});

describe('a project that meets the bar', () => {
  it('produces no failures', () => {
    assert.deepEqual(checkMeasures(measures(), LIMITS), []);
  });

  it('accepts coverage exactly on the floor', () => {
    assert.deepEqual(checkMeasures(measures({ coverage: '95.0' }), LIMITS), []);
  });
});

describe('coverage', () => {
  it('fails below the floor', () => {
    const failures = checkMeasures(measures({ coverage: '94.9' }), LIMITS);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /coverage 94\.9% is below the 95% floor/);
  });
});

describe('duplication', () => {
  it('fails on any duplication at all', () => {
    const failures = checkMeasures(measures({ duplicated_lines_density: '0.1' }), LIMITS);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /duplicated lines 0\.1%/);
  });
});

describe('issues', () => {
  it('fails on a single open issue', () => {
    const failures = checkMeasures(measures({ violations: '1' }), LIMITS);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /1 open issue\(s\)/);
  });

  it('reports every breach at once rather than the first', () => {
    const failures = checkMeasures(
      measures({ coverage: '10', duplicated_lines_density: '5', violations: '7' }),
      LIMITS
    );
    assert.equal(failures.length, 3);
  });
});

describe('a measure the analysis never published', () => {
  it('fails rather than reading the absence as zero', () => {
    const failures = checkMeasures(
      measures().filter((measure) => measure.metric !== 'coverage'),
      LIMITS
    );
    assert.equal(failures.length, 1);
    assert.match(failures[0], /coverage was not published/);
  });

  it('fails on an unparseable value too', () => {
    const failures = checkMeasures(measures({ violations: '' }), LIMITS);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /violations was not published/);
  });

  it('says so for every missing measure before checking any threshold', () => {
    const failures = checkMeasures([], LIMITS);
    assert.equal(failures.length, 3);
    for (const failure of failures) assert.match(failure, /was not published/);
  });
});
