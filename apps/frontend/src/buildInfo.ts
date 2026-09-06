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

/** Where the sha came from, so a wrong answer is traceable to its source. */
export type BuildShaSource = 'AWS_COMMIT_ID' | 'git' | 'unavailable';

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
 * `readGitSha` is injected so this is testable without a repository, and so a
 * build container without a readable `.git` produces `unavailable` rather than
 * throwing during `next build`.
 */
export function resolveBuildSha(
  env: { AWS_COMMIT_ID?: string },
  readGitSha: () => string | null
): BuildSha {
  const fromAmplify = normalise(env.AWS_COMMIT_ID);
  if (fromAmplify) return { sha: fromAmplify, source: 'AWS_COMMIT_ID' };

  let fromGit: string | null = null;
  try {
    fromGit = normalise(readGitSha());
  } catch {
    // A build that cannot read git still has to produce a site. Reporting
    // `unavailable` is the honest outcome and it is visible on the health
    // route, where a missing sha is a finding rather than a silent blank.
    fromGit = null;
  }
  if (fromGit) return { sha: fromGit, source: 'git' };

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
 * An empty or whitespace-only value is treated as absent rather than passed on.
 * `??` does not fall back on `''`, so an empty string would render as a blank
 * field that looks like a populated one - the same wrong state wearing a
 * different costume.
 */
function normalise(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
