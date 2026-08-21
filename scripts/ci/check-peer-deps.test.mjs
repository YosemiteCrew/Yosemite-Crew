// Tests for the peer dependency gate. Walking a real dependency tree is what
// the workflow step does; what is pinned here is the CLASSIFICATION, since that
// is what decides whether an unmet peer reds the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPeer } from './check-peer-deps.mjs';

test('the mobile 1.6.0 launch crash is caught', () => {
  // react-native@0.81.6 declares peerDependencies.react: ^19.1.4 and
  // apps/mobileAppYC pinned react 19.1.0. React refuses to run against a
  // renderer built for a different version, so every Release build died on
  // launch while CI stayed green.
  assert.equal(classifyPeer('19.1.0', '^19.1.4'), 'unsatisfied');
});

test('the aligned version passes', () => {
  assert.equal(classifyPeer('19.1.4', '^19.1.4'), 'ok');
  assert.equal(classifyPeer('19.2.0', '^19.1.4'), 'ok');
});

test('a range spanning majors is honoured', () => {
  assert.equal(classifyPeer('17.0.2', '^16.9.0 || ^17.0.0'), 'ok');
  assert.equal(classifyPeer('19.1.4', '^16.9.0 || ^17.0.0'), 'unsatisfied');
});

test('an unparseable range is skipped rather than reported', () => {
  // @gorhom/bottom-sheet publishes this; the trailing '-' makes it invalid, so
  // semver.satisfies returns false for every version and would otherwise
  // manufacture a mismatch that does not exist.
  assert.equal(classifyPeer('4.2.3', '>=3.16.0 || >=4.0.0-'), 'unparseable');
});

test('prereleases are compared rather than silently excluded', () => {
  assert.equal(classifyPeer('19.2.0-canary.1', '^19.1.4'), 'ok');
});

test('a wildcard range accepts anything', () => {
  assert.equal(classifyPeer('1.0.0', '*'), 'ok');
});
