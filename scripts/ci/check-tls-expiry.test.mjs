// Tests for the TLS expiry check. The network-touching handshake is exercised by
// the scheduled workflow itself; what is pinned here is the CLASSIFICATION, since
// that is what decides whether a certificate about to expire reds the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, isTransient, probeWithRetry } from './check-tls-expiry.mjs';

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
  // What the real host looked like on 2026-08-13: still answering 200, but the
  // handshake fails verification, so a reachability check would have stayed green
  // while this reports the exact reason.
  const [r] = evaluate(
    [{ host: 'dev.yosemitecrew.com', status: 'error', detail: 'CERT_HAS_EXPIRED' }],
    OPTS
  );
  assert.equal(r.verdict, 'error');
});

test('a hostname the certificate does not cover fails even with time left', () => {
  const [r] = evaluate(
    [{ host: 'example.test', status: 'error', detail: 'ERR_TLS_CERT_ALTNAME_INVALID' }],
    OPTS
  );
  assert.equal(r.verdict, 'error');
});

test('an untrusted result still fails if one ever reaches classify', () => {
  // Defensive: inspectHost cannot produce this now that validation is on, but
  // evaluate() is exported and must not grade an untrusted certificate a pass.
  const [r] = evaluate([healthy({ daysLeft: 200, authorized: false })], OPTS);
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

test('an empty --hosts exits 2 instead of passing having checked nothing', () => {
  for (const args of [
    [script, '--hosts', ''],
    [script, '--hosts', ' , '],
  ]) {
    try {
      execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      assert.fail('expected a non-zero exit');
    } catch (err) {
      assert.equal(err.status, 2);
      assert.match(`${err.stderr}`, /--hosts requires at least one hostname/);
    }
  }
});

test('negative thresholds are rejected, so advance notice cannot be disabled', () => {
  try {
    execFileSync('node', [script, '--warn-days', '-1', '--fail-days', '-2'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('expected a non-zero exit');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(`${err.stderr}`, /must not be negative/);
  }
});

test('--json emits parseable JSON on stdout with no annotations mixed in', () => {
  // A host that cannot resolve exercises the failure path, which is where the
  // ::error:: lines used to be appended after the array.
  let stdoutText = '';
  try {
    stdoutText = execFileSync('node', [script, '--json', '--hosts', 'no-such-host.invalid'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    stdoutText = `${err.stdout ?? ''}`;
  }
  assert.doesNotMatch(stdoutText, /::(error|warning)::/);
  const parsed = JSON.parse(stdoutText);
  assert.equal(Array.isArray(parsed), true);
  assert.equal(parsed[0].host, 'no-such-host.invalid');
  assert.equal(parsed[0].verdict, 'error');
});

// --- retry of transient connection failures (issue #2350) ---
// The apex host timed out once from CI and opened a TLS-expiry issue while its
// certificate was valid for over a year. Transient errors are retried; a real
// certificate verdict is returned on the first look.

test('isTransient matches connection failures, not certificate failures', () => {
  for (const d of ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'timed out after 15000ms']) {
    assert.equal(isTransient(d), true, d);
  }
  for (const d of [
    'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'no certificate presented',
  ]) {
    assert.equal(isTransient(d), false, d);
  }
});

test('probeWithRetry retries a transient error and then succeeds', async () => {
  let calls = 0;
  const probeOnce = async () => {
    calls += 1;
    if (calls < 3) return { host: 'apex.test', status: 'error', detail: 'ETIMEDOUT' };
    return { host: 'apex.test', status: 'ok', daysLeft: 400 };
  };
  const result = await probeWithRetry(probeOnce, 'apex.test', new Date(), {
    attempts: 3,
    delayMs: 0,
  });
  assert.equal(calls, 3);
  assert.equal(result.status, 'ok');
});

test('probeWithRetry does NOT retry a certificate failure', async () => {
  let calls = 0;
  const probeOnce = async () => {
    calls += 1;
    return { host: 'expired.test', status: 'error', detail: 'CERT_HAS_EXPIRED' };
  };
  const result = await probeWithRetry(probeOnce, 'expired.test', new Date(), {
    attempts: 3,
    delayMs: 0,
  });
  assert.equal(calls, 1);
  assert.equal(result.detail, 'CERT_HAS_EXPIRED');
});

test('probeWithRetry gives up after the attempt budget and reports the error', async () => {
  let calls = 0;
  const probeOnce = async () => {
    calls += 1;
    return { host: 'down.test', status: 'error', detail: 'ECONNREFUSED' };
  };
  const result = await probeWithRetry(probeOnce, 'down.test', new Date(), {
    attempts: 3,
    delayMs: 0,
  });
  assert.equal(calls, 3);
  assert.equal(result.status, 'error');
});
