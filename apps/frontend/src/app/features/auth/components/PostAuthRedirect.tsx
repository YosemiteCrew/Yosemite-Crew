'use client';

import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

type PostAuthRedirectProps = {
  fallbackRole?: string | null;
};

const PostAuthRedirect = ({ fallbackRole }: PostAuthRedirectProps) => {
  const [route, setRoute] = useState<string | null>(null);

  // The destination depends on client-only session state (org/profile stores hydrated
  // from the authenticated session), so it cannot be resolved on the server. Resolve it
  // in an effect, then hand the navigation to `redirect()` during render: Next's redirect
  // boundary performs the replace, and nothing is ever rendered at the wrong route.
  useEffect(() => {
    let cancelled = false;
    resolvePostAuthRedirect({ fallbackRole }).then((nextRoute) => {
      if (!cancelled) setRoute(nextRoute);
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackRole]);

  if (route) {
    redirect(route);
  }

  return null;
};

export default PostAuthRedirect;
