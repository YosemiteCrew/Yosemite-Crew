// Tests for the TLS expiry check. The network-touching handshake is exercised by
// the scheduled workflow itself; what is pinned here is the CLASSIFICATION, since
// that is what decides whether a certificate about to expire reds the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from './check-tls-expiry.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-tls-expiry.mjs');
const OPTS = { warnDays: 30, failDays: 14 };
const healthy = (over) => ({
  host: 'example.test',
  status: 'ok',
  validTo: '2027-01-01T00:00:00.000Z',
  daysLeft: 90,
  issuer: 'Amazon',
  names: ['example.test'],
  authorized: true,
  authorizationError: null,
  ...over,
});

test('a certificate comfortably in date passes', () => {
  const [r] = evaluate([healthy()], OPTS);
  assert.equal(r.verdict, 'pass');
});

test('a certificate inside the warn window warns but does not fail', () => {
  const [r] = evaluate([healthy({ daysLeft: 21 })], OPTS);
  assert.equal(r.verdict, 'warn');
});

test('a certificate inside the fail window fails', () => {
  const [r] = evaluate([healthy({ daysLeft: 14 })], OPTS);
  assert.equal(r.verdict, 'fail');
});

test('an already-expired certificate fails - the dev.yosemitecrew.com case', () => {
  // What the real host looked like on 2026-08-13: still answering, cert expired
  // the previous midnight, so a reachability check would have stayed green.
  const [r] = evaluate(
    [
      healthy({
        host: 'dev.yosemitecrew.com',
        daysLeft: -1,
        validTo: '2026-08-12T23:59:59.000Z',
        authorized: false,
        authorizationError: 'CERT_HAS_EXPIRED',
      }),
    ],
    OPTS
  );
  assert.equal(r.verdict, 'fail');
});

test('a hostname the certificate does not cover fails even with time left', () => {
  const [r] = evaluate(
    [
      healthy({
        daysLeft: 200,
        authorized: false,
        authorizationError: 'ERR_TLS_CERT_ALTNAME_INVALID',
      }),
    ],
    OPTS
  );
  assert.equal(r.verdict, 'fail');
});

test('an unreachable host is an error, not a pass', () => {
  const [r] = evaluate([{ host: 'nope.test', status: 'error', detail: 'ENOTFOUND' }], OPTS);
  assert.equal(r.verdict, 'error');
});

test('a nonsensical threshold pair is rejected instead of silently accepted', () => {
  try {
    execFileSync('node', [script, '--fail-days', '40', '--warn-days', '10'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('expected a non-zero exit');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(`${err.stderr}`, /--fail-days must not exceed --warn-days/);
  }
});

test('an unknown flag exits 2 rather than scanning a default list unexpectedly', () => {
  try {
    execFileSync('node', [script, '--bogus'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('expected a non-zero exit');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(`${err.stderr}`, /unknown argument/);
  }
});
