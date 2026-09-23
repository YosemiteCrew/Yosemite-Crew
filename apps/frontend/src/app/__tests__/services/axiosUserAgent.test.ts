import axios from 'axios';
import { API_CLIENT_DEFAULTS } from '@/app/services/axios';

// Real axios and its real fetch adapter, with only `fetch` stubbed: the other
// suite mocks axios wholesale, so it can see the config but never the request.
jest.mock('supertokens-web-js/recipe/session', () => ({ __esModule: true, default: {} }));
jest.mock('@/app/stores/authStore', () => ({ useAuthStore: { getState: jest.fn() } }));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: { getState: jest.fn() } }));
jest.mock('@/app/hooks/useAuth', () => ({ hardSignOut: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const sentHeaders = async (method: 'get' | 'post') => {
  const fetch = jest.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      ({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        text: async () => '{}',
        json: async () => ({}),
      }) as unknown as Response
  );
  const client = axios.create({ ...API_CLIENT_DEFAULTS, baseURL: 'https://api.example.test' });
  await client.request({
    method,
    url: '/v1/x',
    data: method === 'post' ? { a: 1 } : undefined,
    env: { fetch },
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  return Object.fromEntries(
    Object.entries((fetch.mock.calls[0][1]?.headers ?? {}) as Record<string, string>).map(
      ([name, value]) => [name.toLowerCase(), value]
    )
  );
};

describe('API client request headers', () => {
  it.each(['get', 'post'] as const)(
    'sends no user-agent on %s, so Firefox and Safari do not preflight for it',
    async (method) => {
      const headers = await sentHeaders(method);
      expect(headers).not.toHaveProperty('user-agent');
      expect(headers['content-type']).toBe('application/json');
    }
  );
});
