/**
 * Mirrors the other route tests: the handler returns a `NextResponse`, which
 * needs the Web `Response` global that jsdom does not provide. Mocking
 * `next/server` down to the one factory the route uses keeps the whole handler
 * under test, cache headers included.
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { headers?: Record<string, string> }) => ({ body, init }),
  },
}));

import { GET, dynamic, revalidate } from '@/app/api/health/route';

type MockedResponse = {
  body: { status: string; buildSha: string | null; buildShaSource: string };
  init?: { headers?: Record<string, string> };
};

const SHA = 'c'.repeat(40);

describe('GET /api/health', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('reports the sha and the source baked in at build time', () => {
    process.env.BUILD_SHA = SHA;
    process.env.BUILD_SHA_SOURCE = 'git';

    const res = GET() as unknown as MockedResponse;

    expect(res.body).toEqual({ status: 'ok', buildSha: SHA, buildShaSource: 'git' });
  });

  it('reports buildSha as null, not absent, when the build could not identify itself', () => {
    delete process.env.BUILD_SHA;
    process.env.BUILD_SHA_SOURCE = 'unavailable';

    const res = GET() as unknown as MockedResponse;

    // `toHaveProperty` rather than a truthiness check: an omitted key reads as
    // "this deploy predates the field", null reads as "this build could not
    // identify itself". Those are different states and only one is a defect.
    expect(res.body).toHaveProperty('buildSha', null);
    expect(res.body.buildShaSource).toBe('unavailable');
  });

  it('defaults the source to unavailable rather than undefined', () => {
    delete process.env.BUILD_SHA;
    delete process.env.BUILD_SHA_SOURCE;

    const res = GET() as unknown as MockedResponse;

    expect(res.body.buildShaSource).toBe('unavailable');
  });

  it('sends no-store, because a cached health response reports the PREVIOUS deploy', () => {
    process.env.BUILD_SHA = SHA;

    const res = GET() as unknown as MockedResponse;

    // This is the assertion the route exists for. Without it the one instrument
    // for "did my change ship?" answers with the sha of the build before it -
    // wrong in the reassuring direction.
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
  });

  it('opts the route out of static rendering', () => {
    // The header alone is not enough: without `force-dynamic` Next prerenders
    // the handler at build time and serves one frozen body, so the response
    // could carry a correct-looking sha and never change again. Asserted as
    // exported values because there is no way to observe prerendering here.
    expect(dynamic).toBe('force-dynamic');
    expect(revalidate).toBe(0);
  });
});
