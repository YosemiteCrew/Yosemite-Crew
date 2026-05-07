import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';

export const metadata: Metadata = {
  title: 'Developer Sign Up — Yosemite Crew',
  description: 'Create a developer account to build on the Yosemite Crew platform.',
};

function Page() {
  return (
    <Suspense fallback={null}>
      <SignUp
        postAuthRedirect="/developers/home"
        signinHref="/developers/signin"
        allowNext={false}
        isDeveloper
      />
    </Suspense>
  );
}

export default Page;
