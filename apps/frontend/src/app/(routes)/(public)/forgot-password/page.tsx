import type { Metadata } from 'next';
import ForgotPasswordPageWrapper from '@/app/features/auth/pages/ForgotPassword/ForgotPasswordPage';

export const metadata: Metadata = {
  title: 'Forgot Password — Yosemite Crew',
  description: 'Reset your Yosemite Crew account password.',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <ForgotPasswordPageWrapper />;
}
