/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const run = (pathname: string) =>
  middleware(new NextRequest(new URL(`http://localhost${pathname}`)));

describe('middleware security headers', () => {
  test.each([
    '/_next/static/chunk.js',
    '/api/health',
    '/fonts/inter.woff2',
    '/dev-docs/openapi-ui.html',
    '/logo.png',
    '/styles/app.css',
  ])('does not attach a Content-Security-Policy to skipped path %s', (pathname) => {
    const response = run(pathname);

    expect(response.headers.get('Content-Security-Policy')).toBeNull();
    expect(response.headers.get('X-Frame-Options')).toBeNull();
  });

  test('applies a nonce CSP and the base security headers to a document route', () => {
    const response = run('/dashboard');
    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain("'nonce-");
    expect(csp).toContain("object-src 'none'");
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(self)'
    );
  });

  test('applies a CSP to public routes and unknown dotted document paths', () => {
    for (const pathname of ['/', '/signin', '/www.yosemitecrew.com']) {
      const csp = run(pathname).headers.get('Content-Security-Policy');
      expect(csp).toContain("'nonce-");
    }
  });

  test('generates a fresh nonce for every request', () => {
    const first = run('/dashboard').headers.get('Content-Security-Policy');
    const second = run('/dashboard').headers.get('Content-Security-Policy');

    expect(first).not.toBeNull();
    expect(first).not.toBe(second);
  });
});
