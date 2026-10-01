import assert from 'node:assert/strict';
import test, { afterEach, mock } from 'node:test';
import {
  allowedTurnstileHostnames,
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
  hostnames: ['site.example.test'],
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

test('allowedTurnstileHostnames pairs a main domain with its www host', () => {
  assert.deepEqual(allowedTurnstileHostnames('yosemitecrew.com'), [
    'yosemitecrew.com',
    'www.yosemitecrew.com',
  ]);
  assert.deepEqual(allowedTurnstileHostnames(' WWW.YosemiteCrew.com '), [
    'yosemitecrew.com',
    'www.yosemitecrew.com',
  ]);
});

test('allowedTurnstileHostnames keeps any other host exact', () => {
  assert.deepEqual(allowedTurnstileHostnames('dev.yosemitecrew.com'), ['dev.yosemitecrew.com']);
  assert.deepEqual(allowedTurnstileHostnames('www.dev.yosemitecrew.com'), [
    'www.dev.yosemitecrew.com',
  ]);
  assert.deepEqual(allowedTurnstileHostnames('localhost'), ['localhost']);
  assert.deepEqual(allowedTurnstileHostnames('www.localhost'), ['www.localhost']);
  assert.deepEqual(allowedTurnstileHostnames('127.0.0.1'), ['127.0.0.1']);
  assert.deepEqual(allowedTurnstileHostnames('[::1]'), ['[::1]']);
  assert.deepEqual(allowedTurnstileHostnames(''), []);
  assert.deepEqual(allowedTurnstileHostnames('   '), []);
});

for (const [configured, tokenHost, expected] of [
  ['yosemitecrew.com', 'www.yosemitecrew.com', true],
  ['yosemitecrew.com', 'yosemitecrew.com', true],
  ['www.yosemitecrew.com', 'yosemitecrew.com', true],
  ['www.yosemitecrew.com', 'www.yosemitecrew.com', true],
  ['dev.yosemitecrew.com', 'dev.yosemitecrew.com', true],
  ['dev.yosemitecrew.com', 'www.yosemitecrew.com', false],
  ['dev.yosemitecrew.com', 'yosemitecrew.com', false],
  ['yosemitecrew.com', 'dev.yosemitecrew.com', false],
  ['yosemitecrew.com', 'evil.com', false],
  ['yosemitecrew.com', 'www.evil.com', false],
  ['yosemitecrew.com', 'yosemitecrew.com.evil.com', false],
  ['yosemitecrew.com', 'wwwyosemitecrew.com', false],
  ['yosemitecrew.com', 'www.www.yosemitecrew.com', false],
  ['yosemitecrew.com', '', false],
] as const) {
  test(`a token from "${tokenHost}" with ${configured} configured is ${expected ? 'accepted' : 'refused'}`, async () => {
    answerWith({ success: true, action: 'contact_form', hostname: tokenHost });
    const hostnames = allowedTurnstileHostnames(configured);
    assert.equal(await verifyTurnstileToken({ ...input, hostnames }), expected);
  });
}

test('rejects an answer with no hostname', async () => {
  answerWith({ success: true, action: 'contact_form' });
  assert.equal(await verifyTurnstileToken(input), false);
});

test('rejects a twin host issued for a different action', async () => {
  answerWith({ success: true, action: 'business_signup', hostname: 'www.yosemitecrew.com' });
  const hostnames = allowedTurnstileHostnames('yosemitecrew.com');
  assert.equal(await verifyTurnstileToken({ ...input, hostnames }), false);
});

test('rejects a twin host on an unsuccessful answer', async () => {
  answerWith({ success: false, action: 'contact_form', hostname: 'www.yosemitecrew.com' });
  const hostnames = allowedTurnstileHostnames('yosemitecrew.com');
  assert.equal(await verifyTurnstileToken({ ...input, hostnames }), false);
});
