import assert from 'node:assert/strict';
import test, { afterEach, mock } from 'node:test';
import {
  isValidTurnstileToken,
  TURNSTILE_SITEVERIFY_URL,
  verifyTurnstileToken,
} from './turnstile.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

const input = {
  token: 'synthetic widget token',
  secret: 'synthetic secret value',
  hostname: 'site.example.test',
  action: 'contact_form',
};

function answerWith(result: unknown, ok = true) {
  const fetchMock = mock.fn(async (_url: string, _init: RequestInit) => ({
    ok,
    json: async () => result,
  }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

test('isValidTurnstileToken accepts only non-empty strings up to 2048 characters', () => {
  assert.equal(isValidTurnstileToken('a'), true);
  assert.equal(isValidTurnstileToken('x'.repeat(2048)), true);
  assert.equal(isValidTurnstileToken('x'.repeat(2049)), false);
  assert.equal(isValidTurnstileToken(''), false);
  assert.equal(isValidTurnstileToken(undefined), false);
  assert.equal(isValidTurnstileToken(42), false);
});

test('accepts a successful answer for the expected action and hostname', async () => {
  const fetchMock = answerWith({
    success: true,
    action: 'contact_form',
    hostname: 'site.example.test',
  });

  assert.equal(await verifyTurnstileToken({ ...input, remoteIp: '198.51.100.7' }), true);

  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, TURNSTILE_SITEVERIFY_URL);
  const body = init.body as URLSearchParams;
  assert.equal(body.get('secret'), input.secret);
  assert.equal(body.get('response'), input.token);
  assert.equal(body.get('remoteip'), '198.51.100.7');
});

test('omits remoteip when none is given', async () => {
  const fetchMock = answerWith({
    success: true,
    action: 'contact_form',
    hostname: 'site.example.test',
  });

  assert.equal(await verifyTurnstileToken(input), true);

  const body = fetchMock.mock.calls[0].arguments[1].body as URLSearchParams;
  assert.equal(body.has('remoteip'), false);
});

test('rejects a token issued for a different action', async () => {
  answerWith({ success: true, action: 'business_signup', hostname: 'site.example.test' });
  assert.equal(await verifyTurnstileToken(input), false);
});

test('rejects a token issued for a different hostname', async () => {
  answerWith({ success: true, action: 'contact_form', hostname: 'other.example.test' });
  assert.equal(await verifyTurnstileToken(input), false);
});

test('rejects an unsuccessful answer', async () => {
  answerWith({ success: false, action: 'contact_form', hostname: 'site.example.test' });
  assert.equal(await verifyTurnstileToken(input), false);
});

test('rejects a non-OK response', async () => {
  answerWith({ success: true, action: 'contact_form', hostname: 'site.example.test' }, false);
  assert.equal(await verifyTurnstileToken(input), false);
});

test('fails closed when the request throws', async () => {
  const consoleError = mock.method(console, 'error', () => undefined);
  globalThis.fetch = (async () => {
    throw new Error('synthetic network failure');
  }) as typeof fetch;

  assert.equal(await verifyTurnstileToken(input), false);
  assert.equal(consoleError.mock.callCount(), 1);
});
