'use client';

import { useEffect, useState } from 'react';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';
import RedirectTo from '@/app/features/auth/components/RedirectTo';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

type PostAuthRedirectProps = {
  fallbackRole?: string | null;
};

const PostAuthRedirect = ({ fallbackRole }: PostAuthRedirectProps) => {
  const [route, setRoute] = useState<string | null>(null);

  // The destination depends on client-only session state (org/profile stores hydrated
  // from the authenticated session), so it cannot be resolved on the server. Resolve it
  // in an effect, then render RedirectTo, which calls `redirect()` during render: Next's
  // redirect boundary performs the replace, and nothing is ever rendered at the wrong route.
  useEffect(() => {
    let cancelled = false;
    resolvePostAuthRedirect({ fallbackRole })
      .then((nextRoute) => {
        if (!cancelled) setRoute(nextRoute);
      })
      .catch(() => {
        if (!cancelled) setRoute(resolveDefaultOpenScreenRoute(fallbackRole));
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackRole]);

  return route ? <RedirectTo route={route} /> : null;
};

export default PostAuthRedirect;
