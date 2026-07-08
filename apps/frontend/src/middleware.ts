import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicy, securityHeaders } from '@/securityHeaders';

const CSP_HEADER = 'Content-Security-Policy';
const NONCE_HEADER = 'x-nonce';

// Static asset file extensions. Requests for these are served as-is: they are
// not HTML documents, so they do not execute inline script and never need a
// per-request nonce. The `/dev-docs` surface carries its own strict CSP from
// next.config.ts, so it is skipped here to avoid emitting a second, conflicting
// policy.
const STATIC_ASSET_PATTERN =
  /\.(?:html?|css|js|mjs|map|json|txt|xml|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|ya?ml|pdf|wasm)$/i;

const isSkippablePath = (pathname: string): boolean =>
  pathname.startsWith('/_next') ||
  pathname.startsWith('/api') ||
  pathname.startsWith('/fonts') ||
  pathname.startsWith('/dev-docs') ||
  STATIC_ASSET_PATTERN.test(pathname);

const createNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCodePoint(...bytes));
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSkippablePath(pathname)) {
    return NextResponse.next();
  }

  // Every HTML document response gets a per-request nonce CSP with no
  // 'unsafe-inline' script source. There are no author-written inline scripts;
  // Next.js applies this nonce to its own framework scripts automatically
  // because the policy is also set on the forwarded request headers below.
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    documensoHost: process.env.NEXT_PUBLIC_DOCUMENSO_HOST,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);

  // Security headers on every document response.
  // Auth is handled client-side by ProtectedRoute + SessionInitializer —
  // amazon-cognito-identity-js stores tokens in localStorage which is not
  // accessible at the edge, so route protection cannot be done here.
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  for (const header of securityHeaders) {
    response.headers.set(header.key, header.value);
  }
  response.headers.set(CSP_HEADER, csp);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
