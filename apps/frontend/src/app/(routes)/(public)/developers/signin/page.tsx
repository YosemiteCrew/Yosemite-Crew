import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import SignIn from '@/app/features/auth/pages/SignIn/SignIn';

export const metadata: Metadata = {
  title: 'Developer Sign In — Yosemite Crew',
  description: 'Sign in to your Yosemite Crew developer account.',
};

function Page() {
  return (
    <Suspense fallback={<div></div>}>
      <SignIn
        redirectPath="/developers/home"
        signupHref="/developers/signup"
        allowNext={false}
        isDeveloper
      />
    </Suspense>
  );
}

export default Page;
