import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import SignIn from '@/app/features/auth/pages/SignIn/SignIn';

// no-story: thin Next.js route wrapper; real content is SignIn, already storied (developer variant is a prop, exercised in SignIn.stories.tsx)
export const metadata: Metadata = {
  title: 'Developer Sign In — Yosemite Crew',
  description: 'Sign in to your Yosemite Crew developer account.',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

function Page() {
  return (
    <Suspense fallback={<div></div>}>
      <SignIn signupHref="/developers/signup" allowNext={false} isDeveloper />
    </Suspense>
  );
}

export default Page;
