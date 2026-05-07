import type { Metadata } from 'next';
import SignUpPage from '@/app/features/auth/pages/SignUp/SignUpPage';

export const metadata: Metadata = {
  title: 'Sign Up — Yosemite Crew',
  description: 'Create your Yosemite Crew account and start managing your pet business.',
};

export default function Page() {
  return <SignUpPage />;
}
