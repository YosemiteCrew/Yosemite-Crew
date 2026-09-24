/**
 * `next/server` is mocked down to the one factory the route uses, as in the
 * other route suites: jsdom has no Web `Response` global.
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { headers?: Record<string, string> }) => ({ body, init }),
  },
}));

import { GET } from '@/app/api/platform-status/route';

type MockedResponse = {
  body: { status: string };
  init?: { headers?: Record<string, string> };
};

const callRoute = async (): Promise<MockedResponse> => (await GET()) as unknown as MockedResponse;

const ok = (data: unknown) => ({ ok: true, json: () => Promise.resolve(data) }) as Response;
const notOk = () => ({ ok: false, json: () => Promise.resolve(null) }) as unknown as Response;

const CACHED = 'public, max-age=60, stale-while-revalidate=60';
const ONE_COMPONENT = { components: [{ id: 'api', name: 'API', status: 'operational' }] };
// What the live page returned when #2743 was filed: green, with nothing behind it.
const NOTHING_CONFIGURED = {
  status: { indicator: 'none', description: 'All Systems Operational' },
  monitors: null,
  pageComponents: null,
  pageComponentGroups: null,
  trackers: null,
  incidents: [],
};

/** Answers the status API and the summary endpoint independently. */
const mockUpstream = (status: () => Promise<Response>, summary: () => Promise<Response>) => {
  const fetchMock = jest.fn((url: string) =>
    url.includes('/summary.json') ? summary() : status()
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe('GET /api/platform-status', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports operational when at least one component is monitored', async () => {
    const fetchMock = mockUpstream(
      () => Promise.resolve(ok({ status: 'operational' })),
      () => Promise.resolve(ok(ONE_COMPONENT))
    );

    const res = await callRoute();

    expect(res.body).toEqual({ status: 'operational' });
    expect(res.init?.headers?.['Cache-Control']).toBe(CACHED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['monitors', { ...NOTHING_CONFIGURED, monitors: [{ id: 1, name: 'API' }] }],
    ['pageComponents', { ...NOTHING_CONFIGURED, pageComponents: [{ id: 1, name: 'API' }] }],
  ])('reports operational when the summary lists %s', async (_field, summary) => {
    mockUpstream(
      () => Promise.resolve(ok({ status: 'operational' })),
      () => Promise.resolve(ok(summary))
    );

    expect((await callRoute()).body).toEqual({ status: 'operational' });
  });

  it('reports unknown, not operational, when the page monitors nothing', async () => {
    mockUpstream(
      () => Promise.resolve(ok({ status: 'operational' })),
      () => Promise.resolve(ok(NOTHING_CONFIGURED))
    );

    const res = await callRoute();

    expect(res.body).toEqual({ status: 'unknown' });
    // Nothing configured is a real answer, so it is cached like one.
    expect(res.init?.headers?.['Cache-Control']).toBe(CACHED);
  });

  it.each([
    ['a missing components field', {}],
    ['a non-array components field', { components: 'api' }],
    ['empty monitor and component lists', { monitors: [], pageComponents: [], components: [] }],
    ['a non-object summary', 'components'],
  ])('treats %s as nothing monitored', async (_label, summary) => {
    mockUpstream(
      () => Promise.resolve(ok({ status: 'operational' })),
      () => Promise.resolve(ok(summary))
    );

    expect((await callRoute()).body).toEqual({ status: 'unknown' });
  });

  it('passes a raised incident through even with no components configured', async () => {
    mockUpstream(
      () => Promise.resolve(ok({ status: 'incident' })),
      () => Promise.resolve(ok(NOTHING_CONFIGURED))
    );

    const res = await callRoute();

    expect(res.body).toEqual({ status: 'incident' });
    expect(res.init?.headers?.['Cache-Control']).toBe(CACHED);
  });

  it('passes a non-green status through when the summary is unreachable', async () => {
    mockUpstream(
      () => Promise.resolve(ok({ status: 'major_outage' })),
      () => Promise.reject(new Error('offline'))
    );

    expect((await callRoute()).body).toEqual({ status: 'major_outage' });
  });

  it('does not cache unknown when the evidence for a green status could not be read', async () => {
    mockUpstream(
      () => Promise.resolve(ok({ status: 'operational' })),
      () => Promise.resolve(notOk())
    );

    const res = await callRoute();

    expect(res.body).toEqual({ status: 'unknown' });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it.each([
    ['a non-ok response', () => Promise.resolve(notOk())],
    ['a rejected request', () => Promise.reject(new Error('offline'))],
    ['a body with no string status', () => Promise.resolve(ok({ status: 3 }))],
    ['a null body', () => Promise.resolve(ok(null))],
  ])('reports uncached unknown on %s from the status API', async (_label, status) => {
    mockUpstream(status, () => Promise.resolve(ok(ONE_COMPONENT)));

    const res = await callRoute();

    expect(res.body).toEqual({ status: 'unknown' });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('asks both endpoints uncached so a failure is never replayed', async () => {
    const fetchMock = mockUpstream(
      () => Promise.resolve(ok({ status: 'operational' })),
      () => Promise.resolve(ok(ONE_COMPONENT))
    );

    await callRoute();

    const urls = fetchMock.mock.calls.map(([url]) => String(url)).sort();
    expect(urls).toEqual([
      'https://api.openstatus.dev/public/status/yosemite-crew',
      'https://yosemite-crew.openstatus.dev/api/status/summary.json',
    ]);
    for (const call of fetchMock.mock.calls) {
      expect((call as unknown as [string, RequestInit])[1]).toMatchObject({ cache: 'no-store' });
    }
  });
});
