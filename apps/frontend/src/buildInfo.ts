/**
 * Which commit is this build?
 *
 * Nothing served by this app could answer that. The panel can - it exposes a
 * `buildSha` and settling "is this deployed?" there costs one request - but on
 * this app the only way to attribute a deploy to a commit was to line up
 * timestamps, and the Amplify job record cannot help: a build triggered by an
 * incoming webhook records `commitId: "HEAD"`, not a sha, and its build log
 * never prints one either.
 *
 * That leaves a real gap rather than a bookkeeping one. A webhook build clones
 * the branch when the build starts, so what ships is the branch tip at clone
 * time - not necessarily the commit whose merge triggered it. Two merges close
 * together and the deploy carries the second one, including the case where the
 * second commit's own pipeline decided it did not need deploying.
 *
 * The sha has to be captured during `next build`, because that is the only step
 * that runs inside the build container's clone. It cannot be added to the
 * Amplify build spec: that spec lives in the Amplify console, not in this
 * repository, so no pull request can change it.
 *
 * The sha is read out of `.git` rather than by running `git`. Spawning a binary
 * resolved through `PATH` during a build is a finding in its own right
 * (`sonarjs/no-os-command-from-path`), and the files are a stable, documented
 * format - so this ends up with no subprocess, no `PATH` dependency, and a pure
 * function that can be tested without a repository.
 */

/**
 * Where the sha came from, so a wrong answer is traceable to its source.
 *
 * `git-amplify-rejected` is `git` plus one fact: `AWS_COMMIT_ID` was set to
 * something that is not an object name and was discarded. Collapsing that into
 * `git` would be correct behaviour and a lossy instrument - the sha would be
 * right, and the deployed artifact could no longer say whether Amplify hands
 * this app a sha, the literal `HEAD`, or nothing at all. No app in the account
 * consumes the variable on the webhook path today, so nothing already deployed
 * can be asked; the first `/api/health` after this ships is the only place that
 * question becomes a reading rather than an inference.
 *
 * One corner stays lossy on purpose: if git cannot answer either, the result is
 * `unavailable` and the rejection is not reported. That build has a louder
 * problem than the provenance of a variable.
 */
export type BuildShaSource = 'AWS_COMMIT_ID' | 'git' | 'git-amplify-rejected' | 'unavailable';

export interface BuildSha {
  sha: string | null;
  source: BuildShaSource;
}

/** A 40-character lowercase hex object name, and nothing else. */
const SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * `AWS_COMMIT_ID` is Amplify's own variable and is the right answer when it is
 * set - but it is populated from the repository integration, and this app's
 * `dev` branch is deployed by a webhook with auto-build off. On that path
 * Amplify does not know the commit, so the variable is absent. Reading it first
 * and falling back is deliberate: on any branch wired the other way it is
 * authoritative, and where it is missing the clone still has the answer.
 *
 * It is shape-checked before it is preferred, and that is not defensiveness.
 * The same job metadata records `commitId: "HEAD"` on a webhook build, so the
 * literal string `HEAD` is the value this deploy path is likeliest to supply -
 * and accepting it would report a populated-looking `buildSha` that identifies
 * nothing, while the returning branch shadows the git read that holds the real
 * answer. Anything that is not an object name falls through rather than wins,
 * and the fall-through is *reported* rather than silent: see `BuildShaSource`.
 *
 * `readGitSha` is injected so this is testable without a repository, and so a
 * build container without a readable `.git` produces `unavailable` rather than
 * throwing during `next build`.
 */
export function resolveBuildSha(
  env: { AWS_COMMIT_ID?: string },
  readGitSha: () => string | null
): BuildSha {
  const fromAmplify = shaOrNull(env.AWS_COMMIT_ID);
  if (fromAmplify) return { sha: fromAmplify, source: 'AWS_COMMIT_ID' };

  // Reaching here, the variable is absent, blank, or malformed - and only the
  // last of those is worth reporting, because it is evidence about what this
  // deploy path actually supplies.
  const rejected = (env.AWS_COMMIT_ID ?? '').trim() !== '';

  let fromGit: string | null = null;
  try {
    fromGit = shaOrNull(readGitSha());
  } catch {
    // A build that cannot read git still has to produce a site. Reporting
    // `unavailable` is the honest outcome and it is visible on the health
    // route, where a missing sha is a finding rather than a silent blank.
    fromGit = null;
  }
  if (fromGit) return { sha: fromGit, source: rejected ? 'git-amplify-rejected' : 'git' };

  return { sha: null, source: 'unavailable' };
}

/**
 * Resolve `HEAD` to an object name by reading the files git maintains.
 *
 * Three shapes have to be handled and all three occur here:
 *   - `.git` is a *file* in a linked worktree (`gitdir: <path>`), which is how
 *     this repository is developed, so the common local case is the indirect one.
 *   - `HEAD` holds a raw sha when the checkout is detached.
 *   - a symbolic `HEAD` points at a ref whose loose file may not exist, because
 *     a fresh clone usually arrives with its refs packed - which is exactly the
 *     state an Amplify build container is in.
 *
 * `readFile` returns null for anything unreadable, so a missing file is a normal
 * outcome rather than an exception.
 */
export function readHeadSha(
  gitPath: string,
  readFile: (path: string) => string | null
): string | null {
  const gitDir = resolveGitDir(gitPath, readFile);
  if (!gitDir) return null;

  const head = readFile(`${gitDir}/HEAD`)?.trim();
  if (!head) return null;

  if (SHA_PATTERN.test(head)) return head;

  const ref = head.startsWith('ref: ') ? head.slice(5).trim() : null;
  if (!ref) return null;

  // In a linked worktree `HEAD` is per-worktree but branch refs are not: they
  // live in the main repository's git dir, named by `commondir`. Looking only
  // beside HEAD finds nothing on every developer machine here, while working
  // fine in CI - a difference no fixture using a detached HEAD can expose,
  // because a detached HEAD never resolves a ref at all.
  const dirs = refSearchPath(gitDir, readFile);

  for (const dir of dirs) {
    const loose = readFile(`${dir}/${ref}`)?.trim();
    if (loose && SHA_PATTERN.test(loose)) return loose;
  }

  for (const dir of dirs) {
    const packed = findPackedRef(readFile(`${dir}/packed-refs`), ref);
    if (packed) return packed;
  }

  return null;
}

/**
 * Where refs may live: the git dir itself, then the common dir if this is a
 * linked worktree. `commondir` holds a path that is usually relative to the
 * worktree's git dir.
 */
function refSearchPath(gitDir: string, readFile: (path: string) => string | null): string[] {
  const common = readFile(`${gitDir}/commondir`)?.trim();
  if (!common) return [gitDir];

  const resolved = common.startsWith('/') ? common : `${gitDir}/${common}`;
  return resolved === gitDir ? [gitDir] : [gitDir, resolved];
}

/** `.git` is a directory in a normal clone and a pointer file in a worktree. */
function resolveGitDir(gitPath: string, readFile: (path: string) => string | null): string | null {
  const pointer = readFile(`${gitPath}/HEAD`);
  if (pointer !== null) return gitPath;

  const link = readFile(gitPath)?.trim();
  if (link?.startsWith('gitdir: ')) return link.slice(8).trim();

  return null;
}

/**
 * `packed-refs` is one `<sha> <ref>` per line, with comment lines and `^`
 * peeled-tag lines mixed in. The ref is matched whole rather than by prefix:
 * `refs/heads/dev` must not be answered by `refs/heads/dev-experiment`.
 *
 * Neither comment lines nor peeled-tag lines need a guard of their own. A
 * peeled line carries no space, and a comment's first field is not a sha, so
 * the separator check and the sha-shape check below already reject both.
 * Explicit `#` and `^` guards were written first and then removed: no input
 * could make either one decide the outcome, so they read as protections while
 * being incapable of failing. The behaviour they described is still asserted.
 */
function findPackedRef(contents: string | null, ref: string): string | null {
  if (!contents) return null;

  for (const line of contents.split('\n')) {
    const space = line.indexOf(' ');
    if (space === -1) continue;
    if (line.slice(space + 1).trim() !== ref) continue;
    const sha = line.slice(0, space).trim();
    if (SHA_PATTERN.test(sha)) return sha;
  }

  return null;
}

/**
 * A candidate is accepted only if it is an object name, so every source is held
 * to the shape `readHeadSha` already enforces on the files it reads.
 *
 * Trimming alone is not enough and the two rejected shapes fail differently.
 * An empty or whitespace-only value would render as a blank field that looks
 * populated, because `??` does not fall back on `''`. A non-empty non-sha -
 * `HEAD`, a branch name, an abbreviated sha - is worse: the field looks
 * answered, and it is wrong in the direction nobody re-checks.
 */
function shaOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return SHA_PATTERN.test(trimmed) ? trimmed : null;
}
