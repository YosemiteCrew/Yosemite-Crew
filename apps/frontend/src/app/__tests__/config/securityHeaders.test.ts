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
    expect(nextConfig.poweredByHeader).toBe(false);

    const routes = await nextConfig.headers?.();
    expect(routes).toBeDefined();

    // Look the catch-all up by source rather than by position, so adding
    // narrower rules (for example the static-asset cache policies) cannot
    // silently move the security headers out from under this assertion.
    const routeHeaders = routes?.find((route) => route.source === '/(.*)');
    expect(routeHeaders).toBeDefined();

    const headers = routeHeaders?.headers as HeaderEntry[];
    expect(findHeader(headers, 'X-Frame-Options')).toBe('SAMEORIGIN');
    expect(findHeader(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(findHeader(headers, 'Strict-Transport-Security')).toBeUndefined();
    expect(findHeader(headers, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(findHeader(headers, 'Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(self)'
    );
  });

  test('caches static assets long enough for the CDN to keep them', async () => {
    const routes = await nextConfig.headers?.();

    const fonts = routes?.find((route) => route.source === '/fonts/:path*');
    expect(findHeader(fonts?.headers as HeaderEntry[], 'Cache-Control')).toBe(
      'public, max-age=31536000, immutable'
    );

    // Images can be replaced in place, so they get a freshness window and
    // stale-while-revalidate rather than being marked immutable.
    const images = routes?.find((route) => route.source === '/images/:path*');
    expect(findHeader(images?.headers as HeaderEntry[], 'Cache-Control')).toBe(
      'public, max-age=86400, stale-while-revalidate=2592000'
    );
  });

  test('applies a strict, tightly scoped CSP to the static dev-docs surface', async () => {
    const routes = await nextConfig.headers?.();
    const devDocs = routes?.find((route) => route.source === '/dev-docs/:path*');
    expect(devDocs).toBeDefined();

    const csp = findHeader(devDocs?.headers as HeaderEntry[], 'Content-Security-Policy');
    expect(csp).toBeDefined();

    const directives = parseCspDirectives(csp as string);
    expect(directives.get('default-src')).toBe("'self'");
    expect(directives.get('script-src')).toBe("'self' https://cdn.redoc.ly");
    expect(directives.get('object-src')).toBe("'none'");
    expect(directives.get('base-uri')).toBe("'self'");
    expect(directives.get('frame-ancestors')).toBe("'self'");
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
    expect(directives.get('frame-ancestors')).toBe("'self'");
    expect(directives.get('form-action')).toBe("'self'");
    expect(directives.get('upgrade-insecure-requests')).toBeUndefined();

    expect(directives.get('script-src')).toContain("'self'");
    expect(directives.get('script-src')).toContain("'nonce-test-nonce'");
    expect(directives.get('script-src')).toContain('https://js.stripe.com');
    expect(directives.get('script-src')).toContain('https://connect-js.stripe.com');
    expect(directives.get('script-src')).toContain('https://*.js.stripe.com');
    expect(directives.get('script-src')).toContain('https://eu-assets.i.posthog.com');
    expect(directives.get('script-src')).not.toContain('https://us-assets.i.posthog.com');
    expect(directives.get('script-src')).toContain("'unsafe-eval'");
    expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
    expect(directives.get('style-src')).toContain('https://fonts.googleapis.com');
    expect(directives.get('style-src')).toContain("'unsafe-inline'");
    expect(directives.get('style-src-elem')).toContain("'unsafe-inline'");
    expect(directives.get('style-src-attr')).toBe("'unsafe-inline'");
    expect(directives.get('font-src')).toContain('https://fonts.gstatic.com');
    expect(directives.get('connect-src')).toContain('blob:');
    expect(directives.get('connect-src')).toContain('https://api.stripe.com');
    expect(directives.get('connect-src')).toContain('https://connect-js.stripe.com');
    expect(directives.get('connect-src')).toContain('https://places.googleapis.com');
    expect(directives.get('connect-src')).toContain('https://raw.githubusercontent.com');
    // Deliberately absent: the Discord member count is fetched server-side by
    // /api/community/discord-members, so the browser never connects to
    // discord.com and granting the origin was an unused exfiltration channel.
    expect(directives.get('connect-src')).not.toContain('https://discord.com');
    expect(directives.get('connect-src')).toContain('http:');
    expect(directives.get('connect-src')).toContain('ws:');
    expect(directives.get('media-src')).toContain("'self'");
    expect(directives.get('media-src')).toContain('https://d2il6osz49gpup.cloudfront.net');
    expect(directives.get('img-src')).toContain('https://upload.wikimedia.org');
    expect(directives.get('img-src')).toContain('https://d2il6osz49gpup.cloudfront.net');
    expect(directives.get('img-src')).toContain('https://d2kyjiikho62xx.cloudfront.net');
    expect(directives.get('frame-src')).toContain('blob:');
    expect(directives.get('frame-src')).toContain('https://js.stripe.com');
    expect(directives.get('frame-src')).toContain('https://*.js.stripe.com');
    expect(directives.get('frame-src')).toContain('https://connect-js.stripe.com');
    expect(directives.get('img-src')).toContain('https://*.stripe.com');
    // Every host isAllowedMerckUrl accepts must be frameable, apex included —
    // a `*.` wildcard does not match the bare domain.
    ['merckvetmanual.com', 'msdvetmanual.com', 'merckmanuals.com', 'msdmanuals.com'].forEach(
      (domain) => {
        expect(directives.get('frame-src')).toContain(`https://${domain}`);
        expect(directives.get('frame-src')).toContain(`https://*.${domain}`);
      }
    );
    expect(directives.get('frame-src')).toContain('https://*.idexx.com');
    expect(directives.get('frame-src')).toContain('https://*.vetconnectplus.com');
    expect(directives.get('frame-src')).toContain('https://d2il6osz49gpup.cloudfront.net');
    expect(directives.get('frame-src')).toContain('https://d2kyjiikho62xx.cloudfront.net');
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

  test('does not allow the US PostHog host from env', () => {
    const originalHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';

    const directives = parseCspDirectives(
      buildContentSecurityPolicy({
        nonce: 'test-nonce',
        documensoHost: 'https://sign.example.com',
      })
    );

    process.env.NEXT_PUBLIC_POSTHOG_HOST = originalHost;

    expect(directives.get('script-src')).not.toContain('https://us.i.posthog.com');
    expect(directives.get('connect-src')).not.toContain('https://us.i.posthog.com');
    expect(directives.get('script-src')).not.toContain('https://us-assets.i.posthog.com');
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
    expect(directives.get('connect-src')).toContain('https://places.googleapis.com');
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

/**
 * The Documenso portal is embedded in an iframe on the organisation page, so
 * `frame-src` has to name its origin or the browser blocks the frame. The
 * failure is completely silent - the component computes a portal URL it is
 * happy with, renders the iframe, and the reader gets a blank panel with no
 * error in the app and nothing in `console`.
 *
 * Reproduced on dev while chasing "the document portal doesn't work": the
 * portal there fails for an unrelated reason on the Documenso side, but these
 * two shapes are how the FRONTEND can cause the same blank panel.
 */
describe('Documenso frame-src', () => {
  /* Tokenised, not a substring match. `https://ds.example.com` is a prefix of
     `https://ds.example.com/`, so a substring assertion cannot tell the bare
     origin from the slashed form - which is the entire distinction under test. */
  const frameSrc = (documensoHost?: string) =>
    (parseCspDirectives(buildContentSecurityPolicy({ documensoHost })).get('frame-src') ?? '')
      .split(/\s+/)
      .filter(Boolean);

  test('falls back to the default host when the variable is blank', () => {
    /* A default parameter only fires on `undefined`, and `.env.example` ships
       `NEXT_PUBLIC_DOCUMENSO_HOST=` with no value - so any environment that
       copies it hands this an empty string, which used to survive the default
       and then get dropped, leaving frame-src with no portal host at all. */
    expect(frameSrc('')).toContain('https://ds.yosemitecrew.com');
    expect(frameSrc('   ')).toContain('https://ds.yosemitecrew.com');
    expect(frameSrc(undefined)).toContain('https://ds.yosemitecrew.com');
  });

  test('reduces a configured host to a bare origin', () => {
    /* `https://ds.example.com/` is a source with a PATH, not an origin, and it
       does not match a frame the way the bare form does. `urls.ts` already
       normalises via `new URL(...).origin` when it decides whether to render
       the iframe at all, so leaving the raw string here let the two halves
       disagree about the same value. */
    expect(frameSrc('https://ds.example.com/')).toContain('https://ds.example.com');
    expect(frameSrc('https://ds.example.com/')).not.toContain('https://ds.example.com/');
    expect(frameSrc('https://ds.example.com/portal/x')).toContain('https://ds.example.com');
    expect(frameSrc('https://ds.example.com/portal/x')).not.toContain(
      'https://ds.example.com/portal/x'
    );
  });

  test('falls back rather than emitting an unparseable source', () => {
    // A malformed value must not become a CSP token that silently matches nothing.
    expect(frameSrc('not a url')).toContain('https://ds.yosemitecrew.com');
    expect(frameSrc('not a url')).not.toContain('not');
    expect(frameSrc('not a url')).not.toContain('url');
  });
});
