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
import { resolveWithin } from './safe-path.mjs';

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
  // Desktop does not reach a store, it reaches the public. `gh release edit
  // --draft=false` is the step that takes a draft release public, and a public
  // release is what electron-updater's clients poll.
  { store: 'a public GitHub Release', run: '--draft=false' },
  // `gh release create` opens a release, and the only shipped one is guarded at
  // the step (`verify`'s `Open a draft release for the build jobs` carries
  // `if: github.event_name == 'push'`), so there is NO draft exemption here and
  // nothing reads the command text for flags. Two consequences, both deliberate:
  //
  //   * Deleting `--draft` while KEEPING the tag guard is not a finding. That is
  //     a real defect - the tag path would open a published, asset-less release,
  //     which the comment above the `publish` job explains is visible to beta
  //     updaters immediately - but it is a different property. This check asks
  //     whether something outward-facing is reachable from a dispatch, not
  //     whether the release it opens starts as a draft. That wants its own check.
  //
  //   * A DRAFTED `gh release create` on a deliberately dispatch-only path IS a
  //     false positive here, and the finding will read `no condition`. Measured:
  //     respelling the `release` job's step with the CLI reds it. The repair in
  //     that case is an exemption like the one below, NOT a tag guard on a job
  //     that is dispatch-only by design. Do not follow the message off a cliff.
  { store: 'a GitHub Release', run: 'gh release create' },
  // action-gh-release publishes unless the release is explicitly a draft. The
  // dispatch-only `release` job sets `draft: true`, which is why it is not a
  // finding today - but flipping that one word publishes from a branch, and
  // that is the edit this entry exists to catch.
  { store: 'a GitHub Release', uses: 'softprops/action-gh-release', exemptWhenDraft: true },
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
  const isDraft = Boolean(step.with && step.with.draft === true);
  for (const submission of SUBMISSIONS) {
    if (submission.exemptWhenDraft && isDraft) continue;
    if (submission.uses && uses.split('@')[0] === submission.uses) return submission;
    if (submission.run && run.includes(submission.run)) return submission;
  }
  return null;
}

/**
 * True when `condition` restricts the step to a release tag.
 *
 * A substring test is not enough and the counter-example is 78 lines above the
 * step it would wave through. The `android` job is gated on
 *
 *   github.event_name == 'push' || inputs.platform == 'both' || inputs.platform == 'android'
 *
 * and copying that condition down onto the upload step is the most natural edit
 * anyone will make to this file. It contains an accepted guard and submits on a
 * plain dispatch anyway, because a disjunction can only widen: `A || B` runs
 * whenever B alone is true, so no guard to the left of a `||` restricts
 * anything.
 *
 * `&&` is the opposite and is accepted, so tightening the shipped guard to
 * `github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')` does not
 * red the build.
 *
 * THE `||` REJECTION IS WHAT MAKES THE `&&` SPLIT BELOW SOUND, and that is not
 * the same claim as the paragraph above it. Splitting on `&&` ignores operator
 * precedence: `&&` binds tighter than `||`, so
 *
 *   inputs.force || inputs.x && github.event_name == 'push'
 *
 * means `inputs.force || (inputs.x && push)` - it runs on a dispatch whenever
 * `inputs.force` is set - yet splitting it on `&&` yields an operand that is
 * EXACTLY an accepted guard. Without the early return this is accepted, measured.
 * Note it is order-dependent: move the guard to the left of the `&&` and the
 * naive split happens to reject it, so the hole opens on one spelling and not
 * the other. Both are pinned in the tests.
 *
 * A plain `A || B` is rejected either way, because the whole string becomes one
 * operand and no operand equals a guard. So the early return looks redundant
 * against the case this comment opens with, and is load-bearing against a case
 * that comment never mentions. Do not delete it on the strength of the first
 * paragraph.
 *
 * Every other spelling fails closed - a red build and a human reading this
 * comment is the outcome we want from an expression we cannot classify.
 */
export function isTagOnly(condition) {
  if (typeof condition !== 'string') return false;
  if (condition.includes('||')) return false;
  return condition.split('&&').some((operand) => TAG_ONLY_GUARDS.includes(operand.trim()));
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
      // A step runs only when its job runs AND its own condition passes, so a
      // tag-only condition at EITHER level restricts it. Desktop guards at the
      // job (`publish` carries the condition, its step does not) and mobile at
      // the step, and reading only one level misses one of them: reading only
      // steps waves through a desktop `publish` job whose guard was deleted.
      if (isTagOnly(step.if) || isTagOnly(job?.if)) continue;
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

/**
 * Runs the check over the real workflow files.
 *
 * `files` is a module constant and nothing reaches this script from a request,
 * so the containment assertion is not load-bearing today. It is here because a
 * path built from a parameter is worth pinning inside the tree it claims to
 * describe before someone passes one in, and `resolveWithin` is what the other
 * scripts in this directory use for it.
 */
export function checkRepo(root = REPO_ROOT, files = RELEASE_WORKFLOWS) {
  return files.flatMap((file) => {
    const resolved = resolveWithin(root, file);
    if (resolved === null) throw new Error(`Workflow path escapes the repository: ${file}`);
    return findUnguardedSubmissions(readFileSync(resolved, 'utf8'), file);
  });
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
      `\n${findings.length} outward-facing publish step(s) reachable from a workflow_dispatch. ` +
        `Gate each on ${TAG_ONLY_GUARDS.join(' or ')}. ` +
        `A condition containing '||' is never accepted: a disjunction can only widen.`
    );
    process.exit(1);
  }
  console.log(`No unguarded publish steps in ${RELEASE_WORKFLOWS.length} release workflows.`);
}
