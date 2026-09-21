import 'whatwg-fetch';

jest.unmock('supertokens-web-js');
jest.unmock('supertokens-web-js/recipe/emailpassword');
jest.unmock('supertokens-web-js/recipe/emailverification');
jest.unmock('supertokens-web-js/recipe/multifactorauth');
jest.unmock('supertokens-web-js/recipe/passwordless');
jest.unmock('supertokens-web-js/recipe/session');
jest.unmock('supertokens-web-js/recipe/thirdparty');
jest.unmock('supertokens-web-js/recipe/totp');

const requestUrl = (input: RequestInfo | URL): string =>
  input instanceof Request ? input.url : String(input);

const requestMethod = (input: RequestInfo | URL, init?: RequestInit): string =>
  (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

describe('auth client session refresh interception', () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const originalFetch = globalThis.fetch;
  const originalWindowFetch = globalThis.window.fetch;

  afterAll(() => {
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
    globalThis.fetch = originalFetch;
    globalThis.window.fetch = originalWindowFetch;
  });

  it('retries a safe read but never replays a state-changing body', async () => {
    const { initAuthClient } = await import('@/app/lib/authClient');
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.com';
    const frontToken = btoa(
      JSON.stringify({ uid: 'user-1', ate: Date.now() + 60_000, up: { role: 'staff' } })
    );
    document.cookie = `sFrontToken=${frontToken}; path=/`;
    document.cookie = 'st-last-access-token-update=1; path=/';

    let getAttempts = 0;
    let writeAttempts = 0;
    const networkFetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      if (url.endsWith('/auth/session/refresh')) {
        return new Response(null, { status: 200, headers: { 'front-token': frontToken } });
      }
      if (method === 'GET') {
        getAttempts += 1;
        return new Response(null, { status: getAttempts === 1 ? 401 : 200 });
      }
      writeAttempts += 1;
      return new Response(null, { status: writeAttempts === 1 ? 401 : 200 });
    });
    globalThis.fetch = networkFetch;
    globalThis.window.fetch = networkFetch;

    expect(initAuthClient()).toBe(true);
    expect(globalThis.window.fetch).not.toBe(networkFetch);

    const writeResponse = await globalThis.window.fetch(
      'https://api.example.com/v1/appointments/appointment-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: 7, status: 'complete' }),
      }
    );
    expect(writeResponse.status).toBe(401);
    expect(writeResponse.headers.get('x-yc-session-write-replay-blocked')).toBe('true');
    expect(writeAttempts).toBe(1);

    const explicitResubmission = await globalThis.window.fetch(
      'https://api.example.com/v1/appointments/appointment-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: 8, status: 'complete' }),
      }
    );
    const readResponse = await globalThis.window.fetch(
      'https://api.example.com/v1/appointments/appointment-1'
    );

    const networkCalls = networkFetch.mock.calls.map(([input, init]) => ({
      method: requestMethod(input, init),
      url: requestUrl(input),
    }));
    expect(networkCalls).toEqual([
      { method: 'PATCH', url: 'https://api.example.com/v1/appointments/appointment-1' },
      { method: 'POST', url: 'https://api.example.com/auth/session/refresh' },
      { method: 'PATCH', url: 'https://api.example.com/v1/appointments/appointment-1' },
      { method: 'GET', url: 'https://api.example.com/v1/appointments/appointment-1' },
      { method: 'POST', url: 'https://api.example.com/auth/session/refresh' },
      { method: 'GET', url: 'https://api.example.com/v1/appointments/appointment-1' },
    ]);
    expect(explicitResubmission.status).toBe(200);
    expect(readResponse.status).toBe(200);
    expect(
      networkCalls.filter(
        ({ method, url }) => method === 'PATCH' && url.endsWith('/appointments/appointment-1')
      )
    ).toHaveLength(2);
    expect(
      networkCalls.filter(
        ({ method, url }) => method === 'GET' && url.endsWith('/appointments/appointment-1')
      )
    ).toHaveLength(2);
    expect(networkCalls.filter(({ url }) => url.endsWith('/auth/session/refresh'))).toHaveLength(2);
  });
});
