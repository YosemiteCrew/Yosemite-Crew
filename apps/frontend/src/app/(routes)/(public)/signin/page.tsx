import type { Metadata } from 'next';
import SignInPage from '@/app/features/auth/pages/SignIn/SignInPage';

export const metadata: Metadata = {
  title: 'Sign In — Yosemite Crew',
  description: 'Sign in to your Yosemite Crew account.',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <SignInPage />;
}
