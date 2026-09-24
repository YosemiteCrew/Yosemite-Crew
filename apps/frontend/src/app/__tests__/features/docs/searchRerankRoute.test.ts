jest.mock('@/app/features/docs/searchReranker', () => ({ rerankDocs: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
      status: init.status ?? 200,
      headers: {
        get: (key: string) =>
          Object.entries(init.headers ?? {}).find(
            ([name]) => name.toLowerCase() === key.toLowerCase()
          )?.[1] ?? null,
      },
      json: async () => body,
    }),
  },
}));

import { POST } from '@/app/api/docs/rerank/route';
import { rerankDocs } from '@/app/features/docs/searchReranker';

const mockRerankDocs = rerankDocs as jest.MockedFunction<typeof rerankDocs>;
const makeRequest = (body: string, headers: Record<string, string> = {}) =>
  ({
    headers: {
      get: (key: string) =>
        Object.entries(headers).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1] ??
        null,
    },
    text: async () => body,
  }) as unknown as Request;

describe('POST /api/docs/rerank', () => {
  beforeEach(() => {
    mockRerankDocs.mockResolvedValue(['/docs/a']);
  });

  it('accepts only a bounded query and returns the server ordering without cache storage', async () => {
    const response = await POST(makeRequest(JSON.stringify({ query: 'rotate api key' })));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ order: ['/docs/a'] });
    expect(mockRerankDocs).toHaveBeenCalledWith('rotate api key');
  });

  it('rejects a declared oversized request before parsing it', async () => {
    const response = await POST(makeRequest('{}', { 'Content-Length': '4097' }));

    expect(response.status).toBe(413);
    expect(mockRerankDocs).not.toHaveBeenCalled();
  });

  it('rejects an oversized streamed body', async () => {
    const response = await POST(makeRequest(JSON.stringify({ query: 'x'.repeat(4100) })));

    expect(response.status).toBe(413);
    expect(mockRerankDocs).not.toHaveBeenCalled();
  });

  it('measures streamed request size in UTF-8 bytes', async () => {
    const response = await POST(makeRequest(JSON.stringify({ query: '🐾'.repeat(1100) })));

    expect(response.status).toBe(413);
    expect(mockRerankDocs).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const response = await POST(makeRequest('{'));

    expect(response.status).toBe(400);
    expect(mockRerankDocs).not.toHaveBeenCalled();
  });

  it.each([
    ['null', 'null'],
    ['array', '[]'],
    ['extra field', JSON.stringify({ query: 'api', extra: true })],
    ['missing query', JSON.stringify({})],
    ['non-string query', JSON.stringify({ query: 10 })],
    ['long query', JSON.stringify({ query: 'x'.repeat(201) })],
  ])('rejects invalid input: %s', async (_caseName, body) => {
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(400);
    expect(mockRerankDocs).not.toHaveBeenCalled();
  });

  it('returns null when the optional judgment is unavailable', async () => {
    mockRerankDocs.mockResolvedValue(null);
    const response = await POST(makeRequest(JSON.stringify({ query: 'api' })));

    expect(await response.json()).toEqual({ order: null });
  });
});
