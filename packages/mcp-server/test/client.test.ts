import { createApiClient, DEFAULT_BASE_URL, orgHeaders } from '../src/client.js';

describe('createApiClient', () => {
  it('refuses to start without a key, and says where to get one', () => {
    expect(() => createApiClient({})).toThrow(/YC_API_KEY/);
    expect(() => createApiClient({})).toThrow(/developers\/api-keys/);
  });

  it('sends the key as a bearer token', () => {
    const client = createApiClient({ YC_API_KEY: 'yc_test_abc' });
    expect(client.defaults.headers.Authorization).toBe('Bearer yc_test_abc');
  });

  /*
   * The backend listens on 4000. This is pinned because a default that drifts
   * from apps/backend/.env.example surfaces as a connection error that reads
   * like a broken server rather than a wrong port.
   */
  it('defaults to the port the backend actually listens on', () => {
    expect(DEFAULT_BASE_URL).toBe('http://localhost:4000');
    expect(createApiClient({ YC_API_KEY: 'k' }).defaults.baseURL).toBe(DEFAULT_BASE_URL);
  });

  it('honours an explicit base URL', () => {
    const client = createApiClient({ YC_API_KEY: 'k', YC_API_BASE_URL: 'https://api.example.com' });
    expect(client.defaults.baseURL).toBe('https://api.example.com');
  });

  /*
   * A key must never carry a practice. If an organisation were baked into the
   * client the server's per-request membership re-check would be bypassed for
   * every call this process makes.
   */
  it('configures no organisation of its own', () => {
    const headers = createApiClient({ YC_API_KEY: 'k' }).defaults.headers;
    expect(JSON.stringify(headers)).not.toContain('x-org-id');
  });
});

describe('orgHeaders', () => {
  it('names the practice for a single request', () => {
    expect(orgHeaders('org-a')).toEqual({ headers: { 'x-org-id': 'org-a' } });
  });
});
