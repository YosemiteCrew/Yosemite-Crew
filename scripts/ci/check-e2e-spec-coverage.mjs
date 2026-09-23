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
 * Exit 2 means the check could not run rather than that it found something. An
 * empty spec inventory and an empty set of named specs are both that case: each
 * would otherwise report a clean pass built out of nothing, which is the one
 * result this file exists to prevent.
 *
 * Offline, so it is a hard gate. `pnpm run test:scripts` covers the unit tests
 * (.github/workflows/_core.yaml), and the same job runs this script.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Playwright's `testDir` for the frontend, relative to the repo root. */
export const SPEC_DIR = 'apps/frontend/e2e';
export const WORKFLOW_DIR = '.github/workflows';

/**
 * Spec paths as Playwright is given them - relative to `apps/frontend`, so
 * `e2e/smoke.spec.ts`. Recursive: `testDir` discovery does not stop at the top
 * level, and a spec parked in a subdirectory is exactly as invisible.
 */
export const listSpecs = (root = REPO_ROOT) => {
  const dir = path.join(root, SPEC_DIR);
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

/** Spec paths named by any `run:` step in one workflow document. */
export const specsNamedInWorkflow = (source) => {
  const named = new Set();
  for (const job of Object.values(parse(source)?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      if (typeof step?.run === 'string') {
        for (const spec of specsNamedInRun(step.run)) named.add(spec);
      }
    }
  }
  return named;
};

export const specsNamedInWorkflows = (root = REPO_ROOT) => {
  const named = new Set();
  for (const entry of readdirSync(path.join(root, WORKFLOW_DIR))) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const source = readFileSync(path.join(root, WORKFLOW_DIR, entry), 'utf8');
    for (const spec of specsNamedInWorkflow(source)) named.add(spec);
  }
  return named;
};

export const findUnrunSpecs = (root = REPO_ROOT) => {
  const specs = listSpecs(root);
  const named = specsNamedInWorkflows(root);
  return { specs, named, unrun: specs.filter((spec) => !named.has(spec)) };
};

/**
 * The decision, separated from the reporting so both the finding path and the
 * two could-not-run paths are reachable from a test. An empty spec inventory
 * and an empty set of named specs each produce a passing comparison out of
 * nothing, so they are failures in their own right rather than a clean run.
 */
export const evaluate = ({ specs, named, unrun }) => {
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
  return {
    code: unrun.length > 0 ? 1 : 0,
    errors: unrun.map(
      (spec) =>
        `${SPEC_DIR}/${spec.slice('e2e/'.length)} is named by no workflow, so it never runs in CI. ` +
        `Add it to a Playwright step in ${WORKFLOW_DIR}/frontend-e2e.yml.`
    ),
  };
};

const main = () => {
  const found = findUnrunSpecs();
  const { code, errors } = evaluate(found);
  for (const error of errors) console.error(`::error::${error}`);
  if (code !== 0) process.exit(code);
  console.log(`All ${found.specs.length} specs under ${SPEC_DIR} are named by a workflow.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
