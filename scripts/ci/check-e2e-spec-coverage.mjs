#!/usr/bin/env node
/**
 * Fails when a frontend Playwright spec is named by no workflow.
 *
 * `frontend-e2e.yml` runs Playwright with an explicit list of spec files rather
 * than letting it discover `testDir`. That is deliberate - the two jobs serve
 * different environments and only one has credentials - but it means adding a
 * spec is a two-file change, and forgetting the second file has no symptom. The
 * suite passes, `Frontend E2E Required` goes green, and the spec has never run.
 *
 * It has happened twice. #3502 added `marketing-hero-mobile.spec.ts`, read a
 * green aggregate, and the spec had not executed. `session-write-replay.spec.ts`
 * then sat unlisted long enough that a reader counting specs and a reader
 * counting CI results disagreed by one, which is how #3535 was opened.
 *
 * No other gate can see this. The workflow is valid YAML, the spec is valid
 * TypeScript, and the evidence of absence is a test name that does not appear
 * in a log nobody reads when the run is green.
 *
 * WHY THE WORKFLOWS ARE PARSED RATHER THAN GREPPED. A spec file is named in
 * prose as well as in commands - `frontend-e2e.yml` carries a comment telling
 * you how to reproduce the authenticated job locally, and that comment contains
 * `e2e/auth-flow.spec.ts` and `e2e/developer-portal.spec.ts` verbatim. A raw
 * text search over the file cannot tell the instruction from the description,
 * so dropping either spec from the real list would leave the search still
 * finding it. Parsing discards YAML comments before anything is matched, which
 * makes the distinction structural instead of a pattern that has to be kept
 * ahead of the prose. Shell comments inside a `run:` block survive the parse,
 * so those lines are dropped explicitly.
 *
 * WHY NAMING IS NOT ENOUGH. Being named by a workflow is not being run before a
 * merge. `frontend-e2e.yml` gates its authenticated job on
 * `github.event_name != 'pull_request'`, deliberately - that job holds YC_E2E_*
 * in scope while running PR-controlled code - so a spec listed only there
 * satisfied the naming check while never executing on any pull request. Moving
 * a spec from the public list into that one kept this check green and silently
 * stopped it running before merge, and the distinction was carried only in
 * prose (#3546).
 *
 * So each spec is also classified pre-merge or post-merge-only, and a
 * post-merge-only spec is a finding unless it is recorded in
 * POST_MERGE_ONLY_SPECS below with the reason it cannot run on a pull request.
 * A recorded spec that has since become pre-merge reachable, or that no longer
 * exists, is a finding too: a list that only ever grows stops describing the
 * tree and starts excusing it.
 *
 * WHAT THE REACHABILITY CLASSIFIER PROVES. A job counts as running on a pull
 * request when its workflow declares the `pull_request` trigger and neither it
 * nor anything in its `needs` closure carries an `if` that this file can see
 * excluding that event - `github.event_name != 'pull_request'`, or
 * `github.event_name == '<some other event>'`, required of every `||`-separated
 * alternative. Anything else is read as reachable, which is the permissive
 * direction: an `if` that excludes pull requests by some spelling not listed
 * here leaves this check green. The two spellings are the ones the workflows in
 * this repo actually use, not a guess at the grammar.
 *
 * Exit 2 means the check could not run rather than that it found something. An
 * empty spec inventory, an empty set of named specs, and an empty set of
 * pre-merge specs are all that case: each would otherwise report a clean pass
 * built out of nothing, which is the one result this file exists to prevent.
 *
 * Offline, so it is a hard gate. `pnpm run test:scripts` covers the unit tests
 * (.github/workflows/_core.yaml), and the same job runs this script.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/*
 * Derived from this file's own location and never taken as an argument. An
 * overridable root is a read sink fed by a parameter, which Aikido reports as
 * a file-inclusion risk; the tests never needed one, since the pure functions
 * below take YAML source and an already-walked inventory rather than a path.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Playwright's `testDir` for the frontend, relative to the repo root. */
export const SPEC_DIR = 'apps/frontend/e2e';
/** This file, named the way a reader would find it - derived so a rename cannot stale it. */
const SCRIPT_PATH = path.relative(REPO_ROOT, fileURLToPath(import.meta.url));
export const WORKFLOW_DIR = '.github/workflows';

/**
 * Spec paths as Playwright is given them - relative to `apps/frontend`, so
 * `e2e/smoke.spec.ts`. Recursive: `testDir` discovery does not stop at the top
 * level, and a spec parked in a subdirectory is exactly as invisible.
 */
export const listSpecs = () => {
  const dir = path.join(REPO_ROOT, SPEC_DIR);
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => {
      const absolute = path.join(entry.parentPath, entry.name);
      return `e2e/${path.relative(dir, absolute).split(path.sep).join('/')}`;
    })
    .sort();
};

/*
 * Matched on the argument as written. The leading boundary keeps
 * `my-e2e/smoke.spec.ts` from reading as `e2e/smoke.spec.ts`, which would
 * credit a spec in a different directory for this one.
 */
const SPEC_TOKEN = /(?<![\w./-])e2e\/[\w./-]*\.spec\.ts/g;

/** Spec paths named by one shell command, ignoring its comment lines. */
export const specsNamedInRun = (run) =>
  [
    ...run
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n')
      .matchAll(SPEC_TOKEN),
  ].map((match) => match[0]);

/** Spec paths named by each job's `run:` steps, keyed by job name. */
export const specsNamedByJob = (source) => {
  const byJob = new Map();
  for (const [name, job] of Object.entries(parse(source)?.jobs ?? {})) {
    const named = new Set();
    for (const step of job?.steps ?? []) {
      if (typeof step?.run === 'string') {
        for (const spec of specsNamedInRun(step.run)) named.add(spec);
      }
    }
    byJob.set(name, named);
  }
  return byJob;
};

/** Spec paths named by any `run:` step in one workflow document. */
export const specsNamedInWorkflow = (source) => {
  const named = new Set();
  for (const specs of specsNamedByJob(source).values()) {
    for (const spec of specs) named.add(spec);
  }
  return named;
};

/*
 * The two spellings the workflows here use to keep an event out. Matched per
 * `||` alternative and required of all of them, so
 * `github.event_name != 'pull_request' || <anything>` - which is how the Sonar
 * and Chromatic jobs admit same-repo pull requests - does not read as an
 * exclusion.
 */
const EXCLUDES_PULL_REQUEST = [
  /github\.event_name\s*!=\s*(['"])pull_request\1/,
  /github\.event_name\s*==\s*(['"])(?!pull_request\1)[\w-]+\1/,
];

/** Whether a job-level `if` keeps the job off the `pull_request` event. */
export const excludesPullRequest = (condition) =>
  typeof condition === 'string' &&
  condition
    .split('||')
    .every((alternative) => EXCLUDES_PULL_REQUEST.some((rule) => rule.test(alternative)));

/**
 * Job names that run when the workflow is triggered by a pull request. Empty
 * when the workflow does not declare that trigger at all. A job inherits its
 * dependencies' exclusions: `playwright-auth` needs `preflight`, and skipping
 * `preflight` on a pull request is what actually skips it.
 */
export const pullRequestJobs = (source) => {
  const workflow = parse(source);
  const on = workflow?.on;
  const triggers = Array.isArray(on) ? on : typeof on === 'string' ? [on] : Object.keys(on ?? {});
  if (!triggers.includes('pull_request')) return new Set();

  const jobs = workflow?.jobs ?? {};
  // `seen` guards a `needs` cycle. Actions rejects one, so this is about not
  // hanging on a malformed file rather than about a case that reaches CI.
  const isExcluded = (name, seen) => {
    if (seen.has(name)) return false;
    seen.add(name);
    const job = jobs[name];
    const needs = job?.needs == null ? [] : [job.needs].flat();
    return excludesPullRequest(job?.if) || needs.some((dep) => isExcluded(dep, seen));
  };

  return new Set(Object.keys(jobs).filter((name) => !isExcluded(name, new Set())));
};

/** Spec paths named by a job that runs on a pull request. */
export const preMergeSpecsInWorkflow = (source) => {
  const reachable = pullRequestJobs(source);
  const named = new Set();
  for (const [job, specs] of specsNamedByJob(source)) {
    if (!reachable.has(job)) continue;
    for (const spec of specs) named.add(spec);
  }
  return named;
};

export const specsNamedInWorkflows = () => {
  const named = new Set();
  const preMerge = new Set();
  const dir = path.join(REPO_ROOT, WORKFLOW_DIR);
  for (const entry of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const source = readFileSync(path.join(dir, entry), 'utf8');
    for (const spec of specsNamedInWorkflow(source)) named.add(spec);
    for (const spec of preMergeSpecsInWorkflow(source)) preMerge.add(spec);
  }
  return { named, preMerge };
};

/**
 * Specs that are allowed to run only after merge, and why. Each one runs in
 * `frontend-e2e.yml`'s authenticated job, which resolves YC_E2E_* into the
 * runner and therefore must never be reachable from a pull request - the
 * branch's own workflow file is editable on the PR. Adding an entry here is a
 * decision to give up pre-merge coverage of that spec; the alternative is to
 * make the spec run without credentials, as `session-write-replay.spec.ts`
 * does by fulfilling its API calls with `page.route`.
 */
export const POST_MERGE_ONLY_SPECS = {
  'e2e/auth-flow.spec.ts': 'signs in with YC_E2E_*',
  'e2e/developer-portal.spec.ts': 'drives the developer portal behind the session',
  'e2e/public-booking-setup.spec.ts': 'configures booking as a signed-in practice',
  'e2e/route-sweep.spec.ts': 'sweeps the authenticated routes',
};

export const findUnrunSpecs = () => {
  const specs = listSpecs();
  const { named, preMerge } = specsNamedInWorkflows();
  return { specs, named, preMerge, unrun: specs.filter((spec) => !named.has(spec)) };
};

/**
 * The decision, separated from the reporting so both the finding paths and the
 * three could-not-run paths are reachable from a test. `postMergeOnly` is a
 * parameter only so a fixture can state its own acknowledgements; the script
 * never passes anything but the constant. An empty spec inventory,
 * an empty set of named specs and an empty set of pre-merge specs each produce
 * a passing comparison out of nothing, so they are failures in their own right
 * rather than a clean run.
 */
export const evaluate = (
  { specs, named, preMerge, unrun },
  postMergeOnly = POST_MERGE_ONLY_SPECS
) => {
  if (specs.length === 0) {
    return {
      code: 2,
      errors: [`e2e spec coverage check could not run: no *.spec.ts under ${SPEC_DIR}`],
    };
  }
  if (named.size === 0) {
    return {
      code: 2,
      errors: [
        `e2e spec coverage check could not run: no workflow in ${WORKFLOW_DIR} names any spec`,
      ],
    };
  }
  if (preMerge.size === 0) {
    return {
      code: 2,
      errors: [
        `e2e spec coverage check could not run: no job that names a spec was found to run on ` +
          `a pull_request event, so every spec would read as post-merge-only`,
      ],
    };
  }

  const full = (spec) => `${SPEC_DIR}/${spec.slice('e2e/'.length)}`;
  const acknowledged = Object.keys(postMergeOnly);

  const errors = [
    ...unrun.map(
      (spec) =>
        `${full(spec)} is named by no workflow, so it never runs in CI. ` +
        `Add it to a Playwright step in ${WORKFLOW_DIR}/frontend-e2e.yml.`
    ),
    ...specs
      .filter((spec) => named.has(spec) && !preMerge.has(spec) && !(spec in postMergeOnly))
      .map(
        (spec) =>
          `${full(spec)} is named only by jobs that do not run on a pull_request, so it never ` +
          `runs before a merge. Either name it in a job that does, or record it in ` +
          `POST_MERGE_ONLY_SPECS in ${SCRIPT_PATH} with the reason it cannot.`
      ),
    ...acknowledged
      .filter((spec) => !specs.includes(spec))
      .map(
        (spec) =>
          `${full(spec)} is recorded in POST_MERGE_ONLY_SPECS in ${SCRIPT_PATH} but no longer ` +
          `exists. Remove the entry.`
      ),
    ...acknowledged
      .filter((spec) => specs.includes(spec) && preMerge.has(spec))
      .map(
        (spec) =>
          `${full(spec)} is recorded in POST_MERGE_ONLY_SPECS in ${SCRIPT_PATH} but now runs on ` +
          `a pull_request. Remove the entry so the list keeps describing the tree.`
      ),
  ];

  return { code: errors.length > 0 ? 1 : 0, errors };
};

const main = () => {
  const found = findUnrunSpecs();
  const { code, errors } = evaluate(found);
  for (const error of errors) console.error(`::error::${error}`);
  if (code !== 0) process.exit(code);
  const postMerge = found.specs.filter((spec) => !found.preMerge.has(spec));
  console.log(`All ${found.specs.length} specs under ${SPEC_DIR} are named by a workflow.`);
  console.log(`${found.specs.length - postMerge.length} run on a pull request, before a merge.`);
  for (const spec of postMerge) {
    console.log(`post-merge only: ${spec} (${POST_MERGE_ONLY_SPECS[spec]})`);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
