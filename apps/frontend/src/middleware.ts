import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicy, securityHeaders } from '@/securityHeaders';

const CSP_HEADER = 'Content-Security-Policy';
const NONCE_HEADER = 'x-nonce';

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
  '/developers/website-builder',
  '/finance',
  '/forms',
  '/guides',
  '/integrations',
  '/inventory',
  '/organization',
  '/organizations',
  '/settings',
  '/stripe-onboarding',
  '/tasks',
  '/team-onboarding',
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
