import { readHeadSha, resolveBuildSha } from '@/buildInfo';

/**
 * Each case here is paired with the mutation it is meant to catch, because the
 * obvious assertions on this function are satisfied by several broken versions
 * of it: returning the git sha unconditionally passes every "it found a sha"
 * test, and so does returning `AWS_COMMIT_ID` unconditionally.
 */

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

const never = () => {
  throw new Error('readGitSha should not have been called');
};

describe('resolveBuildSha', () => {
  it('prefers AWS_COMMIT_ID and does not consult git when it is set', () => {
    // `never` is the assertion: a version that always shells out to git would
    // throw here rather than quietly returning the same value by luck. Checking
    // only the returned sha cannot separate "preferred" from "both agree".
    expect(resolveBuildSha({ AWS_COMMIT_ID: SHA }, never)).toEqual({
      sha: SHA,
      source: 'AWS_COMMIT_ID',
    });
  });

  it('falls back to git when AWS_COMMIT_ID is absent, which is the webhook-build case', () => {
    expect(resolveBuildSha({}, () => OTHER)).toEqual({ sha: OTHER, source: 'git' });
  });

  it('reports the source that actually answered when the two disagree', () => {
    // The separating input. Both values are present and different, so a
    // implementation that reads the wrong one returns a real-looking sha and
    // only `source` reveals it.
    expect(resolveBuildSha({ AWS_COMMIT_ID: SHA }, () => OTHER)).toEqual({
      sha: SHA,
      source: 'AWS_COMMIT_ID',
    });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace-only'],
  ])('treats an %s AWS_COMMIT_ID as absent rather than passing it on (%s)', (value) => {
    // `??` does not fall back on '', so an empty value would be inlined and
    // render as a blank field that looks populated.
    expect(resolveBuildSha({ AWS_COMMIT_ID: value }, () => OTHER)).toEqual({
      sha: OTHER,
      source: 'git',
    });
  });

  it.each([
    ['HEAD', 'what a webhook build records instead of a sha, so the likeliest wrong value'],
    ['dev', 'a branch name'],
    ['9662b9d', 'an abbreviated sha'],
    [`${SHA}x`, 'a sha with a trailing character, which only the $ anchor rejects'],
    [`x${SHA}`, 'a sha with a leading character, which only the ^ anchor rejects'],
  ])('falls through to git on a non-empty malformed AWS_COMMIT_ID: %s (%s)', (value) => {
    // The mutation this exists for is the previous behaviour: accept any
    // non-empty string. Every other AWS_COMMIT_ID case here is a well-formed
    // sha or blank, so none of them can tell the two apart - the field would
    // render populated with a value that identifies no commit, and because
    // the preferred branch returns, the git read holding the right answer
    // never runs.
    expect(resolveBuildSha({ AWS_COMMIT_ID: value }, () => OTHER)).toEqual({
      sha: OTHER,
      source: 'git-amplify-rejected',
    });
  });

  it('separates a rejected AWS_COMMIT_ID from an absent one', () => {
    // Both produce the git sha, so `sha` cannot tell them apart and only
    // `source` can. This is the assertion that keeps the deployed artifact able
    // to answer what Amplify supplies on the webhook path - a question nothing
    // already running can be asked, because no app in the account consumes the
    // variable there. Reporting both as `git` is correct and unfalsifiable.
    const rejected = resolveBuildSha({ AWS_COMMIT_ID: 'HEAD' }, () => OTHER);
    const absent = resolveBuildSha({}, () => OTHER);

    expect(rejected.sha).toBe(absent.sha);
    expect(rejected.source).not.toBe(absent.source);
    expect([rejected.source, absent.source]).toEqual(['git-amplify-rejected', 'git']);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace-only'],
  ])('does not report a %s AWS_COMMIT_ID as rejected (%s)', (value) => {
    // Blank is indistinguishable from unset in a build environment, so calling
    // it a rejection would report evidence that is not there - the failure mode
    // the fourth state exists to avoid, pointed the other way.
    expect(resolveBuildSha({ AWS_COMMIT_ID: value }, () => OTHER).source).toBe('git');
  });

  it('reports unavailable when AWS_COMMIT_ID is malformed and git has nothing either', () => {
    // Falling through must not mean falling back to the malformed value: with
    // no second source the honest answer is that this build cannot identify
    // itself, not `HEAD`. The rejection is not reported in this corner and that
    // is deliberate - documented on `BuildShaSource`, asserted here so the
    // omission is a decision rather than something nobody looked at.
    expect(resolveBuildSha({ AWS_COMMIT_ID: 'HEAD' }, () => null)).toEqual({
      sha: null,
      source: 'unavailable',
    });
  });

  it('rejects a malformed value from git too, rather than trusting the caller', () => {
    // `readHeadSha` shape-checks what it reads, but it is injected here, so the
    // guarantee has to hold at this boundary rather than be inherited from one
    // particular implementation of it.
    expect(resolveBuildSha({}, () => 'refs/heads/dev')).toEqual({
      sha: null,
      source: 'unavailable',
    });
  });

  it('trims the trailing newline that git rev-parse always emits', () => {
    // Without this the sha reaches the health route with a newline in it, which
    // survives JSON encoding and breaks an equality check against a real sha.
    expect(resolveBuildSha({}, () => `${OTHER}\n`)).toEqual({ sha: OTHER, source: 'git' });
  });

  it('reports unavailable rather than throwing when git cannot be read', () => {
    // A build container without a usable .git must still produce a site; the
    // missing sha is a finding on the health route, not a failed build.
    expect(
      resolveBuildSha({}, () => {
        throw new Error('not a git repository');
      })
    ).toEqual({ sha: null, source: 'unavailable' });
  });

  it('reports unavailable when git returns nothing at all', () => {
    expect(resolveBuildSha({}, () => null)).toEqual({ sha: null, source: 'unavailable' });
  });
});

describe('readHeadSha', () => {
  const HEAD_SHA = 'd'.repeat(40);
  const DECOY = 'e'.repeat(40);

  /** A fake filesystem: anything not present reads as unreadable. */
  const fs = (files: Record<string, string>) => (path: string) => files[path] ?? null;

  it('reads a detached HEAD, which is a raw sha', () => {
    expect(readHeadSha('/repo/.git', fs({ '/repo/.git/HEAD': `${HEAD_SHA}\n` }))).toBe(HEAD_SHA);
  });

  it('follows a symbolic HEAD to its loose ref file', () => {
    expect(
      readHeadSha(
        '/repo/.git',
        fs({
          '/repo/.git/HEAD': 'ref: refs/heads/dev\n',
          '/repo/.git/refs/heads/dev': `${HEAD_SHA}\n`,
        })
      )
    ).toBe(HEAD_SHA);
  });

  it('falls back to packed-refs when the loose ref is absent, which is a fresh clone', () => {
    // The Amplify build container is in exactly this state: refs arrive packed,
    // so a reader that only looks for the loose file finds nothing and the whole
    // feature silently reports `unavailable` in the one place it has to work.
    expect(
      readHeadSha(
        '/repo/.git',
        fs({
          '/repo/.git/HEAD': 'ref: refs/heads/dev\n',
          '/repo/.git/packed-refs': `# pack-refs with: peeled fully-peeled sorted\n${HEAD_SHA} refs/heads/dev\n`,
        })
      )
    ).toBe(HEAD_SHA);
  });

  it('matches the packed ref whole, not by prefix', () => {
    // The separating input: a prefix match would return the decoy, and the decoy
    // is a well-formed sha, so the wrong answer looks exactly like a right one.
    expect(
      readHeadSha(
        '/repo/.git',
        fs({
          '/repo/.git/HEAD': 'ref: refs/heads/dev\n',
          '/repo/.git/packed-refs': `${DECOY} refs/heads/dev-experiment\n${HEAD_SHA} refs/heads/dev\n`,
        })
      )
    ).toBe(HEAD_SHA);
  });

  it('ignores peeled-tag lines in packed-refs', () => {
    expect(
      readHeadSha(
        '/repo/.git',
        fs({
          '/repo/.git/HEAD': 'ref: refs/heads/dev\n',
          '/repo/.git/packed-refs': `${DECOY} refs/tags/v1\n^${HEAD_SHA}\n${HEAD_SHA} refs/heads/dev\n`,
        })
      )
    ).toBe(HEAD_SHA);
  });

  it('follows a .git FILE to the real git dir, which is how a worktree is laid out', () => {
    // This repository is developed in linked worktrees, so the indirect case is
    // the ordinary local one - a reader that only handles a directory works in
    // CI and returns nothing on every developer machine.
    expect(
      readHeadSha(
        '/wt/.git',
        fs({
          '/wt/.git': 'gitdir: /repo/.git/worktrees/wt\n',
          '/repo/.git/worktrees/wt/HEAD': `${HEAD_SHA}\n`,
        })
      )
    ).toBe(HEAD_SHA);
  });

  it('resolves a worktree ref through commondir, where branch refs actually live', () => {
    // The case the detached-HEAD fixture above cannot reach, and the one the
    // real repository is in: HEAD is symbolic and per-worktree, while the ref it
    // names exists only in the main git dir. Written after an end-to-end run
    // returned null on this exact layout while every unit test passed.
    expect(
      readHeadSha(
        '/wt/.git',
        fs({
          '/wt/.git': 'gitdir: /repo/.git/worktrees/wt\n',
          '/repo/.git/worktrees/wt/HEAD': 'ref: refs/heads/feature\n',
          '/repo/.git/worktrees/wt/commondir': '../..\n',
          // Deliberately absent: /repo/.git/worktrees/wt/refs/heads/feature
          '/repo/.git/worktrees/wt/../../refs/heads/feature': `${HEAD_SHA}\n`,
        })
      )
    ).toBe(HEAD_SHA);
  });

  it('resolves a worktree ref from the common packed-refs', () => {
    expect(
      readHeadSha(
        '/wt/.git',
        fs({
          '/wt/.git': 'gitdir: /repo/.git/worktrees/wt\n',
          '/repo/.git/worktrees/wt/HEAD': 'ref: refs/heads/feature\n',
          '/repo/.git/worktrees/wt/commondir': '../..\n',
          '/repo/.git/worktrees/wt/../../packed-refs': `${HEAD_SHA} refs/heads/feature\n`,
        })
      )
    ).toBe(HEAD_SHA);
  });

  it('returns null when nothing is readable', () => {
    expect(readHeadSha('/repo/.git', fs({}))).toBeNull();
  });

  it('returns null rather than a malformed value when HEAD is not a sha or a ref', () => {
    expect(readHeadSha('/repo/.git', fs({ '/repo/.git/HEAD': 'garbage\n' }))).toBeNull();
  });

  it('rejects a ref file whose contents are not a sha', () => {
    expect(
      readHeadSha(
        '/repo/.git',
        fs({
          '/repo/.git/HEAD': 'ref: refs/heads/dev\n',
          '/repo/.git/refs/heads/dev': 'not-a-sha\n',
        })
      )
    ).toBeNull();
  });
});
