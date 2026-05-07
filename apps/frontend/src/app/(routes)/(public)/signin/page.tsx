import type { Metadata } from 'next';
import SignInPage from '@/app/features/auth/pages/SignIn/SignInPage';

export const metadata: Metadata = {
  title: 'Sign In — Yosemite Crew',
  description: 'Sign in to your Yosemite Crew account.',
};

export default function Page() {
  return <SignInPage />;
}
