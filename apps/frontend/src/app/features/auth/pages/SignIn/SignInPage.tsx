'use client';

import SignIn from '@/app/features/auth/pages/SignIn/SignIn';
import AuthedRedirectShell from '@/app/features/auth/pages/AuthedRedirectShell';

export default function SignInPage() {
  return (
    <AuthedRedirectShell>
      <SignIn />
    </AuthedRedirectShell>
  );
}
