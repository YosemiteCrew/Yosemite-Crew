// Tests for the dev API drift check (#2740). The network half is exercised by
// the scheduled workflow; what is pinned here is the git measurement, against a
// real history, and the verdict it leads to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate, measure, readRevision } from './check-api-drift.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'api-drift-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'init.defaultBranch=dev', ...args],
      { cwd: dir, encoding: 'utf8' }
    ).trim();
  git('init', '--quiet');
  let n = 0;
  const commit = () => {
    writeFileSync(join(dir, 'f'), String(n++));
    git('add', 'f');
    git('commit', '--quiet', '-m', `c${n}`);
    return git('rev-parse', 'HEAD');
  };
  // One PR landing on dev: two commits on a branch, merged with a merge commit,
  // which is the only merge style the repository allows.
  const land = () => {
    const branch = `pr${n}`;
    git('checkout', '--quiet', '-b', branch);
    commit();
    commit();
    git('checkout', '--quiet', 'dev');
    git('merge', '--quiet', '--no-ff', '-m', `merge ${branch}`, branch);
    return git('rev-parse', 'HEAD');
  };
  return { dir, git, commit, land };
}

test('the served revision at the branch tip is zero behind', (t) => {
  const f = fixture(t);
  f.commit();
  const served = f.land();
  const m = measure(served, 'dev', f.dir);
  assert.deepEqual(
    { known: m.known, isAncestor: m.isAncestor, behind: m.behind, behindAll: m.behindAll },
    { known: true, isAncestor: true, behind: 0, behindAll: 0 }
  );
  assert.equal(m.tip, served);
});

test('advancing dev counts merges first-parent and commits separately', (t) => {
  const f = fixture(t);
  f.commit();
  const served = f.land();
  f.land();
  f.land();
  const tip = f.land();
  const m = measure(served, 'dev', f.dir);
  assert.equal(m.tip, tip);
  assert.equal(m.behind, 3);
  // Each landing is a merge commit plus the two commits it brought in.
  assert.equal(m.behindAll, 9);
});

test('a revision deployed from a branch that never reached dev is not an ancestor', (t) => {
  const f = fixture(t);
  f.commit();
  f.git('checkout', '--quiet', '-b', 'side');
  const served = f.commit();
  f.git('checkout', '--quiet', 'dev');
  f.land();
  const m = measure(served, 'dev', f.dir);
  assert.equal(m.known, true);
  assert.equal(m.isAncestor, false);
  assert.equal(m.behind, null);
});

test('a revision this history does not contain is reported as unknown', (t) => {
  const f = fixture(t);
  f.commit();
  const m = measure(SHA, 'dev', f.dir);
  assert.equal(m.known, false);
  assert.equal(m.behind, null);
});

test('no reported revision is measured as unknown without touching git history', (t) => {
  const f = fixture(t);
  const tip = f.commit();
  const m = measure(null, 'dev', f.dir);
  assert.equal(m.tip, tip);
  assert.equal(m.known, false);
});

test('a lag at the threshold passes and one past it fails', () => {
  const base = { revision: SHA, known: true, isAncestor: true, maxBehind: 100 };
  assert.equal(evaluate({ ...base, behind: 100 }).verdict, 'pass');
  assert.equal(evaluate({ ...base, behind: 101 }).verdict, 'fail');
  assert.match(evaluate({ ...base, behind: 101 }).reason, /101 merges behind/);
});

test('every way of not knowing the served code fails', () => {
  const base = { revision: SHA, known: true, isAncestor: true, behind: 0, maxBehind: 100 };
  assert.equal(evaluate(base).verdict, 'pass');
  assert.equal(evaluate({ ...base, revision: null }).verdict, 'fail');
  assert.equal(evaluate({ ...base, known: false }).verdict, 'fail');
  assert.equal(evaluate({ ...base, isAncestor: false }).verdict, 'fail');
});

test('only a full commit sha is read out of the health body', () => {
  assert.equal(readRevision(JSON.stringify({ status: 'ok', revision: SHA })), SHA);
  // The body every API older than this change returns.
  assert.equal(readRevision('{"status":"ok"}'), null);
  assert.equal(readRevision(JSON.stringify({ status: 'ok', revision: null })), null);
  assert.equal(readRevision(JSON.stringify({ revision: SHA.slice(0, 7) })), null);
  assert.equal(readRevision(JSON.stringify({ revision: SHA.toUpperCase() })), null);
  assert.equal(readRevision('<html>bad gateway</html>'), null);
});
