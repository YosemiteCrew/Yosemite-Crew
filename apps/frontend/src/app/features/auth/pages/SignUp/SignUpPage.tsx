'use client';

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';
import AuthedRedirectShell from '@/app/features/auth/pages/AuthedRedirectShell';

export default function SignUpPage() {
  return (
    <AuthedRedirectShell>
      <SignUp />
    </AuthedRedirectShell>
  );
}
