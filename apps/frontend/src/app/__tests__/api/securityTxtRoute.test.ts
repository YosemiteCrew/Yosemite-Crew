/**
 * `next/server` is mocked down to the constructor the route uses, as in the
 * other route suites: jsdom has no Web `Response` global.
 */
jest.mock('next/server', () => ({
  NextResponse: class {
    constructor(
      readonly body: string,
      readonly init: { headers: Record<string, string> }
    ) {}
  },
}));

import nextConfig from '../../../../next.config';
import { GET, dynamic } from '@/app/security.txt/route';

type MockedResponse = { body: string; init: { headers: Record<string, string> } };

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const callRoute = () => GET() as unknown as MockedResponse;

/** RFC 9116 fields as name -> values, in file order. */
const readFields = (body: string) => {
  const fields = new Map<string, string[]>();
  for (const line of body.split('\n').filter(Boolean)) {
    const separator = line.indexOf(': ');
    expect(separator).toBeGreaterThan(0);
    const name = line.slice(0, separator);
    fields.set(name, [...(fields.get(name) ?? []), line.slice(separator + 2)]);
  }
  return fields;
};

describe('GET /security.txt', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves plain text with every field the policy promises', () => {
    const { body, init } = callRoute();
    const fields = readFields(body);

    expect(init.headers['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(body.endsWith('\n')).toBe(true);
    // RFC 9116: the first Contact is the preferred one.
    expect(fields.get('Contact')).toEqual([
      'mailto:security@yosemitecrew.com',
      'https://github.com/YosemiteCrew/Yosemite-Crew/security/advisories/new',
    ]);
    expect(fields.get('Policy')).toEqual([
      'https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/SECURITY.md',
    ]);
    expect(fields.get('Preferred-Languages')).toEqual(['en']);
    expect(fields.get('Expires')).toHaveLength(1);
  });

  it('expires one year after the request, so the file never lapses', () => {
    const now = Date.UTC(2031, 1, 3, 4, 5, 6);
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const fields = readFields(callRoute().body);

    expect(fields.get('Expires')).toEqual([new Date(now + ONE_YEAR_MS).toISOString()]);
  });

  it('is rendered per request rather than frozen at build time', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('is also served from the well-known path', async () => {
    const rewrites = await nextConfig.rewrites?.();

    expect(rewrites).toEqual(
      expect.arrayContaining([
        { source: '/.well-known/security.txt', destination: '/security.txt' },
      ])
    );
  });
});
