import type { Metadata } from 'next';
import ForgotPasswordPageWrapper from '@/app/features/auth/pages/ForgotPassword/ForgotPasswordPage';

export const metadata: Metadata = {
  title: 'Forgot Password — Yosemite Crew',
  description: 'Reset your Yosemite Crew account password.',
};

export default function Page() {
  return <ForgotPasswordPageWrapper />;
}
