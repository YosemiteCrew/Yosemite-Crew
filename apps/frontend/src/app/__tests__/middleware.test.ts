import { readdirSync } from 'node:fs';
import path from 'node:path';

import { config, middleware } from '@/middleware';
import { buildContentSecurityPolicy, securityHeaders } from '@/securityHeaders';
import { NextResponse } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(),
  },
}));

const mockNext = NextResponse.next as jest.Mock;

const createResponse = () => ({
  headers: new Headers(),
});

const createRequest = (pathname: string) =>
  ({
    nextUrl: { pathname },
    headers: new Headers({ accept: 'text/html' }),
  }) as never;

const APP_ROUTES_DIR = path.join(__dirname, '..', '(routes)', '(app)');

const isRouteGroup = (segment: string) => segment.startsWith('(') && segment.endsWith(')');

// Walks the (app) route tree and returns the URL path of every page, so the
// strict-CSP list in middleware.ts can be checked against reality rather than
// against a hand-maintained copy of it. Route groups contribute no URL segment.
const collectRoutePaths = (directory: string, urlPath: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'page.tsx') {
      return [urlPath];
    }
    if (!entry.isDirectory()) {
      return [];
    }
    const nestedPath = isRouteGroup(entry.name) ? urlPath : `${urlPath}/${entry.name}`;
    return collectRoutePaths(path.join(directory, entry.name), nestedPath);
  });

const appRoutePaths = collectRoutePaths(APP_ROUTES_DIR, '');

const getScriptSrc = (csp: string) =>
  csp.split('; ').find((directive) => directive.startsWith('script-src ')) ?? '';

describe('middleware', () => {
  const originalCrypto = globalThis.crypto;
  const originalBtoa = globalThis.btoa;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext.mockReturnValue(createResponse());
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: jest.fn((bytes: Uint8Array) => {
          bytes.fill(1);
          return bytes;
        }),
      },
    });
    Object.defineProperty(globalThis, 'btoa', {
      configurable: true,
      value: jest.fn(() => 'fixed-nonce'),
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
    Object.defineProperty(globalThis, 'btoa', {
      configurable: true,
      value: originalBtoa,
    });
  });

  // Internal, api, font and static-file requests are excluded by `config.matcher`
  // rather than by a guard in this function, so middleware() is never entered for
  // them at all. The `matcher` describe block below is what pins that.

  it('adds nonce-backed CSP and security headers for strict app routes', () => {
    const response = middleware(createRequest('/appointments/abc')) as ReturnType<
      typeof createResponse
    >;
    const nextOptions = mockNext.mock.calls[0][0];
    const requestHeaders = nextOptions.request.headers as Headers;
    const expectedCsp = buildContentSecurityPolicy({
      nonce: 'fixed-nonce',
      documensoHost: process.env.NEXT_PUBLIC_DOCUMENSO_HOST,
      allowInlineScripts: false,
    });

    expect(requestHeaders.get('x-nonce')).toBe('fixed-nonce');
    expect(requestHeaders.get('Content-Security-Policy')).toBe(expectedCsp);
    expect(response.headers.get('Content-Security-Policy')).toBe(expectedCsp);
    for (const header of securityHeaders) {
      expect(response.headers.get(header.key)).toBe(header.value);
    }
  });

  describe('every (app) route is covered by the strict CSP list', () => {
    it('discovered the (app) route tree', () => {
      expect(appRoutePaths.length).toBeGreaterThan(20);
    });

    it.each(appRoutePaths)('serves %s with a nonce and no inline scripts', (pathname) => {
      middleware(createRequest(pathname));
      const requestHeaders = mockNext.mock.calls[0][0].request.headers as Headers;

      expect(requestHeaders.get('x-nonce')).toBe('fixed-nonce');
      expect(getScriptSrc(requestHeaders.get('Content-Security-Policy') ?? '')).not.toContain(
        "'unsafe-inline'"
      );
    });
  });

  it('allows inline scripts and omits nonce for public document routes', () => {
    middleware(createRequest('/pricing'));
    const nextOptions = mockNext.mock.calls[0][0];
    const requestHeaders = nextOptions.request.headers as Headers;

    expect(requestHeaders.has('x-nonce')).toBe(false);
    expect(requestHeaders.get('Content-Security-Policy')).toBe(
      buildContentSecurityPolicy({
        nonce: undefined,
        documensoHost: process.env.NEXT_PUBLIC_DOCUMENSO_HOST,
        allowInlineScripts: true,
      })
    );
  });

  it.each([
    '/signin',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/payment-status',
    '/developers/signin',
    '/developers/signup',
  ])('serves %s with a nonce CSP instead of unsafe-inline scripts', (pathname) => {
    const response = middleware(createRequest(pathname)) as ReturnType<typeof createResponse>;
    const nextOptions = mockNext.mock.calls[0][0];
    const requestHeaders = nextOptions.request.headers as Headers;
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    const scriptSrc = csp.split('; ').find((directive) => directive.startsWith('script-src'));

    expect(requestHeaders.get('x-nonce')).toBe('fixed-nonce');
    expect(scriptSrc).toContain("'nonce-fixed-nonce'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  describe('matcher', () => {
    // Compile the matcher the way Next does, rather than treating `config.matcher`
    // as a raw regex. Next appends its transport suffixes (`.rsc`,
    // `.segments/....segment.rsc`) AFTER the source, so a hand-rolled regex test
    // cannot see that a "path contains a dot" exclusion also swallows those - the
    // exact bug this pins. `getMiddlewareMatchers` is the real compiler.
    // Next appends its transport suffixes (`.rsc`, `.segments/....segment.rsc`)
    // AFTER this source when it compiles the matcher, so the compiled regex can
    // satisfy `/dashboard.rsc` either by the capture consuming the whole path or
    // by the suffix group taking `.rsc`. Testing the source alone exercises the
    // stricter of the two: if the capture accepts the suffixed path, the compiled
    // matcher certainly does. That is what makes a "path contains a dot"
    // exclusion visibly wrong here, which a test over unsuffixed paths misses.
    const matches = (pathname: string) =>
      config.matcher.some((source) => new RegExp(`^${source}$`).test(pathname));

    it.each([
      '/',
      '/signin',
      '/dashboard',
      '/appointments/123/workspace',
      // Transport forms of the same app routes. These must keep matching, or the
      // RSC request renders without the nonce its CSP requires.
      '/dashboard.rsc',
      '/appointments/123/workspace.rsc',
      '/appointments.segments/_tree.segment.rsc',
    ])('still runs for %s', (pathname) => {
      expect(matches(pathname)).toBe(true);
    });

    it.each([
      '/api/community/discord-members',
      '/_next/static/chunks/main.js',
      '/fonts/satoshi-font/Satoshi-Variable.woff2',
      '/images/marketing/logo.svg',
      '/assets/hero.jpg',
      '/dev-docs/openapi-ui.html',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/site.webmanifest',
      // Committed under public/static, and the only .csv the app serves.
      '/static/bulk_invite_users_header.csv',
    ])('does not run for %s', (pathname) => {
      expect(matches(pathname)).toBe(false);
    });

    // The prefix exclusions are bounded to a path segment. Unbounded, these
    // document routes would be skipped and their HTML would be served with no
    // CSP, because next.config.ts headers() sets no CSP of its own.
    it.each(['/images-foo', '/assets-library', '/static-pages', '/dev-docs-archive', '/apixyz'])(
      'still runs for the document route %s',
      (pathname) => {
        expect(matches(pathname)).toBe(true);
      }
    );

    // Every top-level entry in public/ must be excluded, or it pays an edge
    // invocation on every request. Reading the directory keeps this honest when
    // a new asset folder is added.
    it('excludes every top-level public/ entry', () => {
      const publicDir = path.join(__dirname, '..', '..', '..', 'public');
      const served = readdirSync(publicDir, { withFileTypes: true }).map((entry) =>
        entry.isDirectory() ? `/${entry.name}/probe` : `/${entry.name}`
      );

      expect(served.filter((pathname) => matches(pathname))).toEqual([]);
    });
  });

  describe('transport paths resolve to the document they belong to', () => {
    const nonceFor = (pathname: string) => {
      const response = createResponse();
      mockNext.mockReturnValue(response);
      middleware(createRequest(pathname));
      return getScriptSrc(response.headers.get('Content-Security-Policy') ?? '');
    };

    it.each([
      '/dashboard.rsc',
      '/appointments/123/workspace.rsc',
      '/appointments.segments/_tree.segment.rsc',
      // Repeated markers resolve to the first one, same as the plain form.
      '/dashboard.segments/a.segments/b.segment.rsc',
    ])('gives %s the strict CSP of its document route', (pathname) => {
      expect(nonceFor(pathname)).toContain("'nonce-fixed-nonce'");
    });

    it.each([
      // Public route: transport form must stay permissive, not accidentally strict.
      '/pricing.rsc',
      // Not a transport suffix at all.
      '/dashboard.rscx',
    ])('does not mistake %s for a strict app route', (pathname) => {
      expect(nonceFor(pathname)).not.toContain("'nonce-");
    });

    it('normalises a pathological transport path in linear time', () => {
      // The regex this replaced backtracked polynomially here - seconds of edge
      // CPU on an attacker-supplied path, on every request (js/polynomial-redos).
      const evil = `/${'.segments/'.repeat(20_000)}x`;

      const started = performance.now();
      middleware(createRequest(evil));

      expect(performance.now() - started).toBeLessThan(250);
    });
  });

  describe('no second static-asset filter in the body', () => {
    // A dotted path that the matcher admits must reach the CSP logic. This is
    // the contradiction that made the matcher fix a no-op: the body skipped
    // anything containing a dot, which is every transport request.
    it('applies the strict CSP to a transport request for an app route', () => {
      const response = createResponse();
      mockNext.mockReturnValue(response);

      middleware(createRequest('/dashboard.rsc'));

      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("'nonce-");
      expect(csp).not.toContain("'unsafe-inline' https://js.stripe.com");
    });
  });
});
