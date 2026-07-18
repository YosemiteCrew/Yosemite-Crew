import { readdirSync } from 'node:fs';
import path from 'node:path';

import { middleware } from '@/middleware';
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

  it('skips internal, api, font, and static file requests', () => {
    for (const pathname of [
      '/_next/static/app.js',
      '/api/health',
      '/fonts/satoshi.woff2',
      '/logo.png',
    ]) {
      const response = middleware(createRequest(pathname));

      expect(response).toBe(mockNext.mock.results.at(-1)?.value);
      expect(mockNext).toHaveBeenLastCalledWith();
    }
  });

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
});
