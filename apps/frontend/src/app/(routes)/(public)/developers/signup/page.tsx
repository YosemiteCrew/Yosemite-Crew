import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';

export const metadata: Metadata = {
  title: 'Developer Sign Up — Yosemite Crew',
  description: 'Create a developer account to build on the Yosemite Crew platform.',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

function Page() {
  return (
    <Suspense fallback={null}>
      <SignUp signinHref="/developers/signin" allowNext={false} isDeveloper />
    </Suspense>
  );
}

export default Page;
