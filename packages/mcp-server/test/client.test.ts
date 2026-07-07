import axios from 'axios';
import { createApiClient, DEFAULT_BASE_URL } from '../src/client.js';

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));

const createMock = axios.create as jest.Mock;

describe('createApiClient', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockReturnValue({ fake: 'client' });
  });

  it('throws a clear error when YC_API_KEY is missing', () => {
    expect(() => createApiClient({})).toThrow(/YC_API_KEY environment variable is required/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('mentions the developer portal in the missing-key error', () => {
    expect(() => createApiClient({})).toThrow(/developers\/api-keys/);
  });

  it('creates an axios client with Bearer auth, JSON content type, and a timeout', () => {
    const client = createApiClient({ YC_API_KEY: 'yc_test_abc' });
    expect(client).toEqual({ fake: 'client' });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      baseURL: DEFAULT_BASE_URL,
      headers: {
        Authorization: 'Bearer yc_test_abc',
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  });

  it('defaults the base URL to the local backend', () => {
    createApiClient({ YC_API_KEY: 'k' });
    const config = createMock.mock.calls[0][0] as { baseURL: string };
    expect(config.baseURL).toBe('http://localhost:3000');
  });

  it('honours YC_API_BASE_URL when set', () => {
    createApiClient({ YC_API_KEY: 'k', YC_API_BASE_URL: 'https://api.example.test' });
    const config = createMock.mock.calls[0][0] as { baseURL: string };
    expect(config.baseURL).toBe('https://api.example.test');
  });

  it('reads from process.env by default', () => {
    const previousKey = process.env.YC_API_KEY;
    const previousBase = process.env.YC_API_BASE_URL;
    process.env.YC_API_KEY = 'yc_test_env';
    delete process.env.YC_API_BASE_URL;
    try {
      createApiClient();
      const config = createMock.mock.calls[0][0] as { headers: Record<string, string> };
      expect(config.headers.Authorization).toBe('Bearer yc_test_env');
    } finally {
      if (previousKey === undefined) {
        delete process.env.YC_API_KEY;
      } else {
        process.env.YC_API_KEY = previousKey;
      }
      if (previousBase !== undefined) {
        process.env.YC_API_BASE_URL = previousBase;
      }
    }
  });
});
