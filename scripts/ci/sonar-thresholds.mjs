#!/usr/bin/env node
// Enforce Yosemite Crew's Sonar bar in CI, because SonarCloud will not.
//
// Usage, from the directory that was scanned - which in this repository is an
// app directory, so the script itself lives two levels up:
//   cd apps/<app> && node ../../scripts/ci/sonar-thresholds.mjs \
//     [--coverage 95] [--duplication 0] [--issues 0]
// (The workflows do the same thing with working-directory: <app dir> and
// node "$GITHUB_WORKSPACE/scripts/ci/sonar-thresholds.mjs".)
//
// It takes no path. The scanner writes `.scannerwork/report-task.txt` under the
// directory it scanned, so the caller sets the working directory and this reads
// a constant relative path. That is deliberate rather than incidental: a path
// assembled from an argument and then read is a file-inclusion sink whether or
// not anything hostile can reach the argument, and bounding it is not enough -
// the sink is the shape, not the value - so there is no argument to bound.
//
// The scan step already passes `sonar.qualitygate.wait=true`, so a red gate reds
// the job. The trouble is which gate it waits for. Attaching a custom quality
// gate to a project needs a plan this organisation does not have - the API
// answers `api/qualitygates/select` with "Organization ... is not allowed to
// modify Quality gates" - so the only verdict available is the built-in "Sonar
// way": 80% coverage and 3% duplication on new code, and no condition on the
// issue count at all. Those are not the numbers this repository holds itself
// to, and the difference is not small.
//
// Two further gaps come with any gate written against new code:
//
//   - A pull request analysis evaluates NEW-code conditions only, and drops even
//     those when the pull request introduces no new lines. A change can pass a
//     green gate while the project sits well below the bar.
//   - "Sonar way" carries no issue condition, so a project accumulating smells
//     passes it indefinitely as long as each individual change is clean.
//
// So this reads the measures the analysis just published and holds them to the
// bar docs/ci/sonar-quality-bar.md states. What those measures mean depends on
// the analysis scope, verified against live analyses rather than assumed:
//
//   - A branch (main) analysis publishes whole-branch figures for all three
//     metrics: is this project at 95% coverage, zero duplication and zero open
//     issues right now.
//   - A pull request analysis publishes whole-project `coverage` and
//     `duplicated_lines_density` as of the PR head, but its `violations` counts
//     the issues open on the PR itself. A PR leg therefore enforces "the whole
//     project meets the coverage and duplication bar, and this change
//     introduces zero issues"; the push-to-main scan and the nightly enforce
//     zero open issues across the whole branch.
//
// Dependency-free by design, like the other scripts in this directory: the scan
// job deliberately does not install the workspace, so this has only Node to
// work with.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** The three measures the bar is written in. */
export const METRICS = ['coverage', 'duplicated_lines_density', 'violations'];

// A literal, and it stays a literal. Node accepts forward slashes on every
// platform, so there is no reason to assemble this from path.join and every
// reason not to: the only read in this file has to be visibly constant.
const REPORT_TASK = '.scannerwork/report-task.txt';

// The one Sonar host this repository scans to. report-task.txt names a server
// URL too, but honouring it would send SONAR_TOKEN (Basic auth on every poll)
// to whatever host a tampered .scannerwork names. So the file's value is
// checked against this pin and then discarded; every request below uses the
// constant.
export const SONAR_SERVER = 'https://sonarcloud.io';

/**
 * Why the report's serverUrl must equal the pin, as a failure message - or
 * null when it does. Split out so the refusal has a test.
 */
export function pinnedServerFailure(serverUrl) {
  if (serverUrl === SONAR_SERVER) return null;
  return (
    `${REPORT_TASK} names server ${serverUrl}, but this repository scans to ` +
    `${SONAR_SERVER}. Refusing to send SONAR_TOKEN anywhere else.`
  );
}

/**
 * Parse the scanner's report-task.txt.
 *
 * It is a Java properties file, which means `Properties.store` has escaped every
 * `:` and `=` in the values - so `serverUrl` arrives as `https\://sonarcloud.io`
 * and a naive read produces a URL that does not resolve. Unescaping is therefore
 * part of reading it correctly rather than a nicety.
 */
export function parseReportTask(text) {
  const entries = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('!')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    entries[line.slice(0, separator).trim()] = unescapeProperty(line.slice(separator + 1));
  }
  return entries;
}

function unescapeProperty(value) {
  return value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_match, escaped) => {
    if (escaped[0] === 'u') return String.fromCharCode(Number.parseInt(escaped.slice(1), 16));
    if (escaped === 'n') return '\n';
    if (escaped === 't') return '\t';
    if (escaped === 'r') return '\r';
    return escaped;
  });
}

/**
 * Work out which branch or pull request the analysis published to.
 *
 * Taken from the scanner's own dashboardUrl rather than from the GitHub event,
 * so the measures read back are the ones this analysis wrote. Deriving the
 * scope independently would let the two disagree on a re-run or a dispatch,
 * and a check that reads the wrong branch is worse than no check.
 */
export function analysisScope(dashboardUrl) {
  const parameters = new URL(dashboardUrl).searchParams;
  const pullRequest = parameters.get('pullRequest');
  if (pullRequest) return { kind: 'pullRequest', value: pullRequest };
  const branch = parameters.get('branch');
  if (branch) return { kind: 'branch', value: branch };
  // No branch parameter means the main branch: SonarCloud omits it for the
  // project's default branch.
  return { kind: 'branch', value: null };
}

/**
 * The name every SonarCloud project in this organisation gives its main branch.
 *
 * ci.yaml already requires it - the Backend project's main branch was named
 * `dev` until 2026-08-11, which failed its leg on main pushes and passed it on
 * dev pushes, the mirror image of the other three - so it can be checked here
 * without asking the server which name it uses.
 */
export const MAIN_BRANCH = 'main';

/**
 * Build the measures query for an analysis.
 *
 * A pull request is addressed by number. A branch is addressed by NOT naming it:
 * this organisation's plan serves the main branch and refuses every other one,
 * answering `branch=main` itself with "Organization is not allowed to access
 * data from non main branches" - so the parameter that looks correct is the one
 * that fails. Omitting it returns the main branch, which is the only branch
 * analysis the Sonar stage ever produces (ci.yaml restricts the stage to a pull
 * request or a push to main).
 *
 * A branch analysis under any other name is refused rather than measured. It
 * would silently read main's numbers and report them as that branch's, which is
 * the one way this check could pass while measuring nothing relevant.
 */
export function measuresQuery(projectKey, scope, metrics) {
  const query = new URLSearchParams({ component: projectKey, metricKeys: metrics.join(',') });
  if (scope.kind === 'pullRequest') {
    query.set('pullRequest', scope.value);
    return query;
  }
  if (scope.value !== null && scope.value !== MAIN_BRANCH) {
    throw new Error(
      `this analysis published to branch '${scope.value}', and this organisation's SonarCloud plan ` +
        `serves '${MAIN_BRANCH}' only. Measuring it would read ${MAIN_BRANCH}'s numbers under ` +
        "another branch's name, so it stops here instead."
    );
  }
  return query;
}

/**
 * Compare published measures against the limits.
 *
 * A metric that is missing fails rather than passing. Sonar publishes no
 * `coverage` measure at all when it resolved no coverage report, and both of the
 * obvious readings of that absence - treat it as zero, treat it as fine - are
 * wrong: it means the pipeline broke upstream, which is a thing to stop for.
 */
export function checkMeasures(measures, limits) {
  const failures = [];
  const value = (metric) => {
    const found = measures.find((measure) => measure.metric === metric);
    return found === undefined ? undefined : Number.parseFloat(found.value);
  };

  for (const metric of METRICS) {
    if (value(metric) === undefined || Number.isNaN(value(metric))) {
      failures.push(
        `${metric} was not published by this analysis. That is a broken pipeline rather than a ` +
          'clean project, so it fails here instead of passing quietly.'
      );
    }
  }
  if (failures.length > 0) return failures;

  if (value('coverage') < limits.coverage) {
    failures.push(`coverage ${value('coverage')}% is below the ${limits.coverage}% floor`);
  }
  if (value('duplicated_lines_density') > limits.duplication) {
    failures.push(
      `duplicated lines ${value('duplicated_lines_density')}% exceeds the ` +
        `${limits.duplication}% ceiling`
    );
  }
  if (value('violations') > limits.issues) {
    failures.push(
      `${value('violations')} open issue(s), and the ceiling is ${limits.issues}. Fix them, or ` +
        "record a narrow exclusion with its rationale in the app's sonar-project.properties."
    );
  }
  return failures;
}

/** Basic auth, which every SonarCloud token type accepts. Bearer does not. */
function authHeaders() {
  const token = process.env.SONAR_TOKEN;
  if (!token) return {};
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}` };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retried because on the nightly this is the step that waits for the compute
// engine (the nightly's scan passes no qualitygate.wait), which can mean
// minutes of polling - and without a retry, one transient 5xx, 429 or dropped
// connection in that window reds a leg whose project meets the bar. A 4xx
// other than 429 is a real answer (bad token, missing project) and is not
// retried.
async function getJson(url, { attempts = 3, retryDelayMs = 5000 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    let response;
    let body;
    try {
      response = await fetch(url, { headers: authHeaders() });
      body = await response.text();
    } catch (error) {
      if (attempt >= attempts)
        throw new Error(`${url} failed after ${attempts} attempts: ${error.message}`);
      await sleep(retryDelayMs);
      continue;
    }
    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt < attempts) {
      await sleep(retryDelayMs);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`${url} returned HTTP ${response.status} and no JSON`);
    }
    if (!response.ok) {
      const message = (parsed.errors ?? []).map((error) => error.msg).join('; ');
      throw new Error(`${url} returned HTTP ${response.status}: ${message || body.slice(0, 200)}`);
    }
    return parsed;
  }
}

/**
 * Wait for the compute engine to finish publishing this analysis.
 *
 * The pipeline's scan step passes `qualitygate.wait`, which has usually done
 * this already, so the first poll normally returns SUCCESS. The nightly's scan
 * does not wait, and the wait can be switched off in one place - either way an
 * unfinished task would make this read the *previous* analysis's measures and
 * pass on them, so it polls rather than assumes.
 */
export async function waitForAnalysis(serverUrl, ceTaskId, { timeoutMs = 300_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { task } = await getJson(`${serverUrl}/api/ce/task?id=${encodeURIComponent(ceTaskId)}`);
    if (task.status === 'SUCCESS') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`analysis task ${ceTaskId} ended as ${task.status}`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`analysis task ${ceTaskId} was still ${task.status} after ${timeoutMs}ms`);
    }
    await sleep(5000);
  }
}

function readOption(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const parsed = Number.parseFloat(argv[index + 1]);
  if (Number.isNaN(parsed)) throw new Error(`--${name} needs a number`);
  return parsed;
}

async function main(argv) {
  // Checked up front because the failure it prevents is unreadable. The measures
  // API serves these public projects to anyone, but `api/ce/task` does not: it
  // answers an unauthenticated caller with 404 "Project doesn't exist", which
  // reads as a missing project rather than a missing token.
  if (!process.env.SONAR_TOKEN) {
    process.stderr.write(
      'sonar-thresholds: SONAR_TOKEN is empty. The scan that produced this analysis needed it too, ' +
        "so this is a wiring problem in the job rather than anything about the project's code.\n"
    );
    return 1;
  }

  const limits = {
    coverage: readOption(argv, 'coverage', 95),
    duplication: readOption(argv, 'duplication', 0),
    issues: readOption(argv, 'issues', 0),
  };

  if (!existsSync(REPORT_TASK)) {
    process.stderr.write(
      `sonar-thresholds: no ${REPORT_TASK} under ${process.cwd()}. Either the scan did not run, or ` +
        'this was not called from the directory it scanned. Neither is a pass.\n'
    );
    return 1;
  }

  const report = parseReportTask(readFileSync(REPORT_TASK, 'utf8'));
  for (const key of ['serverUrl', 'projectKey', 'ceTaskId', 'dashboardUrl']) {
    if (!report[key]) {
      process.stderr.write(`sonar-thresholds: ${REPORT_TASK} has no ${key}\n`);
      return 1;
    }
  }

  const pinFailure = pinnedServerFailure(report.serverUrl);
  if (pinFailure) {
    process.stderr.write(`sonar-thresholds: ${pinFailure}\n`);
    return 1;
  }

  const scope = analysisScope(report.dashboardUrl);
  const task = await waitForAnalysis(SONAR_SERVER, report.ceTaskId);

  // The report file names the project and the task independently, and a stale
  // .scannerwork picked up from the repository root would agree with itself
  // while describing a different app. Cheap to check, and the failure it
  // prevents is a green check measured against the wrong project.
  if (task.componentKey && task.componentKey !== report.projectKey) {
    process.stderr.write(
      `sonar-thresholds: ${REPORT_TASK} names ${report.projectKey}, but its analysis task belongs ` +
        `to ${task.componentKey}. That report is not this scan's.\n`
    );
    return 1;
  }

  const query = measuresQuery(report.projectKey, scope, METRICS);
  const { component } = await getJson(`${SONAR_SERVER}/api/measures/component?${query}`);
  const measures = component.measures ?? [];

  const shown = (metric) =>
    measures.find((measure) => measure.metric === metric)?.value ?? '(none)';
  process.stdout.write(`sonar-thresholds: ${report.projectKey}\n`);
  process.stdout.write(`  analysed:    ${scope.kind} ${scope.value ?? '(main)'}\n`);
  process.stdout.write(`  coverage:    ${shown('coverage')}%  (floor ${limits.coverage}%)\n`);
  process.stdout.write(
    `  duplication: ${shown('duplicated_lines_density')}%  (ceiling ${limits.duplication}%)\n`
  );
  process.stdout.write(`  issues:      ${shown('violations')}  (ceiling ${limits.issues})\n`);
  process.stdout.write(`  dashboard:   ${report.dashboardUrl}\n`);

  const failures = checkMeasures(measures, limits);
  if (failures.length === 0) {
    process.stdout.write('sonar-thresholds: the bar is met.\n');
    return 0;
  }
  for (const failure of failures) process.stderr.write(`sonar-thresholds: ${failure}\n`);
  return 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      process.stderr.write(`sonar-thresholds: ${error.message}\n`);
      process.exit(1);
    }
  );
}
