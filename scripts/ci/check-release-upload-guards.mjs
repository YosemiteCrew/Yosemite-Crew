#!/usr/bin/env node
/**
 * Fails when a step that submits a build to a store is not gated to a release tag.
 *
 * `mobile-release.yml` runs on `push: tags: mobile-v*` and on `workflow_dispatch`.
 * The jobs are deliberately reachable both ways so the Android and iOS signing
 * chains can be exercised without cutting a release — but the two submitting
 * steps once carried no condition at all, so a plain dispatch shipped a
 * build to the Play internal track (`status: completed`) and to TestFlight. There
 * was no dispatch shape that built without uploading: `platform` offers only
 * `both`, `android` and `ios`.
 *
 * That is invisible to every other gate in this repo. The workflow is valid YAML,
 * the run goes green, and the evidence that anything happened is in App Store
 * Connect rather than in CI. It is also invisible to a run history: the dispatch
 * path had never been exercised, so there was no red run to learn from.
 *
 * What is checked is the SUBMITTING MECHANISM, not the step name. A step that
 * renames from "Upload to TestFlight" to something else still calls `altool
 * --upload-app`, and that is what this matches on. Adding a new way to submit
 * means adding a row to SUBMISSIONS below; the check cannot infer one.
 *
 * The accepted guards are `github.event_name == 'push'` (the idiom desktop-release.yml
 * already uses for `--publish never`) and `startsWith(github.ref, 'refs/tags/')`.
 * Either is sufficient: the only push trigger these workflows declare is a tag
 * pattern, so on this repo they are equivalent, and accepting both means a future
 * tightening does not red the build.
 *
 * Runs offline against the workflow files, so it is a hard gate rather than an
 * advisory one. `pnpm run test:scripts` covers it (.github/workflows/_core.yaml).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Workflows whose steps can reach a store. */
export const RELEASE_WORKFLOWS = [
  '.github/workflows/mobile-release.yml',
  '.github/workflows/desktop-release.yml',
];

/**
 * How a step submits. `uses` is matched on the action name without its version so a
 * pin bump does not silently drop the row; `run` is matched on the command.
 */
export const SUBMISSIONS = [
  { store: 'Google Play', uses: 'r0adkll/upload-google-play' },
  { store: 'App Store Connect', run: 'altool --upload-app' },
];

/** Conditions that restrict a step to a release tag. Either one is enough. */
export const TAG_ONLY_GUARDS = [
  "github.event_name == 'push'",
  "startsWith(github.ref, 'refs/tags/')",
];

/** The submission a step performs, or null when it does not submit. */
export function classifyStep(step) {
  if (!step || typeof step !== 'object') return null;
  const uses = typeof step.uses === 'string' ? step.uses : '';
  const run = typeof step.run === 'string' ? step.run : '';
  for (const submission of SUBMISSIONS) {
    if (submission.uses && uses.split('@')[0] === submission.uses) return submission;
    if (submission.run && run.includes(submission.run)) return submission;
  }
  return null;
}

/** True when `condition` restricts the step to a release tag. */
export function isTagOnly(condition) {
  if (typeof condition !== 'string') return false;
  return TAG_ONLY_GUARDS.some((guard) => condition.includes(guard));
}

/**
 * Every submitting step in one workflow that is not gated to a tag.
 * `file` is only used to label the finding.
 */
export function findUnguardedSubmissions(source, file) {
  const doc = parse(source);
  const findings = [];
  for (const [jobId, job] of Object.entries(doc?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      const submission = classifyStep(step);
      if (!submission) continue;
      if (isTagOnly(step.if)) continue;
      findings.push({
        file,
        job: jobId,
        step: step.name ?? step.uses ?? '<unnamed>',
        store: submission.store,
        condition: step.if ?? null,
      });
    }
  }
  return findings;
}

/** Runs the check over the real workflow files. */
export function checkRepo(root = REPO_ROOT, files = RELEASE_WORKFLOWS) {
  return files.flatMap((file) =>
    findUnguardedSubmissions(readFileSync(path.join(root, file), 'utf8'), file)
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = checkRepo();
  for (const finding of findings) {
    const condition = finding.condition === null ? 'no condition' : `if: ${finding.condition}`;
    console.error(
      `${finding.file}: job '${finding.job}' step '${finding.step}' submits to ` +
        `${finding.store} with ${condition}.`
    );
  }
  if (findings.length > 0) {
    console.error(
      `\n${findings.length} store submission(s) reachable from a workflow_dispatch. ` +
        `Gate each on one of: ${TAG_ONLY_GUARDS.join(' | ')}`
    );
    process.exit(1);
  }
  console.log(`No unguarded store submissions in ${RELEASE_WORKFLOWS.length} release workflows.`);
}
