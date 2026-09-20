'use client';

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';
import AuthedRedirectShell from '@/app/features/auth/pages/AuthedRedirectShell';

type SignUpPageProps = {
  turnstileSiteKey?: string;
};

// `turnstileSiteKey` is only ever set by Storybook, so it can stand in the
// Storybook-only bot-verification stub `SignUp` already supports. The real
// `/signup` route renders `<SignUpPage />` with no props and keeps falling
// through to `SignUp`'s own `NEXT_PUBLIC_TURNSTILE_SITE_KEY` default.
export default function SignUpPage({ turnstileSiteKey }: Readonly<SignUpPageProps>) {
  return (
    <AuthedRedirectShell>
      <SignUp turnstileSiteKey={turnstileSiteKey} />
    </AuthedRedirectShell>
  );
}
