import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicy, securityHeaders } from '@/securityHeaders';

const CSP_HEADER = 'Content-Security-Policy';
const NONCE_HEADER = 'x-nonce';

// Every route under (routes)/(app) belongs here — its layout awaits connection(),
// so the whole group renders per-request and always has a nonce.
// Routes under (routes)/(public) must NOT be added: they are statically
// prerendered, so their inline scripts carry no per-request nonce and a strict
// CSP would block them. Make such a route dynamic first, or leave it off.
// The credential/payment routes below opt out of static generation via their own
// `export const dynamic = 'force-dynamic'`, so they carry a per-request nonce too.
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
  '/public-booking-setup',
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
  // Matches the early-return list at the top of middleware(): those paths reached
  // the function only to be skipped, so every font, image, manifest and API call
  // paid an edge invocation to do nothing. Excluding them here means the
  // middleware is never entered for them. next.config.ts headers() already
  // applies the security headers to `/(.*)`, so nothing loses them by being
  // skipped here.
  //
  // The exclusion is a list of static prefixes plus an anchored extension list,
  // NOT a general "contains a dot" rule. Next appends its transport suffixes
  // (`.rsc`, `.segments/....segment.rsc`) AFTER this source when it compiles the
  // matcher, so a `[^?]*\.` lookahead also swallows those: `/dashboard.rsc` would
  // stop matching and that RSC request would lose its nonce CSP. Anchoring on
  // `$` with known asset extensions keeps the transport forms matchable.
  matcher: [
    String.raw`/((?!api|_next|fonts|images|assets|dev-docs|.*\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|css|js|map|json|txt|xml|webmanifest)$).*)`,
  ],
};
