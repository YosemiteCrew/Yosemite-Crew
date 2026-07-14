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
});
