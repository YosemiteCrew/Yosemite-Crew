import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicy, securityHeaders } from '@/securityHeaders';

const CSP_HEADER = 'Content-Security-Policy';
const NONCE_HEADER = 'x-nonce';

// Only routes that are server-rendered on demand belong here: a nonce is minted
// per request, and a prerendered page's inline bootstrap scripts would not carry
// it. Every entry must be a route that opts out of static generation — the `(app)`
// routes via the group layout's `connection()`, the auth/payment routes below via
// their own `export const dynamic = 'force-dynamic'`.
const STRICT_CSP_PATH_PREFIXES = [
  '/appointments',
  '/book-onboarding',
  '/chat',
  '/companions',
  '/create-org',
  '/dashboard',
  '/developers/api-keys',
  '/developers/documentation',
  '/developers/home',
  '/developers/plugins',
  '/developers/settings',
  '/developers/signin',
  '/developers/signup',
  '/developers/website-builder',
  '/finance',
  '/forgot-password',
  '/forms',
  '/guides',
  '/integrations',
  '/inventory',
  '/organization',
  '/organizations',
  '/payment-status',
  '/reset-password',
  '/settings',
  '/signin',
  '/signup',
  '/stripe-onboarding',
  '/tasks',
  '/team-onboarding',
  '/verify-email',
];

const createNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCodePoint(...bytes));
};

const usesStrictContentSecurityPolicy = (pathname: string) =>
  STRICT_CSP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internal routes and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/fonts') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const usesStrictCsp = usesStrictContentSecurityPolicy(pathname);
  const nonce = usesStrictCsp ? createNonce() : undefined;
  const csp = buildContentSecurityPolicy({
    nonce,
    documensoHost: process.env.NEXT_PUBLIC_DOCUMENSO_HOST,
    allowInlineScripts: !usesStrictCsp,
  });
  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set(NONCE_HEADER, nonce);
  }
  requestHeaders.set(CSP_HEADER, csp);

  // Security headers on every document response.
  // Auth is handled client-side by ProtectedRoute + SessionInitializer —
  // sessions are httpOnly cookies scoped to the API domain (SuperTokens),
  // which this middleware (running on the web origin) cannot read, so route
  // protection cannot be done here.
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
