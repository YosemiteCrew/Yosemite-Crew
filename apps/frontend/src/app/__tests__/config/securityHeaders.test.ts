import nextConfig from '../../../../next.config';
import { buildContentSecurityPolicy, buildSecurityHeaders } from '@/securityHeaders';

type HeaderEntry = {
  key: string;
  value: string;
};

const findHeader = (headers: HeaderEntry[], key: string): string | undefined =>
  headers.find((header) => header.key === key)?.value;

const parseCspDirectives = (csp: string): Map<string, string> =>
  new Map(
    csp
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const firstSpaceIndex = directive.indexOf(' ');
        if (firstSpaceIndex === -1) {
          return [directive, ''];
        }
        return [directive.slice(0, firstSpaceIndex), directive.slice(firstSpaceIndex + 1)];
      })
  );

describe('security headers', () => {
  test('applies critical non-HSTS security headers to all routes in local/test mode', async () => {
    const routes = await nextConfig.headers?.();
    expect(routes).toBeDefined();
    expect(routes).toHaveLength(1);

    const routeHeaders = routes?.[0];
    expect(routeHeaders?.source).toBe('/(.*)');

    const headers = routeHeaders?.headers as HeaderEntry[];
    expect(findHeader(headers, 'X-Frame-Options')).toBe('DENY');
    expect(findHeader(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(findHeader(headers, 'Strict-Transport-Security')).toBeUndefined();
    expect(findHeader(headers, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(findHeader(headers, 'Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(self)'
    );
  });

  test('applies HSTS in production headers', () => {
    const headers = buildSecurityHeaders(true);

    expect(findHeader(headers, 'Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains; preload'
    );
  });

  test('builds a local-safe nonce-based content security policy', () => {
    const directives = parseCspDirectives(
      buildContentSecurityPolicy({
        nonce: 'test-nonce',
        documensoHost: 'https://sign.example.com',
      })
    );

    expect(directives.get('default-src')).toBe("'self'");
    expect(directives.get('object-src')).toBe("'none'");
    expect(directives.get('base-uri')).toBe("'self'");
    expect(directives.get('frame-ancestors')).toBe("'none'");
    expect(directives.get('form-action')).toBe("'self'");
    expect(directives.get('upgrade-insecure-requests')).toBeUndefined();

    expect(directives.get('script-src')).toContain("'self'");
    expect(directives.get('script-src')).toContain("'nonce-test-nonce'");
    expect(directives.get('script-src')).toContain('https://js.stripe.com');
    expect(directives.get('script-src')).toContain("'unsafe-eval'");
    expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
    expect(directives.get('style-src')).toContain('https://fonts.googleapis.com');
    expect(directives.get('style-src')).toContain("'unsafe-inline'");
    expect(directives.get('style-src-elem')).toContain("'unsafe-inline'");
    expect(directives.get('style-src-attr')).toBe("'unsafe-inline'");
    expect(directives.get('font-src')).toContain('https://fonts.gstatic.com');
    expect(directives.get('connect-src')).toContain('https://api.stripe.com');
    expect(directives.get('connect-src')).toContain('http:');
    expect(directives.get('connect-src')).toContain('ws:');
    expect(directives.get('frame-src')).toContain('https://js.stripe.com');
    expect(directives.get('frame-src')).toContain('https://*.merckvetmanual.com');
    expect(directives.get('frame-src')).toContain('https://sign.example.com');
  });

  test('builds a static-compatible content security policy for public pages', () => {
    const directives = parseCspDirectives(
      buildContentSecurityPolicy({
        allowInlineScripts: true,
        documensoHost: 'https://sign.example.com',
      })
    );

    expect(directives.get('script-src')).toContain("'self'");
    expect(directives.get('script-src')).toContain("'unsafe-inline'");
    expect(directives.get('script-src')).not.toContain("'nonce-");
    expect(directives.get('style-src')).toContain("'unsafe-inline'");
    expect(directives.get('style-src-elem')).toContain("'unsafe-inline'");
  });

  test('omits dev-only CSP relaxations in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const directives = parseCspDirectives(
      buildContentSecurityPolicy({
        nonce: 'test-nonce',
        documensoHost: 'https://sign.example.com',
      })
    );

    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;

    expect(directives.get('script-src')).not.toContain("'unsafe-eval'");
    expect(directives.get('style-src')).not.toContain("'nonce-test-nonce'");
    expect(directives.get('style-src-elem')).not.toContain("'nonce-test-nonce'");
    expect(directives.get('style-src')).toContain("'unsafe-inline'");
    expect(directives.get('style-src-elem')).toContain("'unsafe-inline'");
    expect(directives.get('connect-src')).not.toContain('http:');
    expect(directives.get('connect-src')).not.toContain('ws:');
    expect(directives.get('upgrade-insecure-requests')).toBe('');
  });

  test('keeps public static CSP compatible in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const directives = parseCspDirectives(
      buildContentSecurityPolicy({
        allowInlineScripts: true,
        documensoHost: 'https://sign.example.com',
      })
    );

    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;

    expect(directives.get('script-src')).toContain("'unsafe-inline'");
    expect(directives.get('script-src')).not.toContain("'unsafe-eval'");
    expect(directives.get('script-src')).not.toContain("'nonce-");
  });
});
