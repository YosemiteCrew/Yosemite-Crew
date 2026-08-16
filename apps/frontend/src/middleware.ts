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

// Next requests the RSC payload for a route at a transport URL derived from the
// route: `/dashboard` becomes `/dashboard.rsc`, and a segment prefetch becomes
// `/dashboard.segments/_tree.segment.rsc`. Those are the same document as far as
// the CSP is concerned, so strip the suffix before matching the prefix list -
// otherwise `/dashboard.rsc` matches no prefix and the RSC response is served
// with the permissive inline-script CSP instead of the nonce one.
// Deliberately not a regex. `/(?:\.segments\/.*)?\.rsc$/` backtracks
// polynomially on a path with many repetitions of `.segments/`, and this runs at
// the edge on an attacker-supplied pathname for every request (CodeQL
// js/polynomial-redos). These three string operations are linear.
const RSC_SUFFIX = '.rsc';
const SEGMENTS_MARKER = '.segments/';

const toDocumentPath = (pathname: string) => {
  if (!pathname.endsWith(RSC_SUFFIX)) return pathname;

  const withoutSuffix = pathname.slice(0, -RSC_SUFFIX.length);
  const segmentsAt = withoutSuffix.indexOf(SEGMENTS_MARKER);
  return segmentsAt === -1 ? withoutSuffix : withoutSuffix.slice(0, segmentsAt);
};

const usesStrictContentSecurityPolicy = (pathname: string) => {
  const documentPath = toDocumentPath(pathname);
  return STRICT_CSP_PATH_PREFIXES.some(
    (prefix) => documentPath === prefix || documentPath.startsWith(`${prefix}/`)
  );
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // No static-asset guard here on purpose: `config.matcher` below is the single
  // place that decides what middleware runs for. A second filter in this body
  // used to skip any path containing a dot, which silently contradicted the
  // matcher - Next's transport requests (`/dashboard.rsc`) all contain one, so
  // they could never reach the nonce/CSP logic the matcher was letting them in
  // for.
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
  // The only place that decides whether middleware runs. Static assets used to
  // reach middleware() just to hit an early return, so every font, image,
  // manifest and API call paid an edge invocation to do nothing. next.config.ts
  // headers() already applies the security headers to `/(.*)`, so nothing loses
  // them by being skipped here.
  //
  // Two deliberate details:
  //
  // 1. Prefixes are bounded with `(?:/|$)`. Unbounded, `images` would also
  //    exclude a document route like `/images-foo`, whose 404 HTML would then be
  //    served with no CSP at all.
  // 2. Extensions are anchored on `$` and listed, rather than a general
  //    "contains a dot" rule. Next appends its transport suffixes (`.rsc`,
  //    `.segments/....segment.rsc`) AFTER this source when it compiles the
  //    matcher, so a `[^?]*\.` lookahead also swallows those: `/dashboard.rsc`
  //    would stop matching and that RSC request would lose its nonce CSP.
  //
  // The escaped `\\.` cannot become String.raw here, whatever Sonar's S7780
  // says: Next statically analyses this object at build time and a tagged
  // template is not a literal it can evaluate, so `next build` fails outright
  // with "can't recognize the exported `config` field". The rule is turned off
  // for this file in sonar-project.properties.
  matcher: [
    '/((?!(?:api|_next|fonts|images|assets|dev-docs|static)(?:/|$)|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|css|js|map|json|txt|xml|csv|yaml|html|webmanifest)$).*)',
  ],
};
