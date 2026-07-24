import type { Metadata } from 'next';
import SignUpPage from '@/app/features/auth/pages/SignUp/SignUpPage';

export const metadata: Metadata = {
  title: 'Sign Up — Yosemite Crew',
  description: 'Create your Yosemite Crew account and start managing your pet business.',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <SignUpPage />;
}
