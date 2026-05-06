import { NextRequest, NextResponse } from 'next/server';

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

  // Security headers on every response.
  // Auth is handled client-side by ProtectedRoute + SessionInitializer —
  // amazon-cognito-identity-js stores tokens in localStorage which is not
  // accessible at the edge, so route protection cannot be done here.
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
