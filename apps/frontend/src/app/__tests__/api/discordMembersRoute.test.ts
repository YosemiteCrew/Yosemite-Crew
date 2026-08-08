/**
 * The route returns a `NextResponse`, which needs the Web `Response` global that
 * the jsdom test environment does not provide. Mocking `next/server` down to the
 * one factory the route uses keeps the whole handler under test — status body and
 * cache headers included — without switching the suite to a node environment
 * (jest.setup.ts touches `HTMLElement`, so it cannot run there).
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { headers?: Record<string, string> }) => ({ body, init }),
  },
}));

import { GET } from '@/app/api/community/discord-members/route';

type MockedResponse = {
  body: { discordMembers: string | null };
  init?: { headers?: Record<string, string> };
};

const callRoute = async (): Promise<MockedResponse> => (await GET()) as unknown as MockedResponse;

const okInvite = (data: unknown) =>
  ({ ok: true, json: () => Promise.resolve(data) }) as unknown as Response;

const notOk = () => ({ ok: false, json: () => Promise.resolve(null) }) as unknown as Response;

const PRIMARY_CODE = 'SwM6mX85KD';
const FALLBACK_CODE = 'yosemitecrew';

describe('GET /api/community/discord-members', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the formatted member count from the primary invite code', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okInvite({ approximate_member_count: 1204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await callRoute();

    expect(res.body).toEqual({ discordMembers: '1,204' });
    expect(res.init?.headers?.['Cache-Control']).toBe(
      'public, max-age=300, stale-while-revalidate=300'
    );
    // The fallback code is only tried when the first one fails.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(PRIMARY_CODE);
  });

  it('sends the counts query and a descriptive User-Agent Discord accepts', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okInvite({ approximate_member_count: 42 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await callRoute();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('with_counts=true');
    expect((init as RequestInit).headers).toMatchObject({
      'User-Agent': expect.stringContaining('yosemitecrew.com'),
    });
  });

  it('falls back to the second invite code when the first is rejected', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(notOk())
      .mockResolvedValueOnce(okInvite({ approximate_member_count: 196 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await callRoute();

    expect(res.body).toEqual({ discordMembers: '196' });
    expect(String(fetchMock.mock.calls[1][0])).toContain(FALLBACK_CODE);
  });

  it('falls back when an invite resolves without a member count', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okInvite({ code: PRIMARY_CODE }))
      .mockResolvedValueOnce(okInvite({ approximate_member_count: 7 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect((await callRoute()).body).toEqual({ discordMembers: '7' });
  });

  it('falls back when an invite resolves to a non-object payload', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okInvite(null))
      .mockResolvedValueOnce(okInvite({ approximate_member_count: 8 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect((await callRoute()).body).toEqual({ discordMembers: '8' });
  });

  it('returns a null count that is not cached when every lookup fails', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const res = await callRoute();

    // Null rather than an error status: the caller keeps its loading placeholder
    // and never paints a fabricated number.
    expect(res.body).toEqual({ discordMembers: null });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });
});
