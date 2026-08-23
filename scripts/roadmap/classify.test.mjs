// What is pinned here is the PRECEDENCE between signals, because that is where
// every real misclassification came from. Each case below is an issue that was
// actually filed wrong by an earlier draft of this classifier, kept as a
// regression test so the ordering cannot be casually rearranged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  classifyCategory,
  classifyPriority,
  classifyStatus,
  scopeOf,
  affectedAreaOf,
} from './classify.mjs';

const cat = (o) => classifyCategory(o).category;

test('conventional-commit scope is read from the title', () => {
  assert.equal(scopeOf('fix(mobile): thing'), 'mobile');
  assert.equal(scopeOf('feat(repo)!: thing'), 'repo');
  assert.equal(scopeOf('Upgrade the backend runtime'), null);
});

test('the bug template affected area is read from the body', () => {
  assert.equal(affectedAreaOf('### Affected area\n\nMobile app\n\n### What'), 'Mobile app');
  assert.equal(affectedAreaOf('no template here'), null);
});

// #2008 was filed under Developer Platform because its body mentions MCP in
// passing. A surface label is a human being explicit and must win.
test('a surface label beats a developer-platform keyword in the body', () => {
  assert.equal(
    cat({
      title: 'Consolidated backlog: unimplemented companion-app modules',
      body: 'Some of this would later be exposed over MCP and the public data api.',
      labels: ['enhancement', 'App'],
    }),
    CATEGORIES.MOBILE
  );
});

// #1992: a single stray "android/" in a TypeScript upgrade sent a repo-wide
// chore to Mobile App.
test('a repo-wide toolchain chore is infra, whatever paths its body lists', () => {
  assert.equal(
    cat({
      title: 'chore(repo): migrate to TypeScript 7 and @types/node 26',
      body: 'Touches android/ and apps/frontend and apps/backend.',
      labels: [],
    }),
    CATEGORIES.PLATFORM
  );
});

// #2355: body listed seven mobile peer-dependency examples.
test('a repo-wide ci change is infra even when its examples are all mobile', () => {
  assert.equal(
    cat({
      title: 'ci(repo): fail on unmet peer dependencies instead of only warning',
      body: 'apps/mobileAppYC react-native react-native react-native ios/ android/ Podfile',
      labels: [],
    }),
    CATEGORIES.PLATFORM
  );
});

// #1868: "desktop" here is a viewport, not the Electron app.
test('the word desktop in a frontend title does not mean the desktop app', () => {
  assert.equal(
    cat({
      title: 'fix(frontend): desktop week calendar anchors day columns',
      body: '',
      labels: [],
    }),
    CATEGORIES.PMS
  );
});

test('an explicit desktop scope does mean the desktop app', () => {
  assert.equal(
    cat({
      title: 'test(desktop): window state does not persist',
      body: '',
      labels: ['engineering'],
    }),
    CATEGORIES.DESKTOP
  );
});

// #2284: the area read "Auth (packages/auth), mobile Sign in with Apple", which
// never contains the exact phrase "mobile app".
test('an affected area naming mobile counts even without the word app', () => {
  assert.equal(
    cat({
      title: 'fix(auth): sign in with apple fails on android',
      body: '### Affected area\n\nAuth (packages/auth), mobile Sign in with Apple\n',
      labels: ['bug'],
    }),
    CATEGORIES.MOBILE
  );
});

// #1672 had only `enhancement` and `engineering` and fell through to no category
// at all, which would have left it invisible on the board.
test('an engineering label lands cross-cutting work in Platform & Infra', () => {
  assert.equal(
    cat({
      title: 'Provider-independent authentication boundary (epic)',
      body: '',
      labels: ['enhancement', 'engineering'],
    }),
    CATEGORIES.PLATFORM
  );
});

test('growth work is separated from product work', () => {
  assert.equal(
    cat({ title: 'Launch campaign', body: '', labels: ['Marketing'] }),
    CATEGORIES.GROWTH
  );
});

test('an unrecognisable issue is left uncategorised rather than guessed', () => {
  const { category } = classifyCategory({ title: 'Something vague', body: '', labels: [] });
  assert.equal(category, null);
});

test('status follows the tracker, not the board', () => {
  assert.equal(classifyStatus({ state: 'CLOSED' }), STATUSES.COMPLETED);
  assert.equal(classifyStatus({ state: 'MERGED' }), STATUSES.COMPLETED);
  assert.equal(classifyStatus({ state: 'OPEN' }), STATUSES.NOT_STARTED);
});

test('a ready pull request means the work is waiting on review, not being written', () => {
  assert.equal(
    classifyStatus({ state: 'OPEN', linkedPrs: [{ state: 'OPEN', isDraft: false }] }),
    STATUSES.UNDER_TESTING
  );
  assert.equal(
    classifyStatus({ state: 'OPEN', linkedPrs: [{ state: 'OPEN', isDraft: true }] }),
    STATUSES.IN_PROGRESS
  );
  assert.equal(
    classifyStatus({ state: 'OPEN', assignees: [{ login: 'someone' }] }),
    STATUSES.IN_PROGRESS
  );
  // A merged PR on a still-open issue does not close it, so it is not done.
  assert.equal(
    classifyStatus({ state: 'OPEN', linkedPrs: [{ state: 'MERGED', isDraft: false }] }),
    STATUSES.NOT_STARTED
  );
});

test('priority starts from the labels a human already applied', () => {
  assert.equal(classifyPriority({ labels: ['security'] }), PRIORITIES.URGENT);
  assert.equal(classifyPriority({ labels: ['future-scope'] }), PRIORITIES.LOW);
  assert.equal(classifyPriority({ labels: ['bug'], title: 'contrast is low' }), PRIORITIES.HIGH);
  assert.equal(classifyPriority({ labels: [] }), PRIORITIES.NORMAL);
});

test('a bug that stops people using the product outranks a cosmetic bug', () => {
  assert.equal(
    classifyPriority({
      labels: ['bug'],
      title: 'Email verification link 404s, blocking every new signup',
    }),
    PRIORITIES.URGENT
  );
});
